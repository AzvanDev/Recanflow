import { useState } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, Send } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell, StatusBadge } from "./shared";

export function DebateNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const messages = data.messages || [];
  const opening = messages[0];
  const stance = opening?.stance === "for" || opening?.stance === "against" ? opening.stance : null;
  const busy = data.status === "loading";

  function submit() {
    if (!draft.trim() || busy) return;
    data.onAction?.("respondDebate", id, draft.trim());
    setDraft("");
  }

  return (
    <NodeShell kind="debate" selected={selected}>
      <div className="node-kicker-trailer">
        <StatusBadge status={data.status} />
      </div>
      {stance && <span className={`debate-stance ${stance}`}>{stance === "for" ? "For" : "Against"}</span>}

      {!expanded ? (
        <>
          <p className="node-answer-preview">{opening?.content || (busy ? "Preparing opening argument…" : "Not started")}</p>
          <div className="node-footer">
            <button
              className="node-action nodrag"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
              }}
            >
              Expand <ChevronRight size={12} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="debate-thread nodrag">
            {messages.map((m) => (
              <div key={m.id} className={`debate-msg ${m.role}`}>
                <span className="debate-msg-role">{m.role === "user" ? "You" : "AI"}</span>
                <p>{m.content}</p>
              </div>
            ))}
            {busy && <p className="thinking-inline">Thinking…</p>}
          </div>
          <div className="debate-composer nodrag">
            <input
              placeholder="Respond to the debate…"
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") submit();
              }}
            />
            <button disabled={!draft.trim() || busy} onClick={submit} aria-label="Send response">
              <Send size={13} />
            </button>
          </div>
          <button
            className="node-action nodrag debate-collapse"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
          >
            <ChevronDown size={12} /> Collapse
          </button>
        </>
      )}
    </NodeShell>
  );
}
