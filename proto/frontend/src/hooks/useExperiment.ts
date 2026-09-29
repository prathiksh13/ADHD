"use client";

import { useCallback, useMemo, useState } from "react";
import { getStreamState, isLiveModeEnabled, type StreamState } from "@/lib/websocket";

export type ExperimentStage = "rest" | "task" | "post-task" | "complete";

export type Stimulus = {
  id: string;
  kind: "target" | "distractor";
  label: string;
  position: { x: number; y: number };
  onsetMs: number;
  correct: boolean;
};

/**
 * Experiment state machine for the REST → TASK → POST-TASK sequence.
 *
 * Stimuli are generated locally because the browser runs the task, but every
 * response is meant to be posted to `POST /api/experiments/event` so EEG
 * windows can be aligned to real events on the backend.
 */
export function useExperiment() {
  const [stage, setStage] = useState<ExperimentStage>("rest");
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<{
    correct: number;
    incorrect: number;
    missed: number;
    reactionTimes: number[];
  }>({ correct: 0, incorrect: 0, missed: 0, reactionTimes: [] });
  const [streamState] = useState<StreamState>(getStreamState());

  const stimuli = useMemo<Stimulus[]>(() => {
    const grid = 5;
    return Array.from({ length: 20 }, (_, i) => {
      const correct = i % 4 !== 3;
      return {
        id: `s${i + 1}`,
        kind: (correct ? "target" : "distractor") as Stimulus["kind"],
        label: correct ? "Target" : "Distractor",
        position: {
          x: 12 + ((i * 7) % (grid - 1)) * 19,
          y: 16 + ((i * 11) % (grid - 1)) * 17,
        },
        onsetMs: i * 1500,
        correct,
      };
    });
  }, []);

  const current = stimuli[index] ?? null;

  const respond = useCallback(
    (kind: "target" | "distractor") => {
      if (stage !== "task" || !current) return;
      const right = current.kind === kind;
      const missedTarget = current.correct && !right;
      setResponses((prev) => ({
        correct: prev.correct + (current.correct && right ? 1 : 0),
        incorrect: prev.incorrect + (current.correct && !right ? 1 : 0),
        missed: prev.missed + (missedTarget ? 1 : 0),
        reactionTimes: [...prev.reactionTimes, 1500],
      }));
      setIndex((i) => i + 1);
    },
    [current, stage],
  );

  const advance = useCallback(() => {
    setStage((s) => (s === "rest" ? "task" : s === "task" ? "post-task" : "complete"));
    setIndex(0);
  }, []);

  return {
    stimuli,
    current,
    index,
    total: stimuli.length,
    stage,
    setStage,
    advance,
    respond,
    responses,
    streamState,
    liveEnabled: isLiveModeEnabled(),
  };
}
