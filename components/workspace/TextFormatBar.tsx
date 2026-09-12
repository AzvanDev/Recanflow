import { useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Type as TypeIcon } from "lucide-react";
import type { FlowNode, FlowNodeData } from "@/lib/types";
import { TEXT_COLORS, type TextAlign, type TextLevel, type TextSize } from "@/lib/textStyles";

const ALIGN_ORDER: TextAlign[] = ["left", "center", "right"];
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight };

export function TextFormatBar({ node, onFormat }: { node: FlowNode; onFormat: (partial: Partial<FlowNodeData>) => void }) {
  const [colorOpen, setColorOpen] = useState(false);
  const { data } = node;
  const level: TextLevel = data.textLevel || "body";
  const size: TextSize = data.textSize || "medium";
  const align: TextAlign = data.align || "left";
  const AlignIcon = ALIGN_ICON[align];

  return (
    <div className="text-format-bar floating">
      <span className="text-format-label">
        <TypeIcon size={14} /> Text
      </span>
      <i />
      <select value={level} aria-label="Text level" onChange={(e) => onFormat({ textLevel: e.target.value as TextLevel })}>
        <option value="heading">Heading</option>
        <option value="subheading">Subheading</option>
        <option value="body">Body</option>
      </select>
      <button className={data.bold ? "active" : ""} aria-label="Bold" onClick={() => onFormat({ bold: !data.bold })}>
        <Bold size={14} />
      </button>
      <button className={data.italic ? "active" : ""} aria-label="Italic" onClick={() => onFormat({ italic: !data.italic })}>
        <Italic size={14} />
      </button>
      <button aria-label="Alignment" onClick={() => onFormat({ align: ALIGN_ORDER[(ALIGN_ORDER.indexOf(align) + 1) % ALIGN_ORDER.length] })}>
        <AlignIcon size={14} />
      </button>
      <select value={size} aria-label="Text size" onChange={(e) => onFormat({ textSize: e.target.value as TextSize })}>
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
      <div className="text-color-picker">
        <button
          className="text-color-swatch"
          aria-label="Text color"
          style={{ background: data.textColor || "#2a2632" }}
          onClick={() => setColorOpen((v) => !v)}
        />
        {colorOpen && (
          <div className="text-color-options">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.name}
                aria-label={c.name}
                className="text-color-swatch"
                style={{ background: c.value || "#2a2632" }}
                onClick={() => {
                  onFormat({ textColor: c.value || undefined });
                  setColorOpen(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
