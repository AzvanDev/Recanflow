import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { FileText, GitBranch, Lightbulb, Sparkles, Telescope, Type as TypeIcon } from "lucide-react";
import type { NodeKind, NodeStatus } from "@/lib/types";

export const KIND_LABEL: Record<NodeKind, string> = {
  question: "Question",
  branch: "Research branch",
  research: "Research",
  finding: "Finding",
  insight: "Insight",
  note: "Note",
  text: "Text",
};

export const KIND_ICON: Record<NodeKind, typeof Sparkles> = {
  question: Sparkles,
  branch: GitBranch,
  research: Telescope,
  finding: FileText,
  insight: Lightbulb,
  note: FileText,
  text: TypeIcon,
};

export function StatusBadge({ status }: { status?: NodeStatus }) {
  if (!status || status === "idle") return null;
  return <span className={`status ${status}`}>{status === "loading" ? "Working…" : status}</span>;
}

export function NodeShell({
  kind,
  selected,
  showHandles = true,
  className = "",
  children,
}: {
  kind: NodeKind;
  selected?: boolean;
  showHandles?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Icon = KIND_ICON[kind];
  return (
    <div className={`canvas-node ${kind} ${selected ? "selected" : ""} ${className}`}>
      {showHandles && <Handle type="target" position={Position.Top} />}
      <div className="node-kicker">
        <Icon size={13} /> {KIND_LABEL[kind].toUpperCase()}
      </div>
      {children}
      {showHandles && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
