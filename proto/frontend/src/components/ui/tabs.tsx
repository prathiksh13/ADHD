"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type TabItem = {
  label: string;
  href: string;
  count?: number;
  /**
   * Only mark active on an exact path match.
   *
   * Needed when a tab is a parent of other tabs: without it, the "Overview" tab
   * would stay highlighted while on `/eeg`, `/behavior` or `/report`.
   */
  exact?: boolean;
};

/**
 * Tab navigation backed by real routes, so a participant record's tabs are
 * addressable and shareable rather than local component state.
 */
export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((item) => {
        // `usePathname` never includes the hash, so an anchor tab such as
        // `/record#sessions` has to be matched on its path alone.
        const path = item.href.split("#")[0] || "/";
        const active = item.exact
          ? pathname === path
          : pathname === path ||
            (path.split("/").length > 2 && pathname.startsWith(`${path}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              active
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active ? "bg-primary-50 text-primary-700" : "bg-surface-sunken text-ink-subtle",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
