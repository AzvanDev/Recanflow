import { useEffect, useRef } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { ArrowRight, RotateCcw } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell } from "./shared";

type Props = NodeProps<Node<FlowNodeData & { autoFocus?: boolean }>>;

export function QuestionNode({ id, data, selected }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (data.autoFocus) ref.current?.focus();
    // only ever run for the initial mount of a freshly created node
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = data.status === "loading";

  return (
    <NodeShell kind="question" selected={selected}>
      <textarea
        ref={ref}
        className="nodrag node-question-input"
        value={data.title}
        placeholder="What do you want to understand?"
        rows={2}
        onChange={(e) => data.onAction?.("editTitle", id, e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      {data.status === "error" && <p className="node-error">{data.error || "Something went wrong."}</p>}
      <div className="node-footer">
        {data.status === "error" ? (
          <button className="node-primary nodrag" onClick={() => data.onAction?.("retryExplore", id)}>
            <RotateCcw size={13} /> Retry
          </button>
        ) : (
          <button className="node-primary nodrag" disabled={!data.title.trim() || loading} onClick={() => data.onAction?.("explore", id)}>
            {loading ? "Generating research paths…" : "Explore with AI"} {!loading && <ArrowRight size={13} />}
          </button>
        )}
      </div>
    </NodeShell>
  );
}
