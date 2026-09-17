import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Italic, Type as TypeIcon } from "lucide-react";
import type { FlowNode, FlowNodeData } from "@/lib/types";
import { TEXT_COLORS, type TextAlign, type TextLevel, type TextSize } from "@/lib/textStyles";

const ALIGN_ORDER: TextAlign[] = ["left", "center", "right"];
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight };

const LEVEL_OPTIONS: { value: TextLevel; label: string }[] = [
  { value: "heading", label: "Heading" },
  { value: "subheading", label: "Subheading" },
  { value: "body", label: "Body" },
];
const SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

type MenuKey = "level" | "size" | "color";

/**
 * Replaces the native <select> look with a small popover menu matching the rest of the
 * toolbar. Controlled (open/onToggle come from the parent) so only one popover in the bar can
 * ever be open at a time — opening one always closes any other, which is what actually
 * prevents them from visually overlapping. Opens upward since the bar is docked just above the
 * bottom toolbar, so there's rarely room below.
 */
function FormatDropdown<T extends string>({
  value,
  options,
  ariaLabel,
  open,
  onToggle,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  ariaLabel: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: T) => void;
}) {
  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div className="format-dropdown">
      <button
        type="button"
        className={`format-dropdown-trigger ${open ? "open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{current.label}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="format-dropdown-menu" role="listbox">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`format-dropdown-item ${o.value === value ? "active" : ""}`}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TextFormatBar({ node, onFormat }: { node: FlowNode; onFormat: (partial: Partial<FlowNodeData>) => void }) {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const { data } = node;
  const level: TextLevel = data.textLevel || "body";
  const size: TextSize = data.textSize || "medium";
  const align: TextAlign = data.align || "left";
  const AlignIcon = ALIGN_ICON[align];

  useEffect(() => {
    if (!openMenu) return;
    function onOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [openMenu]);

  function toggleMenu(key: MenuKey) {
    setOpenMenu((v) => (v === key ? null : key));
  }

  return (
    <div className="text-format-bar floating" ref={barRef}>
      <span className="text-format-label">
        <TypeIcon size={14} /> Text
      </span>
      <i />
      <FormatDropdown
        value={level}
        options={LEVEL_OPTIONS}
        ariaLabel="Text level"
        open={openMenu === "level"}
        onToggle={() => toggleMenu("level")}
        onChange={(v) => {
          onFormat({ textLevel: v });
          setOpenMenu(null);
        }}
      />
      <i />
      <div className="format-button-group">
        <button className={data.bold ? "active" : ""} aria-label="Bold" onClick={() => onFormat({ bold: !data.bold })}>
          <Bold size={14} />
        </button>
        <button className={data.italic ? "active" : ""} aria-label="Italic" onClick={() => onFormat({ italic: !data.italic })}>
          <Italic size={14} />
        </button>
        <button aria-label="Alignment" onClick={() => onFormat({ align: ALIGN_ORDER[(ALIGN_ORDER.indexOf(align) + 1) % ALIGN_ORDER.length] })}>
          <AlignIcon size={14} />
        </button>
      </div>
      <i />
      <FormatDropdown
        value={size}
        options={SIZE_OPTIONS}
        ariaLabel="Text size"
        open={openMenu === "size"}
        onToggle={() => toggleMenu("size")}
        onChange={(v) => {
          onFormat({ textSize: v });
          setOpenMenu(null);
        }}
      />
      <i />
      <div className="text-color-picker">
        <button
          className="text-color-swatch"
          aria-label="Text color"
          style={{ background: data.textColor || "#2a2632" }}
          onClick={() => toggleMenu("color")}
        />
        {openMenu === "color" && (
          <div className="text-color-options">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.name}
                aria-label={c.name}
                className="text-color-swatch"
                style={{ background: c.value || "#2a2632" }}
                onClick={() => {
                  onFormat({ textColor: c.value || undefined });
                  setOpenMenu(null);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
