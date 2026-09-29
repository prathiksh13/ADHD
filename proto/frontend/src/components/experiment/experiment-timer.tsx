"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/format";

/** Countdown ring used by the experiment screen. */
export function ExperimentTimer({
  totalSeconds,
  remaining,
  running,
  onPause,
  onResume,
  onReset,
  className,
}: {
  totalSeconds: number;
  remaining: number;
  running: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onReset?: () => void;
  className?: string;
}) {
  const ratio = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const urgent = remaining <= 10;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative flex size-36 items-center justify-center">
        <svg viewBox="0 0 144 144" className="size-36 -rotate-90">
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke="var(--color-surface-sunken)"
            strokeWidth="6"
          />
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke={urgent ? "var(--color-caution-500)" : "var(--color-primary-600)"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            style={{ transition: "stroke-dashoffset 0.9s linear" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span
            className={cn(
              "text-3xl font-semibold tabular-nums",
              urgent ? "text-caution-600" : "text-ink",
            )}
          >
            {formatClock(remaining)}
          </span>
          <span className="mt-0.5 text-[11px] font-medium tracking-[0.06em] text-ink-subtle uppercase">
            remaining
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {running ? (
          <Button variant="secondary" size="sm" onClick={onPause}>
            Pause
          </Button>
        ) : (
          <Button size="sm" onClick={onResume}>
            Resume
          </Button>
        )}
        {onReset ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export type StageStep = {
  key: string;
  label: string;
  state: "pending" | "running" | "done";
};

/** REST → TASK → POST-TASK stage rail. */
export function StageRail({ steps, className }: { steps: StageStep[]; className?: string }) {
  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {steps.map((step, i) => (
        <li key={step.key} className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              step.state === "running"
                ? "border-primary-300 bg-primary-50 text-primary-800"
                : step.state === "done"
                  ? "border-positive-100 bg-positive-50 text-positive-700"
                  : "border-line bg-surface text-ink-subtle",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                step.state === "running"
                  ? "animate-pulse bg-primary-600"
                  : step.state === "done"
                    ? "bg-positive-500"
                    : "bg-neutral-300",
              )}
            />
            {step.label}
          </span>
          {i < steps.length - 1 ? (
            <span className="h-px w-4 bg-line-strong" aria-hidden />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
