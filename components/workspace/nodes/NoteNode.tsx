import { useEffect, useRef } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { NodeShell } from "./shared";

type Props = NodeProps<Node<FlowNodeData & { autoFocus?: boolean }>>;

export function NoteNode({ id, data, selected }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (data.autoFocus) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <NodeShell kind="note" selected={selected}>
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
