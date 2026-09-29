import { cn } from "@/lib/utils";
import { Sidebar, type NavSection } from "./sidebar";
import { PrototypeStamp } from "./page-header";
import { PortalMobileNav } from "./portal-mobile-nav";

/**
 * Authenticated portal frame: fixed sidebar + scrollable content column.
 *
 * The header strip carries the research-prototype stamp and the API
 * environment, so no screen can be mistaken for a clinical product. Below
 * `lg` the sidebar is replaced by an equivalent drawer.
 */
export function PortalShell({
  sections,
  portalLabel,
  user,
  apiMode = "mock fixtures",
  children,
}: {
  sections: NavSection[];
  portalLabel: string;
  user: { name: string; meta: string; initials: string };
  apiMode?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar sections={sections} portalLabel={portalLabel} user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-20 hidden h-9 items-center justify-between gap-3 border-b border-line bg-surface-subtle px-6 lg:flex lg:px-8">
          <PrototypeStamp />
          <p className="text-[11px] text-ink-subtle">
            Data source:{" "}
            <span className="font-medium text-ink-muted">{apiMode}</span>
            <span className="mx-2 text-line-strong">|</span>
            Frontend does not run the model
          </p>
        </div>

        <PortalMobileNav
          sections={sections}
          portalLabel={portalLabel}
          user={user}
          apiMode={apiMode}
        />

        <main className={cn("flex-1")}>{children}</main>
      </div>
    </div>
  );
}

export function PortalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-6 py-6 lg:px-8", className)}>{children}</div>;
}
