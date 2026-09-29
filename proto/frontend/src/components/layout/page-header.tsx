import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  icon: Icon,
  meta,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  icon?: LucideIcon;
  meta?: { label: string; value: string }[];
  className?: string;
}) {
  return (
    <header className={cn("border-b border-line bg-surface", className)}>
      <div className="px-6 py-5 lg:px-8">
        {breadcrumb?.length ? (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-[12px] text-ink-subtle">
              {breadcrumb.map((crumb, i) => (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="size-3" /> : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-ink-muted hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-subtle text-primary-700">
                <Icon className="size-4.5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
                  {description}
                </p>
              ) : null}
              {meta?.length ? (
                <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  {meta.map((item) => (
                    <div key={item.label} className="flex items-baseline gap-1.5">
                      <dt className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
                        {item.label}
                      </dt>
                      <dd className="text-[13px] font-semibold text-ink tabular-nums">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </div>

          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}

/** Compact banner shown on every authenticated screen. */
export function PrototypeStamp({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-caution-100 bg-caution-50 px-2.5 py-1 text-[11px] font-medium text-caution-700",
        className,
      )}
    >
      <ShieldCheck className="size-3" />
      Research prototype
    </span>
  );
}
