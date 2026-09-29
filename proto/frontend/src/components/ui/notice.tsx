import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const notice = cva("flex gap-3 rounded-lg border px-4 py-3 text-[13px] leading-relaxed", {
  variants: {
    tone: {
      info: "border-secondary-100 bg-secondary-50 text-secondary-900",
      neutral: "border-line bg-surface-subtle text-ink-muted",
      caution: "border-caution-100 bg-caution-50 text-caution-700",
      critical: "border-critical-100 bg-critical-50 text-critical-700",
      positive: "border-positive-100 bg-positive-50 text-positive-700",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Notice({
  className,
  tone,
  icon,
  title,
  children,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof notice> & { icon?: React.ReactNode; title?: string }) {
  return (
    <div className={cn(notice({ tone }), className)} {...props}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="flex min-w-0 flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="[&_p]:leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "bg-line",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
