import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { ExperimentRunner } from "@/components/experiment/experiment-runner";

export const metadata: Metadata = {
  title: "Experiment",
  description: "Attention task: rest, task and post-task blocks with time-stamped responses.",
};

export default function ParticipantExperimentPage() {
  return (
    <>
      <PageHeader
        title="Attention task"
        icon={ListChecks}
        breadcrumb={[
          { label: "Participant", href: "/participant/dashboard" },
          { label: "Experiment" },
        ]}
        description="A focused task surface. The recording runs throughout so responses stay aligned to the EEG signal."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <ExperimentRunner />
      </PortalBody>
    </>
  );
}
