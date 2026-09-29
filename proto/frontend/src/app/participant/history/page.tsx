import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileUp, History as HistoryIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/data";
import { ButtonLink } from "@/components/ui/button";
import { listParticipantSessions } from "@/lib/api";
import { formatDate, formatDuration, formatPercent, relativeTime } from "@/lib/format";
import type { Session, SessionStatus } from "@/types/session";

export const metadata: Metadata = {
  title: "History",
  description: "Previous sessions with date, experiment, model output and status.",
};

const DEMO_PARTICIPANT = "P-0142";

export default async function ParticipantHistoryPage() {
  const sessions = (await listParticipantSessions(DEMO_PARTICIPANT))
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const completed = sessions.filter((s) => s.status === "complete");

  return (
    <>
      <PageHeader
        title="Session history"
        icon={HistoryIcon}
        breadcrumb={[
          { label: "Participant", href: "/participant/dashboard" },
          { label: "History" },
        ]}
        description="Every session recorded for this participant, with its experiment, status and model output."
        meta={[
          { label: "Total", value: String(sessions.length) },
          { label: "Completed", value: String(completed.length) },
        ]}
        actions={
          <ButtonLink href="/participant/eeg">
            <FileUp className="size-4" />
            New session
          </ButtonLink>
        }
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        {sessions.length ? (
          <Panel bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line">
                    {[
                      "Session",
                      "Date",
                      "Experiment",
                      "Duration",
                      "Status",
                      "Task accuracy",
                      "Model output",
                      "",
                    ].map((label) => (
                      <th
                        key={label || "actions"}
                        className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3.5 font-mono text-[12.5px] font-medium text-ink">
                        {session.id}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="block text-ink">{formatDate(session.startedAt)}</span>
                        <span className="block text-[11.5px] text-ink-subtle">
                          {relativeTime(session.startedAt)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">{session.experiment}</td>
                      <td className="px-5 py-3.5 text-ink-muted tabular-nums">
                        {formatDuration(session.durationSeconds)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={statusTone(session.status)}>{session.status}</Badge>
                        {session.flagged ? (
                          <Badge tone="caution" className="ml-1.5">
                            flagged
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted tabular-nums">
                        {session.behavior
                          ? formatPercent(
                              session.behavior.correctResponses /
                                Math.max(
                                  1,
                                  session.behavior.correctResponses +
                                    session.behavior.incorrectResponses,
                                ),
                            )
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        {session.probability !== null ? (
                          <>
                            <span className="font-semibold text-ink tabular-nums">
                              {formatPercent(session.probability)}
                            </span>
                            <span className="ml-1.5 text-[11.5px] text-ink-subtle">
                              {session.resultLabel}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <SessionLink session={session} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : (
          <Panel>
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-md bg-surface-sunken text-ink-subtle">
                <HistoryIcon className="size-5" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">No sessions yet</p>
                <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-muted">
                  Upload an EEG recording to create your first session. Processing and results
                  appear here once complete.
                </p>
              </div>
              <ButtonLink href="/participant/eeg" variant="secondary" size="sm">
                <FileUp className="size-3.5" />
                Upload EEG
              </ButtonLink>
            </div>
          </Panel>
        )}

        <p className="text-[11.5px] leading-relaxed text-ink-subtle">
          Model output column shows the classification probability produced by the research model
          for that session. It is not a diagnosis and cannot confirm or rule out any condition.
        </p>
      </PortalBody>
    </>
  );
}

function SessionLink({ session }: { session: Session }) {
  if (session.status === "complete") {
    return (
      <Link
        href={`/participant/session/${session.id}/results`}
        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary-700 hover:underline"
      >
        Result
        <ArrowRight className="size-3" />
      </Link>
    );
  }
  if (session.status === "processing" || session.status === "uploaded") {
    return (
      <Link
        href={`/participant/session/${session.id}/processing`}
        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary-700 hover:underline"
      >
        Processing
        <ArrowRight className="size-3" />
      </Link>
    );
  }
  return <span className="text-[12.5px] text-ink-subtle">—</span>;
}

function statusTone(status: SessionStatus) {
  switch (status) {
    case "complete":
      return "positive" as const;
    case "processing":
      return "primary" as const;
    case "failed":
      return "critical" as const;
    case "uploaded":
      return "secondary" as const;
    default:
      return "neutral" as const;
  }
}
