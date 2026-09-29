"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CirclePlay, Info, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { KeyValueList, Panel } from "@/components/ui/data";
import { ExperimentTimer, StageRail } from "@/components/experiment/experiment-timer";
import { Stimulus } from "@/components/experiment/stimulus";
import { EEGStatus } from "@/components/eeg/eeg-status";
import { useExperiment } from "@/hooks/useExperiment";
import { cn } from "@/lib/utils";
import { formatMs, formatPercent } from "@/lib/format";

/**
 * CPT-style attention task: REST → TASK → POST-TASK.
 *
 * This is a focused task surface, not another dashboard. The EEG context
 * panel is deliberately collapsed to a status line so it cannot distract from
 * the stimulus during the block.
 */
export function ExperimentRunner() {
  const router = useRouter();
  const { current, index, total, stage, advance, respond, responses, liveEnabled } =
    useExperiment();
  const [aborted, setAborted] = useState(false);

  const totalResponses = responses.correct + responses.incorrect;
  const accuracy = totalResponses ? responses.correct / totalResponses : null;
  const meanRt = responses.reactionTimes.length
    ? responses.reactionTimes.reduce((a, b) => a + b, 0) / responses.reactionTimes.length
    : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="flex flex-col gap-4">
        <Panel
          title={
            stage === "rest"
              ? "Stage 1 of 3 — Rest"
              : stage === "task"
                ? "Stage 2 of 3 — Attention task"
                : stage === "post-task"
                  ? "Stage 3 of 3 — Post-task"
                  : "Block complete"
          }
          icon={stage === "task" ? CirclePlay : Pause}
          description={
            stage === "rest"
              ? "Rest with eyes open and closed. No responses are collected in this stage."
              : stage === "task"
                ? "Respond only to target shapes. Distractors must be withheld."
                : stage === "post-task"
                  ? "Eyes closed, no task. Used as the post-task comparison baseline."
                  : "All stages complete."
          }
          actions={
            <Badge tone={stage === "task" ? "primary" : "neutral"}>
              {stage === "task" ? "recording" : stage}
            </Badge>
          }
          bodyClassName={cn(stage === "task" && "p-0")}
        >
          {stage === "rest" ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">
                Sit comfortably and keep still. The recording is running; there is nothing to
                respond to during this stage.
              </p>
              <Button size="lg" onClick={advance}>
                Begin task block
              </Button>
            </div>
          ) : stage === "post-task" ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">
                Rest with eyes closed for the post-task stage. This gives a comparison baseline
                against the task block.
              </p>
              <Button size="lg" onClick={advance}>
                Finish block
              </Button>
            </div>
          ) : stage === "complete" ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="size-8 text-positive-600" />
              <p className="text-[14px] font-semibold text-ink">Block complete</p>
              <Button onClick={() => router.push("/participant/eeg")}>
                Return to EEG input
              </Button>
            </div>
          ) : (
            <div className="p-5">
              <Stimulus
                stimulus={current}
                index={index}
                total={total}
                onRespond={respond}
              />
              <div className="mt-4 flex items-center justify-between gap-3">
                <ExperimentTimer
                  totalSeconds={total * 1.5}
                  remaining={Math.max(0, (total - index) * 1.5)}
                  running
                  className="text-[12.5px] text-ink-muted"
                />
                <button
                  type="button"
                  onClick={() => setAborted(true)}
                  className="flex items-center gap-1.5 text-[12px] text-ink-subtle hover:text-critical-600"
                >
                  <Square className="size-3" />
                  Abort block
                </button>
              </div>
            </div>
          )}
        </Panel>

        {aborted ? (
          <Notice tone="caution" title="Block aborted">
            <p>
              Responses collected so far are kept and will still be time-stamped against the
              recording. The session can be reprocessed, though a partial block will reduce the
              number of usable EEG windows.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setAborted(false)}
            >
              Resume
            </Button>
          </Notice>
        ) : null}

        <Panel title="Live performance" description="Updates as responses are recorded.">
          <KeyValueList
            columns={2}
            items={[
              { label: "Correct responses", value: String(responses.correct) },
              { label: "Incorrect responses", value: String(responses.incorrect) },
              { label: "Missed targets", value: String(responses.missed) },
              {
                label: "Mean reaction time",
                value: meanRt === null ? "—" : formatMs(meanRt),
              },
              {
                label: "Task accuracy",
                value: accuracy === null ? "—" : formatPercent(accuracy, 1),
              },
              { label: "Stimuli shown", value: `${index} / ${total}` },
            ]}
          />
          <p className="mt-4 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-subtle">
            <Info className="mt-0.5 size-3 shrink-0" />
            Reaction times in this prototype use a fixed inter-stimulus interval, so they are
            placeholders until events are posted to the real endpoint.
          </p>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Stages">
          <StageRail
            className="flex-wrap"
            steps={[
              { key: "rest", label: "Rest", state: stage === "rest" ? "running" : "done" },
              {
                key: "task",
                label: "Task",
                state: stage === "task" ? "running" : stage === "rest" ? "pending" : "done",
              },
              {
                key: "post-task",
                label: "Post-task",
                state:
                  stage === "post-task" ? "running" : stage === "complete" ? "done" : "pending",
              },
            ]}
          />
        </Panel>

        <EEGStatus
          state={stage === "task" ? "recording" : "ready"}
          source="live"
          device="Offline session recording"
          samplingRateHz={128}
          channels={14}
        />

        <Notice tone="neutral">
          <p>
            Response events are intended to be posted to{" "}
            <span className="font-mono text-[11.5px]">POST /api/experiments/event</span> so EEG
            windows can be aligned to real task events on the backend.
          </p>
        </Notice>

        {!liveEnabled ? (
          <Notice tone="info">
            <p>
              Live device streaming is off. This task runs against an already-uploaded recording,
              which is the supported workflow in the current version.
            </p>
          </Notice>
        ) : null}
      </div>
    </div>
  );
}
