import type { BandKey } from "@/lib/constants";

export type MetricKey =
  | "accuracy"
  | "precision"
  | "recall"
  | "f1"
  | "sensitivity"
  | "specificity"
  | "auc"
  | "brier";

export type MetricSet = Record<MetricKey, number>;

export type ModelArchitecture = {
  id: string;
  name: string;
  short: string;
  family: "Recurrent" | "Convolutional" | "Hybrid" | "Hybrid + Attention";
  description: string;
  inputShape: string;
  parameters: string;
  epochs: number;
  /** True when the value came from a real experiment run. */
  evaluated: boolean;
};

export type ModelResult = {
  modelId: string;
  runId: string;
  evaluationLevel: "window" | "participant";
  folds: number;
  metrics: MetricSet;
  standardDeviation: Partial<MetricSet>;
  confusion: { tp: number; fp: number; tn: number; fn: number };
  roc: { fpr: number; tpr: number }[];
  trainedAt: string;
  seed: number;
};

export type ChannelImportance = {
  channel: string;
  importance: number;
  region: string;
};

export type BandImportance = {
  band: BandKey;
  label: string;
  importance: number;
};

export type FeatureImportance = {
  feature: string;
  importance: number;
  group: "channel" | "band" | "time";
};

export type AttentionWeights = {
  step: number;
  label: string;
  weight: number;
};

export type ExperimentPlan = {
  id: string;
  code: string;
  title: string;
  question: string;
  variants: string[];
  primaryMetric: string;
  status: "planned" | "running" | "complete";
  dataset: string;
  notes: string;
};

export type TrainingCurve = {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  trainAccuracy: number;
  valAccuracy: number;
};
