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
import { CircleHelp, Clipboard, Network, PanelLeft, Plus, Sparkles, ZoomIn, ZoomOut } from "lucide-react";

import { loadWorkspace, newId, saveWorkspace } from "@/lib/workspace";
import { buildLineageContext } from "@/lib/context";
import { layoutChildrenBelow, layoutChildOf, layoutBelowGroup, viewportCenterPosition } from "@/lib/layout";
import { callAI } from "@/lib/ai-client";
import type { ChatMessage, Confidence, FlowNode, FlowNodeData, NodeAction, NodeKind } from "@/lib/types";
import { useHistory } from "@/lib/history";

import { QuestionNode } from "./nodes/QuestionNode";
import { BranchNode } from "./nodes/BranchNode";
import { ResearchNode } from "./nodes/ResearchNode";
import { FindingNode } from "./nodes/FindingNode";
import { InsightNode } from "./nodes/InsightNode";
import { NoteNode } from "./nodes/NoteNode";
import { TextNode } from "./nodes/TextNode";
import { TopLeftHeader, TopRightControls, ShareToast } from "./Header";
import { Toolbar, type Tool } from "./Toolbar";
import { EmptyState } from "./EmptyState";
import { AIResearchPanel, type PanelActions } from "./AIResearchPanel";
import { CommandPalette } from "./CommandPalette";
import { OnboardingModal, HelpModal } from "./Modals";

const nodeTypes = { question: QuestionNode, branch: BranchNode, research: ResearchNode, finding: FindingNode, insight: InsightNode, note: NoteNode, text: TextNode };

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

function summarize(text: string, max = 70) {
  const clean = text.trim().replace(/\s+/g, " ");
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  return firstSentence.length > max ? `${firstSentence.slice(0, max - 1)}…` : firstSentence;
}

export function Workspace() {
  const [loaded] = useState(() => (typeof window !== "undefined" ? loadWorkspace() : null));
  const [workspaceId] = useState(() => loaded?.id || newId("workspace"));
  const [workspaceName, setWorkspaceName] = useState(loaded?.name || "Untitled workspace");
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(loaded?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(loaded?.edges || []);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<FlowNode> | null>(null);
  const [zoom, setZoom] = useState(100);
  const [sidebar, setSidebar] = useState(false);
  const [search, setSearch] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [shareNotice, setShareNotice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);

  const { undo, redo, canUndo, canRedo } = useHistory(nodes, edges, setNodes, setEdges);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("recan-onboarded")) setOnboarding(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => saveWorkspace({ version: 2, id: workspaceId, name: workspaceName, nodes, edges, updatedAt: new Date().toISOString() }), 500);
    return () => clearTimeout(timer);
  }, [nodes, edges, workspaceId, workspaceName]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedNodes = useMemo(() => nodes.filter((n) => selection.includes(n.id)), [nodes, selection]);
  const canSaveFinding = selectedNodes.length === 1 && selectedNodes[0].data.kind === "research" && (selectedNodes[0].data.messages || []).some((m) => m.role === "assistant");
  const canSynthesize = selectedNodes.length >= 2 && selectedNodes.every((n) => n.data.kind === "finding");

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

  // -- node creation --
  const addQuestion = useCallback((position?: { x: number; y: number }, title = "") => {
    const id = newId("question");
    const pos = position || viewportCenterPosition(flow, "question");
    pushNodes([{ id, type: "question", position: pos, data: { kind: "question", title, status: "idle" } }]);
    setSelection([id]);
    setFocusNodeId(id);
    setPanelOpen(true);
    return id;
  }, [flow, pushNodes]);

  const addNote = useCallback((position?: { x: number; y: number }) => {
    const id = newId("note");
    const pos = position || viewportCenterPosition(flow, "note");
    pushNodes([{ id, type: "note", position: pos, data: { kind: "note", title: "Note", content: "" } }]);
    setSelection([id]);
    setFocusNodeId(id);
  }, [flow, pushNodes]);

  const addText = useCallback((position?: { x: number; y: number }) => {
    const id = newId("text");
    const pos = position || viewportCenterPosition(flow, "text");
    pushNodes([{ id, type: "text", position: pos, data: { kind: "text", title: "", content: "" } }]);
    setSelection([id]);
    setFocusNodeId(id);
  }, [flow, pushNodes]);

  const addStandaloneResearch = useCallback(() => {
    const id = newId("research");
    const pos = viewportCenterPosition(flow, "research");
    pushNodes([{ id, type: "research", position: pos, data: { kind: "research", title: "", description: "Define what to research, then ask a question.", status: "idle", messages: [], findingIds: [] } }]);
    setSelection([id]);
    setPanelOpen(true);
  }, [flow, pushNodes]);

  // -- AI-backed actions --
  const explore = useCallback(async (questionId: string) => {
    const question = nodesRef.current.find((n) => n.id === questionId);
    if (!question || !question.data.title.trim()) return;
    patchNode(questionId, { status: "loading", error: undefined });
    try {
      const { branches } = await callAI({ action: "decompose", question: question.data.title });
      const parent = nodesRef.current.find((n) => n.id === questionId)!;
      const positions = layoutChildrenBelow(nodesRef.current, parent, "branch", branches.length);
      const ids = branches.map(() => newId("branch"));
      const newNodes: FlowNode[] = branches.map((b, i) => ({ id: ids[i], type: "branch", position: positions[i], data: { kind: "branch", title: b.title, description: b.description } }));
      const newEdges: Edge[] = ids.map((bid) => ({ id: `e-${questionId}-${bid}`, source: questionId, target: bid, type: "smoothstep" }));
      pushNodes(newNodes, newEdges);
      patchNode(questionId, { status: "idle" });
      window.setTimeout(() => flow?.fitView({ padding: 0.25, duration: 350 }), 60);
    } catch (err) {
      patchNode(questionId, { status: "error", error: err instanceof Error ? err.message : "Could not generate branches." });
    }
  }, [patchNode, pushNodes, flow]);

  const openResearch = useCallback((id: string) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    if (node.data.kind === "research") {
      setSelection([id]);
      setPanelOpen(true);
      return;
    }
    if (node.data.kind !== "branch") return;
    const existingEdge = edgesRef.current.find((e) => e.source === id && nodesRef.current.find((n) => n.id === e.target)?.data.kind === "research");
    if (existingEdge) {
      setSelection([existingEdge.target]);
      setPanelOpen(true);
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
    setSelection([researchId]);
    setPanelOpen(true);
  }, [pushNodes]);

  const sendChat = useCallback(async (researchId: string, message: string) => {
    const research = nodesRef.current.find((n) => n.id === researchId);
    if (!research) return;
    const history: ChatMessage[] = research.data.messages || [];
    const context = buildLineageContext(researchId, nodesRef.current, edgesRef.current);
    const userMessage: ChatMessage = { id: newId("msg"), role: "user", content: message };
    patchNode(researchId, (d) => ({ status: "loading", error: undefined, messages: [...(d.messages || []), userMessage] }));
    try {
      const { reply } = await callAI({ action: "chat", topic: research.data.title, context, history, message });
      patchNode(researchId, (d) => ({ status: "idle", messages: [...(d.messages || []), { id: newId("msg"), role: "assistant", content: reply }] }));
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
      setSelection([insightId]);
      setPanelOpen(true);
      window.setTimeout(() => flow?.fitView({ padding: 0.25, duration: 350 }), 60);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not synthesize these findings.");
    } finally {
      setSynthesizing(false);
    }
  }, [pushNodes, flow]);

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

  const createQuestionFromChallenge = useCallback((insightId: string) => {
    const insight = nodesRef.current.find((n) => n.id === insightId);
    if (!insight?.data.challenge) return;
    const id = newId("question");
    const pos = layoutChildOf(nodesRef.current, insight, "question");
    pushNodes([{ id, type: "question", position: pos, data: { kind: "question", title: insight.data.challenge.suggestedQuestion, status: "idle" } }], [{ id: `e-${insightId}-${id}`, source: insightId, target: id, type: "smoothstep" }]);
    setSelection([id]);
    setFocusNodeId(id);
    setPanelOpen(true);
    window.setTimeout(() => flow?.fitView({ padding: 0.25, duration: 350 }), 60);
  }, [pushNodes, flow]);

  const selectNode = useCallback((id: string) => {
    setSelection([id]);
    setPanelOpen(true);
    flow?.fitView({ nodes: [{ id }], padding: 0.5, duration: 300, maxZoom: 1 });
  }, [flow]);

  const handleAction = useCallback((action: NodeAction, id: string, payload?: unknown) => {
    if (action === "editTitle") patchNode(id, { title: String(payload ?? "") });
    else if (action === "editContent") patchNode(id, { content: String(payload ?? "") });
    else if (action === "explore" || action === "retryExplore") explore(id);
    else if (action === "openResearch" || action === "openBranch") openResearch(id);
    else if (action === "challenge") challenge(id);
    else if (action === "createQuestionFromChallenge") createQuestionFromChallenge(id);
  }, [patchNode, explore, openResearch, challenge, createQuestionFromChallenge]);

  const panelActions: PanelActions = useMemo(() => ({
    explore,
    openResearch,
    sendChat,
    saveFinding,
    synthesize,
    challenge,
    createQuestionFromChallenge,
    selectNode,
    startQuestion: () => addQuestion(),
  }), [explore, openResearch, sendChat, saveFinding, synthesize, challenge, createQuestionFromChallenge, selectNode, addQuestion]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((es) => addEdge({ ...connection, type: "smoothstep" }, es));
  }, [setEdges]);

  const deleteSelected = useCallback(() => {
    if (!selection.length) return;
    setNodes((ns) => ns.filter((n) => !selection.includes(n.id)));
    setEdges((es) => es.filter((e) => !selection.includes(e.source) && !selection.includes(e.target)));
    setSelection([]);
  }, [selection, setNodes, setEdges]);

  const createBlankWorkspace = () => {
    if (nodes.length > 0 && !window.confirm("Start a new workspace? This clears the current canvas.")) return;
    setNodes([]);
    setEdges([]);
    setSelection([]);
    setSidebar(false);
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

  const runResearchTool = () => {
    if (selectedNodes.length === 1 && (selectedNodes[0].data.kind === "branch" || selectedNodes[0].data.kind === "research")) openResearch(selectedNodes[0].id);
    else addStandaloneResearch();
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
        setSelection([]);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection.length) {
        deleteSelected();
      } else if (e.key.toLowerCase() === "v") setTool("select");
      else if (e.key.toLowerCase() === "h") setTool("hand");
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
    () => nodes.map((n) => ({ ...n, data: { ...n.data, onAction: handleAction, autoFocus: n.id === focusNodeId } })),
    [nodes, handleAction, focusNodeId],
  );

  const effectiveTool: Tool = spaceHeld ? "hand" : tool;

  return (
    <main className="workspace">
      <ReactFlow<FlowNode>
        nodes={renderNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setFlow}
        onMove={(_, viewport) => setZoom(Math.round(viewport.zoom * 100))}
        onSelectionChange={({ nodes: ns }) =>
          setSelection((previous) => {
            const next = ns.map((n) => n.id);
            if (next.length) setPanelOpen(true);
            return previous.length === next.length && previous.every((id, index) => id === next[index]) ? previous : next;
          })
        }
        fitView
        fitViewOptions={{ padding: 0.3 }}
        selectionOnDrag={effectiveTool === "select"}
        panOnDrag={effectiveTool === "hand" || spaceHeld}
        multiSelectionKeyCode="Shift"
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background gap={22} size={1} color="#e9e7ef" />
        <MiniMap pannable zoomable className="minimap" />
        <Controls showInteractive={false} className="flow-controls" />
      </ReactFlow>

      {nodes.length === 0 && <EmptyState onStart={(question) => { const id = addQuestion(undefined, question); explore(id); }} />}

      <TopLeftHeader workspaceName={workspaceName} onRename={setWorkspaceName} onToggleSidebar={() => setSidebar((v) => !v)} />
      <TopRightControls onOpenPanel={() => setPanelOpen(true)} onShare={shareWorkspace} />
      <button className="nav-toggle floating" onClick={() => setSidebar((v) => !v)} aria-label="Toggle navigation">
        <PanelLeft size={18} />
      </button>

      {sidebar && (
        <aside className="sidebar floating">
          <div className="side-title">Your research</div>
          <button className="side-active">
            <Network size={16} /> {workspaceName}
          </button>
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
          <button className="new-workspace" onClick={createBlankWorkspace}>
            <Plus size={16} /> New workspace
          </button>
        </aside>
      )}

      <AIResearchPanel selected={selectedNodes} open={panelOpen} onClose={() => setPanelOpen(false)} actions={panelActions} synthesizing={synthesizing} />
      {!panelOpen && (
        <button className="ai-launcher floating" onClick={() => setPanelOpen(true)} aria-label="Open AI panel">
          <Sparkles size={18} />
          <span>AI</span>
        </button>
      )}

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
        onCreateText={() => addText()}
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
