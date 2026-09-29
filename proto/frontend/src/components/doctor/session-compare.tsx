"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, TriangleAlert } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Panel } from "@/components/ui/data";
import { Badge } from "@/components/ui/badge";
import { BandComparisonChart } from "@/components/charts/band-charts";
import { formatPercent, formatRatio } from "@/lib/format";
import { FREQUENCY_BANDS, type BandKey } from "@/lib/constants";
import type { BehaviorSummary } from "@/types/session";
import { cn } from "@/lib/utils";

type CompareItem = {
  id: string;
  participant: string;
  startedAt: string;
  duration: string;
  experiment: string;
  stage: string;
  device: string;
  montage: string;
  samplingRateHz: number;
  channels: number;
  windows: number;
  probability: number | null;
  resultLabel: string | null;
  flagged: boolean;
  flagReason: string | null;
  quality: {
    quality: number;
    artifactWindows: number;
    totalWindows: number;
    flatlineRatio: number;
    impedanceOk: boolean;
  };
  behavior: BehaviorSummary | null;
  meanBands: { band: BandKey; value: number }[];
};

const BANDS: BandKey[] = ["delta", "theta", "alpha", "beta"];

/**
 * Side-by-side session comparison.
 *
 * Both sessions are already loaded, so switching the selection is instant and
 * needs no request. Differences are described, never scored or interpreted.
 */
export function SessionCompare({ items }: { items: CompareItem[] }) {
  const [leftId, setLeftId] = useState(items[0].id);
  const [rightId, setRightId] = useState(items[1].id);

  const left = items.find((i) => i.id === leftId) ?? items[0];
  const right = items.find((i) => i.id === rightId) ?? items[1];

  const chartData = useMemo(
    () =>
      BANDS.map((band) => ({
        label: FREQUENCY_BANDS.find((b) => b.key === band)?.label ?? band,
        delta: band === "delta" ? valueOf(left, band) : 0,
        theta: band === "theta" ? valueOf(left, band) : 0,
        alpha: band === "alpha" ? valueOf(left, band) : 0,
        beta: band === "beta" ? valueOf(left, band) : 0,
      })),
    [left],
  );

  const chartDataRight = useMemo(
    () =>
      BANDS.map((band) => ({
        label: FREQUENCY_BANDS.find((b) => b.key === band)?.label ?? band,
        delta: band === "delta" ? valueOf(right, band) : 0,
        theta: band === "theta" ? valueOf(right, band) : 0,
        alpha: band === "alpha" ? valueOf(right, band) : 0,
        beta: band === "beta" ? valueOf(right, band) : 0,
      })),
    [right],
  );

  return (
    <div className="grid gap-4">
      <Panel title="Sessions" description="Choose two completed sessions to compare.">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div className="grid gap-1.5">
            <label className="text-[12px] font-medium text-ink-muted" htmlFor="left">
              Session A
            </label>
            <Select id="left" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} — {item.participant}
                </option>
              ))}
            </Select>
          </div>

          <span className="hidden size-8 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle sm:flex">
            <ArrowLeftRight className="size-4" />
          </span>

          <div className="grid gap-1.5">
            <label className="text-[12px] font-medium text-ink-muted" htmlFor="right">
              Session B
            </label>
            <Select id="right" value={rightId} onChange={(e) => setRightId(e.target.value)}>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} — {item.participant}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {leftId === rightId ? (
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-caution-700">
            <TriangleAlert className="size-3.5" />
            Both slots hold the same session. Pick two different sessions to see a comparison.
          </p>
        ) : null}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {[left, right].map((item, index) => (
          <Panel
            key={item.id}
            title={index === 0 ? "Session A" : "Session B"}
            description={item.id}
            actions={
              <div className="flex items-center gap-1.5">
                {item.flagged ? <Badge tone="caution">flagged</Badge> : null}
                <Badge tone={item.probability !== null && item.probability >= 0.5 ? "caution" : "primary"}>
                  {item.resultLabel ?? "no output"}
                </Badge>
              </div>
            }
          >
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Participant" value={item.participant} />
                <Metric label="Recorded" value={item.startedAt} />
                <Metric label="Duration" value={item.duration} />
                <Metric label="Experiment" value={item.experiment} />
                <Metric label="Device" value={item.device} />
                <Metric label="Montage" value={`${item.montage} · ${item.samplingRateHz} Hz`} />
                <Metric label="Channels" value={String(item.channels)} />
                <Metric label="Windows" value={String(item.windows)} />
              </div>

              <div className="rounded-md border border-line bg-surface-subtle p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-medium text-ink-muted">
                    Model output probability
                  </span>
                  <span className="text-[15px] font-semibold text-ink tabular-nums">
                    {formatPercent(item.probability, 1)}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-ink-subtle">
                  Research model output. Not a diagnosis.
                </p>
              </div>

              <div>
                <p className="section-label mb-2">Signal quality</p>
                <div className="flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                    <span
                      className={cn("block h-full rounded-full")}
                      style={{
                        width: `${Math.round(item.quality.quality * 100)}%`,
                        backgroundColor:
                          item.quality.quality >= 0.85
                            ? "var(--color-positive-500)"
                            : item.quality.quality >= 0.7
                              ? "var(--color-caution-500)"
                              : "var(--color-critical-500)",
                      }}
                    />
                  </span>
                  <span className="w-14 text-right text-[12px] text-ink-muted tabular-nums">
                    {formatPercent(item.quality.quality, 1)}
                  </span>
                </div>
                <p className="mt-1.5 text-[11.5px] text-ink-subtle tabular-nums">
                  {item.quality.artifactWindows} artifact / {item.quality.totalWindows} windows ·
                  flatline {formatPercent(item.quality.flatlineRatio, 1)}
                </p>
                {item.flagReason ? (
                  <p className="mt-1.5 text-[11.5px] text-caution-700">{item.flagReason}</p>
                ) : null}
              </div>

              <div>
                <p className="section-label mb-2">Mean band power</p>
                <ul className="grid gap-1.5">
                  {BANDS.map((band) => {
                    const value = valueOf(item, band);
                    const max = Math.max(
                      ...item.meanBands.map((b) => b.value),
                      0.0001,
                    );
                    return (
                      <li key={band} className="flex items-center gap-2.5">
                        <span className="w-16 shrink-0 text-[12px] text-ink-muted">
                          {FREQUENCY_BANDS.find((b) => b.key === band)?.label ?? band}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${(value / max) * 100}%`,
                              backgroundColor: "var(--color-primary-500)",
                            }}
                          />
                        </span>
                        <span className="w-14 text-right text-[12px] text-ink-muted tabular-nums">
                          {formatRatio(value, 3)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {item.behavior ? (
                <div>
                  <p className="section-label mb-2">Behaviour</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Metric
                      label="Accuracy"
                      value={formatPercent(
                        item.behavior.correctResponses /
                          Math.max(
                            1,
                            item.behavior.correctResponses + item.behavior.incorrectResponses,
                          ),
                        0,
                      )}
                    />
                    <Metric label="Reaction time" value={`${item.behavior.reactionTimeMs} ms`} />
                    <Metric label="Missed" value={String(item.behavior.missedTargets)} />
                    <Metric
                      label="Task score"
                      value={formatPercent(item.behavior.taskScore, 0)}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-ink-subtle">
                  No behavioural data linked to this session.
                </p>
              )}
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BandComparisonChart
          data={chartData}
          title={`Band power — ${left.id}`}
          subtitle="Mean relative power over accepted windows"
        />
        <BandComparisonChart
          data={chartDataRight}
          title={`Band power — ${right.id}`}
          subtitle="Mean relative power over accepted windows"
        />
      </div>

      <Panel title="Difference" description="Descriptive only. No threshold is applied.">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {BANDS.map((band) => {
            const delta = valueOf(right, band) - valueOf(left, band);
            return (
              <div key={band} className="rounded-md border border-line p-3.5">
                <p className="text-[12px] font-medium text-ink-muted">
                  {FREQUENCY_BANDS.find((b) => b.key === band)?.label ?? band}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[15px] font-semibold tabular-nums",
                    Math.abs(delta) < 0.0005
                      ? "text-ink-subtle"
                      : delta > 0
                        ? "text-positive-700"
                        : "text-critical-600",
                  )}
                >
                  {delta >= 0 ? "+" : ""}
                  {formatRatio(delta, 3)}
                </p>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function valueOf(item: CompareItem, band: BandKey) {
  return item.meanBands.find((b) => b.band === band)?.value ?? 0;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-subtle">{label}</p>
      <p className="mt-0.5 truncate text-[12.5px] font-medium text-ink">{value}</p>
    </div>
  );
}
