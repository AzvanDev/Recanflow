"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { DailyPoint } from "@/lib/admin/types";

export function LineChart({
  data,
  height = 220,
  color = "var(--accent)",
  formatValue,
}: {
  data: DailyPoint[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-US"));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 600;
  const padding = 8;

  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (data.length - 1);
  const toY = (v: number) => height - padding - ((v - min) / range) * (height - padding * 2);
  const points = values.map((v, i) => [padding + i * stepX, toY(v)] as const);
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0]},${height} L${points[0][0]},${height} Z`;

  function handleMove(e: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round((relX - padding) / stepX);
    setHoverIndex(Math.max(0, Math.min(data.length - 1, idx)));
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="line-chart">
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <path d={areaPath} fill={color} opacity="0.1" stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hoveredPoint && (
          <>
            <line x1={hoveredPoint[0]} y1={0} x2={hoveredPoint[0]} y2={height} stroke="var(--border-2)" strokeWidth="1" />
            <circle cx={hoveredPoint[0]} cy={hoveredPoint[1]} r="4" fill={color} stroke="var(--bg-elevated)" strokeWidth="2" />
          </>
        )}
      </svg>
      {hovered && hoveredPoint && (
        <div className="line-chart-tooltip" style={{ left: `${(hoveredPoint[0] / width) * 100}%` }}>
          <div className="line-chart-tooltip-value">{fmt(hovered.value)}</div>
          <div className="line-chart-tooltip-date">{hovered.date}</div>
        </div>
      )}
    </div>
  );
}
