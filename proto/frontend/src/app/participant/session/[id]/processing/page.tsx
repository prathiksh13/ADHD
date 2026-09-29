import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cpu } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { ProcessingTracker } from "@/components/session/processing-tracker";
import { getSessionSummary } from "@/lib/api";

export const metadata: Metadata = {
  title: "Processing",
  description: "Live processing state for a session, driven by backend stage reporting.",
};

export default async function SessionProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fail fast on an unknown id so a bad URL is a 404 rather than an empty shell.
  if (!(await getSessionSummary(id))) notFound();

  return (
    <>
      <PageHeader
        title="Processing"
        icon={Cpu}
        breadcrumb={[
          { label: "Participant", href: "/participant/dashboard" },
          { label: "History", href: "/participant/history" },
          { label: id },
        ]}
        description="Each stage reflects what the processing service has reported. No progress is simulated in the browser."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <ProcessingTracker sessionId={id} />
      </PortalBody>
    </>
  );
}
