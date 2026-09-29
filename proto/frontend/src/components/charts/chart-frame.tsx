"use client";

import { cn } from "@/lib/utils";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

export const AXIS_STYLE = {
  stroke: "var(--color-line)",
  tick: { fill: "var(--color-ink-subtle)", fontSize: 11 },
} as const;

export const GRID_STYLE = {
  stroke: "var(--color-line)",
  strokeDasharray: "0",
  vertical: false,
} as const;

/**
 * Recharts hands the formatter loosely-typed values, so numeric formatters are
 * funnelled through here to keep one safe narrowing point.
 */
export function valueFormatter(
  format: (value: number) => string,
  resolveName?: (name: NameType) => string,
) {
  return (value: ValueType | undefined, name: NameType | undefined) => {
    const numeric = typeof value === "number" ? value : Number(value ?? 0);
    return [
      format(Number.isFinite(numeric) ? numeric : 0),
      resolveName && name !== undefined ? resolveName(name) : String(name ?? ""),
    ] as [string, string];
  };
}

export function ChartFrame({
  title,
  subtitle,
  actions,
  legend,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <figure className={cn("flex flex-col rounded-lg border border-line bg-surface shadow-card", className)}>
      {title || actions ? (
        <figcaption className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title ? (
              <p className="text-[13.5px] font-semibold tracking-tight text-ink">{title}</p>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </figcaption>
      ) : null}
      <div className={cn("min-w-0 flex-1 px-2 pt-4 pb-3", bodyClassName)}>{children}</div>
      {legend ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-5 py-2.5">
          {legend}
        </div>
      ) : null}
    </figure>
  );
}

export function LegendItem({
  color,
  label,
  value,
  className,
}: {
  color: string;
  label: string;
  value?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted", className)}>
      <span
        className="size-2 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
      {value ? <span className="font-semibold text-ink tabular-nums">{value}</span> : null}
    </span>
  );
}

export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center px-6 text-center text-[12.5px] text-ink-subtle">
      {message}
    </div>
  );
}
