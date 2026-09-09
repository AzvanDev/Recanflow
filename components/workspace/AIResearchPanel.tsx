import { useState } from "react";
import type { Edge } from "@xyflow/react";
import { ArrowRight, Bookmark, ChevronRight, ExternalLink, HelpCircle, ListChecks, Plus, RotateCcw, Scale, Send, ShieldQuestion, Sparkles, Swords, Telescope, ThumbsDown, ThumbsUp, X } from "lucide-react";
import type { DebateStance, FlowNode, ResearchSource } from "@/lib/types";
import { KIND_LABEL } from "./nodes/shared";

export type PanelActions = {
  explore: (questionId: string) => void;
  openResearch: (id: string) => void;
  sendChat: (researchId: string, message: string) => void;
  saveFinding: (researchId: string, content: string) => void;
  synthesize: (findingIds: string[]) => void;
  challenge: (insightId: string) => void;
  createQuestionFromChallenge: (insightId: string) => void;
  addFollowUp: (parentId: string, title: string) => void;
  startDebate: (sourceId: string) => void;
  argueDebate: (debateId: string, stance: "for" | "against" | "balanced") => void;
  respondDebate: (debateId: string, text: string) => void;
  getCruxes: (debateId: string) => void;
  summarizeDebate: (debateId: string) => void;
  exploreUnresolved: (debateId: string, question: string) => void;
  selectNode: (id: string) => void;
  startQuestion: () => void;
};

function DebateThisButton({ id, actions }: { id: string; actions: PanelActions }) {
  return (
    <button className="node-action" onClick={() => actions.startDebate(id)}>
      <Swords size={13} /> Debate this
    </button>
  );
}

export function AIResearchPanel({
  selected,
  nodes,
  edges,
  open,
  onClose,
  actions,
  synthesizing,
}: {
  selected: FlowNode[];
  nodes: FlowNode[];
  edges: Edge[];
  open: boolean;
  onClose: () => void;
  actions: PanelActions;
  synthesizing: boolean;
}) {
  if (!open) return null;

  const heading = synthesizing
    ? "Synthesizing…"
    : selected.length > 1
      ? `${selected.length} nodes selected`
      : selected[0]
        ? selected[0].data.title || `Untitled ${KIND_LABEL[selected[0].data.kind].toLowerCase()}`
        : "Make your research visible";
  const eyebrow = selected.length > 1 ? "SELECTION" : selected[0] ? KIND_LABEL[selected[0].data.kind].toUpperCase() : "AI RESEARCH";

  return (
    <section className="ai-panel floating">
      <div className="panel-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{heading}</h2>
        </div>
        <button aria-label="Close AI panel" title="Close AI panel" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="panel-body">
        {synthesizing ? (
          <p className="thinking"><span /> Synthesizing findings…</p>
        ) : selected.length > 1 ? (
          <MultiSelectView selected={selected} actions={actions} />
        ) : selected[0] ? (
          <SingleNodeView key={selected[0].id} node={selected[0]} nodes={nodes} edges={edges} actions={actions} />
        ) : (
          <HomeView actions={actions} />
        )}
      </div>
    </section>
  );
}

function HomeView({ actions }: { actions: PanelActions }) {
  return (
    <>
      <p>Start with a question, explore branches, collect evidence, then select findings to synthesize what you learned.</p>
      <button className="primary wide" onClick={actions.startQuestion}>
        <Sparkles size={16} /> Start a question
      </button>
    </>
  );
}

function MultiSelectView({ selected, actions }: { selected: FlowNode[]; actions: PanelActions }) {
  const findings = selected.filter((n) => n.data.kind === "finding");
  const allFindings = findings.length === selected.length;
  if (allFindings && findings.length >= 2) {
    return (
      <>
        <p>Bring these findings together without losing their nuance.</p>
        <button className="primary wide" onClick={() => actions.synthesize(findings.map((f) => f.id))}>
          <Sparkles size={16} /> Synthesize {findings.length} findings
        </button>
      </>
    );
  }
  return <p>Select at least 2 Finding nodes (and nothing else) to create an Insight.</p>;
}

function SingleNodeView({ node, nodes, edges, actions }: { node: FlowNode; nodes: FlowNode[]; edges: Edge[]; actions: PanelActions }) {
  const { data } = node;
  if (data.kind === "question") {
    const followUps = edges
      .filter((e) => e.source === node.id)
      .map((e) => nodes.find((n) => n.id === e.target))
      .filter((n): n is FlowNode => !!n && n.data.kind === "branch");
    return (
      <>
        {!data.answer && <p>{data.title || "Give this question some text, then explore it with AI."}</p>}
        {data.status === "error" && <ErrorBanner message={data.error} onRetry={() => actions.explore(node.id)} />}
        {data.answer && (
          <>
            <span className="eyebrow">ANSWER</span>
            <p>{data.answer}</p>
          </>
        )}
        {!data.answer && (
          <button className="primary wide" disabled={!data.title.trim() || data.status === "loading"} onClick={() => actions.explore(node.id)}>
            {data.status === "loading" ? "Thinking…" : "Explore with AI"} {data.status !== "loading" && <ArrowRight size={15} />}
          </button>
        )}
        {followUps.length > 0 && (
          <>
            <span className="eyebrow">FOLLOW-UP QUESTIONS</span>
            <div className="followup-list">
              {followUps.map((f) => (
                <button key={f.id} className="followup-chip" onClick={() => actions.openResearch(f.id)}>
                  <span>{f.data.title}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </>
        )}
        {data.answer && <FollowUpComposer onSubmit={(text) => actions.addFollowUp(node.id, text)} />}
      </>
    );
  }

  if (data.kind === "branch") {
    return (
      <>
        <p>{data.description}</p>
        <button className="primary wide" onClick={() => actions.openResearch(node.id)}>
          <Telescope size={16} /> Open research <ChevronRight size={15} />
        </button>
        <div className="panel-quick-actions"><DebateThisButton id={node.id} actions={actions} /></div>
      </>
    );
  }

  if (data.kind === "research") return <ResearchChat node={node} actions={actions} />;

  if (data.kind === "finding") {
    return (
      <>
        <p className="panel-finding-content">{data.content}</p>
        <div className="panel-quick-actions">
          {data.provenance?.researchId && (
            <button className="node-action" onClick={() => actions.selectNode(data.provenance!.researchId!)}>
              <Telescope size={13} /> Open source research
            </button>
          )}
          <DebateThisButton id={node.id} actions={actions} />
        </div>
      </>
    );
  }

  if (data.kind === "insight") return <InsightView node={node} actions={actions} />;

  if (data.kind === "debate") return <DebateView node={node} actions={actions} />;

  return <p>{data.content || "Edit this note directly on the canvas."}</p>;
}

function FollowUpComposer({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState("");
  function submit() {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  }
  return (
    <div className="followup-composer">
      <input
        placeholder="Ask your own follow-up…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") submit();
        }}
      />
      <button className="node-action" disabled={!value.trim()} onClick={submit} aria-label="Add follow-up">
        <Plus size={14} />
      </button>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="panel-error">
      <p>{message || "Something went wrong."}</p>
      <button className="node-action" onClick={onRetry}>
        <RotateCcw size={13} /> Retry
      </button>
    </div>
  );
}

function SourcesList({ sources }: { sources: ResearchSource[] }) {
  return (
    <div className="sources-list">
      <span className="eyebrow">SOURCES</span>
      {sources.map((s) => (
        <a key={s.id || s.url} className="source-card" href={s.url} target="_blank" rel="noopener noreferrer">
          <div className="source-card-head">
            <span className="source-title">{s.title}</span>
            <ExternalLink size={12} />
          </div>
          <span className="source-domain">{s.domain}</span>
          {s.snippet && <p className="source-snippet">{s.snippet}</p>}
        </a>
      ))}
    </div>
  );
}

function ResearchChat({ node, actions }: { node: FlowNode; actions: PanelActions }) {
  const [draft, setDraft] = useState("");
  const messages = node.data.messages || [];
  const busy = node.data.status === "loading";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  function send(text: string) {
    if (!text.trim() || busy) return;
    actions.sendChat(node.id, text.trim());
    setDraft("");
  }

  return (
    <>
      <p>{node.data.description}</p>
      <div className="chat-thread">
        {messages.length === 0 && !busy && <p className="chat-empty">Ask a research question about this branch to begin.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.role}`}>
            <span className="chat-role">{m.role === "user" ? "You" : "AI"}</span>
            <p>{m.content}</p>
            {m.role === "assistant" && m.researched === false && <span className="model-only-badge">Model reasoning — no live sources</span>}
            {m.role === "assistant" && m.sources && m.sources.length > 0 && <SourcesList sources={m.sources} />}
            {m.role === "assistant" && (
              <button className="node-action" onClick={() => actions.saveFinding(node.id, m.content)}>
                <Bookmark size={12} /> Save as finding
              </button>
            )}
          </div>
        ))}
        {busy && <p className="thinking"><span /> Researching…</p>}
        {node.data.status === "error" && <ErrorBanner message={node.data.error} onRetry={() => send(messages[messages.length - 1]?.content || "")} />}
      </div>
      <div className="panel-quick-actions">
        <button className="node-action" disabled={!lastAssistant || busy} onClick={() => send("Go deeper on the most important open question from your last answer.")}>
          <Telescope size={13} /> Research deeper
        </button>
        <button className="node-action" disabled={!lastAssistant || busy} onClick={() => send("What evidence or reasoning most strongly supports your last answer?")}>
          <ThumbsUp size={13} /> Find evidence
        </button>
        <button className="node-action" disabled={!lastAssistant || busy} onClick={() => send("What evidence or reasoning would most challenge or contradict your last answer?")}>
          <ThumbsDown size={13} /> Find counter-evidence
        </button>
      </div>
      <div className="composer">
        <textarea
          aria-label="Ask about this research"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send(draft);
          }}
          placeholder="Ask about this research…"
        />
        <button className="send" onClick={() => send(draft)} disabled={busy || !draft.trim()} aria-label="Send">
          <Send size={16} />
        </button>
      </div>
    </>
  );
}

function InsightView({ node, actions }: { node: FlowNode; actions: PanelActions }) {
  const { data } = node;
  return (
    <>
      {data.confidence && (
        <div className="node-meta insight-confidence-top">
          <span className={`confidence ${data.confidence}`}>Confidence: {data.confidence}</span>
        </div>
      )}
      <span className="eyebrow">SUMMARY</span>
      <p>{data.description}</p>
      {data.keyPoints && data.keyPoints.length > 0 && (
        <>
          <span className="eyebrow">KEY POINTS</span>
          <ul className="panel-list">
            {data.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}
      {data.supportingEvidence && data.supportingEvidence.length > 0 && (
        <>
          <span className="eyebrow">SUPPORTING EVIDENCE</span>
          <ul className="panel-list">
            {data.supportingEvidence.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}
      {data.status === "error" && <ErrorBanner message={data.error} onRetry={() => actions.challenge(node.id)} />}
      {!data.challenge && (
        <button className="primary wide" disabled={data.status === "loading"} onClick={() => actions.challenge(node.id)}>
          {data.status === "loading" ? "Challenging insight…" : (<><ShieldQuestion size={16} /> Challenge</>)}
        </button>
      )}
      <div className="panel-quick-actions"><DebateThisButton id={node.id} actions={actions} /></div>
      {data.challenge && (
        <div className="challenge-block">
          <span className="eyebrow">CHALLENGE</span>
          <p className="challenge-lead">What could weaken this insight?</p>
          <ul className="panel-list">
            {data.challenge.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p><b>Missing evidence:</b> {data.challenge.missingEvidence}</p>
          <p><b>Alternative explanation:</b> {data.challenge.alternativeExplanation}</p>
          <div className="node-meta"><span className={`confidence ${data.challenge.confidence}`}>Revised confidence: {data.challenge.confidence}</span></div>
          <button className="primary wide" onClick={() => actions.createQuestionFromChallenge(node.id)}>
            Create new question <ArrowRight size={15} />
          </button>
        </div>
      )}
    </>
  );
}

function stanceLabel(role: "user" | "assistant", stance?: DebateStance) {
  if (role === "user") return "You";
  if (stance === "for") return "For";
  if (stance === "against") return "Against";
  if (stance === "balanced") return "Balanced";
  if (stance === "challenge") return "Challenges you";
  return "AI";
}

function DebateView({ node, actions }: { node: FlowNode; actions: PanelActions }) {
  const [draft, setDraft] = useState("");
  // Tracks whichever debate action last ran, so the error banner's Retry re-attempts the
  // thing that actually failed (arguing a stance, sending a reply, cruxes, or summarize).
  const [lastAction, setLastAction] = useState<(() => void) | null>(null);
  const { data } = node;
  const messages = data.messages || [];
  const busy = data.status === "loading";
  const hasExchanges = messages.length > 0;

  function send() {
    if (!draft.trim() || busy) return;
    const text = draft.trim();
    setLastAction(() => () => actions.respondDebate(node.id, text));
    actions.respondDebate(node.id, text);
    setDraft("");
  }

  function argue(stance: "for" | "against" | "balanced") {
    setLastAction(() => () => actions.argueDebate(node.id, stance));
    actions.argueDebate(node.id, stance);
  }

  function cruxes() {
    setLastAction(() => () => actions.getCruxes(node.id));
    actions.getCruxes(node.id);
  }

  function summarize() {
    setLastAction(() => () => actions.summarizeDebate(node.id));
    actions.summarizeDebate(node.id);
  }

  return (
    <>
      <p>{data.description || "State your view, or ask the AI to argue a side, to begin."}</p>
      <div className="panel-quick-actions">
        <button className="node-action" disabled={busy} onClick={() => argue("for")}>
          <ThumbsUp size={13} /> Argue for
        </button>
        <button className="node-action" disabled={busy} onClick={() => argue("against")}>
          <ThumbsDown size={13} /> Argue against
        </button>
        <button className="node-action" disabled={busy} onClick={() => argue("balanced")}>
          <Scale size={13} /> Balanced
        </button>
      </div>
      <div className="chat-thread">
        {!hasExchanges && !busy && <p className="chat-empty">No exchanges yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.role} stance-${m.stance || "none"}`}>
            <span className="chat-role">{stanceLabel(m.role, m.stance)}</span>
            <p>{m.content}</p>
          </div>
        ))}
        {busy && <p className="thinking"><span /> Thinking…</p>}
        {data.status === "error" && <ErrorBanner message={data.error} onRetry={() => lastAction?.()} />}
      </div>
      {hasExchanges && (
        <div className="panel-quick-actions">
          <button className="node-action" disabled={busy} onClick={cruxes}>
            <HelpCircle size={13} /> What would change your mind?
          </button>
          <button className="node-action" disabled={busy} onClick={summarize}>
            <ListChecks size={13} /> {data.debateSummary ? "Update summary" : "Summarize debate"}
          </button>
        </div>
      )}
      {data.debateSummary && <DebateSummaryCard debateId={node.id} summary={data.debateSummary} actions={actions} />}
      <div className="composer">
        <textarea
          aria-label="State your position or respond"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send();
          }}
          placeholder="State your position or respond…"
        />
        <button className="send" onClick={send} disabled={busy || !draft.trim()} aria-label="Send">
          <Send size={16} />
        </button>
      </div>
    </>
  );
}

function DebateSummaryCard({ debateId, summary, actions }: { debateId: string; summary: NonNullable<FlowNode["data"]["debateSummary"]>; actions: PanelActions }) {
  return (
    <div className="challenge-block">
      <span className="eyebrow">DEBATE SUMMARY</span>
      {summary.currentPosition && <p className="challenge-lead">{summary.currentPosition}</p>}
      <div className="node-meta"><span className={`confidence ${summary.confidence}`}>Confidence: {summary.confidence}</span></div>
      {summary.strengthenedBy.length > 0 && (
        <>
          <span className="eyebrow">STRENGTHENED BY</span>
          <ul className="panel-list">{summary.strengthenedBy.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </>
      )}
      {summary.weakenedBy.length > 0 && (
        <>
          <span className="eyebrow">WEAKENED BY</span>
          <ul className="panel-list">{summary.weakenedBy.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </>
      )}
      {summary.strongestCounterargument && (
        <>
          <span className="eyebrow">STRONGEST COUNTERARGUMENT</span>
          <p>{summary.strongestCounterargument}</p>
        </>
      )}
      {summary.assumptions.length > 0 && (
        <>
          <span className="eyebrow">ASSUMPTIONS</span>
          <ul className="panel-list">{summary.assumptions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </>
      )}
      {summary.unresolvedQuestions.length > 0 && (
        <>
          <span className="eyebrow">OPEN QUESTIONS</span>
          <div className="followup-list">
            {summary.unresolvedQuestions.map((q, i) => (
              <button key={i} className="followup-chip" onClick={() => actions.exploreUnresolved(debateId, q)}>
                <span>{q}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
