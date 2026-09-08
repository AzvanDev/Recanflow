import type { Node, NodeProps } from "@xyflow/react";
import { ShieldQuestion } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell, StatusBadge } from "./shared";

export function InsightNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const count = data.findingIds?.length ?? 0;
  return (
    <NodeShell kind="insight" selected={selected}>
      <div className="node-kicker-trailer">
        <StatusBadge status={data.status} />
      </div>
      <h3>{data.title}</h3>
      <p>{data.description}</p>
      <div className="node-meta">
        {data.confidence && <span className={`confidence ${data.confidence}`}>Confidence: {data.confidence}</span>}
        <span>{count} supporting finding{count === 1 ? "" : "s"}</span>
      </div>
      <div className="node-footer">
        <button
          className="node-action nodrag"
          onClick={(e) => {
            e.stopPropagation();
            data.onAction?.("challenge", id);
          }}
        >
          <ShieldQuestion size={12} /> Challenge
        </button>
      </div>
    </NodeShell>
  );
}
