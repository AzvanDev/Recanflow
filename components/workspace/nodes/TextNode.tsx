import { useEffect, useRef } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";

type Props = NodeProps<Node<FlowNodeData & { autoFocus?: boolean }>>;

export function TextNode({ id, data, selected }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (data.autoFocus) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={`canvas-node text-bare ${selected ? "selected" : ""}`}>
      <textarea
        ref={ref}
        className="nodrag node-editable-text bare"
        value={data.content || ""}
        placeholder="Text…"
        rows={1}
        onChange={(e) => data.onAction?.("editContent", id, e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
