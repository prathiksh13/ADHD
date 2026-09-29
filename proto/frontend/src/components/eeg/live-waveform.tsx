"use client";

import { useMemo } from "react";
import { ChartEmpty, ChartFrame } from "@/components/charts/chart-frame";
import type { StreamFrame } from "@/lib/websocket";

/**
 * Rolling multi-channel trace for a live stream.
 *
 * Mirrors the visual language of `EEGChart` (labelled rows, normalised
 * amplitude, monospace values) so recorded and live sessions read the same.
 * Each frame contributes one sample per channel.
 */
export function LiveWaveform({
  frames,
  channels,
  height = 180,
  title = "Live waveform",
  subtitle,
}: {
  frames: StreamFrame[];
  channels: string[];
  height?: number;
  title?: string;
  subtitle?: string;
}) {
  const rows = useMemo(
    () =>
      channels.map((channel) => {
        const series = frames
          .map((frame) => frame.channels[channel])
          .filter((v): v is number => typeof v === "number");
        if (series.length < 2) return null;

        const min = Math.min(...series);
        const max = Math.max(...series);
        const spanY = max - min || 1;
        const points = series
          .map((value, i) => {
            const x = (i / (series.length - 1)) * 1000;
            const y = ROW_HEIGHT - 10 - ((value - min) / spanY) * (ROW_HEIGHT - 20);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(" ");

        return {
          channel,
          points,
          current: series[series.length - 1],
          min,
          max,
        };
      }),
    [channels, frames],
  );

  const visible = rows.filter((r): r is NonNullable<typeof r> => r !== null);

  if (!visible.length) {
    return (
      <ChartFrame title={title} subtitle={subtitle}>
        <ChartEmpty message="Waiting for signal" />
      </ChartFrame>
    );
  }

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      legend={
        <span className="text-[11.5px] text-ink-subtle">
          {visible.length} channel{visible.length === 1 ? "" : "s"} · newest sample at right ·
          amplitude normalised per channel
        </span>
      }
    >
      <svg
        viewBox={`0 0 1000 ${visible.length * ROW_HEIGHT}`}
        style={{ height }}
        className="w-full"
        role="img"
        aria-label={`Live EEG waveform for ${visible.length} channels`}
      >
        {visible.map((row, i) => {
          const top = i * ROW_HEIGHT;
          return (
            <g key={row.channel} transform={`translate(0 ${top})`}>
              <line
                x1={0}
                x2={1000}
                y1={ROW_HEIGHT / 2}
                y2={ROW_HEIGHT / 2}
                stroke="var(--color-line)"
                strokeDasharray="2 4"
              />
              <text
                x={4}
                y={13}
                className="fill-[var(--color-ink-subtle)] font-mono text-[11px]"
              >
                {row.channel}
              </text>
              <text
                x={996}
                y={13}
                textAnchor="end"
                className="fill-[var(--color-ink-muted)] font-mono text-[11px]"
              >
                {row.current.toFixed(1)} µV
              </text>
              <polyline
                points={row.points}
                fill="none"
                stroke="var(--color-primary-600)"
                strokeWidth={1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

const ROW_HEIGHT = 46;
