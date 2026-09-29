"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_STYLE, GRID_STYLE, ChartEmpty, ChartFrame, valueFormatter } from "./chart-frame";
import { formatPercent } from "@/lib/format";

/**
 * ROC curve with the chance diagonal.
 *
 * Points come from a `ModelResult.roc` array reported by the evaluation run.
 */
export function RocCurve({
  points,
  height = 260,
  title = "ROC curve",
  subtitle,
}: {
  points: { fpr: number; tpr: number }[];
  height?: number;
  title?: string;
  subtitle?: string;
}) {
  if (!points.length) {
    return (
      <ChartFrame title={title} subtitle={subtitle}>
        <ChartEmpty message="No ROC data reported" />
      </ChartFrame>
    );
  }

  const data = points.map((p) => ({ fpr: p.fpr, tpr: p.tpr, chance: p.fpr }));
  const auc = trapezoid(points);

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={
        <span className="flex items-center gap-4 text-[11.5px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3.5 rounded-full"
              style={{ backgroundColor: "var(--color-primary-600)" }}
              aria-hidden
            />
            model
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-3.5 rounded-full"
              style={{ backgroundColor: "var(--color-ink-subtle)" }}
              aria-hidden
            />
            chance
          </span>
          <span className="ml-auto font-semibold text-ink tabular-nums">
            AUC {formatPercent(auc, 1)}
          </span>
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rocFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary-600)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-primary-600)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis
            type="number"
            dataKey="fpr"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickLine={false}
            axisLine={{ stroke: "var(--color-line)" }}
            tick={AXIS_STYLE.tick}
            tickFormatter={(v: number) => formatPercent(v, 0)}
          />
          <YAxis
            type="number"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickLine={false}
            axisLine={false}
            width={40}
            tick={AXIS_STYLE.tick}
            tickFormatter={(v: number) => formatPercent(v, 0)}
          />
          <Tooltip
            cursor={{ fill: "var(--color-surface-sunken)" }}
            formatter={valueFormatter((v) => formatPercent(v, 1), () => "rate")}
          />
          <Area
            type="monotone"
            dataKey="tpr"
            stroke="var(--color-primary-600)"
            strokeWidth={2}
            fill="url(#rocFill)"
            isAnimationActive={false}
            name="TPR"
          />
          <Line
            type="monotone"
            dataKey="chance"
            stroke="var(--color-ink-subtle)"
            strokeWidth={1.2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
            name="Chance"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Trapezoidal rule over the reported ROC points, in the order supplied. */
function trapezoid(points: { fpr: number; tpr: number }[]) {
  const sorted = [...points].sort((a, b) => a.fpr - b.fpr);
  let area = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const dx = sorted[i].fpr - sorted[i - 1].fpr;
    area += (dx * (sorted[i].tpr + sorted[i - 1].tpr)) / 2;
  }
  return area;
}
