import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Handle, Position } from "@xyflow/react";
import { BookOpen, FileText, GitBranch, Lightbulb, MessageCircle, Sparkles, Swords, Telescope, Type as TypeIcon, Wand2 } from "lucide-react";
import type { NodeKind, NodeStatus } from "@/lib/types";

export const KIND_LABEL: Record<NodeKind, string> = {
  question: "Question",
  answer: "Answer",
  branch: "Follow-up",
  research: "Research",
  finding: "Finding",
  insight: "Insight",
  note: "Note",
  text: "Text",
  debate: "Debate",
  result: "AI Result",
  researchBranch: "Research Branch",
};

export const KIND_ICON: Record<NodeKind, typeof Sparkles> = {
  question: Sparkles,
  answer: MessageCircle,
  branch: GitBranch,
  research: Telescope,
  finding: FileText,
  insight: Lightbulb,
  note: FileText,
  text: TypeIcon,
  debate: Swords,
  result: Wand2,
  researchBranch: BookOpen,
};

/**
 * Focuses a freshly created node's input on mount. Deferred a tick because XYFlow's own
 * node wrapper manages DOM focus for selected nodes (for keyboard nav) in an effect that can
 * run after ours in the same commit, stealing focus back if we call it synchronously.
 */
export function useAutoFocus(ref: RefObject<HTMLTextAreaElement | null>, autoFocus?: boolean) {
  useEffect(() => {
    if (!autoFocus) return;
    // XYFlow's own node wrapper also manages DOM focus around selection; a single attempt
    // sometimes loses that race, so retry briefly until the textarea actually holds focus.
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const el = ref.current;
      if (el && document.activeElement !== el) el.focus();
      if (!el || document.activeElement === el || attempts > 10) window.clearInterval(timer);
    }, 40);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Reveals `text` over a fixed total duration regardless of length, so a long answer doesn't
 * feel slow and a short one doesn't feel skipped. Only animates when `animate` is true (gated
 * by the caller on a "this content was just generated" flag) — re-renders of an already-shown
 * answer, and content restored on page load, render instantly since the effect only re-runs
 * when `text` itself changes.
 */
export function useRevealText(text: string, animate: boolean, duration = 450) {
  const [shown, setShown] = useState(() => (animate ? "" : text));
  useEffect(() => {
    if (!animate) {
      setShown(text);
      return;
    }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setShown(text.slice(0, Math.ceil(text.length * progress)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, animate, duration]);
  return shown;
}

export function StatusBadge({ status }: { status?: NodeStatus }) {
  if (!status || status === "idle") return null;
  return <span className={`status ${status}`}>{status === "loading" ? "Working…" : status}</span>;
}

export function NodeShell({
  kind,
  selected,
  dimmed,
  showHandles = true,
  className = "",
  children,
}: {
  kind: NodeKind;
  selected?: boolean;
  dimmed?: boolean;
  showHandles?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const Icon = KIND_ICON[kind];
  return (
    <div className={`canvas-node ${kind} ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""} ${className}`}>
      {showHandles && <Handle type="target" position={Position.Top} />}
      <div className="node-kicker">
        <Icon size={13} /> {KIND_LABEL[kind].toUpperCase()}
      </div>
      {children}
      {showHandles && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
