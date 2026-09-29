"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChartFrame, ChartEmpty, LegendItem } from "@/components/charts/chart-frame";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { MONTAGE_LABELS, type MontageKey } from "@/lib/constants";

type Props = {
  raw: Record<string, number[]>;
  processed: Record<string, number[]>;
  channels: string[];
  montage: MontageKey;
  title?: string;
  subtitle?: string;
  samplingRateHz: number;
  windowSeconds?: number;
  defaultChannels?: string[];
  height?: number;
  showSelector?: boolean;
  footerNote?: React.ReactNode;
};

const ROW_HEIGHT = 62;
const LABEL_WIDTH = 62;

/**
 * Multi-channel EEG trace.
 *
 * Drawn as SVG so recorded sessions stay server-renderable and print cleanly.
 * The live screen reuses the same visual language through `LiveWaveform`.
 */
export function EEGChart({
  raw,
  processed,
  channels,
  montage,
  title = "EEG waveform",
  subtitle,
  samplingRateHz,
  windowSeconds = 10,
  defaultChannels,
  height,
  showSelector = true,
  footerNote,
}: Props) {
  const [source, setSource] = useState<"processed" | "raw">("processed");
  const [span, setSpan] = useState(windowSeconds);
  const [active, setActive] = useState<string[]>(
    defaultChannels ?? channels.slice(0, 4),
  );

  const data = source === "raw" ? raw : processed;

  const total = data[active[0]]?.length ?? 0;
  const visibleCount = Math.min(total, Math.max(64, Math.round(span * samplingRateHz)));
  const start = Math.max(0, total - visibleCount);

  const rows = useMemo(
    () =>
      active.map((channel) => {
        const full = data[channel] ?? [];
        const slice = full.slice(start, start + visibleCount);
        const min = Math.min(...slice, 0);
        const max = Math.max(...slice, 1);
        const spanY = max - min || 1;
        const points = slice
          .map((v, i) => {
            const x = (i / Math.max(1, slice.length - 1)) * 1000;
            const y = ROW_HEIGHT - 10 - ((v - min) / spanY) * (ROW_HEIGHT - 20);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(" ");
        return {
          channel,
          points,
          min: Number(min.toFixed(1)),
          max: Number(max.toFixed(1)),
          samples: slice.length,
        };
      }),
    [active, data, start, visibleCount],
  );

  const totalHeight = rows.length * ROW_HEIGHT + 26;

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle ?? `${MONTAGE_LABELS[montage]} · ${samplingRateHz} Hz`}
      actions={
        showSelector ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-line-strong p-0.5">
              {(["processed", "raw"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSource(key)}
                  className={cn(
                    "rounded px-2.5 py-1 text-[12px] font-medium capitalize transition-colors",
                    source === key
                      ? "bg-primary-700 text-ink-inverse"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
            <Select
              value={String(span)}
              onChange={(e) => setSpan(Number(e.target.value))}
              className="h-8 w-28 text-[12px]"
              aria-label="Visible window"
            >
              {[2, 5, 10, 20, 60].map((s) => (
                <option key={s} value={s}>
                  last {s} s
                </option>
              ))}
            </Select>
          </div>
        ) : null
      }
      legend={
        <>
          <LegendItem color="var(--color-primary-600)" label={`${source} signal`} />
          <LegendItem color="var(--color-line-strong)" label={`${visibleCount} samples shown`} />
          <span className="text-[11.5px] text-ink-subtle">
            Amplitude µV · {samplingRateHz} Hz · 0 – {span} s of the recording
          </span>
        </>
      }
    >
      {rows.length === 0 ? (
        <ChartEmpty message="No signal selected" />
      ) : (
        <div style={{ minHeight: height ?? totalHeight }}>
          <div className="flex">
            <div className="shrink-0" style={{ width: LABEL_WIDTH }}>
              {rows.map((row) => (
                <div
                  key={row.channel}
                  className="flex items-center justify-end pr-2.5"
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className="text-[11.5px] font-semibold text-ink-muted tabular-nums">
                    {row.channel}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              <svg
                viewBox={`0 0 1000 ${rows.length * ROW_HEIGHT}`}
                preserveAspectRatio="none"
                className="w-full"
                style={{ height: rows.length * ROW_HEIGHT }}
                role="img"
                aria-label={`EEG waveform for ${rows.map((r) => r.channel).join(", ")}`}
              >
                {rows.map((row, i) => (
                  <g key={row.channel} transform={`translate(0 ${i * ROW_HEIGHT})`}>
                    <rect
                      x="0"
                      y="0"
                      width="1000"
                      height={ROW_HEIGHT}
                      fill={i % 2 === 0 ? "var(--color-surface-subtle)" : "var(--color-surface)"}
                    />
                    <line
                      x1="0"
                      y1={ROW_HEIGHT / 2}
                      x2="1000"
                      y2={ROW_HEIGHT / 2}
                      stroke="var(--color-line)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                    {[0.25, 0.5, 0.75].map((f) => (
                      <line
                        key={f}
                        x1={f * 1000}
                        y1="6"
                        x2={f * 1000}
                        y2={ROW_HEIGHT - 6}
                        stroke="var(--color-line)"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    <polyline
                      points={row.points}
                      fill="none"
                      stroke="var(--color-primary-600)"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between" style={{ paddingLeft: LABEL_WIDTH }}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="text-[10.5px] text-ink-subtle tabular-nums">
                {(start / samplingRateHz + (i * (total - start)) / 4 / samplingRateHz).toFixed(2)} s
              </span>
            ))}
          </div>
        </div>
      )}

      {showSelector && channels.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-line px-3 pt-3">
          <div className="flex items-center justify-between">
            <p className="section-label">Channels</p>
            <div className="flex gap-1.5">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setActive(channels.slice(0, 4))}
              >
                Defaults
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setActive(channels)}
              >
                All ({channels.length})
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setActive([])}
              >
                None
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {channels.map((channel) => {
              const on = active.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() =>
                    setActive((prev) =>
                      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
                    )
                  }
                  className={cn(
                    "rounded border px-2 py-1 text-[11.5px] font-medium transition-colors",
                    on
                      ? "border-primary-300 bg-primary-50 text-primary-800"
                      : "border-line bg-surface text-ink-subtle hover:border-line-strong hover:text-ink",
                  )}
                >
                  {channel}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {footerNote ? (
        <p className="border-t border-line px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-subtle">
          {footerNote}
        </p>
      ) : null}
    </ChartFrame>
  );
}
