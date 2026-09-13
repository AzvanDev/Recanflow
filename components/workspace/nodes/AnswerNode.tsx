import { useState } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, ExternalLink, Plus } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell, useRevealText } from "./shared";

export function AnswerNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sources = data.sources || [];
  const videos = data.videos || [];
  const hasMaterial = sources.length > 0 || videos.length > 0;
  const revealedContent = useRevealText(data.content || "", !!data.justGenerated);

  function submit() {
    if (!draft.trim()) return;
    data.onAction?.("addFollowUp", id, draft.trim());
    setDraft("");
    setComposing(false);
  }

  return (
    <NodeShell kind="answer" selected={selected} dimmed={data.dimmed}>
      <p className="node-answer-preview">{revealedContent}</p>

      {data.suggestions && data.suggestions.length > 0 && (
        <div className="followup-list">
          {data.suggestions.map((s, i) => (
            <button
              key={i}
              className={`followup-chip nodrag ${data.justGenerated ? "reveal" : ""}`}
              style={data.justGenerated ? { animationDelay: `${380 + i * 70}ms` } : undefined}
              onClick={(e) => {
                e.stopPropagation();
                data.onAction?.("selectSuggestion", id, i);
              }}
            >
              <span>{s.title}</span>
              <ChevronRight size={12} />
            </button>
          ))}
        </div>
      )}

      <div className="answer-sources">
        <button
          className="sources-toggle nodrag"
          onClick={(e) => {
            e.stopPropagation();
            setSourcesOpen((v) => !v);
          }}
        >
          <span>Sources</span>
          {sourcesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {sourcesOpen && (
          <div className="sources-panel nodrag">
            {sources.length > 0 && (
              <>
                <span className="eyebrow">QUICK LINKS</span>
                <div className="quick-links">
                  {sources.map((s) => (
                    <a key={s.id || s.url} className="quick-link" href={s.url} target="_blank" rel="noopener noreferrer">
                      <span>{s.title}</span>
                      <ExternalLink size={11} />
                    </a>
                  ))}
                </div>
              </>
            )}
            {videos.length > 0 && (
              <>
                <span className="eyebrow">VIDEOS</span>
                <div className="quick-links">
                  {videos.map((v) => (
                    <a key={v.videoId} className="quick-link" href={v.url} target="_blank" rel="noopener noreferrer">
                      <span>{v.title}</span>
                      <ExternalLink size={11} />
                    </a>
                  ))}
                </div>
              </>
            )}
            {!hasMaterial && (
              <p className="sources-empty">{data.videosFetched ? "No sources or videos found for this question." : "Looking for sources and videos…"}</p>
            )}
          </div>
        )}
      </div>

      <div className="answer-footer">
        {composing ? (
          <div className="followup-composer nodrag">
            <input
              autoFocus
              placeholder="Ask your own follow-up…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setComposing(false);
                  setDraft("");
                }
              }}
            />
            <button className="node-action" disabled={!draft.trim()} onClick={submit} aria-label="Add follow-up question">
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <button
            className="answer-plus nodrag"
            aria-label="Add a follow-up question"
            title="Add a follow-up question"
            onClick={(e) => {
              e.stopPropagation();
              setComposing(true);
            }}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </NodeShell>
  );
}
