import { Check, CircleDashed, Loader2, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, type StageKey, type StageState } from "@/lib/constants";
import type { SessionStage } from "@/types/session";

const STATE_ICON: Record<StageState, typeof Check> = {
  done: Check,
  running: Loader2,
  failed: TriangleAlert,
  pending: CircleDashed,
};

const STATE_TONE: Record<StageState, string> = {
  done: "border-positive-100 bg-positive-50 text-positive-700",
  running: "border-primary-300 bg-primary-50 text-primary-800",
  failed: "border-critical-100 bg-critical-50 text-critical-700",
  pending: "border-line bg-surface text-ink-subtle",
};

function toStep(state: StageState): StageStepState {
  if (state === "done") return "done";
  if (state === "running") return "running";
  if (state === "failed") return "failed";
  return "pending";
}

type StageStepState = "pending" | "running" | "done" | "failed";

/** Map backend stage records onto the declared pipeline, in canonical order. */
function orderStages(stages: SessionStage[]) {
  const byKey = new Map<StageKey, SessionStage>(stages.map((s) => [s.key, s]));
  return PIPELINE_STAGES.map((declared) => {
    const actual = byKey.get(declared.key);
    return {
      key: declared.key,
      label: declared.label,
      detail: declared.detail,
      operation: declared.operation,
      state: toStep(actual?.state ?? "pending"),
      startedAt: actual?.startedAt ?? null,
      finishedAt: actual?.finishedAt ?? null,
      message: actual?.message ?? null,
    };
  });
}

/**
 * Full processing pipeline.
 *
 * Every row reflects backend-reported state. Nothing here animates toward a
 * target or invents a completion percentage — a stage reads "done" only when
 * the API said it was done.
 */
export function PipelineTimeline({
  stages,
  compact = false,
  className,
}: {
  stages?: SessionStage[];
  compact?: boolean;
  className?: string;
}) {
  const rows = orderStages(stages ?? []);
  const done = rows.filter((r) => r.state === "done").length;

  return (
    <div className={className}>
      {!stages ? (
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-muted">
          The declared pipeline. A session reports real state against these stages.
        </p>
      ) : (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <p className="text-[13px] font-semibold text-ink tabular-nums">
            {done} of {rows.length} stages complete
          </p>
          <div className="flex gap-1" aria-hidden>
            {rows.map((r) => (
              <span
                key={r.key}
                className={cn(
                  "h-1 w-6 rounded-full",
                  r.state === "done"
                    ? "bg-positive-500"
                    : r.state === "running"
                      ? "bg-primary-500"
                      : r.state === "failed"
                        ? "bg-critical-500"
                        : "bg-line-strong",
                )}
              />
            ))}
          </div>
        </div>
      )}

      <ol className={cn("flex flex-col", compact && "gap-0")}>
        {rows.map((row, i) => {
          const Icon = STATE_ICON[row.state];
          return (
            <li
              key={row.key}
              className={cn(
                "flex gap-3.5",
                compact ? "py-2" : "pb-4",
                i < rows.length - 1 && "border-b border-line",
                compact && "border-b-0",
              )}
            >
              <span
                className={cn(
                  "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border",
                  STATE_TONE[row.state],
                  !compact && "-mt-0.5",
                )}
              >
                <Icon
                  className={cn(
                    "size-3",
                    row.state === "running" && "animate-spin",
                    row.state === "failed" && "text-critical-600",
                  )}
                />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <p
                    className={cn(
                      "text-[13.5px] font-semibold",
                      row.state === "pending" ? "text-ink-subtle" : "text-ink",
                    )}
                  >
                    {row.label}
                  </p>
                  <span
                    className={cn(
                      "rounded px-1.5 py-px text-[10.5px] font-medium tracking-wide uppercase",
                      STATE_TONE[row.state],
                    )}
                  >
                    {row.state}
                  </span>
                  {row.message ? (
                    <span className="text-[11.5px] text-ink-muted">{row.message}</span>
                  ) : null}
                </div>

                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                  {row.detail}
                </p>

                {!compact ? (
                  <p className="mt-1.5 rounded-md border border-line bg-surface-subtle px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ink-subtle">
                    {row.operation}
                  </p>
                ) : null}
              </div>

              {row.state === "failed" ? (
                <X className="mt-1 size-3.5 shrink-0 text-critical-600" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Small helper for screens that need the declared stage order only. */
export function stageProgress(stages: SessionStage[]) {
  const rows = orderStages(stages);
  const done = rows.filter((r) => r.state === "done").length;
  return {
    done,
    total: rows.length,
    percent: rows.length ? Math.round((done / rows.length) * 100) : 0,
    current: rows.find((r) => r.state === "running" || r.state === "failed") ?? null,
  };
}
