"use client";

import { useState } from "react";
import type { DailyPoint } from "@/lib/admin/types";
import { LineChart } from "./LineChart";

const RANGES = [7, 30, 90] as const;

export function RangeLineChart({ data, formatValue }: { data: DailyPoint[]; formatValue?: (v: number) => string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  return (
    <div>
      <div className="chart-toolbar">
        <div className="range-toggle">
          {RANGES.map((r) => (
            <button key={r} type="button" className={range === r ? "active" : ""} onClick={() => setRange(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>
      <LineChart data={data.slice(-range)} formatValue={formatValue} />
    </div>
  );
}
