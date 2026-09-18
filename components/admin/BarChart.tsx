export type BarDatum = { label: string; value: number; color?: string };

/** Square baseline, 4px-rounded data end — a rect can't round only one side, so vertical
 * bars are drawn as an explicit path instead of <rect rx>. */
function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

export function BarChart({
  data,
  orientation = "vertical",
  height = 180,
  color = "var(--accent)",
  formatValue,
}: {
  data: BarDatum[];
  orientation?: "vertical" | "horizontal";
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-US"));
  const max = Math.max(...data.map((d) => d.value), 1);

  if (orientation === "horizontal") {
    return (
      <div className="bar-chart horizontal">
        {data.map((d) => (
          <div className="bar-chart-row" key={d.label}>
            <div className="bar-chart-row-label">{d.label}</div>
            <div className="bar-chart-row-track">
              <div className="bar-chart-row-fill" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color ?? color }}>
                <title>{`${d.label}: ${fmt(d.value)}`}</title>
              </div>
            </div>
            <div className="bar-chart-row-value">{fmt(d.value)}</div>
          </div>
        ))}
      </div>
    );
  }

  const unit = 32;
  const barWidth = Math.min(24, Math.max(8, unit - 8));
  const viewWidth = data.length * unit;

  return (
    <svg className="bar-chart vertical" width="100%" height={height} viewBox={`0 0 ${viewWidth} ${height}`} preserveAspectRatio="none">
      <line x1="0" y1={height - 1} x2={viewWidth} y2={height - 1} stroke="var(--border-2)" strokeWidth="1" />
      {data.map((d, i) => {
        const barHeight = Math.max(2, (d.value / max) * (height - 14));
        const x = i * unit + (unit - barWidth) / 2;
        const y = height - barHeight - 1;
        return (
          <path key={d.label + i} d={roundedTopBarPath(x, y, barWidth, barHeight, 4)} fill={d.color ?? color} className="bar-chart-bar">
            <title>{`${d.label}: ${fmt(d.value)}`}</title>
          </path>
        );
      })}
    </svg>
  );
}
