import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Notice } from "@/components/ui/notice";
import { ParticipantFilter } from "@/components/doctor/participant-filter";
import { listParticipants } from "@/lib/api";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Participants",
  description: "Cohort roster with diagnosis label, session progress and signal quality.",
};

export default async function DoctorParticipantsPage() {
  const { rows, stats } = await listParticipants();

  return (
    <>
      <PageHeader
        title="Participants"
        icon={Users}
        breadcrumb={[{ label: "Clinician", href: "/doctor/dashboard" }, { label: "Participants" }]}
        description="Every participant with an EEG recording in the study, with the basis for their diagnosis label."
        meta={[
          { label: "With EEG", value: formatNumber(stats.eegParticipants) },
          { label: "ADHD", value: formatNumber(stats.adhd) },
          { label: "Control", value: formatNumber(stats.control) },
        ]}
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <Notice tone="neutral">
          <p>
            Diagnosis labels come from the source datasets, not from this study, and are shown
            here so a reviewer can sanity-check the model against the same labelling the study
            used. {formatNumber(stats.excludedFromBinary)} participants carry an undetermined label
            and are excluded from any binary evaluation.
          </p>
        </Notice>

        <ParticipantFilter rows={rows} />
      </PortalBody>
    </>
  );
}
