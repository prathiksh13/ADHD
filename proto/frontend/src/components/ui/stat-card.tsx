import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { StatusDot } from "./badge";

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  trend,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  tone?: "neutral" | "primary" | "positive" | "caution" | "critical";
  className?: string;
}) {
  const toneRing = {
    neutral: "text-ink-muted bg-surface-sunken",
    primary: "text-primary-700 bg-primary-50",
    positive: "text-positive-600 bg-positive-50",
    caution: "text-caution-600 bg-caution-50",
    critical: "text-critical-600 bg-critical-50",
  } as const;

  return (
    <Card className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="section-label">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              toneRing[tone],
            )}
          >
            <Icon className="size-3.5" />
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl leading-none font-semibold tracking-tight text-ink tabular-nums">
          {value}
        </span>
        {unit ? <span className="text-[13px] font-medium text-ink-subtle">{unit}</span> : null}
      </div>
      {hint || trend ? (
        <div className="flex items-center gap-2 text-[12px] text-ink-muted">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                trend.direction === "up" && "text-positive-600",
                trend.direction === "down" && "text-critical-600",
                trend.direction === "flat" && "text-ink-subtle",
              )}
            >
              <StatusDot
                tone={
                  trend.direction === "up" ? "positive" : trend.direction === "down" ? "critical" : "neutral"
                }
              />
              {trend.value}
            </span>
          ) : null}
          {hint ? <span className="truncate">{hint}</span> : null}
        </div>
      ) : null}
    </Card>
  );
}
