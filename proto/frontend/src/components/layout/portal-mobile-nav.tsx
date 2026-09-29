"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { LogoMark } from "./logo";
import { NavLinks, type NavSection } from "./sidebar";
import { PrototypeStamp } from "./page-header";
import { cn } from "@/lib/utils";

/**
 * Portal header for viewports below `lg`, where the fixed sidebar is hidden.
 * The drawer closes on navigation rather than syncing to the pathname in an
 * effect, which would be a synchronous setState during commit.
 */
export function PortalMobileNav({
  sections,
  portalLabel,
  user,
  apiMode,
}: {
  sections: NavSection[];
  portalLabel: string;
  user: { name: string; meta: string; initials: string };
  apiMode: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Guard against a resize leaving the overlay stranded open.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = sections
    .flatMap((s) => s.items)
    .find(
      (item) =>
        pathname === item.href ||
        (item.href.split("/").length > 2 && pathname.startsWith(`${item.href}/`)),
    );

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex h-9 items-center justify-between gap-3 border-b border-line bg-surface-subtle px-4 lg:hidden">
        <PrototypeStamp />
        <p className="truncate text-[11px] text-ink-subtle">
          Data source: <span className="font-medium text-ink-muted">{apiMode}</span>
        </p>
      </div>

      <div className="no-print sticky top-9 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="-ml-1 rounded-md p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <Menu className="size-5" />
        </button>

        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13.5px] font-semibold tracking-tight text-ink">
            {current?.label ?? "NeuroTrace"}
          </span>
          <span className="truncate text-[10.5px] font-medium tracking-[0.06em] text-ink-subtle uppercase">
            {portalLabel}
          </span>
        </span>
      </div>

      {open ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col border-r border-line bg-surface shadow-pop">
            <div className="flex h-15 items-center gap-2.5 border-b border-line px-4">
              <LogoMark />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13.5px] font-semibold tracking-tight text-ink">
                  NeuroTrace
                </span>
                <span className="truncate text-[10.5px] font-medium tracking-[0.06em] text-ink-subtle uppercase">
                  {portalLabel}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded p-1.5 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <NavLinks sections={sections} onNavigate={() => setOpen(false)} />
            </nav>

            <div className="border-t border-line p-3">
              <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    "bg-accent-100 text-[11px] font-semibold text-accent-700",
                  )}
                >
                  {user.initials}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[12.5px] font-semibold text-ink">
                    {user.name}
                  </span>
                  <span className="truncate text-[11px] text-ink-subtle">{user.meta}</span>
                </span>
                <Link
                  href="/login"
                  aria-label="Sign out"
                  className="rounded p-1.5 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
                >
                  <LogOut className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
