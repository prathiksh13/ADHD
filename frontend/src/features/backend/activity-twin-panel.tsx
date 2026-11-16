"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors } from "@/components/charts/chart-tokens";
import { Badge } from "@/components/ui/badge";
import type { TwinActivityProfile } from "@/lib/backend/twin";
import { formatDateTime } from "@/lib/utils";

const METRICS: Record<string, { label: string; unit: string }> = {
  accuracy_percent: { label: "Correct responses", unit: "%" },
  mean_hit_reaction_time_ms: { label: "Response time on target trials", unit: " ms" },
  hit_reaction_time_stddev_ms: { label: "Response-time variation", unit: " ms" },
  commission_error_count: { label: "Responses when you needed to wait", unit: "" },
  mean_reaction_time_ms: { label: "Average response time", unit: " ms" },
  mean_go_reaction_time_ms: { label: "Response time on go trials", unit: " ms" },
  stop_success_percent: { label: "Successful stops", unit: "%" },
  stop_success_rate_percent: { label: "Successful stops", unit: "%" },
  go_accuracy_percent: { label: "Correct go responses", unit: "%" },
  interference_effect_ms: { label: "Extra time with conflicting information", unit: " ms" },
  switch_cost_ms: { label: "Extra time when switching tasks", unit: " ms" },
  solved_percent: { label: "Puzzles solved", unit: "%" },
  mean_extra_moves: { label: "Extra moves per solved puzzle", unit: "" },
  mean_planning_time_ms: { label: "Time before the first move", unit: " ms" },
  longest_correct_span: { label: "Longest sequence recalled", unit: " items" },
  correct_position_percent: { label: "Sequence positions recalled", unit: "%" },
  mean_absolute_error_ms: { label: "Distance from the target duration", unit: " ms" },
  within_tolerance_percent: { label: "Durations within task tolerance", unit: "%" },
  targets_found_percent: { label: "Tracked targets found", unit: "%" },
  mean_response_time_ms: { label: "Average response time", unit: " ms" },
};

const FOCUS: Record<string, string> = {
  cpt: "Sustaining attention during a repeated task",
  "go-no-go": "Responding and waiting for the right signal",
  "n-back": "Keeping and updating information in mind",
  "stop-signal": "Stopping a response after it has started",
  stroop: "Responding while ignoring conflicting information",
  "task-switching": "Moving between different task rules",
  "visual-search": "Finding relevant information among distractions",
  "planning-puzzle": "Planning a sequence of moves",
  "visual-sequence": "Remembering a sequence of locations",
  "time-perception": "Estimating and reproducing durations",
  "multiple-object-tracking": "Following several moving targets",
};

function value(number: number | null | undefined, unit = "") {
  return number == null ? "—" : `${Number(number.toFixed(1))}${unit}`;
}

function ActivityDetail({ activity, showAction }: { activity: TwinActivityProfile; showAction: boolean }) {
  const baseline = activity.personalBaseline;
  const highlights = activity.measurements.filter((metric) => METRICS[metric.key]).slice(0, 3);
  const [metricKey, setMetricKey] = useState("");
  const selected = highlights.find((metric) => metric.key === metricKey) ?? highlights[0];
  const id = useId();
  const comparison = selected ? baseline?.measurements.find((m) => m.key === selected.key) : null;
  const points = baseline?.trend.map((point, index) => ({
    ...point, run: (baseline.comparableRunCount - baseline.trend.length) + index + 1,
    value: selected ? point.metrics[selected.key] ?? null : null,
  })) ?? [];
  const ready = baseline?.status === "comparison_ready";
  const description = selected ? METRICS[selected.key] : null;

  return (
    <article className="space-y-4 rounded-xl border border-line p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-ink">{activity.title}</h4>
          <p className="mt-1 text-sm text-ink-muted">{FOCUS[activity.activityCode]}</p>
        </div>
        <Badge tone={ready ? "brand" : "outline"}>
          {ready ? "Comparison available" : baseline?.status === "baseline_ready" ? "Baseline recorded" : "Building a baseline"}
        </Badge>
      </div>
      <p className="text-xs leading-5 text-ink-subtle">
        {activity.runCount} saved runs · {baseline?.comparableRunCount ?? activity.runCount} comparable runs
        {baseline ? ` across ${baseline.observationDays} recorded day${baseline.observationDays === 1 ? "" : "s"}` : ""}.
        {activity.latestAt ? ` Last saved ${formatDateTime(activity.latestAt)} UTC.` : ""}
      </p>

      <dl className="grid gap-3 sm:grid-cols-3">
        {highlights.map((metric) => <div key={metric.key} className="rounded-lg bg-slate-50 p-3">
          <dt className="text-xs text-ink-muted">{METRICS[metric.key].label}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold text-ink">{value(metric.latest, METRICS[metric.key].unit)}</dd>
          <dd className="text-xs text-ink-subtle">Latest run</dd>
        </div>)}
      </dl>

      <div className="rounded-lg border border-line bg-brand-50/40 p-3 text-sm leading-6 text-ink-muted">
        {ready ? (
          <p>Compare your first three comparable runs with your latest three. These are separate groups.
            The middle value (median) of each group reduces the influence of an unusually high or low run.</p>
        ) : (
          <p>{baseline ? `${baseline.runsNeeded} more comparable scored run${baseline.runsNeeded === 1 ? "" : "s"} needed` : "Save another scored activity to update this older profile"}
            {baseline ? " for a three-run baseline and a separate three-run comparison." : "."}
            {" "}There is no deadline or daily streak to maintain.</p>
        )}
        <p className="mt-2">Practice, sleep, distractions and your device can affect results.
          A task-score change does not establish a change in ADHD symptoms or everyday functioning.</p>
        {baseline?.qualityFlags.includes("single_day_observations") ? <p className="mt-2">
          All comparable observations are from one recorded day. They do not show a pattern across days.
        </p> : null}
        {baseline?.qualityFlags.includes("scoring_or_configuration_changed") ? <p className="mt-2">
          The task or scoring changed. Your baseline starts again from the most recent compatible runs.
        </p> : null}
        {baseline?.qualityFlags.includes("unknown_scoring_version") ? <p className="mt-2">
          The scoring version is missing, so these results cannot be compared reliably.
        </p> : null}
      </div>

      {selected && description ? <>
        <label htmlFor={id} className="block text-xs font-medium text-ink">Explore a measurement</label>
        <select id={id} value={selected.key} onChange={(e) => setMetricKey(e.target.value)}
          className="w-full rounded-lg border border-line bg-white p-3 text-sm text-ink">
          {highlights.map((m) => <option key={m.key} value={m.key}>{METRICS[m.key].label}</option>)}
        </select>
        {comparison && comparison.change !== null ? <p className="text-sm leading-6 text-ink">
          {description.label}: baseline {value(comparison.baseline, description.unit)},
          recent {value(comparison.recent, description.unit)}.
          {" "}{comparison.change === 0 ? "No difference between the two medians."
            : `${Math.abs(Number(comparison.change.toFixed(1)))}${description.unit === "%" ? " percentage points" : description.unit} ${comparison.change > 0 ? "higher" : "lower"}.`}
        </p> : null}
        {points.length >= 2 ? <figure>
          <figcaption className="mb-2 text-xs text-ink-muted">{description.label} · last {points.length} comparable runs</figcaption>
          <div className="h-44" role="img" aria-label={`${description.label} across saved runs; exact values in the table below`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="3 3" />
                <XAxis dataKey="run" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis width={48} domain={description.unit === "%" ? [0, 100] : ["auto", "auto"]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}${description.unit}`, description.label]} labelFormatter={(r) => `Run ${r}`} />
                <Line dataKey="value" type="linear" stroke={chartColors.brand} dot={{ r: 3 }} isAnimationActive={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure> : null}
        {points.length > 0 ? <details>
          <summary className="cursor-pointer text-xs font-medium text-ink">View exact values and dates</summary>
          <table className="mt-2 w-full text-left text-xs">
            <caption className="sr-only">{description.label} by saved observation</caption>
            <thead><tr><th scope="col" className="py-2">Run</th><th scope="col">Recorded (UTC)</th><th scope="col">Value</th></tr></thead>
            <tbody>{points.map((point) => <tr key={point.sourceId} className="border-t border-line">
              <th scope="row" className="py-2">{point.run}</th>
              <td>{point.completedAt ? formatDateTime(point.completedAt) : "Unavailable"}</td>
              <td>{value(point.value, description.unit)}</td>
            </tr>)}</tbody>
          </table>
        </details> : null}
      </> : null}
      <details className="border-t border-line pt-3">
        <summary className="cursor-pointer text-xs font-medium text-ink">All latest task measurements</summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">{activity.measurements.map((m) => <div key={m.key}>
          <dt className="text-xs text-ink-muted">{METRICS[m.key]?.label ?? m.key.replaceAll("_", " ")}</dt>
          <dd className="font-mono text-sm text-ink">{value(m.latest, METRICS[m.key]?.unit)}</dd>
        </div>)}</dl>
      </details>
      {showAction ? <Link href={`/participant/activities/${activity.activityCode}`} className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700 underline underline-offset-4">
        Open {activity.title}
      </Link> : null}
    </article>
  );
}

export function ActivityTwinPanel({ activities, totalRuns, showAction = false }: { activities: TwinActivityProfile[]; totalRuns: number; showAction?: boolean }) {
  const [activityCode, setActivityCode] = useState("");
  const selected = activities.find((a) => a.activityCode === activityCode) ?? activities[0];
  const id = useId();
  return <section className="space-y-4" aria-label="Activity Digital Twin">
    <div><h3 className="text-lg font-semibold text-ink">Your personal activity profile</h3>
      <p className="mt-1 text-sm leading-6 text-ink-muted">{totalRuns} saved runs across {activities.length} activities.
        Compare with your own history. Each task measures a different kind of performance.</p></div>
    <label htmlFor={id} className="block text-xs font-medium text-ink">Choose an activity</label>
    <select id={id} className="w-full rounded-lg border border-line bg-white p-3 text-sm text-ink"
      value={selected?.activityCode ?? ""} onChange={(e) => setActivityCode(e.target.value)}>
      {activities.map((a) => <option key={a.activityCode} value={a.activityCode}>{a.title} ({a.runCount} runs)</option>)}
    </select>
    {selected ? <ActivityDetail key={selected.activityCode} activity={selected} showAction={showAction} /> : null}
    <p className="text-xs leading-5 text-ink-subtle">These tasks are not clinical ADHD assessments.
      EEG and webcam data are not included. More observations do not, by themselves, establish clinical validity.</p>
  </section>;
}
