import type { MiniMetric } from "@/lib/admin/types";
import { Sparkline } from "./Sparkline";

export function MiniTrendCard({ metric }: { metric: MiniMetric }) {
  return (
    <div className="mini-trend-card">
      <div className="mini-trend-label">{metric.label}</div>
      <div className="mini-trend-value">{metric.formatted}</div>
      {metric.trend.length > 1 && <Sparkline data={metric.trend} width={110} height={30} />}
    </div>
  );
}
