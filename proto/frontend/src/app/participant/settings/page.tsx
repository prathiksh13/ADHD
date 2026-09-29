import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { SettingsForm } from "@/components/participant/settings-form";

export const metadata: Metadata = {
  title: "Settings",
  description: "Display preferences, profile and analysis defaults.",
};

export default function ParticipantSettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        icon={Settings2}
        breadcrumb={[
          { label: "Participant", href: "/participant/dashboard" },
          { label: "Settings" },
        ]}
        description="Display preferences for this browser, your study profile, and the analysis defaults fixed by the protocol."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <SettingsForm />
      </PortalBody>
    </>
  );
}
