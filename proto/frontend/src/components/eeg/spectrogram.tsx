"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ChartFrame, ChartEmpty } from "@/components/charts/chart-frame";
import { FREQUENCY_BANDS } from "@/lib/constants";
import type { SpectrogramBin } from "@/types/eeg";

/** Sequential ramp tuned for scientific figures — dark on high power. */
const RAMP = [
  "#f2f6f5", "#dceae7", "#c2ddd8", "#a3cdc7", "#83bcb5",
  "#64a9a2", "#4a918b", "#377873", "#275e5b", "#17423f",
];

function rampColor(power: number) {
  const idx = Math.min(RAMP.length - 1, Math.max(0, Math.floor(power * RAMP.length)));
  return RAMP[idx];
}

export function Spectrogram({
  bins,
  timeBins,
  freqBins,
  maxHz = 45,
  title = "Time–frequency spectrogram",
  subtitle,
  showBands = true,
}: {
  bins: SpectrogramBin[];
  timeBins: number;
  freqBins: number;
  maxHz?: number;
  title?: string;
  subtitle?: string;
  showBands?: boolean;
}) {
  const [maxPower, setMaxPower] = useState(1);

  const grid = useMemo(() => {
    const map = new Float32Array(timeBins * freqBins);
    let peak = 0;
    for (const bin of bins) {
      const index = bin.time * freqBins + Math.min(freqBins - 1, Math.floor(bin.frequency / maxHz * freqBins));
      if (index >= 0 && index < map.length) {
        map[index] = bin.power;
        if (bin.power > peak) peak = bin.power;
      }
    }
    return { map, peak };
  }, [bins, timeBins, freqBins, maxHz]);

  if (!bins.length) {
    return (
      <ChartFrame title={title}>
        <ChartEmpty message="No spectrogram available" />
      </ChartFrame>
    );
  }

  const width = 1000;
  const cellW = width / timeBins;
  const cellH = 5;
  const height = freqBins * cellH;

  const freqTicks = [1, 5, 10, 20, 30, 40, 45].filter((f) => f <= maxHz);

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle ?? "Relative power per time bin and frequency bin"}
      actions={
        <label className="flex items-center gap-2 text-[11.5px] text-ink-muted">
          <span>Gain</span>
          <input
            type="range"
            min={0.4}
            max={1.6}
            step={0.1}
            value={maxPower}
            onChange={(e) => setMaxPower(Number(e.target.value))}
            className="w-20 accent-primary-600"
            aria-label="Spectrogram gain"
          />
        </label>
      }
      legend={
        <>
          {showBands
            ? FREQUENCY_BANDS.map((band) => (
                <span key={band.key} className="text-[11px] text-ink-subtle">
                  <span className="font-semibold text-ink-muted">{band.label}</span>{" "}
                  {band.range}
                </span>
              ))
            : null}
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-ink-subtle">
            low
            <span className="flex h-2 w-24 overflow-hidden rounded-sm">
              {RAMP.map((c) => (
                <span key={c} className="flex-1" style={{ backgroundColor: c }} />
              ))}
            </span>
            high
          </span>
        </>
      }
    >
      <div className="flex gap-2">
        <div
          className="flex shrink-0 flex-col justify-between py-px text-right text-[10px] text-ink-subtle tabular-nums"
          style={{ height }}
        >
          {freqTicks.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="w-full rounded-sm"
            style={{ height }}
            role="img"
            aria-label="Time-frequency spectrogram of relative EEG power"
          >
            {Array.from({ length: freqBins }, (_, f) => (
              <g key={f}>
                {Array.from({ length: timeBins }, (_, t) => {
                  const value = grid.map[t * freqBins + f] / maxPower;
                  return (
                    <rect
                      key={t}
                      x={t * cellW}
                      y={height - (f + 1) * cellH}
                      width={cellW + 0.5}
                      height={cellH + 0.5}
                      fill={rampColor(value)}
                    />
                  );
                })}
              </g>
            ))}
          </svg>

          <div className="mt-1 flex justify-between text-[10px] text-ink-subtle tabular-nums">
            <span>0 s</span>
            <span>{Math.round(timeBins / 2)} s</span>
            <span>{timeBins} s</span>
          </div>
          <p className="mt-0.5 text-right text-[10px] text-ink-subtle">Time (s)</p>
        </div>
      </div>

      {showBands ? (
        <div className="mt-3 flex gap-1 pl-7">
          {FREQUENCY_BANDS.map((band, i) => (
            <div
              key={band.key}
              className={cn("h-1 rounded-full", i === 0 && "ml-0")}
              style={{
                width: `${((band.high - band.low) / maxHz) * 100}%`,
                backgroundColor: `var(--color-band-${band.key})`,
                opacity: 0.55,
              }}
              title={`${band.label} ${band.range}`}
            />
          ))}
        </div>
      ) : null}
    </ChartFrame>
  );
}
