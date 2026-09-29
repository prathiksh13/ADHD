import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { ButtonLink } from "@/components/ui/button";
import { ParticipantTabs } from "@/components/doctor/participant-tabs";
import { getParticipantDetail, getSessionResults } from "@/lib/api";
import type { Participant } from "@/types/participant";
import type { Session } from "@/types/session";

/**
 * Everything a clinician's participant sub-routes share.
 *
 * Resolving the record once here keeps the tab chrome identical across
 * Overview, EEG, Behavior and Reports, and gives the caller a single
 * already-sorted session list instead of re-sorting in each page.
 */
export async function ParticipantShell({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title?: string;
  description?: string;
  children: (context: {
    participant: Participant;
    sessions: Session[];
    latest: Session | null;
    latestResults: Awaited<ReturnType<typeof getSessionResults>>;
  }) => React.ReactNode | Promise<React.ReactNode>;
}) {
  const detail = await getParticipantDetail(id);
  if (!detail) notFound();

  const { participant, sessions } = detail;
  const ordered = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const latest = ordered.find((s) => s.status === "complete") ?? null;
  const latestResults = latest ? await getSessionResults(latest.id) : null;

  const anyBehavior = ordered.some((s) => s.behavior !== null);

  return (
    <>
      <PageHeader
        title={title ?? participant.displayId}
        breadcrumb={[
          { label: "Clinician", href: "/doctor/dashboard" },
          { label: "Participants", href: "/doctor/participants" },
          { label: participant.displayId },
        ]}
        description={description ?? participant.diagnosisBasis}
        meta={[
          { label: "Age", value: String(participant.age) },
          {
            label: "Sessions",
            value: `${participant.completedSessions}/${participant.sessionCount}`,
          },
          { label: "Source", value: participant.source },
        ]}
        actions={
          <ButtonLink href="/doctor/participants" variant="secondary">
            <ArrowLeft className="size-4" />
            Back to roster
          </ButtonLink>
        }
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <ParticipantTabs
          participantId={participant.id}
          hasBehavior={anyBehavior}
          sessionCount={ordered.length}
        />
        {await children({ participant, sessions: ordered, latest, latestResults })}
      </PortalBody>
    </>
  );
}
