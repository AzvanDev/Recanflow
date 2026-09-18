import { ArrowDown, ArrowUp } from "lucide-react";
import type { StatMetric } from "@/lib/admin/types";
import { Sparkline } from "./Sparkline";

export function StatTile({ metric }: { metric: StatMetric }) {
  const DeltaIcon = metric.deltaDirection === "up" ? ArrowUp : ArrowDown;
  const deltaColor = metric.deltaIsGood ? "var(--success-text)" : "var(--error-text)";
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{metric.label}</div>
      <div className="stat-tile-value">{metric.formatted}</div>
      <div className="stat-tile-footer">
        <span className="stat-tile-delta" style={{ color: deltaColor }}>
          <DeltaIcon size={11} />
          {Math.abs(metric.deltaPct)}%
        </span>
        {metric.trend.length > 1 && <Sparkline data={metric.trend} width={72} height={24} />}
      </div>
    </div>
  );
}
