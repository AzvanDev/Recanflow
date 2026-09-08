import type { ComponentType } from "react";
import { FileText, Hand, Lightbulb, MessageSquarePlus, MousePointer2, Redo2, Sparkles, Telescope, Type as TypeIcon, Undo2 } from "lucide-react";

export type Tool = "select" | "hand";

function ToolButton({
  icon: Icon,
  label,
  shortcut,
  active,
  disabled,
  onClick,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={active ? "active" : ""}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={18} />
    </button>
  );
}

export function Toolbar({
  tool,
  onSelectTool,
  onCreateQuestion,
  onCreateNote,
  onCreateResearch,
  onSaveFinding,
  canSaveFinding,
  onSynthesize,
  canSynthesize,
  onCreateText,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  tool: Tool;
  onSelectTool: (tool: Tool) => void;
  onCreateQuestion: () => void;
  onCreateNote: () => void;
  onCreateResearch: () => void;
  onSaveFinding: () => void;
  canSaveFinding: boolean;
  onSynthesize: () => void;
  canSynthesize: boolean;
  onCreateText: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  return (
    <nav className="toolbar floating">
      <ToolButton icon={MousePointer2} label="Select" shortcut="V" active={tool === "select"} onClick={() => onSelectTool("select")} />
      <ToolButton icon={Hand} label="Hand / pan" shortcut="H" active={tool === "hand"} onClick={() => onSelectTool("hand")} />
      <i />
      <ToolButton icon={Sparkles} label="New question" shortcut="Q" onClick={onCreateQuestion} />
      <ToolButton icon={FileText} label="New note" shortcut="N" onClick={onCreateNote} />
      <ToolButton icon={Telescope} label="New research" shortcut="R" onClick={onCreateResearch} />
      <ToolButton
        icon={MessageSquarePlus}
        label={canSaveFinding ? "Save last response as finding" : "Open a research response first"}
        shortcut="F"
        disabled={!canSaveFinding}
        onClick={onSaveFinding}
      />
      <ToolButton
        icon={Lightbulb}
        label={canSynthesize ? "Synthesize selected findings" : "Select 2+ findings to synthesize"}
        shortcut="I"
        disabled={!canSynthesize}
        onClick={onSynthesize}
      />
      <i />
      <ToolButton icon={TypeIcon} label="New text" onClick={onCreateText} />
      <i />
      <ToolButton icon={Undo2} label="Undo" shortcut="Ctrl+Z" disabled={!canUndo} onClick={onUndo} />
      <ToolButton icon={Redo2} label="Redo" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={onRedo} />
    </nav>
  );
}
