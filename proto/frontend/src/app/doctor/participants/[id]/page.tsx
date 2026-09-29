import type { Metadata } from "next";
import { ClipboardCheck, Users } from "lucide-react";
import { Panel } from "@/components/ui/data";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { ChipList, KeyValueList } from "@/components/ui/data";
import { PredictionCard, ImportanceBars } from "@/components/models/prediction-card";
import { PipelineTimeline } from "@/components/session/pipeline-timeline";
import { ParticipantShell } from "@/components/doctor/participant-shell";
import { formatDate, formatDuration, formatMs, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Session } from "@/types/session";

export const metadata: Metadata = {
  title: "Participant overview",
  description: "Participant record with signal quality, latest model output and session list.",
};

export default async function ParticipantReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ParticipantShell id={id}>
      {({ participant, sessions, latest, latestResults }) => (
        <>
          <Notice tone="caution" title="Research record, not a medical record">
            <p>
              The diagnosis label below is inherited from the source dataset ({participant.source}).
              It was assigned by that study, not by this one, and is shown only so you can check
              the model against the labelling the study used.
            </p>
          </Notice>

          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="flex flex-col gap-4">
              <Panel title="Record" icon={Users}>
                <KeyValueList
                  items={[
                    { label: "Participant", value: participant.displayId },
                    { label: "Internal ID", value: participant.id },
                    { label: "Diagnosis label", value: participant.diagnosis },
                    { label: "Status", value: participant.status },
                    { label: "Age", value: `${participant.age}` },
                    { label: "Gender", value: participant.gender },
                    {
                      label: "Behavioural link",
                      value: participant.behaviorLinked ? "linked" : "EEG only",
                    },
                    {
                      label: "Last session",
                      value: participant.lastSession
                        ? formatDate(participant.lastSession)
                        : "—",
                    },
                  ]}
                />
              </Panel>

              <Panel title="Signal quality" description="Mean across all recorded sessions.">
                <div className="grid gap-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] text-ink-muted">Mean signal quality</span>
                    <span className="text-[15px] font-semibold text-ink tabular-nums">
                      {formatPercent(participant.signalQuality, 1)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(participant.signalQuality * 100)}%`,
                        backgroundColor:
                          participant.signalQuality >= 0.85
                            ? "var(--color-positive-500)"
                            : participant.signalQuality >= 0.7
                              ? "var(--color-caution-500)"
                              : "var(--color-critical-500)",
                      }}
                    />
                  </div>
                  <p className="text-[11.5px] text-ink-subtle">0.80 is the review threshold</p>
                </div>
                <p
                  className={cn(
                    "mt-3 text-[12px] leading-relaxed",
                    participant.signalQuality < 0.8 ? "text-caution-700" : "text-ink-muted",
                  )}
                >
                  {participant.signalQuality < 0.8
                    ? "Below the 0.80 review threshold. Session-level windows may have been rejected during preprocessing, which reduces the number of usable model inputs."
                    : "Above the 0.80 review threshold. No quality-driven exclusion is expected for this participant."}
                </p>
              </Panel>

              <Panel title="Devices and tasks">
                <p className="section-label">Devices</p>
                <div className="mt-1.5">
                  <ChipList items={participant.devices} />
                </div>
                <p className="section-label mt-4">Tasks</p>
                <div className="mt-1.5">
                  <ChipList items={participant.tasks} />
                </div>
              </Panel>
            </div>

            <div className="flex flex-col gap-4">
              <div id="model-results" className="scroll-mt-20">
                {latestResults && latest ? (
                  <Panel
                    title="Latest model output"
                    description={`${latest.id} · research prototype`}
                  >
                    <PredictionCard
                      result={latest.resultLabel ?? "Model output unavailable"}
                      probability={latestResults.result}
                      model={latestResults.model}
                      sessionId={latest.id}
                      confidenceNote="Compare against the source diagnosis label on this record, not against a clinical expectation."
                    />
                    <div className="mt-4">
                      <p className="section-label mb-2">Contributing signal features</p>
                      <ImportanceBars
                        items={latestResults.bandImportance.map((b) => ({
                          label: b.label,
                          value: b.importance,
                        }))}
                      />
                    </div>
                    <p className="mt-4 text-[12px] text-ink-muted">
                      Full metrics, channel attribution and time alignment are on the{" "}
                      <a href={`/doctor/participants/${participant.id}/report`} className="font-medium text-primary-700 underline">
                        report
                      </a>{" "}
                      tab.
                    </p>
                  </Panel>
                ) : (
                  <Panel>
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <ClipboardCheck className="size-6 text-ink-subtle" />
                      <p className="text-[13px] font-semibold text-ink">No completed session</p>
                      <p className="max-w-sm text-[12.5px] leading-relaxed text-ink-muted">
                        Model output appears once this participant has at least one fully processed
                        session.
                      </p>
                    </div>
                  </Panel>
                )}
              </div>

              {latest ? (
                <Panel title="Processing trace" description="Backend-reported stage timings.">
                  <PipelineTimeline stages={latest.stages} />
                  <div className="mt-4 border-t border-line pt-4">
                    <KeyValueList
                      columns={3}
                      items={[
                        { label: "Windows", value: String(latest.windows) },
                        { label: "Sequences", value: String(latest.sequences) },
                        { label: "Channels", value: String(latest.channels) },
                        {
                          label: "Mean RT",
                          value: latest.behavior
                            ? formatMs(latest.behavior.reactionTimeMs)
                            : "—",
                        },
                        {
                          label: "Task score",
                          value: latest.behavior
                            ? formatPercent(latest.behavior.taskScore, 0)
                            : "—",
                        },
                        { label: "Stage", value: latest.experimentStage },
                      ]}
                    />
                  </div>
                </Panel>
              ) : null}
            </div>
          </div>

          <Panel
            title="Sessions"
            icon={ClipboardCheck}
            description="Most recent first."
            bodyClassName="p-0"
          >
            <div id="sessions" className="scroll-mt-20 overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line">
                    {[
                      "Session",
                      "Date",
                      "Experiment",
                      "Duration",
                      "Status",
                      "Model output",
                      "",
                    ].map((label) => (
                      <th
                        key={label || "open"}
                        className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <SessionRow key={session.id} session={session} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </ParticipantShell>
  );
}

function SessionRow({ session }: { session: Session }) {
  const href =
    session.status === "complete"
      ? `/participant/session/${session.id}/results`
      : `/participant/session/${session.id}/processing`;

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-5 py-3 font-mono text-[12.5px] font-medium text-ink">{session.id}</td>
      <td className="px-5 py-3 text-ink-muted">{formatDate(session.startedAt)}</td>
      <td className="px-5 py-3 text-ink-muted">{session.experiment}</td>
      <td className="px-5 py-3 text-ink-muted tabular-nums">
        {formatDuration(session.durationSeconds)}
      </td>
      <td className="px-5 py-3">
        <Badge
          tone={
            session.status === "complete"
              ? "positive"
              : session.status === "failed"
                ? "critical"
                : session.status === "processing"
                  ? "primary"
                  : "neutral"
          }
        >
          {session.status}
        </Badge>
        {session.flagged ? (
          <Badge tone="caution" className="ml-1.5">
            flagged
          </Badge>
        ) : null}
      </td>
      <td className="px-5 py-3">
        {session.probability !== null ? (
          <>
            <span className="font-semibold text-ink tabular-nums">
              {formatPercent(session.probability)}
            </span>
            <span className="ml-1.5 text-[11.5px] text-ink-subtle">{session.resultLabel}</span>
          </>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <a
          href={href}
          className="text-[12.5px] font-medium text-primary-700 hover:underline"
        >
          {session.status === "complete" ? "Result" : "Processing"}
        </a>
      </td>
    </tr>
  );
}
