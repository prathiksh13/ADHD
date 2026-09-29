import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary-700 text-ink-inverse shadow-card hover:bg-primary-800 active:bg-primary-900",
        secondary:
          "bg-surface text-ink border border-line-strong hover:bg-surface-subtle active:bg-surface-sunken",
        subtle: "bg-surface-sunken text-ink-muted hover:bg-line hover:text-ink",
        ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        danger: "bg-critical-600 text-ink-inverse shadow-card hover:bg-critical-700",
        link: "text-primary-700 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        xs: "h-7 px-2.5 text-[12px]",
        sm: "h-8 px-3 text-[13px]",
        md: "h-9.5 px-4",
        lg: "h-11 px-6",
        icon: "size-9",
        iconSm: "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type BaseProps = VariantProps<typeof button>;

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & BaseProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & BaseProps) {
  return <Link className={cn(button({ variant, size }), className)} {...props} />;
}
