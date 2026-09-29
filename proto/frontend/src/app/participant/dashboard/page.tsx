import type { Metadata } from "next";
import {
  ArrowRight,
  CircleCheck,
  Clock,
  FileUp,
  History,
  ListChecks,
  Radio,
  Waves,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { EEGStatus } from "@/components/eeg/eeg-status";
import { ButtonLink } from "@/components/ui/button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { KeyValueList, Panel } from "@/components/ui/data";
import { StageRail } from "@/components/experiment/experiment-timer";
import { PipelineTimeline } from "@/components/session/pipeline-timeline";
import { listParticipantSessions, listSessions } from "@/lib/api";
import { PIPELINE_STAGES } from "@/lib/constants";
import { formatDate, formatPercent, relativeTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Participant dashboard",
  description: "Current session, EEG status, previous sessions and the latest research result.",
};

const DEMO_PARTICIPANT = "P-0142";

export default async function ParticipantDashboardPage() {
  const [{ rows: allSessions }, mine] = await Promise.all([
    listSessions(),
    listParticipantSessions(DEMO_PARTICIPANT),
  ]);

  const mineSorted = [...mine].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const active = mineSorted.find((s) => s.status === "processing" || s.status === "uploaded");
  const completed = mineSorted.filter((s) => s.status === "complete");
  const latest = completed[0] ?? null;

  const nextStep = active
    ? {
        href: `/participant/session/${active.id}/processing`,
        label: "Follow processing",
        why: "This session is still being processed.",
      }
    : completed.length
      ? {
          href: "/participant/eeg",
          label: "Start a new session",
          why: "Upload a recording to begin a new session.",
        }
      : {
          href: "/participant/eeg",
          label: "Start your first session",
          why: "Upload an EEG recording to begin.",
        };

  return (
    <>
      <PageHeader
        title={`Welcome back, ${DEMO_PARTICIPANT}`}
        icon={Waves}
        description="Track your current session, or start a new one by uploading an EEG recording."
        meta={[
          { label: "Sessions", value: String(mineSorted.length) },
          { label: "Completed", value: String(completed.length) },
          {
            label: "Latest result",
            value: latest?.resultLabel ?? "not available",
          },
        ]}
        actions={
          <ButtonLink href={nextStep.href}>
            {nextStep.label}
            <ArrowRight className="size-4" />
          </ButtonLink>
        }
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        {/* ---------------------------------------------------- status cards */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Current session" icon={Clock}>
            {active ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <StatusDot tone="caution" pulse={active.status === "processing"} />
                  <span className="text-[13.5px] font-semibold text-ink">
                    {active.status === "processing" ? "Processing" : "Uploaded"}
                  </span>
                </div>
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Session", value: active.id },
                    { label: "Started", value: formatDate(active.startedAt) },
                    { label: "Channels", value: String(active.channels) },
                    { label: "Windows", value: String(active.windows) },
                  ]}
                />
                <StageRail
                  steps={PIPELINE_STAGES.map((declared) => {
                    const actual = active.stages.find((s) => s.key === declared.key);
                    return {
                      key: declared.key,
                      label: declared.label,
                      state:
                        actual?.state === "done"
                          ? "done"
                          : actual?.state === "running"
                            ? "running"
                            : "pending",
                    };
                  })}
                />
                <ButtonLink
                  href={`/participant/session/${active.id}/processing`}
                  variant="secondary"
                  className="w-fit"
                >
                  Follow processing
                  <ArrowRight className="size-4" />
                </ButtonLink>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <StatusDot tone="neutral" />
                  <span className="text-[13.5px] font-semibold text-ink">Not started</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  {nextStep.why} A session runs through six stages: upload, preprocessing, the
                  attention task, model inference, and the result.
                </p>
                <ButtonLink href={nextStep.href} variant="secondary" className="w-fit">
                  <FileUp className="size-4" />
                  Upload EEG recording
                </ButtonLink>
              </div>
            )}
          </Panel>

          <EEGStatus
            state={active ? "processing" : "idle"}
            source="upload"
            device={active?.device}
            samplingRateHz={active?.samplingRateHz}
            channels={active?.channels}
          />

          <Panel title="Latest result" icon={CircleCheck}>
            {latest && latest.probability !== null ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
                    Model output
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-ink">
                    {latest.resultLabel}
                  </p>
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] text-ink-muted">Classification probability</span>
                    <span className="text-[14px] font-semibold text-ink tabular-nums">
                      {formatPercent(latest.probability)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{ width: `${Math.round(latest.probability * 100)}%` }}
                    />
                  </div>
                </div>
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Session", value: latest.id },
                    { label: "Date", value: formatDate(latest.completedAt ?? latest.startedAt) },
                  ]}
                />
                <ButtonLink
                  href={`/participant/session/${latest.id}/results`}
                  variant="secondary"
                  className="w-fit"
                >
                  View full result
                  <ArrowRight className="size-4" />
                </ButtonLink>
                <p className="rounded-md border border-line bg-surface-subtle p-2.5 text-[11.5px] leading-relaxed text-ink-subtle">
                  Research output, not a diagnosis. This is a model classification probability.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <StatusDot tone="neutral" />
                  <span className="text-[13.5px] font-semibold text-ink">Not available</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  A result appears here once a session has been processed by the model.
                </p>
              </div>
            )}
          </Panel>
        </div>

        {/* --------------------------------------------------------- workflow */}
        <Panel
          title="The six stages of a session"
          description="Each stage is driven by backend state. Progress is never simulated."
        >
          <PipelineTimeline compact />
        </Panel>

        {/* ---------------------------------------------------------- history */}
        <Panel
          title="Previous sessions"
          icon={History}
          actions={
            <ButtonLink href="/participant/history" variant="ghost" size="sm">
              View all
              <ArrowRight className="size-3.5" />
            </ButtonLink>
          }
          bodyClassName="p-0"
        >
          {mineSorted.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      Session
                    </th>
                    <th className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      Date
                    </th>
                    <th className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      Experiment
                    </th>
                    <th className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      Status
                    </th>
                    <th className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      Model output
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mineSorted.slice(0, 5).map((session) => (
                    <tr key={session.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-mono text-[12.5px] text-ink">{session.id}</td>
                      <td className="px-5 py-3">
                        <span className="block text-ink">{formatDate(session.startedAt)}</span>
                        <span className="block text-[11.5px] text-ink-subtle">
                          {relativeTime(session.startedAt)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{session.experiment}</td>
                      <td className="px-5 py-3">
                        <Badge tone={statusTone(session.status)}>{session.status}</Badge>
                        {session.flagged ? (
                          <Badge tone="caution" className="ml-1.5">
                            flagged
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        {session.probability !== null ? (
                          <span className="font-semibold text-ink tabular-nums">
                            {formatPercent(session.probability)}
                          </span>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptySessions />
          )}
        </Panel>

        <p className="text-[11.5px] text-ink-subtle">
          Showing {mineSorted.length} of {allSessions.length} sessions in the prototype dataset.
        </p>
      </PortalBody>
    </>
  );
}

function statusTone(status: string) {
  switch (status) {
    case "complete":
      return "positive" as const;
    case "processing":
      return "primary" as const;
    case "failed":
      return "critical" as const;
    default:
      return "neutral" as const;
  }
}

function EmptySessions() {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-md bg-surface-sunken text-ink-subtle">
        <ListChecks className="size-5" />
      </span>
      <div>
        <p className="text-[13.5px] font-semibold text-ink">No sessions yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-muted">
          Upload an EEG recording to create your first session. The attention task runs afterwards
          so responses stay aligned to the signal.
        </p>
      </div>
      <ButtonLink href="/participant/eeg" variant="secondary" size="sm">
        <FileUp className="size-3.5" />
        Upload EEG
      </ButtonLink>
      <p className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
        <Radio className="size-3" />
        Live device capture is not available in this version.
      </p>
    </div>
  );
}
