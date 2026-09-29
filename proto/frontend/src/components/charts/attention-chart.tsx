"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_STYLE, GRID_STYLE, ChartEmpty, ChartFrame, valueFormatter } from "./chart-frame";
import { formatPercent } from "@/lib/format";
import type { AttentionWeights } from "@/types/model";

/** Learned attention weight per step of the model's input sequence. */
export function AttentionChart({
  weights,
  height = 230,
  title = "Attention weights",
  subtitle,
}: {
  weights: AttentionWeights[];
  height?: number;
  title?: string;
  subtitle?: string;
}) {
  if (!weights.length) {
    return (
      <ChartFrame title={title} subtitle={subtitle}>
        <ChartEmpty message="No attention weights reported" />
      </ChartFrame>
    );
  }

  const data = weights.map((w) => ({ label: w.label, weight: w.weight }));

  return (
    <ChartFrame title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--color-line)" }}
            tick={AXIS_STYLE.tick}
            interval={0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={AXIS_STYLE.tick}
            tickFormatter={(v: number) => formatPercent(v, 0)}
          />
          <Tooltip
            {...{ cursor: { fill: "var(--color-surface-sunken)" } }}
            formatter={valueFormatter((v) => formatPercent(v, 2), () => "weight")}
          />
          <Bar
            dataKey="weight"
            name="weight"
            fill="var(--color-accent-400)"
            fillOpacity={0.9}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
