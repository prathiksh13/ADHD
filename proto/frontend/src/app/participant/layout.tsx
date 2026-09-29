import { PortalShell } from "@/components/layout/portal-shell";
import { PARTICIPANT_NAV } from "@/components/layout/sidebar";
import { API_BASE_URL } from "@/lib/api";

/**
 * Participant / guardian portal. Named "Participant" rather than "Patient"
 * because the cohort includes children and consent is guardian-gated.
 */
export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      sections={PARTICIPANT_NAV}
      portalLabel="Participant"
      user={{ name: "A. Rivera", meta: "Guardian · P-0142", initials: "AR" }}
      apiMode={process.env.NEXT_PUBLIC_API_BASE_URL ? API_BASE_URL : "mock fixtures"}
    >
      {children}
    </PortalShell>
  );
}
