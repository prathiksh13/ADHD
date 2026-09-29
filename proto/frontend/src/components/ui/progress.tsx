import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const progress = cva("h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken", {
  variants: {
    size: { xs: "h-1", sm: "h-1.5", md: "h-2" },
    tone: {
      primary: "[&>i]:bg-primary-600",
      positive: "[&>i]:bg-positive-500",
      caution: "[&>i]:bg-caution-500",
      critical: "[&>i]:bg-critical-500",
      accent: "[&>i]:bg-accent-500",
      secondary: "[&>i]:bg-secondary-500",
    },
  },
  defaultVariants: { size: "sm", tone: "primary" },
});

export function Progress({
  className,
  size,
  tone,
  value,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof progress> & { value: number }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(progress({ size, tone }), className)}
      {...props}
    >
      <i className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
