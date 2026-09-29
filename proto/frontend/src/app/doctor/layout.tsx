import { PortalShell } from "@/components/layout/portal-shell";
import { DOCTOR_NAV } from "@/components/layout/sidebar";
import { API_BASE_URL } from "@/lib/api";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      sections={DOCTOR_NAV}
      portalLabel="Clinician"
      user={{ name: "Dr. M. Okonkwo", meta: "Clinical reviewer", initials: "MO" }}
      apiMode={process.env.NEXT_PUBLIC_API_BASE_URL ? API_BASE_URL : "mock fixtures"}
    >
      {children}
    </PortalShell>
  );
}
