import Link from "next/link";
import { cn } from "@/lib/utils";

/** Inline brand mark: a stylised EEG trace inside a rounded teal tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-700",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
        <path
          d="M1.5 12h3l2-5 2.5 10L11.5 6l2 8 1.8-4 1.4 2h4.3"
          stroke="var(--color-primary-100)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function BrandLockup({
  href = "/",
  subtitle,
  className,
}: {
  href?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13.5px] font-semibold tracking-tight text-ink">
          NeuroTrace
        </span>
        <span className="truncate text-[10.5px] font-medium tracking-[0.06em] text-ink-subtle uppercase">
          {subtitle ?? "ADHD EEG Research"}
        </span>
      </span>
    </Link>
  );
}
