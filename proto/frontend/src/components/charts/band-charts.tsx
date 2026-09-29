"use client";

import { useMemo } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_STYLE, ChartEmpty, ChartFrame, GRID_STYLE, LegendItem, valueFormatter } from "./chart-frame";
import { FREQUENCY_BANDS, bandColor, type BandKey } from "@/lib/constants";
import { formatPercent, formatRatio } from "@/lib/format";
import type { BandPowerPoint } from "@/types/eeg";

const bandLabelOf = (name: number | string) =>
  FREQUENCY_BANDS.find((b) => b.label === name)?.label ?? String(name);

const tooltipStyle = {
  contentStyle: {
    borderRadius: 6,
    border: "1px solid var(--color-line-strong)",
    boxShadow: "var(--shadow-raised)",
    fontSize: 12,
    padding: "8px 10px",
    background: "var(--color-surface)",
  },
  labelStyle: { color: "var(--color-ink-muted)", fontSize: 11, marginBottom: 4 },
  itemStyle: { color: "var(--color-ink)", padding: 0 },
} as const;

/* ------------------------------------------------------------------ *
 * Band power over time
 * ------------------------------------------------------------------ */

export function BandPowerChart({
  data,
  bands = ["delta", "theta", "alpha", "beta"],
  height = 260,
  title = "Band power over time",
  subtitle = "Relative power per 1 s window",
  showGamma = false,
}: {
  data: BandPowerPoint[];
  bands?: BandKey[];
  height?: number;
  title?: string;
  subtitle?: string;
  showGamma?: boolean;
}) {
  const active = useMemo(
    () => (showGamma ? [...bands, "gamma" as BandKey] : bands),
    [bands, showGamma],
  );

  if (!data.length) return <ChartFrame title={title}><ChartEmpty message="No band-power data" /></ChartFrame>;

  const latest = data[data.length - 1];

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={active.map((key) => (
        <LegendItem
          key={key}
          color={bandColor(key)}
          label={FREQUENCY_BANDS.find((b) => b.key === key)?.label ?? key}
          value={formatRatio(latest[key as keyof BandPowerPoint] as number, 3)}
        />
      ))}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 14, left: 4, bottom: 0 }}>
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={{ stroke: "var(--color-line)" }}
            tick={AXIS_STYLE.tick}
            label={{
              value: "Window index (1 s)",
              position: "insideBottom",
              offset: -2,
              fill: "var(--color-ink-subtle)",
              fontSize: 11,
            }}
            height={34}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={46}
            tick={AXIS_STYLE.tick}
            domain={[0, "auto"]}
            label={{
              value: "Relative power",
              angle: -90,
              position: "insideLeft",
              fill: "var(--color-ink-subtle)",
              fontSize: 11,
              offset: 8,
            }}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={valueFormatter((v) => formatRatio(v, 4), bandLabelOf)}
            labelFormatter={(label) => `Window ${label}`}
          />
          {active.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={FREQUENCY_BANDS.find((b) => b.key === key)?.label ?? key}
              stroke={bandColor(key)}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Mean band power per channel
 * ------------------------------------------------------------------ */

export function ChannelBandBar({
  data,
  band,
  height = 240,
  title,
  subtitle,
}: {
  data: { channel: string; value: number }[];
  band: BandKey;
  height?: number;
  title?: string;
  subtitle?: string;
}) {
  const bandLabel = FREQUENCY_BANDS.find((b) => b.key === band)?.label ?? band;

  if (!data.length) return <ChartFrame title={title}><ChartEmpty message="No channel data" /></ChartFrame>;

  return (
    <ChartFrame
      title={title ?? `${bandLabel} power by channel`}
      subtitle={subtitle ?? "Mean relative power across the session"}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis
            dataKey="channel"
            tickLine={false}
            axisLine={{ stroke: "var(--color-line)" }}
            tick={AXIS_STYLE.tick}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={48}
          />
          <YAxis tickLine={false} axisLine={false} width={40} tick={AXIS_STYLE.tick} domain={[0, "auto"]} />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: "var(--color-surface-sunken)" }}
            formatter={valueFormatter((v) => formatRatio(v, 4), () => bandLabel)}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={26}>
            {data.map((_, i) => (
              <Cell key={i} fill={bandColor(band)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Band power comparison across sessions or groups
 * ------------------------------------------------------------------ */

export function BandComparisonChart({
  data,
  height = 260,
  title = "Band power comparison",
  subtitle,
}: {
  data: { label: string; delta: number; theta: number; alpha: number; beta: number }[];
  height?: number;
  title?: string;
  subtitle?: string;
}) {
  const keys: BandKey[] = ["delta", "theta", "alpha", "beta"];

  if (!data.length) return <ChartFrame title={title}><ChartEmpty message="Nothing to compare" /></ChartFrame>;

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={keys.map((k) => (
        <LegendItem key={k} color={bandColor(k)} label={FREQUENCY_BANDS.find((b) => b.key === k)?.label ?? k} />
      ))}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--color-line)" }}
            tick={AXIS_STYLE.tick}
          />
          <YAxis tickLine={false} axisLine={false} width={40} tick={AXIS_STYLE.tick} domain={[0, "auto"]} />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: "var(--color-surface-sunken)" }}
            formatter={valueFormatter((v) => formatRatio(v, 4), bandLabelOf)}
          />
          {keys.map((k) => (
            <Bar
              key={k}
              dataKey={k}
              name={FREQUENCY_BANDS.find((b) => b.key === k)?.label}
              fill={bandColor(k)}
              fillOpacity={0.88}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              maxBarSize={18}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Classification probability
 * ------------------------------------------------------------------ */

export function ProbabilityChart({
  data,
  height = 220,
  title = "Classification probability",
  subtitle,
  threshold = 0.5,
}: {
  data: { label: string; probability: number }[];
  height?: number;
  title?: string;
  subtitle?: string;
  threshold?: number;
}) {
  if (!data.length) return <ChartFrame title={title}><ChartEmpty message="No predictions" /></ChartFrame>;

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle ?? "Per-session model output, aggregated to one value per session"}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChartLike data={data} threshold={threshold} />
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function AreaChartLike({
  data,
  threshold,
}: {
  data: { label: string; probability: number }[];
  threshold: number;
}) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
      <defs>
        <linearGradient id="probFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-400)" stopOpacity={0.28} />
          <stop offset="100%" stopColor="var(--color-primary-400)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid {...GRID_STYLE} vertical={false} />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={{ stroke: "var(--color-line)" }}
        tick={AXIS_STYLE.tick}
        minTickGap={24}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={40}
        tick={AXIS_STYLE.tick}
        domain={[0, 1]}
        tickFormatter={(v) => formatPercent(v as number)}
      />
      <Tooltip
        {...tooltipStyle}
        formatter={valueFormatter((v) => formatPercent(v, 1), () => "Probability")}
      />
      <ReferenceLine
        y={threshold}
        stroke="var(--color-line-strong)"
        strokeDasharray="4 4"
        label={{
          value: "decision threshold",
          position: "insideTopRight",
          fill: "var(--color-ink-subtle)",
          fontSize: 10,
        }}
      />
      <Area
        type="monotone"
        dataKey="probability"
        stroke="var(--color-primary-600)"
        strokeWidth={1.8}
        fill="url(#probFill)"
        dot={{ r: 2.5, fill: "var(--color-primary-600)", strokeWidth: 0 }}
        isAnimationActive={false}
      />
      <Line dataKey={() => threshold} hide />
    </LineChart>
  );
}
