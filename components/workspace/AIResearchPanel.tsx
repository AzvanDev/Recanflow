import { useState } from "react";
import { ArrowRight, Bookmark, ChevronRight, RotateCcw, Send, ShieldQuestion, Sparkles, Telescope, X } from "lucide-react";
import type { FlowNode } from "@/lib/types";
import { KIND_LABEL } from "./nodes/shared";

export type PanelActions = {
  explore: (questionId: string) => void;
  openResearch: (id: string) => void;
  sendChat: (researchId: string, message: string) => void;
  saveFinding: (researchId: string, content: string) => void;
  synthesize: (findingIds: string[]) => void;
  challenge: (insightId: string) => void;
  createQuestionFromChallenge: (insightId: string) => void;
  selectNode: (id: string) => void;
  startQuestion: () => void;
};

export function AIResearchPanel({
  selected,
  open,
  onClose,
  actions,
  synthesizing,
}: {
  selected: FlowNode[];
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
          <SingleNodeView key={selected[0].id} node={selected[0]} actions={actions} />
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

function SingleNodeView({ node, actions }: { node: FlowNode; actions: PanelActions }) {
  const { data } = node;
  if (data.kind === "question") {
    return (
      <>
        <p>{data.title || "Give this question some text, then explore it with AI."}</p>
        {data.status === "error" && <ErrorBanner message={data.error} onRetry={() => actions.explore(node.id)} />}
        <button className="primary wide" disabled={!data.title.trim() || data.status === "loading"} onClick={() => actions.explore(node.id)}>
          {data.status === "loading" ? "Generating research paths…" : "Explore with AI"} {data.status !== "loading" && <ArrowRight size={15} />}
        </button>
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
      </>
    );
  }

  if (data.kind === "research") return <ResearchChat node={node} actions={actions} />;

  if (data.kind === "finding") {
    return (
      <>
        <p className="panel-finding-content">{data.content}</p>
        {data.provenance?.researchId && (
          <button className="node-action" onClick={() => actions.selectNode(data.provenance!.researchId!)}>
            <Telescope size={13} /> Open source research
          </button>
        )}
      </>
    );
  }

  if (data.kind === "insight") return <InsightView node={node} actions={actions} />;

  return <p>{data.content || "Edit this note directly on the canvas."}</p>;
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
