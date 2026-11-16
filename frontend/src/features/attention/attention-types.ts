export type AttentionState = "ON_SCREEN" | "OFF_SCREEN";

export type AffectState = "Engaged" | "Neutral" | "Frustrated" | "Fatigued";

export type AttentionTelemetryEventType =
  | "BLINK"
  | "DISTRACTION_START"
  | "DISTRACTION_END"
  | "ALERT_TRIGGERED"
  | "EMOTION_SHIFT";

export type AttentionAlertChannel = "visual" | "audio";

export interface AttentionTelemetryEvent {
  type: AttentionTelemetryEventType;
  /** Exact `performance.now()` value from the frame that produced the event. */
  performanceNow: number;
  /** Wall-clock ISO timestamp from the same frame. */
  timestamp: string;
  /** Milliseconds since monitoring began, for joining with EEG samples. */
  elapsedMs: number;
  state?: AttentionState;
  affect?: AffectState;
  /** Present for ALERT_TRIGGERED events. */
  channel?: AttentionAlertChannel;
  stage?: 1 | 2;
  /** Present for BLINK and DISTRACTION_END events. */
  durationMs?: number;
  recoveryLatencyMs?: number;
  /** Human-readable reason used for distraction events. */
  reason?: string;
}

export interface EmotionTimelinePoint {
  state: AffectState;
  performanceNow: number;
  timestamp: string;
  elapsedMs: number;
}

export interface AttentionSummary {
  focusPercentage: number;
  totalBlinks: number;
  meanBlinkRatePerMin: number;
  distractionCount: number;
  avgRecoveryLatencyMs: number;
  emotionTimeline: EmotionTimelinePoint[];
  sessionDurationMs: number;
  faceVisiblePercentage: number;
  totalDistractionDurationMs: number;
  longestDistractionMs: number;
}

export interface SessionTelemetrySummary extends AttentionSummary {
  schemaVersion: 1;
  provenance: "on-device-heuristic-v1";
  telemetryEvents: AttentionTelemetryEvent[];
  calibrationComplete: boolean;
  observedDurationMs: number;
  eventsTruncated: boolean;
}

export interface ActivityMetrics {
  accuracy: number | null;
  reactionTimeMs: number | null;
  commissionErrors: number;
  omissionErrors: number;
}

export interface AttentionSessionPayload {
  sessionId: string;
  activityType: string;
  startedAt: string;
  completedAt: string;
  activityMetrics: ActivityMetrics;
  telemetryEvents: AttentionTelemetryEvent[];
  summary: AttentionSummary;
}

export interface AttentionFrame {
  taskFocused?: boolean;
  ear: number;
  leftEar?: number;
  rightEar?: number;
  blinkLeft: number;
  blinkRight: number;
  browDownLeft: number;
  browDownRight: number;
  mouthPressLeft: number;
  mouthPressRight: number;
  mouthFrownLeft?: number;
  mouthFrownRight?: number;
  eyeSquintLeft: number;
  eyeSquintRight: number;
  jawOpen: number;
  yawDeg: number;
  pitchDeg: number;
  irisHorizontal: number;
  irisVertical: number;
  facePresent: boolean;
  performanceNow: number;
  timestamp: string;
}

export interface AttentionLiveMetrics {
  state: AttentionState;
  affect: AffectState;
  facePresent: boolean;
  ear: number;
  yawDeg: number;
  pitchDeg: number;
  irisOffset: number;
  blinkRatePerMin: number;
  totalBlinks: number;
  distractionDurationMs: number;
  alertStage: 0 | 1 | 2;
  visualCue: boolean;
  cooldownRemainingMs: number;
  calibrating?: boolean;
  calibrationProgress?: number;
  trackingReason?: string;
  perclos?: number;
}

export interface AttentionStatusSnapshot {
  running: boolean;
  facePresent: boolean;
  metrics: AttentionLiveMetrics;
  fps: number;
}

export const EMPTY_LIVE_METRICS: AttentionLiveMetrics = {
  state: "ON_SCREEN",
  affect: "Neutral",
  facePresent: false,
  ear: 0,
  yawDeg: 0,
  pitchDeg: 0,
  irisOffset: 0,
  blinkRatePerMin: 0,
  totalBlinks: 0,
  distractionDurationMs: 0,
  alertStage: 0,
  visualCue: false,
  cooldownRemainingMs: 0,
};

export const ATTENTION_THRESHOLDS = {
  /** Head pose beyond these limits is treated as looking away. */
  yawDeg: 22,
  pitchDeg: 18,
  /** Iris displacement is normalised to half the eye width. */
  irisHorizontal: 0.34,
  irisVertical: 0.32,
  /** Continuous iris aversion before it counts as a distraction. */
  irisDwellMs: 1500,
  /** EAR below this is an eye closure. */
  closedEar: 0.21,
  /** Only closures in this band count as discrete blinks. */
  blinkMinMs: 80,
  blinkMaxMs: 400,
  /** Longer closures are treated as drowsiness. */
  drowsyMs: 800,
  visualAlertAfterMs: 2500,
  audioAlertAfterMs: 4500,
  audioCooldownMs: 10_000,
  affectSmoothingMs: 1200,
} as const;
