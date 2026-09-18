import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { HealthLevel } from "@/lib/admin/types";

const LEVEL_CONFIG: Record<HealthLevel, { icon: typeof CheckCircle2; text: string; bg: string; label: string }> = {
  good: { icon: CheckCircle2, text: "var(--success-text)", bg: "var(--success-bg)", label: "Operational" },
  warning: { icon: AlertTriangle, text: "var(--warning-text)", bg: "var(--warning-bg)", label: "Degraded" },
  critical: { icon: XCircle, text: "var(--error-text)", bg: "var(--error-bg)", label: "Down" },
};

export function StatusPill({ level, label }: { level: HealthLevel; label?: string }) {
  const cfg = LEVEL_CONFIG[level];
  const Icon = cfg.icon;
  return (
    <span className="status-pill" style={{ color: cfg.text, background: cfg.bg }}>
      <Icon size={12} />
      {label ?? cfg.label}
    </span>
  );
}
