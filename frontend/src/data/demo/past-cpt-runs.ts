import { CPT_SCORED_TRIALS } from "@/features/activities/cpt/cpt-config";
import {
  buildCptRunSummary,
  createCptTrialEvent,
} from "@/features/activities/cpt/scoring";
import { DEMO_PARTICIPANT_ID } from "@/data/demo/participant";
import type { CptRunSummary } from "@/types";

function createPastScoredRun(
  id: string,
  completedAt: string,
  missTargetIndices: number[] = [],
  falseAlarmIndices: number[] = [3],
  baseReactionTimeMs = 350,
): CptRunSummary {
  const events = CPT_SCORED_TRIALS.map((trial, index) => {
    let responded = false;
    let reactionTimeMs: number | null = null;

    if (trial.isTarget) {
      const isMiss = missTargetIndices.includes(index);
      responded = !isMiss;
      if (responded) {
        reactionTimeMs = baseReactionTimeMs + ((index * 17) % 55) - 25;
      }
    } else {
      const isFalseAlarm = falseAlarmIndices.includes(index);
      responded = isFalseAlarm;
      if (responded) {
        reactionTimeMs = baseReactionTimeMs + 40;
      }
    }

    return createCptTrialEvent(trial, index, { responded, reactionTimeMs });
  });

  return buildCptRunSummary({
    id,
    participantId: DEMO_PARTICIPANT_ID,
    mode: "scored",
    completedAt,
    events,
  });
}

export const DEMO_PAST_CPT_RUNS: CptRunSummary[] = [
  createPastScoredRun(
    "DEMO-CPT-0003",
    "2026-10-26T09:45:00Z",
    [],
    [7],
    332,
  ),
  createPastScoredRun(
    "DEMO-CPT-0002",
    "2026-10-22T14:30:00Z",
    [],
    [10],
    348,
  ),
  createPastScoredRun(
    "DEMO-CPT-0001",
    "2026-10-18T10:15:00Z",
    [5],
    [3],
    365,
  ),
];

