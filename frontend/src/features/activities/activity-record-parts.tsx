"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  numericCell,
  type ActivityRecord,
} from "@/features/activities/use-activity-records";
import { formatDateTime } from "@/lib/utils";

export const recordBox =
  "rounded-xl border border-line bg-surface p-4 sm:p-5";

export function RunCard({ run }: { run: ActivityRecord }) {
  return (
    <article className={recordBox}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">{run.title}</h3>
        <Badge tone={run.mode === "scored" ? "brand" : "outline"}>
          {run.mode === "scored" ? "Scored task" : "Trial / practice"}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-ink-subtle">
        {formatDateTime(run.at)} UTC ·{" "}
        {run.source === "saved" ? "Saved to your account" : "Current visit"}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {run.cells.map((cell, index) => (
          <div key={index}>
            <dt className="text-xs text-ink-muted">{run.columns[index]}</dt>
            <dd className="mt-1 font-mono text-lg text-ink">{cell}</dd>
          </div>
        ))}
      </dl>
      <Link
        href={run.href}
        className="mt-3 inline-flex min-h-11 items-center text-sm text-brand-700 underline"
      >
        View activity results
      </Link>
      {run.attentionTelemetry ? <details className="mt-3 text-sm text-ink-muted"><summary className="cursor-pointer">Focus and blink observations · experimental</summary>
        <p className="mt-2">{run.attentionTelemetry.calibrationComplete && run.attentionTelemetry.observedDurationMs > 0 ? `${run.attentionTelemetry.focusPercentage.toFixed(1)}% observed on-screen focus · ${run.attentionTelemetry.totalBlinks} blinks · ${run.attentionTelemetry.distractionCount} distraction cues · average recovery ${Math.round(run.attentionTelemetry.avgRecoveryLatencyMs)} ms.` : "Calibration or observation was incomplete; no reliable focus percentage is available."}</p>
        <p className="mt-1 text-xs">{run.attentionTelemetry.telemetryEvents.length} timestamped events. Camera images were not saved. These are descriptive heuristics, not clinical measurements.</p>
      </details> : null}
    </article>
  );
}

/** One activity at a time, so progress never pools different measurements. */
export function ActivityTrend({ runs }: { runs: ActivityRecord[] }) {
  const [activityId, setActivityId] = useState("");
  const activities = [
    ...new Map(runs.map((run) => [run.activityId, run.title])).entries(),
  ];
  const selected = activities.some(([id]) => id === activityId)
    ? activityId
    : activities[0]?.[0];
  const group = runs
    .filter((run) => run.activityId === selected)
    .sort((a, b) => a.at.localeCompare(b.at));
  const latest = group.at(-1);

  if (!latest) {
    return null;
  }

  const primary = numericCell(latest.cells[0]);
  const points = group.slice(-20).map((run, index) => ({
    run: group.length - Math.min(group.length, 20) + index + 1,
    value: numericCell(run.cells[0])?.value ?? null,
    at: run.at,
  }));

  return (
    <section className="space-y-4" aria-label="Progress by activity">
      <div>
        <h2 className="text-lg font-semibold text-ink">Change over time</h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          Choose one activity to compare its scored runs. Each activity measures
          something different, so results are never combined into one score.
        </p>
      </div>
      <label className="block text-sm font-medium text-ink">
        Choose an activity
        <select
          value={selected}
          onChange={(event) => setActivityId(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface p-3"
        >
          {activities.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </label>
      <RunCard run={latest} />
      <div className={recordBox}>
        <h3 className="font-semibold text-ink">
          {latest.columns[0]} over time
        </h3>
        <p className="mt-1 text-sm text-ink-muted">
          {group.length} completed scored run{group.length === 1 ? "" : "s"}.{" "}
          {group.length === 1
            ? "Your first result is recorded. Another scored run of this activity will add a comparison."
            : "Each point is one scored run of this activity."}
        </p>
        {points.length >= 2 ? (
          <div
            className="mt-4 h-56"
            role="img"
            aria-label={`${latest.columns[0]} across ${points.length} scored runs`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="run" allowDecimals={false} />
                <YAxis domain={primary?.unit === "%" ? [0, 100] : ["auto", "auto"]} />
                <Tooltip
                  labelFormatter={(run) => `Run ${run}`}
                  formatter={(value) => [
                    `${value}${primary?.unit ?? ""}`,
                    latest.columns[0],
                  ]}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  name={latest.columns[0]}
                  stroke="#446b59"
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-ink">
            All recorded values
          </summary>
          <ul className="mt-2 space-y-2">
            {group
              .slice()
              .reverse()
              .map((run) => (
                <li
                  key={run.id}
                  className="border-t border-line py-2 text-sm text-ink-muted"
                >
                  {formatDateTime(run.at)} UTC · {run.cells[0]}
                </li>
              ))}
          </ul>
        </details>
      </div>
      <p className="text-xs leading-5 text-ink-subtle">
        Practice runs are excluded. Scores can change with practice, sleep,
        distractions and your device; they do not establish ADHD severity.
      </p>
    </section>
  );
}
