import type { Metadata } from "next";
import { Brain, ListChecks, Timer } from "lucide-react";
import { Panel } from "@/components/ui/data";
import { Notice } from "@/components/ui/notice";
import { KeyValueList } from "@/components/ui/data";
import { EventTimeline, type TimelineEvent } from "@/components/experiment/event-timeline";
import { ParticipantShell } from "@/components/doctor/participant-shell";
import { formatClock, formatMs, formatPercent, formatRatio } from "@/lib/format";
import { SIGNAL_CONFIG } from "@/lib/constants";
import type { BehaviorSummary } from "@/types/session";
import type { Session } from "@/types/session";

export const metadata: Metadata = {
  title: "Behavioral analysis",
  description: "Task performance and time-aligned events, where behavioural data is linked.",
};

export default async function ParticipantBehaviorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ParticipantShell
      id={id}
      title="Behavioral analysis"
      description="Task performance for the latest completed session, where behavioural data is linked to the recording."
    >
      {({ participant, latest, sessions }) => {
        const behavior = latest?.behavior ?? null;

        if (!behavior) {
          return (
            <>
              <Notice tone="info" title="No behavioural data linked to this participant">
                <p>
                  Not every EEG recording in this study has a matched behavioural session. That is
                  expected:{" "}
                  {participant.source === "balladeer"
                    ? "the BALLADEER EEG subset and its wider demographics cohort do not overlap one-to-one."
                    : "behavioural labels are not published for every adhdata recording."}{" "}
                  EEG-only sessions are still valid model inputs.
                </p>
              </Notice>

              <Panel title="Linkage status">
                <KeyValueList
                  items={[
                    { label: "Participant", value: participant.displayId },
                    { label: "Behavioural link", value: participant.behaviorLinked ? "linked" : "not linked" },
                    { label: "Sessions with behaviour", value: String(countWithBehavior(sessions)) },
                    { label: "Total sessions", value: String(sessions.length) },
                  ]}
                />
              </Panel>
            </>
          );
        }

        const totalTrials =
          behavior.correctResponses + behavior.incorrectResponses + behavior.missedTargets;
        const accuracy =
          totalTrials > 0
            ? behavior.correctResponses /
              Math.max(1, behavior.correctResponses + behavior.incorrectResponses)
            : null;
        const events = buildEvents(behavior, latest!);

        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Reaction time" value={formatMs(behavior.reactionTimeMs)} hint="mean" />
              <Stat
                label="Accuracy"
                value={accuracy === null ? "—" : formatPercent(accuracy, 1)}
                hint={`${behavior.correctResponses} of ${behavior.correctResponses + behavior.incorrectResponses} responded trials`}
              />
              <Stat
                label="Task score"
                value={formatPercent(behavior.taskScore, 0)}
                hint="composite, study-defined"
              />
              <Stat
                label="RT variability"
                value={formatRatio(behavior.variabilityRtp, 3)}
                hint="RTP, higher is less stable"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Panel
                title="Response breakdown"
                icon={ListChecks}
                description="Every trial the task recorded in this session."
              >
                <ul className="grid gap-3">
                  {[
                    {
                      label: "Correct responses",
                      value: behavior.correctResponses,
                      tone: "var(--color-positive-500)",
                    },
                    {
                      label: "Incorrect responses",
                      value: behavior.incorrectResponses,
                      tone: "var(--color-caution-500)",
                    },
                    {
                      label: "Missed targets",
                      value: behavior.missedTargets,
                      tone: "var(--color-critical-500)",
                    },
                    {
                      label: "Commission errors",
                      value: behavior.commissionErrors,
                      tone: "var(--color-accent-500)",
                    },
                  ].map((row) => (
                    <li key={row.label}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[12.5px] text-ink-muted">{row.label}</span>
                        <span className="text-[13px] font-semibold text-ink tabular-nums">
                          {row.value}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${totalTrials ? (row.value / totalTrials) * 100 : 0}%`,
                            backgroundColor: row.tone,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 border-t border-line pt-4">
                  <KeyValueList
                    items={[
                      { label: "Total trials", value: String(totalTrials) },
                      { label: "Condition", value: behavior.condition },
                      { label: "Stage", value: behavior.stage },
                      { label: "Session", value: latest!.id },
                    ]}
                  />
                </div>
              </Panel>

              <Panel
                title="Time-aligned events"
                icon={Timer}
                description={`Stimulus and boundary markers across ${formatClock(latest!.durationSeconds)} of recording.`}
              >
                <EventTimeline events={events} durationSeconds={latest!.durationSeconds} />
                <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
                  In a live deployment each marker comes from{" "}
                  <span className="font-mono">POST /api/experiments/event</span>, so EEG windows can
                  be aligned to real task events on the backend. In this prototype the markers are
                  laid out from the session&apos;s aggregate behaviour summary, so treat the
                  alignment as illustrative rather than measured.
                </p>
              </Panel>
            </div>

            <Panel
              title="Behaviour across sessions"
              icon={Brain}
              description="Stability check across every session with linked behavioural data."
            >
              <SessionBehaviorTable sessions={sessions.filter((s) => s.behavior)} />
            </Panel>

            <Notice tone="neutral">
              <p>
                Behavioural and EEG-only records both feed the study, which is why the dataset
                inventory counts them separately. A participant without a behavioural link is not
                a data-quality problem; it reflects which source dataset their recording came
                from.
              </p>
            </Notice>
          </>
        );
      }}
    </ParticipantShell>
  );
}

function countWithBehavior(sessions: Session[]) {
  return sessions.filter((s) => s.behavior).length;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-card">
      <p className="text-[11.5px] font-medium tracking-[0.03em] text-ink-subtle uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-[24px] leading-none font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-2 text-[11.5px] text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

function SessionBehaviorTable({ sessions }: { sessions: Session[] }) {
  if (!sessions.length) {
    return (
      <p className="py-8 text-center text-[12.5px] text-ink-subtle">
        No sessions with linked behavioural data.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {[
              "Session",
              "Condition",
              "Mean RT",
              "Correct",
              "Incorrect",
              "Missed",
              "Task score",
            ].map((label) => (
              <th
                key={label}
                className="px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const b = session.behavior as BehaviorSummary;
            return (
              <tr key={session.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono text-[12.5px] font-medium text-ink">
                  {session.id}
                </td>
                <td className="px-4 py-3 text-ink-muted">{b.condition}</td>
                <td className="px-4 py-3 text-ink-muted tabular-nums">
                  {formatMs(b.reactionTimeMs)}
                </td>
                <td className="px-4 py-3 text-ink-muted tabular-nums">{b.correctResponses}</td>
                <td className="px-4 py-3 text-ink-muted tabular-nums">{b.incorrectResponses}</td>
                <td className="px-4 py-3 text-ink-muted tabular-nums">{b.missedTargets}</td>
                <td className="px-4 py-3 font-medium text-ink tabular-nums">
                  {formatPercent(b.taskScore, 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Deterministic event layout derived from a session's behaviour summary.
 *
 * This is a placeholder for a real event stream: the order and outcomes are
 * arranged from the aggregate counts so the alignment view has something to
 * show. Every window is a multiple of the analysis window length, which is what
 * a real stream would also satisfy.
 */
function buildEvents(behavior: BehaviorSummary, session: Session): TimelineEvent[] {
  const total = behavior.correctResponses + behavior.incorrectResponses + behavior.missedTargets;
  if (total <= 0) return [];

  const windowSeconds = SIGNAL_CONFIG.windowSeconds;
  const taskStart = Math.max(0, session.durationSeconds * 0.3);
  const available = Math.max(session.durationSeconds - taskStart - windowSeconds, windowSeconds);
  const spacing = available / total;

  const outcomes: TimelineEvent["outcome"][] = [
    ...Array.from({ length: behavior.correctResponses }, () => "correct" as const),
    ...Array.from({ length: behavior.incorrectResponses }, () => "incorrect" as const),
    ...Array.from({ length: behavior.missedTargets }, () => "missed" as const),
  ];

  const events: TimelineEvent[] = [
    { at: 0, type: "rest", label: "Rest" },
    { at: taskStart, type: "boundary", label: "Task onset" },
  ];

  outcomes.forEach((outcome, i) => {
    // Every fourth trial is a distractor, matching the task design.
    const isDistractor = i % 4 === 3;
    events.push({
      at: taskStart + i * spacing,
      type: isDistractor ? "distractor" : "target",
      label: isDistractor ? "Distractor" : "Target",
      outcome,
    });
  });

  events.push({
    at: session.durationSeconds - windowSeconds,
    type: "rest",
    label: "Post-task rest",
  });

  return events;
}
