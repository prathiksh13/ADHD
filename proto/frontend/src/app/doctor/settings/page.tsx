import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { DoctorSettingsForm } from "@/components/doctor/doctor-settings-form";

export const metadata: Metadata = {
  title: "Settings",
  description: "Clinician review preferences and study workload.",
};

export default function DoctorSettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        icon={Settings2}
        breadcrumb={[{ label: "Clinician", href: "/doctor/dashboard" }, { label: "Settings" }]}
        description="Review defaults for the roster, and the explicit limits of what this tool covers."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <DoctorSettingsForm />
      </PortalBody>
    </>
  );
}
