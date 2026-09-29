import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { ResearcherSettingsForm } from "@/components/research/researcher-settings-form";

export const metadata: Metadata = {
  title: "Settings",
  description: "Researcher workspace defaults and reporting safeguards.",
};

export default function ResearchSettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        icon={Settings2}
        breadcrumb={[{ label: "Researcher", href: "/research/dashboard" }, { label: "Settings" }]}
        description="Workspace defaults and the safeguards applied to every exported summary."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <ResearcherSettingsForm />
      </PortalBody>
    </>
  );
}
