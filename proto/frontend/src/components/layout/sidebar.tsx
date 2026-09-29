"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Brain,
  Database,
  FlaskConical,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Radio,
  Settings,
  SlidersHorizontal,
  Users,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Marks screens that belong to the future live-EEG phase. */
  future?: boolean;
  badge?: string;
};

export type NavSection = { title?: string; items: NavItem[] };

export const PARTICIPANT_NAV: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/participant/dashboard", icon: LayoutDashboard },
      { label: "EEG input", href: "/participant/eeg", icon: Waves },
      { label: "Experiment", href: "/participant/experiment", icon: ListChecks },
    ],
  },
  {
    title: "Sessions",
    items: [
      { label: "History", href: "/participant/history", icon: History },
      { label: "Live EEG", href: "/participant/live", icon: Radio, future: true },
    ],
  },
  {
    title: "Account",
    items: [{ label: "Settings", href: "/participant/settings", icon: Settings }],
  },
];

export const DOCTOR_NAV: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/doctor/dashboard", icon: LayoutDashboard },
      { label: "Participants", href: "/doctor/participants", icon: Users },
      { label: "Compare sessions", href: "/doctor/compare", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "Research models", href: "/research/models", icon: Brain },
      { label: "Datasets", href: "/research/datasets", icon: Database },
    ],
  },
  {
    title: "Account",
    items: [{ label: "Settings", href: "/doctor/settings", icon: Settings }],
  },
];

export const RESEARCHER_NAV: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/research/dashboard", icon: LayoutDashboard },
      { label: "Models", href: "/research/models", icon: Brain },
      { label: "Experiments", href: "/research/experiments", icon: FlaskConical },
      { label: "Explainability", href: "/research/explainability", icon: BarChart3 },
      { label: "Datasets", href: "/research/datasets", icon: Database },
    ],
  },
  {
    title: "Live EEG",
    items: [
      { label: "Device", href: "/device", icon: Radio, future: true },
      { label: "Live session", href: "/live/session", icon: Activity, future: true },
    ],
  },
  {
    title: "Account",
    items: [{ label: "Settings", href: "/research/settings", icon: Settings }],
  },
];

export function Sidebar({
  sections,
  portalLabel,
  user,
}: {
  sections: NavSection[];
  portalLabel: string;
  user: { name: string; meta: string; initials: string };
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-15 items-center gap-2.5 border-b border-line px-4">
        <LogoMark />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13.5px] font-semibold tracking-tight text-ink">
            NeuroTrace
          </span>
          <span className="truncate text-[10.5px] font-medium tracking-[0.06em] text-ink-subtle uppercase">
            {portalLabel}
          </span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks sections={sections} />
      </nav>

      <UserFooter user={user} />
    </aside>
  );
}

export function NavLinks({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <div key={section.title ?? sectionIndex} className={cn(sectionIndex > 0 && "mt-5")}>
          {section.title ? (
            <p className="section-label px-2 pb-1.5">{section.title}</p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href.split("/").length > 2 && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-primary-50 text-primary-800"
                        : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1.5 bottom-1.5 -left-3 w-0.5 rounded-r-full bg-primary-600 transition-opacity",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.future ? (
                      <span className="rounded border border-line-strong px-1 py-px text-[9px] font-semibold tracking-wide text-ink-subtle uppercase">
                        soon
                      </span>
                    ) : null}
                    {item.badge ? (
                      <span className="rounded-full bg-caution-50 px-1.5 text-[10px] font-semibold text-caution-700 tabular-nums">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

function UserFooter({ user }: { user: { name: string; meta: string; initials: string } }) {
  return (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[11px] font-semibold text-accent-700">
          {user.initials}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[12.5px] font-semibold text-ink">{user.name}</span>
          <span className="truncate text-[11px] text-ink-subtle">{user.meta}</span>
        </span>
        <Link
          href="/login"
          aria-label="Sign out"
          className="rounded p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <LogOut className="size-4" />
        </Link>
      </div>
    </div>
  );
}
