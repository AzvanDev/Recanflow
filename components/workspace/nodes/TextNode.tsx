import { useRef } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { useAutoFocus } from "./shared";

type Props = NodeProps<Node<FlowNodeData & { autoFocus?: boolean }>>;

export function TextNode({ id, data, selected }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoFocus(ref, data.autoFocus);
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
