/**
 * Domain constants.
 *
 * Every value here is taken from the actual project data configuration
 * (`dataset-EEG/ADHD_CLEAN_DATASET/config/dataset_config.yaml` and its
 * README) or from the documented research plan. Nothing is invented; fields
 * that the source files do not state are explicitly `null`.
 */

/* ------------------------------------------------------------------ *
 * EEG montages
 * ------------------------------------------------------------------ */

export const CHANNELS = {
  adhdata: [
    "Fp1", "Fp2", "F3", "F4", "C3", "C4", "P3", "P4", "O1", "O2",
    "F7", "F8", "T7", "T8", "P7", "P8", "Fz", "Cz", "Pz",
  ],
  epoc14: [
    "AF3", "F7", "F3", "FC5", "T7", "P7", "O1", "O2",
    "P8", "T8", "FC6", "F4", "F8", "AF4",
  ],
  cgx29: [
    "AF7", "Fpz", "F7", "Fz", "T7", "FC6", "Fp1", "F4", "C4", "Oz",
    "CP6", "Cz", "PO8", "CP5", "O2", "O1", "P3", "P4", "P7", "P8",
    "Pz", "PO7", "T8", "C3", "Fp2", "F3", "F8", "FC5", "AF8",
  ],
} as const;

export const MONTAGE_LABELS = {
  adhdata: "adhdata — 10-20 system",
  epoc14: "Emotiv EPOC — 14 channel",
  cgx29: "Cerebrals CX (CGX) — 29 channel",
} as const;

export type MontageKey = keyof typeof MONTAGE_LABELS;

/** Channels shared by every source montage — safe to compare across datasets. */
export const COMMON_CHANNELS_EPOC_CGX = [
  "F7", "F3", "T7", "P7", "O1", "O2", "P8", "T8", "F4", "F8",
] as const;

/* ------------------------------------------------------------------ *
 * Frequency bands
 * ------------------------------------------------------------------ */

export type BandKey = "delta" | "theta" | "alpha" | "beta" | "gamma";

export type FrequencyBand = {
  key: BandKey;
  label: string;
  range: string;
  low: number;
  high: number;
  /** Gamma is an experimental extension, not part of the baseline set. */
  baseline: boolean;
};

export const FREQUENCY_BANDS: FrequencyBand[] = [
  { key: "delta", label: "Delta", range: "0.5 – 4 Hz", low: 0.5, high: 4, baseline: true },
  { key: "theta", label: "Theta", range: "4 – 8 Hz", low: 4, high: 8, baseline: true },
  { key: "alpha", label: "Alpha", range: "8 – 13 Hz", low: 8, high: 13, baseline: true },
  { key: "beta", label: "Beta", range: "13 – 30 Hz", low: 13, high: 30, baseline: true },
  { key: "gamma", label: "Gamma", range: "30 – 45 Hz", low: 30, high: 45, baseline: false },
];

export const BAND_COLORS: Record<BandKey, string> = {
  delta: "var(--color-band-delta)",
  theta: "var(--color-band-theta)",
  alpha: "var(--color-band-alpha)",
  beta: "var(--color-band-beta)",
  gamma: "var(--color-band-gamma)",
};

export const bandColor = (key: BandKey) => BAND_COLORS[key];

/* ------------------------------------------------------------------ *
 * Time-series construction
 * ------------------------------------------------------------------ */

export const SIGNAL_CONFIG = {
  samplingRateHz: 128,
  windowSeconds: 1,
  samplesPerWindow: 128,
  sequenceLength: 16,
  bands: 4,
  channels: 14,
  /** 14 channels x 4 baseline bands = 56 features per timestep. */
  featuresPerStep: 14 * 4,
  modelInputShape: "(N, 16, 56)",
} as const;

/* ------------------------------------------------------------------ *
 * Processing pipeline
 * ------------------------------------------------------------------ */

export type StageKey =
  | "upload"
  | "preprocessing"
  | "artifacts"
  | "bands"
  | "sequences"
  | "inference"
  | "result";

export type StageState = "pending" | "running" | "done" | "failed";

export type PipelineStage = {
  key: StageKey;
  label: string;
  detail: string;
  /** What the backend actually does at this stage. Shown for transparency. */
  operation: string;
};

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    key: "upload",
    label: "EEG uploaded",
    detail: "File received, checksum recorded",
    operation: "Validate container, read channel labels and declared sampling rate.",
  },
  {
    key: "preprocessing",
    label: "Preprocessing",
    detail: "Channel selection, resampling, normalisation",
    operation: "Select the 14 EPOC channels, drop non-signal columns, verify 128 Hz, normalise per channel.",
  },
  {
    key: "artifacts",
    label: "Artifact handling",
    detail: "Blast rejection, segment quality flags",
    operation: "Flag high-amplitude and high-gradient segments; exclude flagged windows from sequence building.",
  },
  {
    key: "bands",
    label: "Frequency extraction",
    detail: "Delta / Theta / Alpha / Beta band power",
    operation: "Welch band power per channel per 1 s window (0.5–4, 4–8, 8–13, 13–30 Hz).",
  },
  {
    key: "sequences",
    label: "Time-series construction",
    detail: "16-step sequences, participant-boundary safe",
    operation: "Group windows into 16-step sequences. Sequences never cross a participant boundary.",
  },
  {
    key: "inference",
    label: "Model inference",
    detail: "CNN-LSTM forward pass",
    operation: "Apply saved scaler, then run the selected checkpoint to produce per-class probabilities.",
  },
  {
    key: "result",
    label: "Result",
    detail: "Participant-level aggregation",
    operation: "Aggregate window probabilities to one participant-level research screening result.",
  },
];

/* ------------------------------------------------------------------ *
 * Roles
 * ------------------------------------------------------------------ */

export const ROLES = [
  {
    key: "participant",
    label: "Participant / Guardian",
    short: "Participant",
    description: "Upload EEG, run a task, view your own screening results.",
    href: "/participant/dashboard",
  },
  {
    key: "doctor",
    label: "Doctor / Clinician",
    short: "Clinician",
    description: "Review participants, EEG analytics and research reports.",
    href: "/doctor/dashboard",
  },
  {
    key: "researcher",
    label: "Researcher / Admin",
    short: "Researcher",
    description: "Compare models, run experiments, inspect explainability.",
    href: "/research/dashboard",
  },
] as const;

export type RoleKey = (typeof ROLES)[number]["key"];

/* ------------------------------------------------------------------ *
 * Datasets (values verified in the clean-dataset README)
 * ------------------------------------------------------------------ */

export type DatasetRecord = {
  id: string;
  name: string;
  modality: "EEG" | "Behavior" | "EEG + Behavior";
  participants: number;
  adhd: number | null;
  control: number | null;
  undetermined: number | null;
  unknown: number | null;
  channels: number | null;
  samplingRate: string;
  fileTypes: string[];
  device: string;
  tasks: string[];
  behavior: boolean;
  mri: boolean;
  sizeOnDisk: string;
  notes: string;
};

export const DATASETS: DatasetRecord[] = [
  {
    id: "balladeer_eeg",
    name: "BALLADEER — EEG sessions",
    modality: "EEG",
    participants: 156,
    // The 156-participant EEG+behaviour subset has no published per-class
    // split. The 88 / 50 / 20 split belongs to the 158-participant
    // demographics cohort (`balladeer_demographics`), which is a different
    // population. The README's 147/110/20 figures are EEG_ONLY view totals
    // across *all* sources (277 subjects incl. adhdata) and must not be
    // attributed to this row.
    adhd: null,
    control: null,
    undetermined: null,
    unknown: null,
    channels: 29,
    samplingRate: "CGX ~500 Hz (estimated) · EPOC 128 / 256 Hz (declared)",
    fileTypes: ["csv", "json"],
    device: "Cerebrals CX (CGX) · Emotiv EPOC / EPOCX / EPOCPLUS",
    tasks: ["Slackline L1", "Slackline L6", "Slackline L11", "Cognifit", "Attention Robots"],
    behavior: true,
    mri: false,
    sizeOnDisk: "~62 GB (referenced by index, not copied)",
    notes:
      "156 participants have both EEG and behaviour. Per-class split is not published for this subset — the 88/50/20 counts are for the 158-participant demographics cohort. Labels derive from users_demographics.json `diagnosed`: yes / no / undetermined.",
  },
  {
    id: "adhdata_eeg",
    name: "adhdata.csv — tabular EEG",
    modality: "EEG",
    participants: 121,
    adhd: 61,
    control: 60,
    undetermined: 0,
    unknown: 0,    channels: 19,
    samplingRate: "not stated in file",
    fileTypes: ["csv", "parquet"],
    device: "not stated",
    tasks: ["not stated"],
    behavior: false,
    mri: false,
    sizeOnDisk: "267 MB raw · 24.5 MB cleaned zip",
    notes:
      "2,166,383 time samples, 45 duplicate rows removed. No timestamps, so time-domain processing needs external metadata.",
  },
  {
    id: "balladeer_behavior",
    name: "BALLADEER — demographics, tags, game, eye tracking",
    modality: "Behavior",
    participants: 158,
    adhd: 88,
    control: 50,
    undetermined: 20,
    unknown: 0,
    channels: null,
    samplingRate: "event / session based",
    fileTypes: ["json", "csv"],
    device: "eye tracker · EmbracePlus wristband",
    tasks: ["all"],
    behavior: true,
    mri: false,
    sizeOnDisk: "~1.2 GB",
    notes:
      "Marker/reaction tags, Attention Robots scores, ~60 Hz gaze, 403-column per-minute physio table.",
  },
  {
    id: "adhdata_behavior",
    name: "adhd_data_behaviour.csv — questionnaire",
    modality: "Behavior",
    participants: 6500,
    adhd: null,
    control: null,
    undetermined: null,
    unknown: 6500,
    channels: null,
    samplingRate: "n/a",
    fileTypes: ["csv"],
    device: "n/a",
    tasks: ["questionnaire"],
    behavior: true,
    mri: false,
    sizeOnDisk: "0.5 MB",
    notes:
      "6,500 rows with no participant identifier and no codebook for Diagnosis_Class (0/1/2/3). Kept verbatim — never mapped to ADHD/Control.",
  },
];

/* ------------------------------------------------------------------ *
 * Upload constraints surfaced in the UI
 * ------------------------------------------------------------------ */

export const ACCEPTED_EEG_EXTENSIONS = [
  ".edf", ".bdf", ".fif", ".set", ".vhdr", ".eeg", ".csv", ".parquet",
] as const;

export const MAX_UPLOAD_MB = 2048;
