import {
  ATTENTION_THRESHOLDS,
  type AffectState,
  type AttentionFrame,
  type AttentionLiveMetrics,
  type AttentionState,
  type AttentionSummary,
  type AttentionTelemetryEvent,
  type AttentionTelemetryEventType,
  type EmotionTimelinePoint,
} from "@/features/attention/attention-types";
import { classifyAffect, gazeState } from "@/features/attention/attention-metrics";

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Pure-ish state machine for on-device attention telemetry.
 *
 * It does not touch the DOM, camera, or Web Audio. The React hook feeds it one
 * frame at a time and decides how to render the returned state.
 */
export class AttentionTelemetryEngine {
  private startedAtMs = 0;
  private startedAtIso = "";
  private lastSampleAtMs: number | null = null;
  private state: AttentionState = "ON_SCREEN";
  private affect: AffectState = "Neutral";
  private affectCandidate: AffectState | null = null;
  private affectCandidateSince = 0;
  private hasFrame = false;
  private irisAvertedSince: number | null = null;
  private closedSince: number | null = null;
  private drowsy = false;
  private distractedSince: number | null = null;
  private distractionReason = "";
  private alertStage: 0 | 1 | 2 = 0;
  private lastChimeAt: number | null = null;
  private events: AttentionTelemetryEvent[] = [];
  private emotionTimeline: EmotionTimelinePoint[] = [];
  private blinkTimes: number[] = [];
  private recoveryLatencies: number[] = [];
  private distractionDurations: number[] = [];
  private totalTrackedMs = 0;
  private onScreenTrackedMs = 0;
  private faceVisibleMs = 0;
  private frames = 0;

  constructor(nowMs = performance.now(), iso = nowIso()) {
    this.reset(nowMs, iso);
  }

  reset(nowMs = performance.now(), iso = nowIso()): void {
    this.startedAtMs = nowMs;
    this.startedAtIso = iso;
    this.lastSampleAtMs = null;
    this.state = "ON_SCREEN";
    this.affect = "Neutral";
    this.affectCandidate = null;
    this.affectCandidateSince = 0;
    this.hasFrame = false;
    this.irisAvertedSince = null;
    this.closedSince = null;
    this.drowsy = false;
    this.distractedSince = null;
    this.distractionReason = "";
    this.alertStage = 0;
    this.lastChimeAt = null;
    this.events = [];
    this.emotionTimeline = [];
    this.blinkTimes = [];
    this.recoveryLatencies = [];
    this.distractionDurations = [];
    this.totalTrackedMs = 0;
    this.onScreenTrackedMs = 0;
    this.faceVisibleMs = 0;
    this.frames = 0;
  }

  get startedAt(): string {
    return this.startedAtIso;
  }

  get elapsedMs(): number {
    return Math.max(0, (this.lastSampleAtMs ?? this.startedAtMs) - this.startedAtMs);
  }

  get telemetryEvents(): readonly AttentionTelemetryEvent[] {
    return this.events;
  }

  get frameCount(): number {
    return this.frames;
  }

  ingest(frame: AttentionFrame): AttentionLiveMetrics {
    if (!this.startedAtIso) {
      this.reset(frame.performanceNow, frame.timestamp);
    }

    const intervalMs =
      this.lastSampleAtMs === null
        ? 0
        : Math.min(100, Math.max(0, frame.performanceNow - this.lastSampleAtMs));

    this.totalTrackedMs += intervalMs;
    if (this.state === "ON_SCREEN") {
      this.onScreenTrackedMs += intervalMs;
    }
    if (frame.facePresent) {
      this.faceVisibleMs += intervalMs;
    }

    this.lastSampleAtMs = frame.performanceNow;
    this.frames += 1;

    const gaze = gazeState(frame);
    if (gaze.irisAverted && frame.facePresent) {
      this.irisAvertedSince ??= frame.performanceNow;
    } else {
      this.irisAvertedSince = null;
    }

    const irisDwellMs =
      this.irisAvertedSince === null
        ? 0
        : frame.performanceNow - this.irisAvertedSince;
    const irisSustained = irisDwellMs >= ATTENTION_THRESHOLDS.irisDwellMs;

    const immediateOffScreen =
      !frame.facePresent ||
      gaze.reason === "head-yaw" ||
      gaze.reason === "head-pitch";

    this.updateBlinkState(frame);

    const effectiveOffScreen = immediateOffScreen || irisSustained || this.drowsy;
    const nextState: AttentionState = effectiveOffScreen
      ? "OFF_SCREEN"
      : "ON_SCREEN";
    const reason = this.drowsy
      ? "fatigue-closure"
      : irisSustained
        ? "iris-averted"
        : gaze.reason;

    if (nextState === "OFF_SCREEN" && this.distractedSince === null) {
      this.distractedSince = frame.performanceNow;
      this.distractionReason = reason;
      this.alertStage = 0;
      this.pushEvent("DISTRACTION_START", frame, {
        state: nextState,
        reason,
      });
    } else if (nextState === "ON_SCREEN" && this.distractedSince !== null) {
      const durationMs = frame.performanceNow - this.distractedSince;
      this.recoveryLatencies.push(durationMs);
      this.distractionDurations.push(durationMs);
      this.distractedSince = null;
      this.distractionReason = "";
      this.alertStage = 0;
      this.pushEvent("DISTRACTION_END", frame, {
        state: nextState,
        durationMs,
        reason: "returned-to-target",
      });
    }

    this.state = nextState;

    if (this.distractedSince !== null) {
      const durationMs = frame.performanceNow - this.distractedSince;

      if (durationMs >= ATTENTION_THRESHOLDS.visualAlertAfterMs && this.alertStage < 1) {
        this.alertStage = 1;
        this.pushEvent("ALERT_TRIGGERED", frame, {
          state: "OFF_SCREEN",
          channel: "visual",
          stage: 1,
          reason: this.distractionReason,
        });
      }

      const cooldownElapsed =
        this.lastChimeAt === null ||
        frame.performanceNow - this.lastChimeAt >= ATTENTION_THRESHOLDS.audioCooldownMs;

      if (
        durationMs >= ATTENTION_THRESHOLDS.audioAlertAfterMs &&
        this.alertStage < 2 &&
        cooldownElapsed
      ) {
        this.alertStage = 2;
        this.lastChimeAt = frame.performanceNow;
        this.pushEvent("ALERT_TRIGGERED", frame, {
          state: "OFF_SCREEN",
          channel: "audio",
          stage: 2,
          reason: this.distractionReason,
        });
      }
    }

    this.updateAffect(frame, nextState);

    return {
      state: nextState,
      affect: this.affect,
      facePresent: frame.facePresent,
      ear: frame.ear,
      yawDeg: frame.yawDeg,
      pitchDeg: frame.pitchDeg,
      irisOffset: Math.max(
        Math.abs(frame.irisHorizontal),
        Math.abs(frame.irisVertical),
      ),
      blinkRatePerMin: this.blinkRatePerMin(frame.performanceNow),
      totalBlinks: this.blinkTimes.length,
      distractionDurationMs:
        this.distractedSince === null
          ? 0
          : frame.performanceNow - this.distractedSince,
      alertStage: this.alertStage,
      visualCue: this.alertStage >= 1,
      cooldownRemainingMs:
        this.lastChimeAt === null
          ? 0
          : Math.max(
              0,
              ATTENTION_THRESHOLDS.audioCooldownMs -
                (frame.performanceNow - this.lastChimeAt),
            ),
    };
  }

  finish(
    nowMs = performance.now(),
    iso = nowIso(),
  ): AttentionSummary {
    if (this.distractedSince !== null) {
      const durationMs = nowMs - this.distractedSince;
      this.recoveryLatencies.push(durationMs);
      this.distractionDurations.push(durationMs);
      this.distractedSince = null;
      this.events.push({
        type: "DISTRACTION_END",
        performanceNow: nowMs,
        timestamp: iso,
        elapsedMs: nowMs - this.startedAtMs,
        state: "ON_SCREEN",
        durationMs,
        reason: "session-ended",
      });
      this.alertStage = 0;
    }

    const durationMs = Math.max(
      0,
      (this.lastSampleAtMs ?? nowMs) - this.startedAtMs,
    );

    return {
      focusPercentage:
        this.totalTrackedMs > 0
          ? Math.round((this.onScreenTrackedMs / this.totalTrackedMs) * 1000) / 10
          : 0,
      totalBlinks: this.blinkTimes.length,
      meanBlinkRatePerMin:
        durationMs >= 5000
          ? Math.round((this.blinkTimes.length / (durationMs / 60_000)) * 10) / 10
          : 0,
      distractionCount: this.recoveryLatencies.length,
      avgRecoveryLatencyMs: mean(this.recoveryLatencies),
      emotionTimeline: [...this.emotionTimeline],
      sessionDurationMs: Math.round(durationMs),
      faceVisiblePercentage:
        this.totalTrackedMs > 0
          ? Math.round((this.faceVisibleMs / this.totalTrackedMs) * 1000) / 10
          : 0,
      totalDistractionDurationMs: this.distractionDurations.reduce(
        (total, value) => total + value,
        0,
      ),
      longestDistractionMs:
        this.distractionDurations.length > 0
          ? Math.max(...this.distractionDurations)
          : 0,
    };
  }

  private updateBlinkState(frame: AttentionFrame): void {
    const closed =
      frame.facePresent && frame.ear < ATTENTION_THRESHOLDS.closedEar;

    if (!frame.facePresent) {
      this.closedSince = null;
      this.drowsy = false;
      return;
    }

    if (closed) {
      this.closedSince ??= frame.performanceNow;
      if (frame.performanceNow - this.closedSince >= ATTENTION_THRESHOLDS.drowsyMs) {
        this.drowsy = true;
      }
      return;
    }

    if (this.closedSince !== null) {
      const durationMs = frame.performanceNow - this.closedSince;
      if (
        durationMs >= ATTENTION_THRESHOLDS.blinkMinMs &&
        durationMs <= ATTENTION_THRESHOLDS.blinkMaxMs
      ) {
        this.blinkTimes.push(frame.performanceNow);
        this.pushEvent("BLINK", frame, { durationMs, state: this.state });
      }
    }

    this.closedSince = null;
    this.drowsy = false;
  }

  private updateAffect(frame: AttentionFrame, state: AttentionState): void {
    const raw = classifyAffect(frame, this.drowsy, state);

    if (!this.hasFrame) {
      this.hasFrame = true;
      this.affect = raw;
      this.emotionTimeline.push(this.emotionPoint(raw, frame));
      return;
    }

    if (raw === this.affect) {
      this.affectCandidate = null;
      return;
    }

    if (this.affectCandidate !== raw) {
      this.affectCandidate = raw;
      this.affectCandidateSince = frame.performanceNow;
      return;
    }

    if (
      frame.performanceNow - this.affectCandidateSince >=
      ATTENTION_THRESHOLDS.affectSmoothingMs
    ) {
      this.affect = raw;
      this.affectCandidate = null;
      this.emotionTimeline.push(this.emotionPoint(raw, frame));
      this.pushEvent("EMOTION_SHIFT", frame, { affect: raw, state });
    }
  }

  private emotionPoint(
    state: AffectState,
    frame: AttentionFrame,
  ): EmotionTimelinePoint {
    return {
      state,
      performanceNow: frame.performanceNow,
      timestamp: frame.timestamp,
      elapsedMs: frame.performanceNow - this.startedAtMs,
    };
  }

  private blinkRatePerMin(nowMs: number): number {
    const windowMs = Math.min(
      60_000,
      Math.max(10_000, nowMs - this.startedAtMs),
    );
    const recent = this.blinkTimes.filter(
      (timestamp) => nowMs - timestamp <= 60_000,
    );
    return Math.round((recent.length * 60_000 * 10) / windowMs) / 10;
  }

  private pushEvent(
    type: AttentionTelemetryEventType,
    frame: AttentionFrame,
    extra: Omit<
      AttentionTelemetryEvent,
      "type" | "performanceNow" | "timestamp" | "elapsedMs"
    >,
  ): void {
    this.events.push({
      type,
      performanceNow: frame.performanceNow,
      timestamp: frame.timestamp,
      elapsedMs: frame.performanceNow - this.startedAtMs,
      ...extra,
    });
  }
}
