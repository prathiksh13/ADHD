import type { Metadata } from "next";
import { FileUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { EEGUpload } from "@/components/eeg/eeg-upload";
import { PipelineTimeline } from "@/components/session/pipeline-timeline";

export const metadata: Metadata = {
  title: "EEG input",
  description: "Upload an EEG recording, validate the file, and review its metadata.",
};

export default function ParticipantEEGPage() {
  return (
    <>
      <PageHeader
        title="EEG input"
        icon={FileUp}
        breadcrumb={[
          { label: "Participant", href: "/participant/dashboard" },
          { label: "EEG input" },
        ]}
        description="Upload a recording to begin a session. The file is validated and its metadata is shown before processing starts."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <EEGUpload />

        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-[13.5px] font-semibold text-ink">What happens after upload</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            The stages below run on the backend. This list is the declared pipeline, not a
            progress indicator.
          </p>
          <div className="mt-4">
            <PipelineTimeline compact />
          </div>
        </div>
      </PortalBody>
    </>
  );
}
