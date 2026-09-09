import type { Node, NodeProps } from "@xyflow/react";
import { Swords } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell, StatusBadge } from "./shared";

export function DebateNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const exchanges = data.messages?.length ?? 0;

  return (
    <NodeShell kind="debate" selected={selected}>
      <div className="node-kicker-trailer">
        <StatusBadge status={data.status} />
      </div>
      <h3>{data.title}</h3>
      <div className="node-meta">
        {exchanges === 0 ? "Not started" : `${exchanges} exchange${exchanges === 1 ? "" : "s"}`}
        {data.debateSummary && <span className={`confidence ${data.debateSummary.confidence}`}>Confidence: {data.debateSummary.confidence}</span>}
      </div>
      <div className="node-footer">
        <button
          className="node-action nodrag"
          onClick={(e) => {
            e.stopPropagation();
            data.onAction?.("openDebate", id);
          }}
        >
          <Swords size={12} /> {exchanges === 0 ? "Start debate" : "Continue debate"}
        </button>
      </div>
    </NodeShell>
  );
}
