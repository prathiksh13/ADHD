import { cn } from "@/lib/utils";
import { formatMs } from "@/lib/format";

export type TimelineEvent = {
  /** Offset from the start of the recording, in seconds. */
  at: number;
  type: "target" | "distractor" | "marker" | "rest" | "boundary";
  label: string;
  outcome?: "correct" | "incorrect" | "missed";
};

/**
 * Time-aligned event rail.
 *
 * Shown next to the EEG waveform so a reviewer can see which window of the
 * recording belongs to which task event.
 */
export function EventTimeline({
  events,
  durationSeconds,
  className,
}: {
  events: TimelineEvent[];
  durationSeconds: number;
  className?: string;
}) {
  const color = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "target":
        return "var(--color-primary-600)";
      case "distractor":
        return "var(--color-neutral-400)";
      case "marker":
        return "var(--color-accent-500)";
      case "boundary":
        return "var(--color-caution-500)";
      default:
        return "var(--color-secondary-400)";
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative h-11 overflow-hidden rounded-md border border-line bg-surface-subtle">
        <div className="hairline-grid absolute inset-0 opacity-50" aria-hidden />
        {events.map((event, i) => {
          const left = `${Math.min(100, (event.at / Math.max(1, durationSeconds)) * 100)}%`;
          return (
            <span
              key={`${event.at}-${i}`}
              className="absolute bottom-0 top-0 w-px"
              style={{ left, backgroundColor: color(event.type) }}
              title={`${event.at.toFixed(1)}s — ${event.label}`}
            >
              <span
                className={cn(
                  "absolute -top-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full",
                  event.outcome === "incorrect" && "ring-2 ring-critical-200",
                )}
                style={{ backgroundColor: color(event.type) }}
              />
            </span>
          );
        })}
        <span className="absolute inset-y-0 left-0 w-px bg-line-strong" />
        <span className="absolute inset-y-0 right-0 w-px bg-line-strong" />
      </div>

      <div className="flex justify-between text-[10.5px] text-ink-subtle tabular-nums">
        <span>0 s</span>
        <span>{Math.round(durationSeconds / 2)} s</span>
        <span>{durationSeconds} s</span>
      </div>

      {events.length ? (
        <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {events.map((event, i) => (
            <li
              key={`${event.at}-row-${i}`}
              className="flex items-center gap-2 text-[11.5px] text-ink-muted"
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: color(event.type) }}
              />
              <span className="w-14 shrink-0 font-medium text-ink tabular-nums">
                {event.at.toFixed(1)} s
              </span>
              <span className="truncate">{event.label}</span>
              {event.outcome ? (
                <span className="ml-auto shrink-0 text-[10.5px] font-medium text-ink-subtle">
                  {event.outcome === "correct" ? "correct" : event.outcome}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Behavioural task metrics table used on the clinician screens. */
export function BehaviorTable({
  reactionTimeMs,
  correctResponses,
  incorrectResponses,
  missedTargets,
  commissionErrors,
  taskScore,
  condition,
  variabilityRtp,
}: {
  reactionTimeMs: number;
  correctResponses: number;
  incorrectResponses: number;
  missedTargets: number;
  commissionErrors: number;
  taskScore: number;
  condition: string;
  variabilityRtp: number;
}) {
  const rows = [
    { label: "Mean reaction time", value: formatMs(reactionTimeMs), note: "Correct responses only" },
    { label: "Correct responses", value: String(correctResponses), note: "Hits" },
    { label: "Incorrect responses", value: String(incorrectResponses), note: "Errors" },
    { label: "Missed targets", value: String(missedTargets), note: "Omissions" },
    { label: "Commission errors", value: String(commissionErrors), note: "Responses to distractors" },
    { label: "Task score", value: `${taskScore.toFixed(1)}%`, note: "Hits / total presented" },
    { label: "RT variability", value: variabilityRtp.toFixed(3), note: "Intra-participant coefficient" },
    { label: "Condition", value: condition, note: "Task block" },
  ];

  return (
    <dl className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="bg-surface px-3.5 py-3">
          <dt className="text-[11.5px] font-medium text-ink-subtle">{row.label}</dt>
          <dd className="mt-0.5 text-[15px] font-semibold text-ink tabular-nums">{row.value}</dd>
          <p className="mt-0.5 text-[11px] text-ink-subtle">{row.note}</p>
        </div>
      ))}
    </dl>
  );
}
