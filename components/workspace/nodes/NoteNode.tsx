import { useRef } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell, useAutoFocus } from "./shared";

type Props = NodeProps<Node<FlowNodeData & { autoFocus?: boolean }>>;

export function NoteNode({ id, data, selected }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoFocus(ref, data.autoFocus);
  return (
    <NodeShell kind="note" selected={selected} dimmed={data.dimmed}>
      <textarea
        ref={ref}
        className="nodrag node-editable-text"
        value={data.content || ""}
        placeholder="Start typing…"
        rows={4}
        onChange={(e) => data.onAction?.("editContent", id, e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </NodeShell>
  );
}
