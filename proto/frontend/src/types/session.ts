import type { StageKey, StageState } from "@/lib/constants";

export type SessionStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "complete"
  | "failed";

export type SessionStage = {
  key: StageKey;
  state: StageState;
  startedAt: string | null;
  finishedAt: string | null;
  /** Backend-reported message. Never invented client-side. */
  message: string | null;
};

export type BehaviorSummary = {
  reactionTimeMs: number;
  correctResponses: number;
  incorrectResponses: number;
  missedTargets: number;
  commissionErrors: number;
  taskScore: number;
  condition: string;
  stage: string;
  variabilityRtp: number;
};

export type Session = {
  id: string;
  participantId: string;
  participantLabel: string;
  startedAt: string;
  completedAt: string | null;
  experiment: string;
  experimentStage: "rest" | "task" | "post-task" | "complete";
  status: SessionStatus;
  source: "upload" | "live";
  device: string;
  montage: string;
  samplingRateHz: number;
  channels: number;
  durationSeconds: number;
  windows: number;
  sequences: number;
  stages: SessionStage[];
  behavior: BehaviorSummary | null;
  modelId: string | null;
  probability: number | null;
  resultLabel: string | null;
  flagged: boolean;
  flagReason: string | null;
};

export type TemporalRegion = {
  label: string;
  weight: number;
  description: string;
};
