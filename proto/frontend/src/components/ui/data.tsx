import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

/** Standard vertical rhythm + width for every authenticated screen. */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-6 py-6 lg:px-8", className)}>{children}</div>;
}

export function Panel({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-ink-subtle" /> : null}
            <div className="min-w-0">
              <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">{title}</h2>
              {description ? (
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

/** Read-only fact list. Two columns on wide screens, one on narrow. */
export function KeyValueList({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: React.ReactNode; hint?: string }[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const cols = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[columns];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3.5", cols, className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 border-b border-line pb-2.5 last:border-0">
          <dt className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-[13.5px] font-semibold break-words text-ink tabular-nums">
            {item.value}
          </dd>
          {item.hint ? (
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-subtle">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** Monospace chip list for channels, file types, labels. */
export function ChipList({
  items,
  tone = "neutral",
  className,
  max,
}: {
  items: string[];
  tone?: "neutral" | "primary" | "outline";
  className?: string;
  max?: number;
}) {
  const shown = max ? items.slice(0, max) : items;
  const rest = max ? items.length - shown.length : 0;
  const tones = {
    neutral: "bg-surface-sunken text-ink-muted border-transparent",
    primary: "bg-primary-50 text-primary-700 border-primary-100",
    outline: "bg-surface text-ink-muted border-line",
  };

  if (!items.length) {
    return <p className={cn("text-[12.5px] text-ink-subtle", className)}>None recorded</p>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {shown.map((item) => (
        <span
          key={item}
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap",
            tones[tone],
          )}
        >
          {item}
        </span>
      ))}
      {rest > 0 ? (
        <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink-subtle">
          +{rest} more
        </span>
      ) : null}
    </div>
  );
}

/** Numbered / lettered step list used for the methodology pipeline. */
export function StepList({
  steps,
  className,
}: {
  steps: { label: string; detail?: string }[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((step, i) => (
        <li key={step.label} className="relative flex gap-3.5 pb-5 last:pb-0">
          {i < steps.length - 1 ? (
            <span className="absolute top-7 bottom-0 left-[13px] w-px bg-line" aria-hidden />
          ) : null}
          <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-[11.5px] font-semibold text-ink-muted tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[13.5px] font-semibold text-ink">{step.label}</p>
            {step.detail ? (
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">{step.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
