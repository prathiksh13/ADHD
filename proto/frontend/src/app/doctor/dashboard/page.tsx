import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Flag,
  LayoutDashboard,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Panel } from "@/components/ui/data";
import { ButtonLink } from "@/components/ui/button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Notice } from "@/components/ui/notice";
import { getDoctorOverview } from "@/lib/api";
import { formatDate, formatNumber, formatPercent, relativeTime } from "@/lib/format";
import type { Diagnosis, Participant } from "@/types/participant";
import type { Session } from "@/types/session";

export const metadata: Metadata = {
  title: "Clinician dashboard",
  description: "Participant review queue, session status and signal quality across the study.",
};

export default async function DoctorDashboardPage() {
  const { stats, sessions, participants } = await getDoctorOverview();

  const needsReview = participants.filter((p) => p.status === "Review");
  const activeSessions = sessions.filter(
    (s) => s.status === "processing" || s.status === "uploaded",
  );

  return (
    <>
      <PageHeader
        title="Clinician dashboard"
        icon={LayoutDashboard}
        breadcrumb={[{ label: "Clinician", href: "/doctor/dashboard" }, { label: "Dashboard" }]}
        description="Participants awaiting review, sessions in flight, and cohort-level signal quality."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <Notice tone="caution" title="Research context">
          <p>
            This is a research review tool. It shows recorded sessions and research model output.
            It is not connected to any medical record, and nothing here supports a clinical
            decision.
          </p>
        </Notice>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Participants"
            value={String(stats.participants)}
            hint="with EEG recordings"
            icon={Users}
            tone="primary"
          />
          <StatCard
            label="Completed sessions"
            value={formatNumber(stats.completedAssessments)}
            hint="fully processed"
            icon={ClipboardCheck}
          />
          <StatCard
            label="Review queue"
            value={String(stats.reviewQueue)}
            hint={`${needsReview.length} shown below`}
            icon={Flag}
            tone={stats.reviewQueue > 0 ? "caution" : "neutral"}
          />
          <StatCard
            label="Mean signal quality"
            value={formatPercent(stats.averageSignalQuality, 1)}
            hint={`${stats.flagged} sessions flagged`}
            icon={SlidersHorizontal}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel
            title="Participants needing review"
            description="Flagged signal, incomplete sessions, or awaiting a data-quality decision."
            actions={
              <ButtonLink href="/doctor/participants" variant="ghost" size="sm">
                All participants
                <ArrowRight className="size-3.5" />
              </ButtonLink>
            }
            bodyClassName="p-0"
          >
            {needsReview.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line">
                      {["Participant", "Status", "Signal quality", "Last session", ""].map(
                        (label) => (
                          <th
                            key={label || "open"}
                            className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase"
                          >
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {needsReview.map((participant) => (
                      <tr key={participant.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3">
                          <span className="block font-medium text-ink">
                            {participant.displayId}
                          </span>
                          <span className="block text-[11.5px] text-ink-subtle">
                            {participant.source} · age {participant.age}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone="caution">
                            <StatusDot tone="caution" />
                            {participant.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <QualityCell value={participant.signalQuality} />
                        </td>
                        <td className="px-5 py-3 text-ink-muted">
                          {participant.lastSession ? relativeTime(participant.lastSession) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/doctor/participants/${participant.id}`}
                            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary-700 hover:underline"
                          >
                            Review
                            <ArrowRight className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-[12.5px] text-ink-subtle">
                No participants are waiting for review.
              </p>
            )}
          </Panel>

          <Panel
            title="Sessions in flight"
            icon={ClipboardCheck}
            description="Uploads still moving through the processing pipeline."
          >
            {activeSessions.length ? (
              <ul className="grid gap-2.5">
                {activeSessions.map((session) => (
                  <li key={session.id}>
                    <SessionRow session={session} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-[12.5px] text-ink-subtle">
                No sessions are currently processing.
              </p>
            )}

            <div className="mt-4 border-t border-line pt-4">
              <ButtonLink href="/doctor/participants" variant="secondary" size="sm">
                Open cohort view
              </ButtonLink>
            </div>
          </Panel>
        </div>

        <Panel
          title="Cohort composition"
          description="Recorded cohort by diagnosis label and source dataset."
        >
          <CohortPanel participants={participants} />
        </Panel>
      </PortalBody>
    </>
  );
}

function QualityCell({ value }: { value: number }) {
  const tone = value >= 0.85 ? "positive" : value >= 0.7 ? "caution" : "critical";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunken">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${Math.round(value * 100)}%`,
            backgroundColor: `var(--color-${tone === "positive" ? "positive" : tone === "caution" ? "caution" : "critical"}-500)`,
          }}
        />
      </span>
      <span className="text-[12.5px] text-ink-muted tabular-nums">
        {formatPercent(value, 1)}
      </span>
    </span>
  );
}

function SessionRow({ session }: { session: Session }) {
  return (
    <Link
      href={`/participant/session/${session.id}/processing`}
      className="flex items-center justify-between gap-3 rounded-md border border-line px-3.5 py-2.5 transition-colors hover:border-line-strong"
    >
      <span className="min-w-0">
        <span className="block font-mono text-[12.5px] font-medium text-ink">{session.id}</span>
        <span className="block text-[11.5px] text-ink-subtle">
          {session.participantLabel} · {formatDate(session.startedAt)}
        </span>
      </span>
      <Badge tone={session.status === "failed" ? "critical" : "primary"}>{session.status}</Badge>
    </Link>
  );
}

function CohortPanel({ participants }: { participants: Participant[] }) {
  const byDiagnosis = new Map<Diagnosis, number>();
  for (const participant of participants) {
    byDiagnosis.set(participant.diagnosis, (byDiagnosis.get(participant.diagnosis) ?? 0) + 1);
  }

  const bySource = participants.reduce<Record<string, number>>((acc, p) => {
    acc[p.source] = (acc[p.source] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <p className="section-label">By diagnosis label</p>
        <ul className="mt-2 grid gap-2">
          {[...byDiagnosis.entries()].map(([diagnosis, count]) => (
            <li key={diagnosis} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="text-ink-muted">{diagnosis}</span>
              <span className="font-medium text-ink tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-subtle">
          Counts reflect the page sample. Undetermined and unknown labels are excluded from any
          binary evaluation, because the model only ever predicts ADHD versus control.
        </p>
      </div>

      <div>
        <p className="section-label">By source dataset</p>
        <ul className="mt-2 grid gap-2">
          {Object.entries(bySource).map(([source, count]) => (
            <li key={source} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="text-ink-muted">{source}</span>
              <span className="font-medium text-ink tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-subtle">
          A diagnosis label is inherited from the source dataset, not assigned by this study. The
          basis for each label is recorded per participant.
        </p>
      </div>
    </div>
  );
}
