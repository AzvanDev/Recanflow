import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell } from "./shared";

export function ResultNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <NodeShell kind="result" selected={selected}>
      <h3>{data.title}</h3>
      <p className="node-answer-preview">{data.content}</p>
    </NodeShell>
  );
}
