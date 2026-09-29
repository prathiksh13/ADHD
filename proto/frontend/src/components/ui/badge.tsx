import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-ink-muted border-transparent",
        outline: "bg-surface text-ink-muted border-line-strong",
        primary: "bg-primary-50 text-primary-700 border-primary-100",
        secondary: "bg-secondary-50 text-secondary-700 border-secondary-100",
        accent: "bg-accent-50 text-accent-700 border-accent-100",
        positive: "bg-positive-50 text-positive-700 border-positive-100",
        caution: "bg-caution-50 text-caution-700 border-caution-100",
        critical: "bg-critical-50 text-critical-700 border-critical-100",
        solid: "bg-primary-700 text-ink-inverse border-transparent",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type Props = ComponentProps<"span"> & VariantProps<typeof badge>;

export function Badge({ className, tone, ...props }: Props) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

/** Small status dot used inside badges and table cells. */
export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
}: {
  tone?: "positive" | "caution" | "critical" | "primary" | "neutral";
  pulse?: boolean;
  className?: string;
}) {
  const colors = {
    positive: "bg-positive-500",
    caution: "bg-caution-500",
    critical: "bg-critical-500",
    primary: "bg-primary-500",
    neutral: "bg-neutral-300",
  } as const;

  return (
    <span className={cn("relative inline-flex size-1.5 shrink-0", className)}>
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60",
            colors[tone],
          )}
        />
      )}
      <span className={cn("relative inline-flex size-1.5 rounded-full", colors[tone])} />
    </span>
  );
}
