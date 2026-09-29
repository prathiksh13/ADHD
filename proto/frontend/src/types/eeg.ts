import type { MontageKey } from "@/lib/constants";

export type SignalSource = "upload" | "live";

export type RecordingStatus = "not-started" | "recording" | "complete" | "error";

export type EEGMetadata = {
  fileName: string;
  sizeMb: number;
  format: string;
  montage: MontageKey;
  channels: string[];
  samplingRateHz: number;
  durationSeconds: number;
  declaredRate: string;
  checksum: string;
  uploadedAt: string;
};

export type ChannelSeries = {
  channel: string;
  /** Amplitude in microvolts, one value per displayed sample. */
  values: number[];
};

export type BandPowerPoint = {
  time: number;
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma?: number;
};

export type SpectrogramBin = {
  time: number;
  /** Frequency in Hz, ascending. */
  frequency: number;
  /** Relative power, 0–1. */
  power: number;
};

export type EEGPayload = {
  metadata: EEGMetadata;
  raw: Record<string, number[]>;
  processed: Record<string, number[]>;
  bandPower: BandPowerPoint[];
  spectrogram: SpectrogramBin[];
  quality: {
    flatlineRatio: number;
    artifactWindows: number;
    totalWindows: number;
    impedanceOk: boolean;
  };
};
