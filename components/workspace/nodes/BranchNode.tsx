import type { Node, NodeProps } from "@xyflow/react";
import { ArrowRight } from "lucide-react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell } from "./shared";

export function BranchNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <NodeShell kind="branch" selected={selected}>
      <h3>{data.title}</h3>
      <p>{data.description}</p>
      <div className="node-footer">
        <button
          className="node-action nodrag"
          onClick={(e) => {
            e.stopPropagation();
            data.onAction?.("openResearch", id);
          }}
        >
          Explore <ArrowRight size={12} />
        </button>
      </div>
    </NodeShell>
  );
}
