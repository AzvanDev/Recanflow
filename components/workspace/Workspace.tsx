"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CircleHelp, Clipboard, Map as MapIcon, Minimize2, Network, PanelLeft, Plus, Sparkles, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";

import { createWorkspace, deleteWorkspace, listWorkspaces, loadWorkspace, newId, saveWorkspace, switchWorkspace, type WorkspaceSummary } from "@/lib/workspace";
import { buildLineageContext, buildSelectionContext } from "@/lib/context";
import { layoutChildrenBelow, layoutChildOf, layoutBelowGroup, layoutNextSiblingBelow, viewportCenterPosition } from "@/lib/layout";
import { callAI } from "@/lib/ai-client";
import { fetchRelatedVideos } from "@/lib/youtube-client";
import type { ChatMessage, Confidence, DebateStance, FlowNode, FlowNodeData, NodeAction, NodeKind, ResearchItem } from "@/lib/types";
import { useHistory } from "@/lib/history";

import { QuestionNode } from "./nodes/QuestionNode";
import { AnswerNode } from "./nodes/AnswerNode";
import { BranchNode } from "./nodes/BranchNode";
import { ResearchNode } from "./nodes/ResearchNode";
import { FindingNode } from "./nodes/FindingNode";
import { InsightNode } from "./nodes/InsightNode";
import { NoteNode } from "./nodes/NoteNode";
import { TextNode } from "./nodes/TextNode";
import { DebateNode } from "./nodes/DebateNode";
import { ResultNode } from "./nodes/ResultNode";
import { ResearchBranchNode } from "./nodes/ResearchBranchNode";
import { TopLeftHeader, TopRightControls, ShareToast } from "./Header";
import { Toolbar, type Tool } from "./Toolbar";
import { EmptyState } from "./EmptyState";
import { AIResearchPanel, type PanelActions } from "./AIResearchPanel";
import { CommandPalette } from "./CommandPalette";
import { OnboardingModal, HelpModal } from "./Modals";
import { SelectionBar } from "./SelectionBar";
import { TextFormatBar } from "./TextFormatBar";
import { OpenResearchPortal } from "./OpenResearchPortal";

const nodeTypes = { question: QuestionNode, answer: AnswerNode, branch: BranchNode, research: ResearchNode, finding: FindingNode, insight: InsightNode, note: NoteNode, text: TextNode, debate: DebateNode, result: ResultNode, researchBranch: ResearchBranchNode };

function findAncestorOfKind(id: string, kind: NodeKind, nodes: FlowNode[], edges: Edge[]): FlowNode | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cursor = id;
  for (let i = 0; i < 8; i++) {
    const parentId = edges.find((e) => e.target === cursor)?.source;
    if (!parentId) return undefined;
    const parent = byId.get(parentId);
    if (parent?.data.kind === kind) return parent;
    cursor = parentId;
  }
  return undefined;
}

// Walks all the way up to the topmost Question in the chain (a nested branch can be many
// Question→Answer hops deep) so secondary lookups like the YouTube query can disambiguate
// generic terms against the overall research topic, not just the immediate follow-up text.
function findRootQuestion(id: string, nodes: FlowNode[], edges: Edge[]): FlowNode | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cursor = id;
  let root = byId.get(id);
  for (let i = 0; i < 20; i++) {
    const parentId = edges.find((e) => e.target === cursor)?.source;
    if (!parentId) break;
    const parent = byId.get(parentId);
    if (!parent) break;
    if (parent.data.kind === "question") root = parent;
    cursor = parentId;
  }
  return root;
}

function summarize(text: string, max = 70) {
  const clean = text.trim().replace(/\s+/g, " ");
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  return firstSentence.length > max ? `${firstSentence.slice(0, max - 1)}…` : firstSentence;
}

export function Workspace() {
  const [loaded] = useState(() => (typeof window !== "undefined" ? loadWorkspace() : null));
  const [workspaceId, setWorkspaceId] = useState(() => loaded?.id || newId("workspace"));
  const [workspaceName, setWorkspaceName] = useState(loaded?.name || "Untitled workspace");
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>(() => (typeof window !== "undefined" ? listWorkspaces() : []));
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(loaded?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(loaded?.edges || []);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const lastSelectionRef = useRef<string[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const [tool, setTool] = useState<Tool>("select");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<FlowNode> | null>(null);
  const [zoom, setZoom] = useState(100);
  const [sidebar, setSidebar] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const [search, setSearch] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [shareNotice, setShareNotice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [openResearchAnswerId, setOpenResearchAnswerId] = useState<string | null>(null);
  const [openResearchQuery, setOpenResearchQuery] = useState("");
  const [focusedIds, setFocusedIds] = useState<Set<string> | null>(null);

  const { undo, redo, canUndo, canRedo } = useHistory(nodes, edges, setNodes, setEdges);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("recan-onboarded")) setOnboarding(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveWorkspace({ version: 2, id: workspaceId, name: workspaceName, nodes, edges, updatedAt: new Date().toISOString() });
      setWorkspaces(listWorkspaces());
    }, 500);
    return () => clearTimeout(timer);
  }, [nodes, edges, workspaceId, workspaceName]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Selection lives on node.selected (the same field XYFlow's own onNodesChange updates for
  // user clicks) rather than in separate state, so programmatic selection and click-driven
  // selection never fight each other.
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selection = useMemo(() => selectedNodes.map((n) => n.id), [selectedNodes]);
  const canSaveFinding = selectedNodes.length === 1 && selectedNodes[0].data.kind === "research" && (selectedNodes[0].data.messages || []).some((m) => m.role === "assistant");
  const canSynthesize = selectedNodes.length >= 2 && selectedNodes.every((n) => n.data.kind === "finding");
  const selectedText = selectedNodes.length === 1 && selectedNodes[0].data.kind === "text" ? selectedNodes[0] : null;

  // -- low-level mutation helpers, kept in sync with refs so chained calls within one handler never read stale state --
  const pushNodes = useCallback((newNodes: FlowNode[], newEdges: Edge[] = []) => {
    setNodes((prev) => [...prev, ...newNodes]);
    nodesRef.current = [...nodesRef.current, ...newNodes];
    if (newEdges.length) {
      setEdges((prev) => [...prev, ...newEdges]);
      edgesRef.current = [...edgesRef.current, ...newEdges];
    }
  }, [setNodes, setEdges]);

  const patchNode = useCallback((id: string, patch: Partial<FlowNodeData> | ((data: FlowNodeData) => Partial<FlowNodeData>)) => {
    const apply = (n: FlowNode) => (n.id === id ? { ...n, data: { ...n.data, ...(typeof patch === "function" ? patch(n.data) : patch) } } : n);
    setNodes((prev) => prev.map(apply));
    nodesRef.current = nodesRef.current.map(apply);
  }, [setNodes]);

  // Selects exactly these node ids by writing node.selected directly, the same field XYFlow
  // itself updates on a user click — keeps programmatic and click-driven selection consistent.
  const selectOnly = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    const apply = (n: FlowNode) => ({ ...n, selected: idSet.has(n.id) });
    setNodes((prev) => prev.map(apply));
    nodesRef.current = nodesRef.current.map(apply);
    if (ids.length) setPanelOpen(true);
  }, [setNodes]);

  // Centers the viewport on exactly this branch (parent + newly created node(s)) instead of
  // re-fitting the whole graph, and quietly dims everything outside it so the branch the user
  // just acted on stays legible as the canvas grows. Positions are never touched — this only
  // moves the camera and toggles a render-only opacity flag.
  const focusOn = useCallback((ids: string[]) => {
    window.setTimeout(() => flow?.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.35, duration: 400, maxZoom: 1.1 }), 60);
    setFocusedIds(new Set(ids));
  }, [flow]);

  const exitFocus = useCallback(() => setFocusedIds(null), []);

  // -- node creation --
  const addQuestion = useCallback((position?: { x: number; y: number }, title = "") => {
    const id = newId("question");
    const pos = position || viewportCenterPosition(flow, "question");
    pushNodes([{ id, type: "question", position: pos, data: { kind: "question", title, status: "idle" } }]);
    selectOnly([id]);
    setFocusNodeId(id);
    return id;
  }, [flow, pushNodes, selectOnly]);

  const addNote = useCallback((position?: { x: number; y: number }) => {
    const id = newId("note");
    const pos = position || viewportCenterPosition(flow, "note");
    pushNodes([{ id, type: "note", position: pos, data: { kind: "note", title: "Note", content: "" } }]);
    selectOnly([id]);
    setFocusNodeId(id);
  }, [flow, pushNodes, selectOnly]);

  const addText = useCallback((position?: { x: number; y: number }) => {
    const id = newId("text");
    const pos = position || viewportCenterPosition(flow, "text");
    pushNodes([{ id, type: "text", position: pos, data: { kind: "text", title: "", content: "" } }]);
    selectOnly([id]);
    setFocusNodeId(id);
  }, [flow, pushNodes, selectOnly]);

  // -- AI-backed actions --
  // Fetches once per node (research or answer) and caches on it (videosFetched) so repeat
  // visits never re-query — real YouTube Data API results only, resolves to [] (never an
  // error) if unavailable.
  const fetchVideosFor = useCallback(async (nodeId: string, topic: string, context?: string) => {
    const videos = await fetchRelatedVideos(topic, context);
    patchNode(nodeId, { videos, videosFetched: true });
  }, [patchNode]);

  // Generates (or regenerates, on retry) the single Answer connected below a Question, with
  // real Tavily sources attached to that same Answer (never shown until "Sources >" is
  // clicked) and a YouTube lookup kicked off right after. The suggested follow-ups ride along
  // as data on the Answer node itself — they are never their own canvas nodes until the user
  // clicks one, at which point addFollowUp turns that click into a real, connected,
  // auto-explored child Question with its own independent sources and videos.
  const explore = useCallback(async (questionId: string) => {
    const question = nodesRef.current.find((n) => n.id === questionId);
    if (!question || !question.data.title.trim()) return;
    patchNode(questionId, { status: "loading", error: undefined });
    try {
      const { answer, branches, sources } = await callAI({ action: "decompose", question: question.data.title });
      const suggestions = branches.map((b) => ({ title: b.title, description: b.description }));
      const existingAnswerEdge = edgesRef.current.find(
        (e) => e.source === questionId && nodesRef.current.find((n) => n.id === e.target)?.data.kind === "answer",
      );
      const answerId = existingAnswerEdge ? existingAnswerEdge.target : newId("answer");
      if (existingAnswerEdge) {
        patchNode(answerId, { content: answer, suggestions, sources, status: "idle" });
      } else {
        const parent = nodesRef.current.find((n) => n.id === questionId)!;
        const pos = layoutChildOf(nodesRef.current, parent, "answer");
        pushNodes(
          [{ id: answerId, type: "answer", position: pos, data: { kind: "answer", title: "Answer", content: answer, suggestions, sources, status: "idle" } }],
          [{ id: `e-${questionId}-${answerId}`, source: questionId, target: answerId, type: "smoothstep" }],
        );
      }
      patchNode(questionId, { status: "idle", answer });
      const rootQuestion = findRootQuestion(questionId, nodesRef.current, edgesRef.current);
      fetchVideosFor(answerId, question.data.title, rootQuestion?.data.title);
      if (!existingAnswerEdge) focusOn([questionId, answerId]);
    } catch (err) {
      patchNode(questionId, { status: "error", error: err instanceof Error ? err.message : "Could not generate an answer." });
    }
  }, [patchNode, pushNodes, focusOn, fetchVideosFor]);

  // Turns a click — on a suggestion chip or the Answer's "+" composer — into a new child
  // Question connected to that Answer, then immediately explores it, so suggested and
  // manually-typed follow-ups behave identically once created. Multiple children can come
  // from the same Answer; each new one fans out beside its earlier siblings instead of
  // replacing them.
  const addFollowUp = useCallback((answerId: string, title: string) => {
    if (!title.trim()) return;
    const parent = nodesRef.current.find((n) => n.id === answerId);
    if (!parent) return;
    const siblingIndex = edgesRef.current.filter((e) => e.source === answerId).length;
    const pos = layoutNextSiblingBelow(nodesRef.current, parent, "question", siblingIndex);
    const id = newId("question");
    pushNodes(
      [{ id, type: "question", position: pos, data: { kind: "question", title: title.trim(), status: "idle" } }],
      [{ id: `e-${answerId}-${id}`, source: answerId, target: id, type: "smoothstep" }],
    );
    focusOn([answerId, id]);
    explore(id);
  }, [pushNodes, focusOn, explore]);

  const openResearch = useCallback((id: string) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    if (node.data.kind === "research") {
      selectOnly([id]);
      return;
    }
    if (node.data.kind !== "branch") return;
    const existingEdge = edgesRef.current.find((e) => e.source === id && nodesRef.current.find((n) => n.id === e.target)?.data.kind === "research");
    if (existingEdge) {
      selectOnly([existingEdge.target]);
      return;
    }
    const question = findAncestorOfKind(id, "question", nodesRef.current, edgesRef.current);
    const researchId = newId("research");
    const pos = layoutChildOf(nodesRef.current, node, "research");
    pushNodes(
      [
        {
          id: researchId,
          type: "research",
          position: pos,
          data: {
            kind: "research",
            title: node.data.title,
            description: node.data.description,
            status: "idle",
            messages: [],
            findingIds: [],
            provenance: { branchId: id, branchTitle: node.data.title, questionId: question?.id, questionTitle: question?.data.title },
          },
        },
      ],
      [{ id: `e-${id}-${researchId}`, source: id, target: researchId, type: "smoothstep" }],
    );
    selectOnly([researchId]);
    fetchVideosFor(researchId, node.data.title, question?.data.title);
  }, [pushNodes, selectOnly, fetchVideosFor]);

  const sendChat = useCallback(async (researchId: string, message: string) => {
    const research = nodesRef.current.find((n) => n.id === researchId);
    if (!research) return;
    const history: ChatMessage[] = research.data.messages || [];
    const context = buildLineageContext(researchId, nodesRef.current, edgesRef.current);
    const userMessage: ChatMessage = { id: newId("msg"), role: "user", content: message };
    patchNode(researchId, (d) => ({ status: "loading", error: undefined, messages: [...(d.messages || []), userMessage] }));
    try {
      const { reply, researched, sources } = await callAI({ action: "chat", topic: research.data.title, context, history, message });
      patchNode(researchId, (d) => ({ status: "idle", messages: [...(d.messages || []), { id: newId("msg"), role: "assistant", content: reply, researched, sources }] }));
    } catch (err) {
      patchNode(researchId, { status: "error", error: err instanceof Error ? err.message : "The research assistant is unavailable." });
    }
  }, [patchNode]);

  const saveFinding = useCallback((researchId: string, content: string) => {
    const research = nodesRef.current.find((n) => n.id === researchId);
    if (!research) return;
    const findingId = newId("finding");
    const pos = layoutChildOf(nodesRef.current, research, "finding");
    pushNodes(
      [{ id: findingId, type: "finding", position: pos, data: { kind: "finding", title: summarize(content), content, provenance: research.data.provenance ? { ...research.data.provenance, researchId } : { researchId } } }],
      [{ id: `e-${researchId}-${findingId}`, source: researchId, target: findingId, type: "smoothstep" }],
    );
    patchNode(researchId, (d) => ({ findingIds: [...(d.findingIds || []), findingId] }));
    setToast("Finding added to canvas");
  }, [pushNodes, patchNode]);

  const synthesize = useCallback(async (findingIds: string[]) => {
    const findings = nodesRef.current.filter((n) => findingIds.includes(n.id));
    if (findings.length < 2) return;
    setSynthesizing(true);
    try {
      const context = buildLineageContext(findings[0].id, nodesRef.current, edgesRef.current);
      const result = await callAI({ action: "synthesize", context, findings: findings.map((f) => ({ title: f.data.title, content: f.data.content || "" })) });
      const pos = layoutBelowGroup(nodesRef.current, findings, "insight");
      const insightId = newId("insight");
      pushNodes(
        [{ id: insightId, type: "insight", position: pos, data: { kind: "insight", title: result.title, description: result.summary, keyPoints: result.keyPoints, supportingEvidence: result.supportingEvidence, confidence: result.confidence as Confidence, findingIds, status: "idle" } }],
        findingIds.map((fid) => ({ id: `e-${fid}-${insightId}`, source: fid, target: insightId, type: "smoothstep" })),
      );
      selectOnly([insightId]);
      focusOn([...findingIds, insightId]);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not synthesize these findings.");
    } finally {
      setSynthesizing(false);
    }
  }, [pushNodes, focusOn, selectOnly]);

  const challenge = useCallback(async (insightId: string) => {
    const insight = nodesRef.current.find((n) => n.id === insightId);
    if (!insight) return;
    patchNode(insightId, { status: "loading", error: undefined });
    try {
      const result = await callAI({ action: "challenge", insightTitle: insight.data.title, insightSummary: insight.data.description || "", keyPoints: insight.data.keyPoints || [] });
      patchNode(insightId, { status: "idle", challenge: result });
    } catch (err) {
      patchNode(insightId, { status: "error", error: err instanceof Error ? err.message : "Could not challenge this insight." });
    }
  }, [patchNode]);

  // Creates a new connected Question node from any parent — reused for "create question from
  // challenge" and for turning a debate's unresolved question into real research.
  const createConnectedQuestion = useCallback((parentId: string, title: string) => {
    const parent = nodesRef.current.find((n) => n.id === parentId);
    if (!parent) return;
    const id = newId("question");
    const pos = layoutChildOf(nodesRef.current, parent, "question");
    pushNodes([{ id, type: "question", position: pos, data: { kind: "question", title, status: "idle" } }], [{ id: `e-${parentId}-${id}`, source: parentId, target: id, type: "smoothstep" }]);
    selectOnly([id]);
    setFocusNodeId(id);
    focusOn([parentId, id]);
  }, [pushNodes, focusOn, selectOnly]);

  const createQuestionFromChallenge = useCallback((insightId: string) => {
    const insight = nodesRef.current.find((n) => n.id === insightId);
    if (!insight?.data.challenge) return;
    createConnectedQuestion(insightId, insight.data.challenge.suggestedQuestion);
  }, [createConnectedQuestion]);

  // -- debate --
  const startDebate = useCallback((sourceId: string) => {
    const source = nodesRef.current.find((n) => n.id === sourceId);
    if (!source) return;
    const existingEdge = edgesRef.current.find((e) => e.source === sourceId && nodesRef.current.find((n) => n.id === e.target)?.data.kind === "debate");
    if (existingEdge) {
      selectOnly([existingEdge.target]);
      return;
    }
    const grounding = source.data.kind === "insight" ? source.data.description : source.data.kind === "finding" ? source.data.content : source.data.description;
    const id = newId("debate");
    const pos = layoutChildOf(nodesRef.current, source, "debate");
    pushNodes(
      [{ id, type: "debate", position: pos, data: { kind: "debate", title: source.data.title, description: grounding || "", messages: [], status: "idle" } }],
      [{ id: `e-${sourceId}-${id}`, source: sourceId, target: id, type: "smoothstep" }],
    );
    selectOnly([id]);
    focusOn([sourceId, id]);
  }, [pushNodes, selectOnly, focusOn]);

  const sendDebateTurn = useCallback(async (debateId: string, stance: DebateStance, apiMessage: string, visibleUserMessage?: string) => {
    const debate = nodesRef.current.find((n) => n.id === debateId);
    if (!debate) return;
    const history: ChatMessage[] = debate.data.messages || [];
    const sourcesBlock = debate.data.sources?.length
      ? `\n\nAvailable sources (you may reference these if relevant; never invent others):\n${debate.data.sources.map((s) => `- ${s.title} (${s.domain}): ${s.snippet}`).join("\n")}`
      : "";
    const context = `${buildLineageContext(debateId, nodesRef.current, edgesRef.current)}${debate.data.description ? `\n\n${debate.data.description}` : ""}${sourcesBlock}`;
    const userMsg: ChatMessage | null = visibleUserMessage ? { id: newId("msg"), role: "user", content: visibleUserMessage } : null;
    patchNode(debateId, (d) => ({ status: "loading", error: undefined, messages: userMsg ? [...(d.messages || []), userMsg] : d.messages || [] }));
    try {
      const { reply } = await callAI({ action: "debate", topic: debate.data.title, context, history, message: apiMessage, stance });
      patchNode(debateId, (d) => ({ status: "idle", messages: [...(d.messages || []), { id: newId("msg"), role: "assistant", content: reply, stance }] }));
    } catch (err) {
      patchNode(debateId, { status: "error", error: err instanceof Error ? err.message : "The debate assistant is unavailable." });
    }
  }, [patchNode]);

  const argueDebate = useCallback((debateId: string, stance: "for" | "against" | "balanced") => {
    const prompt =
      stance === "for" ? "Argue in favor of this position." : stance === "against" ? "Argue against this position." : "Give a balanced take, weighing both sides honestly.";
    sendDebateTurn(debateId, stance, prompt);
  }, [sendDebateTurn]);

  // Debate entry point from the Answer panel: the user picks a position up front, so this
  // creates the (single) Debate node connected to that Answer and immediately kicks off the
  // opening argument via argueDebate — reusing the same turn-taking logic as every other debate
  // entry point. Any real Sources already attached to the Answer ride along as grounding the AI
  // may cite, never fabricate.
  const startAnswerDebate = useCallback((answerId: string, stance: "for" | "against") => {
    const answer = nodesRef.current.find((n) => n.id === answerId);
    if (!answer) return;
    const existingEdge = edgesRef.current.find((e) => e.source === answerId && nodesRef.current.find((n) => n.id === e.target)?.data.kind === "debate");
    if (existingEdge) {
      selectOnly([existingEdge.target]);
      return;
    }
    const question = findAncestorOfKind(answerId, "question", nodesRef.current, edgesRef.current);
    const id = newId("debate");
    const pos = layoutChildOf(nodesRef.current, answer, "debate");
    pushNodes(
      [{ id, type: "debate", position: pos, data: { kind: "debate", title: question?.data.title || "Debate", messages: [], status: "idle", sources: answer.data.sources } }],
      [{ id: `e-${answerId}-${id}`, source: answerId, target: id, type: "smoothstep" }],
    );
    selectOnly([id]);
    focusOn([answerId, id]);
    argueDebate(id, stance);
  }, [pushNodes, selectOnly, focusOn, argueDebate]);

  const respondDebate = useCallback((debateId: string, text: string) => {
    const debate = nodesRef.current.find((n) => n.id === debateId);
    const hasUserSpoken = (debate?.data.messages || []).some((m) => m.role === "user");
    sendDebateTurn(debateId, hasUserSpoken ? "respond" : "challenge", text, text);
  }, [sendDebateTurn]);

  const getCruxes = useCallback(async (debateId: string) => {
    const debate = nodesRef.current.find((n) => n.id === debateId);
    if (!debate) return;
    patchNode(debateId, { status: "loading", error: undefined });
    try {
      const context = `${buildLineageContext(debateId, nodesRef.current, edgesRef.current)}${debate.data.description ? `\n\n${debate.data.description}` : ""}`;
      const { cruxes } = await callAI({ action: "debateCruxes", topic: debate.data.title, context });
      const parent = nodesRef.current.find((n) => n.id === debateId)!;
      const positions = layoutChildrenBelow(nodesRef.current, parent, "branch", cruxes.length);
      const ids = cruxes.map(() => newId("branch"));
      const newNodes: FlowNode[] = cruxes.map((c, i) => ({ id: ids[i], type: "branch", position: positions[i], data: { kind: "branch", title: c.title, description: c.description } }));
      const newEdges: Edge[] = ids.map((bid) => ({ id: `e-${debateId}-${bid}`, source: debateId, target: bid, type: "smoothstep" }));
      pushNodes(newNodes, newEdges);
      patchNode(debateId, { status: "idle" });
      focusOn([debateId, ...ids]);
    } catch (err) {
      patchNode(debateId, { status: "error", error: err instanceof Error ? err.message : "Could not find what would change your mind." });
    }
  }, [patchNode, pushNodes, focusOn]);

  const summarizeDebate = useCallback(async (debateId: string) => {
    const debate = nodesRef.current.find((n) => n.id === debateId);
    if (!debate || !(debate.data.messages || []).length) return;
    patchNode(debateId, { status: "loading", error: undefined });
    try {
      const summary = await callAI({ action: "debateSummarize", topic: debate.data.title, history: debate.data.messages || [] });
      patchNode(debateId, { status: "idle", debateSummary: summary });
    } catch (err) {
      patchNode(debateId, { status: "error", error: err instanceof Error ? err.message : "Could not summarize this debate." });
    }
  }, [patchNode]);

  const exploreUnresolved = useCallback((debateId: string, question: string) => {
    createConnectedQuestion(debateId, question);
  }, [createConnectedQuestion]);

  // Select + Ask AI / Summarize: scopes the AI call strictly to the currently-selected nodes'
  // content (never the whole graph), then drops the answer as a new Result node connected to
  // every selected node. No node is created if the request fails.
  const runSelectionAI = useCallback(async (question?: string) => {
    const selected = nodesRef.current.filter((n) => n.selected);
    if (selected.length < 2) return;
    setSelectionBusy(true);
    try {
      const context = buildSelectionContext(selected);
      const { reply } = question
        ? await callAI({ action: "selectionAsk", context, question })
        : await callAI({ action: "selectionSummarize", context });
      const resultId = newId("result");
      const pos = layoutBelowGroup(nodesRef.current, selected, "result");
      pushNodes(
        [{ id: resultId, type: "result", position: pos, data: { kind: "result", title: question || "Summary", content: reply } }],
        selected.map((n) => ({ id: `e-${n.id}-${resultId}`, source: n.id, target: resultId, type: "smoothstep" })),
      );
      selectOnly([resultId]);
      focusOn([...selected.map((n) => n.id), resultId]);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not generate a result for this selection.");
    } finally {
      setSelectionBusy(false);
    }
  }, [pushNodes, selectOnly, focusOn]);

  const selectNode = useCallback((id: string) => {
    selectOnly([id]);
    flow?.fitView({ nodes: [{ id }], padding: 0.5, duration: 300, maxZoom: 1 });
  }, [flow, selectOnly]);

  // -- Open Research portal --
  // Opens scoped to one Answer: the portal starts its search from that Answer's own Question
  // (never the whole workspace), and anything the user adds connects back to that same Answer.
  const openOpenResearch = useCallback((answerId: string) => {
    const question = findAncestorOfKind(answerId, "question", nodesRef.current, edgesRef.current);
    setOpenResearchQuery(question?.data.title || "");
    setOpenResearchAnswerId(answerId);
    setPanelOpen(true);
    focusOn([answerId]);
  }, [focusOn]);

  const closeOpenResearch = useCallback(() => setOpenResearchAnswerId(null), []);

  // Adds one research item (a real search result or an identified upload) to the single
  // Research Branch connected to this Answer — creating that branch on the first add, and
  // simply appending to it on every add after, so multiple items never spawn multiple nodes.
  const addResearchItem = useCallback((answerId: string, item: ResearchItem) => {
    const answer = nodesRef.current.find((n) => n.id === answerId);
    if (!answer) return;
    const existingEdge = edgesRef.current.find(
      (e) => e.source === answerId && nodesRef.current.find((n) => n.id === e.target)?.data.kind === "researchBranch",
    );
    if (existingEdge) {
      patchNode(existingEdge.target, (d) => {
        const items = d.researchItems || [];
        if (items.some((existing) => existing.id === item.id)) return {};
        return { researchItems: [...items, item] };
      });
      setToast("Added to research branch");
      return;
    }
    const id = newId("researchBranch");
    const pos = layoutChildOf(nodesRef.current, answer, "researchBranch");
    pushNodes(
      [{ id, type: "researchBranch", position: pos, data: { kind: "researchBranch", title: "Research", researchItems: [item] } }],
      [{ id: `e-${answerId}-${id}`, source: answerId, target: id, type: "smoothstep" }],
    );
    setToast("Research branch created");
  }, [pushNodes, patchNode]);

  const handleAction = useCallback((action: NodeAction, id: string, payload?: unknown) => {
    if (action === "editTitle") patchNode(id, { title: String(payload ?? "") });
    else if (action === "editContent") patchNode(id, { content: String(payload ?? "") });
    else if (action === "explore" || action === "retryExplore") explore(id);
    else if (action === "openResearch" || action === "openBranch") openResearch(id);
    else if (action === "challenge") challenge(id);
    else if (action === "createQuestionFromChallenge") createQuestionFromChallenge(id);
    else if (action === "openDebate") selectOnly([id]);
    else if (action === "addFollowUp") addFollowUp(id, String(payload ?? ""));
    else if (action === "respondDebate") respondDebate(id, String(payload ?? ""));
    else if (action === "formatText") patchNode(id, (payload as Partial<FlowNodeData>) || {});
    else if (action === "resizeText") patchNode(id, { width: Number(payload) });
    else if (action === "selectSuggestion") {
      const idx = typeof payload === "number" ? payload : -1;
      const suggestion = nodesRef.current.find((n) => n.id === id)?.data.suggestions?.[idx];
      if (suggestion) addFollowUp(id, suggestion.title);
    }
  }, [patchNode, explore, openResearch, challenge, createQuestionFromChallenge, selectOnly, addFollowUp, respondDebate]);

  const panelActions: PanelActions = useMemo(() => ({
    explore,
    openResearch,
    sendChat,
    saveFinding,
    synthesize,
    challenge,
    createQuestionFromChallenge,
    addFollowUp,
    startDebate,
    startAnswerDebate,
    argueDebate,
    respondDebate,
    getCruxes,
    summarizeDebate,
    exploreUnresolved,
    selectNode,
    openOpenResearch,
    startQuestion: () => addQuestion(),
  }), [explore, openResearch, sendChat, saveFinding, synthesize, challenge, createQuestionFromChallenge, addFollowUp, startDebate, startAnswerDebate, argueDebate, respondDebate, getCruxes, summarizeDebate, exploreUnresolved, selectNode, openOpenResearch, addQuestion]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((es) => addEdge({ ...connection, type: "smoothstep" }, es));
  }, [setEdges]);

  const hasDeletableSelection = selection.length > 0 || edges.some((e) => e.selected);

  const deleteSelected = useCallback(() => {
    setNodes((ns) => ns.filter((n) => !n.selected));
    setEdges((es) => es.filter((e) => !e.selected && !selection.includes(e.source) && !selection.includes(e.target)));
  }, [selection, setNodes, setEdges]);

  const loadWorkspaceIntoState = (w: { id: string; name: string; nodes: FlowNode[]; edges: Edge[] }) => {
    setWorkspaceId(w.id);
    setWorkspaceName(w.name);
    setNodes(w.nodes);
    setEdges(w.edges);
    selectOnly([]);
    setPanelOpen(false);
  };

  const handleCreateWorkspace = () => {
    const w = createWorkspace();
    setWorkspaces(listWorkspaces());
    loadWorkspaceIntoState(w);
    setSidebar(false);
  };

  const handleSwitchWorkspace = (id: string) => {
    if (id === workspaceId) {
      setSidebar(false);
      return;
    }
    const w = switchWorkspace(id);
    if (w) loadWorkspaceIntoState(w);
    setSidebar(false);
  };

  const handleDeleteWorkspace = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const wasActive = id === workspaceId;
    const next = deleteWorkspace(id);
    setWorkspaces(listWorkspaces());
    if (wasActive) loadWorkspaceIntoState(next);
  };

  const shareWorkspace = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // clipboard access may be blocked by the browser; the notice still confirms the intent
    }
    setShareNotice(true);
    window.setTimeout(() => setShareNotice(false), 2200);
  };

  const runSaveFinding = () => {
    if (!canSaveFinding) return;
    const research = selectedNodes[0];
    const last = [...(research.data.messages || [])].reverse().find((m) => m.role === "assistant");
    if (last) saveFinding(research.id, last.content);
  };

  const runSynthesize = () => {
    if (canSynthesize) synthesize(selectedNodes.map((n) => n.id));
    else setToast("Select at least 2 findings to create an insight.");
  };

  // Toolbar's "New research" now opens the same Open Research portal as the Answer panel's
  // button, scoped to whichever Answer is reachable from the current selection — it no longer
  // creates a standalone legacy research-chat node.
  const runResearchTool = () => {
    if (selectedNodes.length === 1) {
      const node = selectedNodes[0];
      if (node.data.kind === "answer") {
        openOpenResearch(node.id);
        return;
      }
      if (node.data.kind === "question") {
        const answer = edgesRef.current
          .filter((e) => e.source === node.id)
          .map((e) => nodesRef.current.find((n) => n.id === e.target))
          .find((n): n is FlowNode => !!n && n.data.kind === "answer");
        if (answer) {
          openOpenResearch(answer.id);
        } else {
          setToast("Explore this question first, then open research for its answer.");
        }
        return;
      }
    }
    setToast("Select a Question or its Answer to open research for it.");
  };

  // -- keyboard shortcuts --
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable;
      if (e.code === "Space" && !typing) setSpaceHeld(true);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;
      if (e.key === "Escape") {
        setSearch(false);
        setHelpOpen(false);
        selectOnly([]);
        exitFocus();
      } else if ((e.key === "Delete" || e.key === "Backspace") && hasDeletableSelection) {
        deleteSelected();
      } else if (e.key.toLowerCase() === "v") setTool("select");
      else if (e.key.toLowerCase() === "h") setTool("hand");
      else if (e.key.toLowerCase() === "t") setTool("text");
      else if (e.key.toLowerCase() === "q") addQuestion();
      else if (e.key.toLowerCase() === "n") addNote();
      else if (e.key.toLowerCase() === "r") runResearchTool();
      else if (e.key.toLowerCase() === "f") runSaveFinding();
      else if (e.key.toLowerCase() === "i") runSynthesize();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceHeld(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  const renderNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, onAction: handleAction, autoFocus: n.id === focusNodeId, dimmed: focusedIds ? !focusedIds.has(n.id) : false } })),
    [nodes, handleAction, focusNodeId, focusedIds],
  );

  const effectiveTool: Tool = spaceHeld ? "hand" : tool;

  return (
    <main className={`workspace ${effectiveTool === "text" ? "tool-text" : ""}`}>
      <ReactFlow<FlowNode>
        nodes={renderNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setFlow}
        onMove={(_, viewport) => setZoom(Math.round(viewport.zoom * 100))}
        onPaneClick={(event) => {
          if (effectiveTool !== "text" || !flow) return;
          const pos = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
          addText(pos);
          setTool("select");
        }}
        onSelectionChange={({ nodes: ns }) => {
          const next = ns.map((n) => n.id);
          const prev = lastSelectionRef.current;
          const changed = next.length !== prev.length || next.some((id, i) => id !== prev[i]);
          lastSelectionRef.current = next;
          if (changed && next.length) {
            setPanelOpen(true);
            setOpenResearchAnswerId(null);
          }
        }}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        selectionOnDrag={effectiveTool === "select"}
        panOnDrag={effectiveTool === "hand" || spaceHeld}
        multiSelectionKeyCode="Shift"
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background gap={22} size={1} color="#e9e7ef" />
        {minimapOpen && <MiniMap pannable zoomable className="minimap" />}
        <Controls showInteractive={false} className="flow-controls" />
      </ReactFlow>

      {nodes.length === 0 && <EmptyState onStart={(question) => { const id = addQuestion(undefined, question); explore(id); }} />}

      {minimapOpen ? (
        <button className="minimap-close floating" aria-label="Hide minimap" title="Hide minimap" onClick={() => setMinimapOpen(false)}>
          <X size={11} />
        </button>
      ) : (
        <button className="minimap-reopen floating" aria-label="Show minimap" title="Show minimap" onClick={() => setMinimapOpen(true)}>
          <MapIcon size={16} />
        </button>
      )}

      {focusedIds && (
        <button className="exit-focus floating" onClick={exitFocus}>
          <Minimize2 size={13} /> Exit focus
        </button>
      )}

      <TopLeftHeader workspaceName={workspaceName} onRename={setWorkspaceName} onToggleSidebar={() => setSidebar((v) => !v)} />
      <TopRightControls onOpenPanel={() => setPanelOpen(true)} onShare={shareWorkspace} />
      <button className="nav-toggle floating" onClick={() => setSidebar((v) => !v)} aria-label="Toggle navigation">
        <PanelLeft size={18} />
      </button>

      {sidebar && (
        <aside className="sidebar floating">
          <div className="side-title">Your research</div>
          <div className="workspace-list">
            {workspaces.map((w) => (
              <div key={w.id} className={`workspace-row ${w.id === workspaceId ? "side-active" : ""}`}>
                <button className="workspace-row-main" onClick={() => handleSwitchWorkspace(w.id)}>
                  <Network size={16} /> <span>{w.name}</span>
                </button>
                {workspaces.length > 1 && (
                  <button className="workspace-row-delete" aria-label={`Delete ${w.name}`} title="Delete workspace" onClick={() => handleDeleteWorkspace(w.id, w.name)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => { setSidebar(false); setSearch(true); }}>
            <Clipboard size={16} /> Find a node
          </button>
          <button onClick={() => { setSidebar(false); setOnboarding(true); }}>
            <Sparkles size={16} /> Getting started
          </button>
          <button onClick={() => setHelpOpen(true)}>
            <CircleHelp size={16} /> Shortcuts &amp; help
          </button>
          <div className="side-spacer" />
          <button className="new-workspace" onClick={handleCreateWorkspace}>
            <Plus size={16} /> New workspace
          </button>
        </aside>
      )}

      {openResearchAnswerId ? (
        <OpenResearchPortal
          defaultQuery={openResearchQuery}
          onClose={closeOpenResearch}
          onAdd={(item) => addResearchItem(openResearchAnswerId, item)}
        />
      ) : (
        <AIResearchPanel selected={selectedNodes} nodes={nodes} edges={edges} open={panelOpen} onClose={() => setPanelOpen(false)} actions={panelActions} synthesizing={synthesizing} />
      )}
      {!panelOpen && !openResearchAnswerId && (
        <button className="ai-launcher floating" onClick={() => setPanelOpen(true)} aria-label="Open AI panel">
          <Sparkles size={18} />
          <span>AI</span>
        </button>
      )}

      {selectedNodes.length >= 2 && (
        <SelectionBar busy={selectionBusy} onAsk={(question) => runSelectionAI(question)} onSummarize={() => runSelectionAI()} />
      )}
      {selectedText && <TextFormatBar node={selectedText} onFormat={(partial) => patchNode(selectedText.id, partial)} />}

      <Toolbar
        tool={effectiveTool}
        onSelectTool={setTool}
        onCreateQuestion={() => addQuestion()}
        onCreateNote={() => addNote()}
        onCreateResearch={runResearchTool}
        onSaveFinding={runSaveFinding}
        canSaveFinding={canSaveFinding}
        onSynthesize={runSynthesize}
        canSynthesize={canSynthesize}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="zoom floating">
        <button aria-label="Zoom out" onClick={() => flow?.zoomOut({ duration: 150 })}>
          <ZoomOut size={16} />
        </button>
        <span>{zoom}%</span>
        <button aria-label="Zoom in" onClick={() => flow?.zoomIn({ duration: 150 })}>
          <ZoomIn size={16} />
        </button>
      </div>
      <button className="help floating" aria-label="Help" onClick={() => setHelpOpen(true)}>
        <CircleHelp size={18} />
      </button>

      {search && <CommandPalette nodes={nodes} onClose={() => setSearch(false)} onSelect={selectNode} />}
      {onboarding && (
        <OnboardingModal
          onDone={() => {
            localStorage.setItem("recan-onboarded", "1");
            setOnboarding(false);
          }}
        />
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {shareNotice && <ShareToast />}
      {toast && <div className="toast floating">{toast}</div>}
    </main>
  );
}
