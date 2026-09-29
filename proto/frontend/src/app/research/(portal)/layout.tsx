import { PortalShell } from "@/components/layout/portal-shell";
import { RESEARCHER_NAV } from "@/components/layout/sidebar";
import { API_BASE_URL } from "@/lib/api";

/**
 * Researcher / admin portal.
 *
 * Lives in a `(portal)` route group so the public methodology page at
 * `/research` keeps the top navigation instead of inheriting this sidebar.
 */
export default function ResearchPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      sections={RESEARCHER_NAV}
      portalLabel="Researcher"
      user={{ name: "S. Lindqvist", meta: "Model research", initials: "SL" }}
      apiMode={process.env.NEXT_PUBLIC_API_BASE_URL ? API_BASE_URL : "mock fixtures"}
    >
      {children}
    </PortalShell>
  );
}
