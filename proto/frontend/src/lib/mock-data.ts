/* ============================================================================
 * Deterministic synthetic fixtures.
 *
 * These values exist so the interface can be built and demonstrated before the
 * FastAPI backend is connected. Everything is generated from a fixed seed so
 * server and client render identically, and every fixture is clearly a
 * placeholder — no real measurement is claimed.
 *
 * Counts, dataset shapes, channel names, sampling rates and label provenance
 * come from the real project data configuration, not from invention.
 * ========================================================================== */

import {
  CHANNELS,
  FREQUENCY_BANDS,
  PIPELINE_STAGES,
  type BandKey,
  type StageState,
} from "@/lib/constants";
import type { Diagnosis, Participant, ParticipantStatus } from "@/types/participant";
import type { BehaviorSummary, Session, SessionStage } from "@/types/session";
import type {
  AttentionWeights,
  BandImportance,
  ChannelImportance,
  ExperimentPlan,
  FeatureImportance,
  MetricSet,
  ModelArchitecture,
  ModelResult,
  TrainingCurve,
} from "@/types/model";
import type { BandPowerPoint, EEGPayload, SpectrogramBin } from "@/types/eeg";

/* ------------------------------------------------------------------ *
 * Seeded randomness — reproducible across renders
 * ------------------------------------------------------------------ */

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(key: string) {
  const rand = mulberry32(hashSeed(key));
  return {
    next: rand,
    range: (min: number, max: number) => min + rand() * (max - min),
    int: (min: number, max: number) => Math.floor(min + rand() * (max - 1 + 1)),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)],
    bool: (p = 0.5) => rand() < p,
    /** Roughly bell-shaped deviate, mean 0, sd 1. */
    normal: () => {
      const u = Math.max(rand(), 1e-9);
      const v = Math.max(rand(), 1e-9);
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Participants — drawn from the BALLADEER UB#### cohort
 * ------------------------------------------------------------------ */

const BALLADEER_IDS = [
  "UB0004", "UB0007", "UB0020", "UB0021", "UB0022", "UB0023", "UB0024", "UB0025",
  "UB0026", "UB0027", "UB0028", "UB0029", "UB0030", "UB0031", "UB0032", "UB0033",
  "UB0034", "UB0035", "UB0036", "UB0037", "UB0038", "UB0039", "UB0040", "UB0041",
  "UB0042", "UB0043", "UB0044", "UB0045", "UB0046", "UB0047", "UB0048", "UB0049",
  "UB0050", "UB0051", "UB0052", "UB0053", "UB0054", "UB0055", "UB0056", "UB0057",
  "UB0058", "UB0059", "UB0060", "UB0061", "UB0062", "UB0063", "UB0064", "UB0065",
  "UB0066", "UB0067", "UB0068", "UB0069", "UB0070", "UB0071", "UB0072", "UB0073",
  "UB0074", "UB0075", "UB0076", "UB0077", "UB0078", "UB0079", "UB0080", "UB0081",
];

const TASKS = [
  "Slackline L1",
  "Slackline L6",
  "Slackline L11",
  "Cognifit",
  "Attention Robots",
] as const;

const DEVICES = [
  "Emotiv EPOC",
  "Emotiv EPOCX",
  "Emotiv EPOCPLUS",
  "Cerebrals CGX",
] as const;

/** 156 BALLADEER subjects carry EEG; 20 of them are `undetermined`. */
const EEG_PARTICIPANTS = 156;
const BEHAVIOR_PARTICIPANTS = 158;
const COHORT_ADHD = 88;
const COHORT_CONTROL = 50;
const COHORT_UNDETERMINED = 20;

function buildParticipants(): Participant[] {
  const rows: Participant[] = [];

  for (let i = 0; i < BALLADEER_IDS.length; i += 1) {
    const rng = makeRng(`participant:${BALLADEER_IDS[i]}`);
    const originalId = BALLADEER_IDS[i];
    const participantId = `balladeer__${originalId}`;

    // Distribution mirrors the cohort: ADHD-heavy with a 20-subject
    // undetermined group that must be excluded from binary modelling.
    const roll = i / BALLADEER_IDS.length;
    const diagnosis: Diagnosis =
      roll < 0.56 ? "ADHD" : roll < 0.87 ? "Control" : "undetermined";

    const sessionCount = rng.int(1, 5);
    const completed = Math.max(1, sessionCount - (rng.bool(0.35) ? 1 : 0));
    const status: ParticipantStatus =
      diagnosis === "undetermined"
        ? "Review"
        : completed < sessionCount
          ? "Active"
          : rng.bool(0.12)
            ? "Review"
            : "Complete";

    const day = rng.int(1, 27);
    const monthOffset = rng.int(0, 3);
    const date = new Date(Date.UTC(2026, 8 - monthOffset, day));

    rows.push({
      id: participantId,
      displayId: originalId,
      source: "balladeer",
      age: rng.int(7, 16),
      gender: rng.bool() ? "male" : "female",
      diagnosis,
      diagnosisBasis: "users_demographics.json · diagnosed",
      sessionCount,
      completedSessions: completed,
      lastSession: date.toISOString().slice(0, 10),
      status,
      devices: Array.from(new Set([rng.pick(DEVICES), rng.pick(DEVICES)])),
      tasks: Array.from(new Set([rng.pick(TASKS), rng.pick(TASKS)])),
      signalQuality: Number(rng.range(0.71, 0.99).toFixed(3)),
      behaviorLinked: rng.bool(0.88),
    });
  }

  // A few tabular-EEG subjects so the two data sources are both represented.
  for (let i = 0; i < 5; i += 1) {
    const rng = makeRng(`participant:adhdata:v${i + 1}`);
    const participantId = `adhdata__v${10 + i}`;
    rows.push({
      id: participantId,
      displayId: participantId.split("__")[1],
      source: "adhdata",
      age: rng.int(8, 14),
      gender: rng.bool() ? "male" : "female",
      diagnosis: rng.bool() ? "ADHD" : "Control",
      diagnosisBasis: "adhdata.csv · Class",
      sessionCount: 1,
      completedSessions: 1,
      lastSession: new Date(Date.UTC(2026, 7, rng.int(1, 28))).toISOString().slice(0, 10),
      status: "Complete",
      devices: ["not stated"],
      tasks: ["not stated"],
      signalQuality: Number(rng.range(0.6, 0.9).toFixed(3)),
      behaviorLinked: false,
    });
  }

  return rows;
}

export const participants = buildParticipants();

export const participantStats = {
  eegParticipants: EEG_PARTICIPANTS,
  behaviorParticipants: BEHAVIOR_PARTICIPANTS,
  adhd: COHORT_ADHD,
  control: COHORT_CONTROL,
  undetermined: COHORT_UNDETERMINED,
  excludedFromBinary: COHORT_UNDETERMINED,
  multimodalJoinable: 156,
};

export function getParticipant(id: string) {
  return participants.find((p) => p.id === id) ?? null;
}

export function getParticipantByCode(code: string) {
  return participants.find((p) => p.displayId.toLowerCase() === code.toLowerCase()) ?? null;
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

function buildStages(
  seedKey: string,
  status: Session["status"],
  currentIndex: number,
): SessionStage[] {
  const rng = makeRng(`stages:${seedKey}`);
  return PIPELINE_STAGES.map((stage, index) => {
    let state: StageState = "pending";
    if (status === "complete" || currentIndex > index) state = "done";
    else if (status === "processing" && currentIndex === index) state = "running";
    else if (status === "failed" && currentIndex === index) state = "failed";

    const at = new Date(Date.UTC(2026, 8, 24, 9, 0, 0) + index * rng.int(9, 40));
    return {
      key: stage.key,
      state,
      startedAt: state === "pending" ? null : at.toISOString(),
      finishedAt: state === "done" ? new Date(at.getTime() + rng.int(4, 22) * 1000).toISOString() : null,
      message:
        state === "done"
          ? stage.detail
          : state === "running"
            ? "In progress — reported by backend"
            : state === "failed"
              ? "Rejected by validation"
              : null,
    };
  });
}

function buildBehavior(seedKey: string): BehaviorSummary {
  const rng = makeRng(`behavior:${seedKey}`);
  const correct = rng.int(38, 62);
  const incorrect = rng.int(2, 14);
  const missed = rng.int(1, 9);
  return {
    reactionTimeMs: Math.round(rng.range(310, 690)),
    correctResponses: correct,
    incorrectResponses: incorrect,
    missedTargets: missed,
    commissionErrors: rng.int(0, 6),
    taskScore: Number(((correct / (correct + incorrect + missed)) * 100).toFixed(1)),
    condition: rng.bool() ? "Eyes open" : "Eyes closed",
    stage: "Task / CPT block",
    variabilityRtp: Number(rng.range(0.04, 0.19).toFixed(3)),
  };
}

function buildSessions(): Session[] {
  const list: Session[] = [];
  const count = 34;

  for (let i = 0; i < count; i += 1) {
    const rng = makeRng(`session:${i}`);
    const participant = participants[Math.floor((i * 7919) % participants.length)];
    const id = `SES-2026-${String(1041 + i).padStart(4, "0")}`;

    // Most sessions finished; a few are in flight so processing states are
    // visible without having to trigger them by hand.
    const bucket = i % 10;
    const status: Session["status"] =
      bucket === 7 ? "processing" : bucket === 9 ? "uploaded" : "complete";
    const currentIndex = status === "complete" ? 99 : status === "uploaded" ? 0 : rng.int(2, 5);

    const durationSeconds = rng.int(180, 900);
    const windows = Math.floor(durationSeconds / 1);
    const device = participant.devices[0] ?? "Emotiv EPOC";
    const montage = device.includes("CGX") ? "Cerebrals CGX — 29 channel" : "Emotiv EPOC — 14 channel";
    const samplingRate = device.includes("CGX") ? 500 : 128;

    const probability =
      status === "complete" ? Number(rng.range(0.31, 0.88).toFixed(3)) : null;

    const started = new Date(Date.UTC(2026, 8, 24 - (i % 20), 9 + (i % 8), (i * 7) % 60));

    list.push({
      id,
      participantId: participant.id,
      participantLabel: participant.displayId,
      startedAt: started.toISOString(),
      completedAt:
        status === "complete" ? new Date(started.getTime() + durationSeconds * 1000).toISOString() : null,
      experiment: rng.pick(TASKS),
      experimentStage: status === "complete" ? "complete" : "task",
      status,
      source: rng.bool(0.12) ? "live" : "upload",
      device,
      montage,
      samplingRateHz: samplingRate,
      channels: device.includes("CGX") ? 29 : 14,
      durationSeconds,
      windows,
      sequences: Math.max(0, Math.floor(windows / 16)),
      stages: buildStages(id, status, currentIndex),
      behavior: rng.bool(0.85) ? buildBehavior(id) : null,
      modelId: status === "complete" ? (rng.bool(0.6) ? "cnn-lstm-attn" : "cnn-lstm") : null,
      probability,
      resultLabel:
        probability === null
          ? null
          : probability >= 0.5
            ? "ADHD-associated pattern"
            : "Control-associated pattern",
      flagged: status === "complete" && rng.bool(0.16),
      flagReason:
        status === "complete" && rng.bool(0.16)
          ? rng.pick([
              "Model output above review threshold",
              "High artifact ratio in EEG window range",
              "Behavioural inconsistency with EEG output",
              "Signal quality below 0.75",
            ])
          : null,
    });
  }

  // The session used by the participant demo journey, deliberately mid-flight.
  const demo = list.find((s) => s.status === "processing");
  if (demo) {
    demo.id = "SES-2026-1042";
    demo.participantId = "balladeer__UB0021";
    demo.participantLabel = "UB0021";
    demo.status = "processing";
    demo.modelId = null;
    demo.probability = null;
    demo.resultLabel = null;
    demo.stages = buildStages(demo.id, "processing", 4);
  }

  return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export const sessions = buildSessions();

export function getSession(id: string) {
  return sessions.find((s) => s.id === id) ?? null;
}

export function getSessionsForParticipant(participantId: string) {
  return sessions.filter((s) => s.participantId === participantId);
}

export const sessionStats = {
  total: 4218,
  complete: 3941,
  flagged: 126,
  inProgress: sessions.filter((s) => s.status === "processing" || s.status === "uploaded").length,
  thisWeek: 47,
};

/* ------------------------------------------------------------------ *
 * Models
 * ------------------------------------------------------------------ */

export const modelArchitectures: ModelArchitecture[] = [
  {
    id: "baseline-bandpower",
    name: "Band-power baseline",
    short: "Baseline",
    family: "Convolutional",
    description:
      "Logistic regression on flattened band-power features. Establishes the floor every deep model must beat.",
    inputShape: "(N, 560)",
    parameters: "561",
    epochs: 1,
    evaluated: true,
  },
  {
    id: "lstm",
    name: "LSTM",
    short: "LSTM",
    family: "Recurrent",
    description:
      "Single-layer LSTM over 16 band-power steps. Isolates the contribution of temporal recurrence without any spatial encoder.",
    inputShape: "(N, 16, 56)",
    parameters: "112 k",
    epochs: 62,
    evaluated: true,
  },
  {
    id: "cnn",
    name: "1D CNN",
    short: "CNN",
    family: "Convolutional",
    description:
      "Temporal convolution stack only. Tests whether local pattern extraction alone is sufficient.",
    inputShape: "(N, 16, 56)",
    parameters: "88 k",
    epochs: 55,
    evaluated: true,
  },
  {
    id: "cnn-lstm",
    name: "CNN-LSTM",
    short: "CNN-LSTM",
    family: "Hybrid",
    description:
      "1D CNN for local band-power structure, then LSTM for temporal dependency, then a dense classifier.",
    inputShape: "(N, 16, 56)",
    parameters: "174 k",
    epochs: 71,
    evaluated: true,
  },
  {
    id: "cnn-lstm-attn",
    name: "CNN-LSTM + Attention",
    short: "CNN-LSTM + Attn",
    family: "Hybrid + Attention",
    description:
      "Adds temporal attention over the LSTM outputs. Attention weights are model-internal, not biological evidence.",
    inputShape: "(N, 16, 56)",
    parameters: "181 k",
    epochs: 78,
    evaluated: true,
  },
  {
    id: "fusion",
    name: "Multimodal fusion",
    short: "Fusion",
    family: "Hybrid",
    description:
      "EEG CNN-LSTM-Attention embedding fused with a behavioural MLP embedding. Requires reliable participant-level linkage.",
    inputShape: "(N, 16, 56) + (N, F)",
    parameters: "236 k",
    epochs: 0,
    evaluated: false,
  },
];

const MODEL_SEED_SCORES: Record<string, number> = {
  "baseline-bandpower": 0.641,
  lstm: 0.688,
  cnn: 0.672,
  "cnn-lstm": 0.734,
  "cnn-lstm-attn": 0.756,
  fusion: 0.0,
};

function buildMetricSet(modelId: string): MetricSet {
  const rng = makeRng(`metrics:${modelId}`);
  const acc = MODEL_SEED_SCORES[modelId];
  if (acc === 0) {
    return {
      accuracy: 0, precision: 0, recall: 0, f1: 0,
      sensitivity: 0, specificity: 0, auc: 0, brier: 0,
    };
  }
  const sensitivity = clamp(acc + rng.range(-0.05, 0.05));
  const specificity = clamp(1 - acc + rng.range(-0.06, 0.04));
  const precision = clamp(sensitivity * 0.97 + rng.range(-0.03, 0.03));
  const recall = sensitivity;
  const f1 = (2 * precision * recall) / (precision + recall || 1);
  return {
    accuracy: round4(acc),
    precision: round4(precision),
    recall: round4(recall),
    f1: round4(f1),
    sensitivity: round4(sensitivity),
    specificity: round4(specificity),
    auc: round4(clamp(acc + rng.range(0.04, 0.1))),
    brier: round4(rng.range(0.11, 0.19)),
  };
}

function round4(n: number) {
  return Number(n.toFixed(4));
}

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

export const modelResults: ModelResult[] = modelArchitectures
  .filter((m) => m.evaluated)
  .map((model) => {
    const rng = makeRng(`result:${model.id}`);
    const metrics = buildMetricSet(model.id);
    const n = 30;
    const tp = Math.round(metrics.sensitivity * 16);
    const fn = 16 - tp;
    const tn = Math.round(metrics.specificity * 14);
    const fp = 14 - tn;
    void n;

    return {
      modelId: model.id,
      runId: `RUN-${model.id.toUpperCase()}-5F`,
      evaluationLevel: "participant" as const,
      folds: 5,
      metrics,
      standardDeviation: {
        accuracy: Number(rng.range(0.008, 0.032).toFixed(4)),
        f1: Number(rng.range(0.01, 0.038).toFixed(4)),
        auc: Number(rng.range(0.009, 0.03).toFixed(4)),
      },
      confusion: { tp, fp, tn, fn },
      roc: buildRoc(metrics.auc),
      trainedAt: "2026-09-18T11:24:00Z",
      seed: 42,
    };
  });

function buildRoc(auc: number) {
  const rng = makeRng(`roc:${auc}`);
  const points = [{ fpr: 0, tpr: 0 }];
  for (let i = 1; i <= 20; i += 1) {
    const fpr = i / 20;
    const lift = Math.pow(1 - fpr, 1 - Math.min(0.98, auc + 0.12));
    points.push({ fpr: round4(fpr), tpr: round4(Math.min(1, lift + rng.range(-0.02, 0.02))) });
  }
  points.push({ fpr: 1, tpr: 1 });
  return points;
}

export function getModel(id: string) {
  return modelArchitectures.find((m) => m.id === id) ?? null;
}

export function getModelResult(modelId: string) {
  return modelResults.find((r) => r.modelId === modelId) ?? null;
}

export function getBestModel() {
  return [...modelResults].sort((a, b) => b.metrics.accuracy - a.metrics.accuracy)[0];
}

/* ------------------------------------------------------------------ *
 * Experiments
 * ------------------------------------------------------------------ */

export const experiments: ExperimentPlan[] = [
  {
    id: "exp-01",
    code: "EXP-01",
    title: "Band set ablation",
    question: "Does adding the gamma band improve classification over the 4-band baseline?",
    variants: ["4 bands (Δ Θ α β)", "5 bands (Δ Θ α β γ)"],
    primaryMetric: "F1 (participant level)",
    status: "complete",
    dataset: "BALLADEER EEG · 14-channel EPOC subset",
    notes: "Gamma 30–45 Hz is an explicit extension, not part of the baseline protocol.",
  },
  {
    id: "exp-02",
    code: "EXP-02",
    title: "Window length",
    question: "Which analysis window best preserves state transitions?",
    variants: ["0.5 s", "1 s", "2 s"],
    primaryMetric: "F1 (participant level)",
    status: "complete",
    dataset: "BALLADEER EEG · 14-channel EPOC subset",
    notes: "1 s is the configured default; 16-step sequences at 0.5 s cover only 8 s of context.",
  },
  {
    id: "exp-03",
    code: "EXP-03",
    title: "Temporal model",
    question: "Does recurrence add value over a purely convolutional encoder?",
    variants: ["LSTM", "CNN-LSTM"],
    primaryMetric: "AUC",
    status: "complete",
    dataset: "BALLADEER EEG · 14-channel EPOC subset",
    notes: "Both use identical features, windowing and participant-level splits.",
  },
  {
    id: "exp-04",
    code: "EXP-04",
    title: "Temporal attention",
    question: "Does an attention layer improve accuracy and expose interpretable timing?",
    variants: ["CNN-LSTM", "CNN-LSTM + Attention"],
    primaryMetric: "AUC",
    status: "running",
    dataset: "BALLADEER EEG · 14-channel EPOC subset",
    notes: "Attention weights are model-internal. They are not evidence of a biological mechanism.",
  },
  {
    id: "exp-05",
    code: "EXP-05",
    title: "Modality comparison",
    question: "Does adding behavioural information improve over EEG alone?",
    variants: ["EEG only", "Behavior only", "EEG + Behavior"],
    primaryMetric: "AUC",
    status: "planned",
    dataset: "BALLADEER (156 joinable participants)",
    notes: "adhdata EEG cannot be joined to the behaviour cohort — no shared identifiers.",
  },
];

/* ------------------------------------------------------------------ *
 * Explainability
 * ------------------------------------------------------------------ */

const REGION_OF: Record<string, string> = {
  O1: "Occipital", O2: "Occipital", Oz: "Occipital",
  P3: "Parietal", P4: "Parietal", Pz: "Parietal", P7: "Parietal", P8: "Parietal", PO7: "Parietal", PO8: "Parietal",
  C3: "Central", C4: "Central", Cz: "Central",
  F3: "Frontal", F4: "Frontal", Fz: "Frontal", F7: "Frontal", F8: "Frontal",
  Fp1: "Frontal", Fp2: "Frontal", Fpz: "Frontal",
  T3: "Temporal", T7: "Temporal", T8: "Temporal",
  AF3: "Frontal", AF4: "Frontal", AF7: "Frontal", AF8: "Frontal",
  FC5: "Frontal", FC6: "Frontal",
  CP5: "Parietal", CP6: "Parietal",
};

export const channelImportance: ChannelImportance[] = (() => {
  const rng = makeRng("channel-importance");
  const pool = [...new Set([...CHANNELS.epoc14, ...CHANNELS.cgx29, ...CHANNELS.adhdata])];
  const weights = pool.map((channel) => ({
    channel,
    importance: rng.range(0.04, 1),
    region: REGION_OF[channel] ?? "Other",
  }));
  const sum = weights.reduce((acc, w) => acc + w.importance, 0);
  return weights
    .map((w) => ({ ...w, importance: Number((w.importance / sum).toFixed(4)) }))
    .sort((a, b) => b.importance - a.importance);
})();

export const bandImportance: BandImportance[] = (() => {
  const rng = makeRng("band-importance");
  const raw = FREQUENCY_BANDS.filter((b) => b.baseline).map((b) => ({
    band: b.key,
    label: b.label,
    importance: rng.range(0.2, 1),
  }));
  const sum = raw.reduce((acc, b) => acc + b.importance, 0);
  return raw
    .map((b) => ({ ...b, importance: Number((b.importance / sum).toFixed(4)) }))
    .sort((a, b) => b.importance - a.importance);
})();

export const featureImportance: FeatureImportance[] = (() => {
  const rng = makeRng("feature-importance");
  const topChannels = channelImportance.slice(0, 6);
  const topBands = bandImportance.slice(0, 4);
  const rows: FeatureImportance[] = [];

  for (const c of topChannels) {
    for (const b of topBands) {
      rows.push({
        feature: `${c.channel} · ${b.label}`,
        importance: rng.range(0.01, 0.12),
        group: "channel",
      });
    }
  }
  for (const b of topBands) {
    rows.push({ feature: `${b.label} · all channels`, importance: rng.range(0.05, 0.15), group: "band" });
  }
  return rows.sort((a, b) => b.importance - a.importance).slice(0, 14);
})();

export const temporalImportance: { label: string; weight: number; description: string }[] = [
  { label: "00–10 s", weight: 0.14, description: "Early window — task onset and settling" },
  { label: "10–20 s", weight: 0.27, description: "Sustained attention, highest model weight" },
  { label: "20–30 s", weight: 0.31, description: "Peak weighted region" },
  { label: "30–40 s", weight: 0.18, description: "Attention decay, target misses rise" },
  { label: "40–50 s", weight: 0.07, description: "Late window, low model weight" },
  { label: "50–60 s", weight: 0.03, description: "Recovery / rest transition" },
];

export const attentionWeights: AttentionWeights[] = Array.from({ length: 16 }, (_, i) => {
  const rng = makeRng(`attention:${i}`);
  const label = `${String(i).padStart(2, "0")}–${String(i + 1).padStart(2, "0")} s`;
  return { step: i, label, weight: Number(rng.range(0.02, 0.16).toFixed(4)) };
});

/* ------------------------------------------------------------------ *
 * Training curves
 * ------------------------------------------------------------------ */

export function getTrainingCurves(modelId: string): TrainingCurve[] {
  const model = getModel(modelId);
  const epochs = model?.epochs ?? 40;
  if (epochs <= 1) return [];
  const rng = makeRng(`curve:${modelId}`);
  const finalLoss = 0.28 + rng.range(0, 0.12);
  const curves: TrainingCurve[] = [];
  for (let e = 1; e <= epochs; e += 1) {
    const p = e / epochs;
    curves.push({
      epoch: e,
      trainLoss: Number((finalLoss + 0.85 * Math.exp(-2.4 * p) + rng.range(0, 0.03)).toFixed(4)),
      valLoss: Number((finalLoss + 0.78 * Math.exp(-2.1 * p) + 0.06 + rng.range(0, 0.04)).toFixed(4)),
      trainAccuracy: Number((0.52 + 0.44 * (1 - Math.exp(-2.6 * p)) + rng.range(0, 0.012)).toFixed(4)),
      valAccuracy: Number(
        (0.5 + 0.3 * (1 - Math.exp(-2.3 * p)) + 0.03 + rng.range(0, 0.018)).toFixed(4),
      ),
    });
  }
  return curves;
}

/* ------------------------------------------------------------------ *
 * EEG signal fixtures
 * ------------------------------------------------------------------ */

/** Time-domain trace: band-limited noise plus a slow drift and occasional artifact. */
export function buildChannelTrace(
  channel: string,
  seedKey: string,
  points: number,
  opts: { amplitude?: number; artifact?: boolean } = {},
): number[] {
  const rng = makeRng(`trace:${seedKey}:${channel}`);
  const amplitude = opts.amplitude ?? rng.range(6, 18);
  const phase = rng.range(0, Math.PI * 2);
  const driftRate = rng.range(0.02, 0.07);
  const values: number[] = [];

  let filtered = 0;
  for (let i = 0; i < points; i += 1) {
    const t = i / points;
    const white = rng.normal();
    filtered = filtered * 0.72 + white * 0.28;

    let v = filtered * amplitude;
    v += Math.sin(t * Math.PI * 2 * 2 + phase) * amplitude * 0.35; // ~2 Hz
    v += Math.sin(t * Math.PI * 2 * 7 + phase * 1.7) * amplitude * 0.18; // ~7 Hz
    v += Math.sin(t * Math.PI * 2 * 19 + phase * 0.4) * amplitude * 0.07; // ~19 Hz
    v += Math.sin(t * Math.PI * 2 * driftRate) * amplitude * 1.6; // drift

    if (opts.artifact && i > points * 0.58 && i < points * 0.68) {
      v += Math.sin(i * 1.7) * amplitude * 9;
    }

    values.push(Number(v.toFixed(3)));
  }
  return values;
}

export function buildBandPowerSeries(
  seedKey: string,
  points: number,
  bias: Partial<Record<BandKey, number>> = {},
): BandPowerPoint[] {
  const rng = makeRng(`bandpower:${seedKey}`);
  const rows: BandPowerPoint[] = [];
  let d = bias.delta ?? rng.range(0.24, 0.32);
  let th = bias.theta ?? rng.range(0.28, 0.4);
  let al = bias.alpha ?? rng.range(0.22, 0.33);
  let be = bias.beta ?? rng.range(0.2, 0.32);

  for (let i = 0; i < points; i += 1) {
    d = clamp(d + rng.normal() * 0.008);
    th = clamp(th + rng.normal() * 0.009);
    al = clamp(al + rng.normal() * 0.007);
    be = clamp(be + rng.normal() * 0.007);
    rows.push({
      time: i,
      delta: Number(d.toFixed(4)),
      theta: Number(th.toFixed(4)),
      alpha: Number(al.toFixed(4)),
      beta: Number(be.toFixed(4)),
      gamma: Number(clamp(be * 0.42 + rng.normal() * 0.004).toFixed(4)),
    });
  }
  return rows;
}

export function buildSpectrogram(
  seedKey: string,
  timeBins: number,
  freqBins: number,
  maxHz = 45,
): SpectrogramBin[] {
  const rng = makeRng(`spec:${seedKey}`);
  const bins: SpectrogramBin[] = [];
  const alphaPeak = 10 + rng.range(-1, 1);

  for (let t = 0; t < timeBins; t += 1) {
    for (let f = 0; f < freqBins; f += 1) {
      const freq = Number((((f + 1) / freqBins) * maxHz).toFixed(2));
      const alpha = Math.exp(-((freq - alphaPeak) ** 2) / 3.2);
      const beta = 0.45 * Math.exp(-((freq - 21) ** 2) / 26);
      const theta = 0.4 * Math.exp(-((freq - 6) ** 2) / 4);
      const delta = 0.55 * Math.exp(-((freq - 2) ** 2) / 1.6);
      const timeMod = 0.7 + 0.3 * Math.sin((t / timeBins) * Math.PI * 2 * 1.5 + freq * 0.05);
      const power = clamp(
        (delta + theta + alpha + beta) * timeMod + rng.range(-0.03, 0.05),
        0.02,
        1,
      );
      bins.push({ time: t, frequency: freq, power: Number(power.toFixed(4)) });
    }
  }
  return bins;
}

const TRACE_POINTS = 600;

export function buildEEGPayload(
  seedKey: string,
  montage: "epoc14" | "cgx29" | "adhdata" = "epoc14",
  opts: { artifact?: boolean; bias?: Partial<Record<BandKey, number>> } = {},
): EEGPayload {
  const allChannels: string[] = Array.from(CHANNELS[montage]);
  const channelList = allChannels.filter(
    (c) => c !== "ACC32" && c !== "ACC33" && c !== "ACC34" && c !== "A2",
  );
  const isCgx = montage === "cgx29";
  const samplingRate = isCgx ? 500 : 128;

  const raw: Record<string, number[]> = {};
  const processed: Record<string, number[]> = {};

  for (const channel of channelList) {
    raw[channel] = buildChannelTrace(channel, `${seedKey}:raw`, TRACE_POINTS, {
      artifact: opts.artifact,
    });
    processed[channel] = buildChannelTrace(channel, `${seedKey}:proc`, TRACE_POINTS, {
      amplitude: isCgx ? 11 : 8,
      artifact: false,
    });
  }

  const bandPower = buildBandPowerSeries(seedKey, 90, opts.bias);
  const artifactWindows = opts.artifact ? 6 : 1;

  return {
    metadata: {
      fileName: `${seedKey.toUpperCase()}_EPOCX_96566.csv`,
      sizeMb: Number((isCgx ? 148 : 42).toFixed(1)),
      format: isCgx ? "CSV (EPOC / CGX export)" : "CSV (BrainFlow export)",
      montage: isCgx ? "cgx29" : montage === "adhdata" ? "adhdata" : "epoc14",
      channels: channelList,
      samplingRateHz: samplingRate,
      durationSeconds: 600,
      declaredRate: isCgx ? "estimated from timestamps (unverified)" : "eeg_128 declared in file",
      checksum: `sha256:${hashSeed(seedKey).toString(16).padStart(8, "0")}…${hashSeed(
        seedKey + "c",
      )
        .toString(16)
        .padStart(8, "0")}`,
      uploadedAt: "2026-09-24T09:14:00Z",
    },
    raw,
    processed,
    bandPower,
    spectrogram: buildSpectrogram(seedKey, 60, 46),
    quality: {
      flatlineRatio: Number((opts.artifact ? 0.041 : 0.004).toFixed(4)),
      artifactWindows,
      totalWindows: 90,
      impedanceOk: !opts.artifact,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Portal-level aggregates
 * ------------------------------------------------------------------ */

export const doctorStats = {
  participants: EEG_PARTICIPANTS,
  activeSessions: 12,
  completedAssessments: 3941,
  flagged: 126,
  reviewQueue: 18,
  averageSignalQuality: 0.883,
};

export const researchStats = {
  datasets: 4,
  participants: EEG_PARTICIPANTS + 121,
  models: modelArchitectures.length,
  evaluatedModels: modelArchitectures.filter((m) => m.evaluated).length,
  experiments: experiments.length,
  experimentsComplete: experiments.filter((e) => e.status === "complete").length,
  evaluationStatus: "5-fold participant-level CV",
  windows: 4218 * 90,
  sequences: Math.floor((4218 * 90) / 16),
};
