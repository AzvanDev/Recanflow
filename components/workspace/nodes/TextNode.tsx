import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position, useViewport } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/types";
import { textFontSize, textFontWeight, type TextAlign, type TextLevel, type TextSize } from "@/lib/textStyles";
import { useAutoFocus } from "./shared";

type Props = NodeProps<Node<FlowNodeData & { autoFocus?: boolean }>>;

const MIN_WIDTH = 140;
const MAX_WIDTH = 720;

export function TextNode({ id, data, selected }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoFocus(ref, data.autoFocus);
  const { zoom } = useViewport();

  const level: TextLevel = data.textLevel || "body";
  const size: TextSize = data.textSize || "medium";
  const align: TextAlign = data.align || "left";
  const width = data.width || 220;

  // Textareas don't grow with content on their own — resize to fit whenever the text or its
  // formatting changes, so multi-line headings/body copy never scroll inside a tiny box.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [data.content, level, size, width]);

  function startResize(e: ReactMouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    function onMove(ev: MouseEvent) {
      const dx = (ev.clientX - startX) / zoom;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(startWidth + dx)));
      data.onAction?.("resizeText", id, next);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className={`canvas-node text-bare ${selected ? "selected" : ""}`} style={{ width }}>
      <Handle type="target" position={Position.Top} />

      <textarea
        ref={ref}
        className="nodrag node-editable-text bare"
        style={{
          fontSize: textFontSize(level, size),
          fontWeight: textFontWeight(level, data.bold),
          fontStyle: data.italic ? "italic" : "normal",
          textAlign: align,
          color: data.textColor || undefined,
        }}
        value={data.content || ""}
        placeholder={level === "heading" ? "Heading…" : level === "subheading" ? "Subheading…" : "Text…"}
        rows={1}
        onChange={(e) => data.onAction?.("editContent", id, e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") ref.current?.blur();
        }}
      />

      <div className="text-resize-handle nodrag" onMouseDown={startResize} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
