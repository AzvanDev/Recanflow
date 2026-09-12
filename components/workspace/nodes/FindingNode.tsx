import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell } from "./shared";

export function FindingNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <NodeShell kind="finding" selected={selected} dimmed={data.dimmed}>
      <h3>{data.title}</h3>
      <textarea
        className="nodrag node-editable-text"
        value={data.content || ""}
        onChange={(e) => data.onAction?.("editContent", id, e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        rows={4}
      />
      {data.provenance?.branchTitle && <div className="node-meta node-provenance">from {data.provenance.branchTitle}</div>}
    </NodeShell>
  );
}
