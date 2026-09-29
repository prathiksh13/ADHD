import { PortalShell } from "@/components/layout/portal-shell";
import { RESEARCHER_NAV } from "@/components/layout/sidebar";

/**
 * Shell for the future live-EEG screens.
 *
 * They live outside the `/research` segment so `/research` can stay the public
 * marketing page while `/research/*` is the researcher portal.
 */
export default function FutureLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      sections={RESEARCHER_NAV}
      portalLabel="Researcher"
      user={{ name: "Dr. A. Rivera", meta: "Researcher", initials: "AR" }}
    >
      {children}
    </PortalShell>
  );
}
