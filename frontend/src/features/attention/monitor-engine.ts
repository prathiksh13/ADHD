import { ATTENTION_THRESHOLDS as T, EMPTY_LIVE_METRICS, type AffectState, type AttentionFrame, type AttentionLiveMetrics, type AttentionTelemetryEvent, type EmotionTimelinePoint, type SessionTelemetrySummary } from "./attention-types";
import { gazeState } from "./attention-metrics";
const keys = ["browDownLeft", "browDownRight", "mouthPressLeft", "mouthPressRight", "mouthFrownLeft", "mouthFrownRight"] as const;
const calibrationKeys = [...keys, "yawDeg", "pitchDeg", "irisHorizontal", "irisVertical", "ear"] as const;

/** Pure state machine; no frames, landmarks, camera handles or images are retained. */
export class MonitorEngine {
  private last: number | null = null;
  private calibratedMs = 0;
  private samples = 0;
  private baseline: Record<string, number> = {};
  private ema: Record<string, number> = {};
  private events: AttentionTelemetryEvent[] = [];
  private timeline: EmotionTimelinePoint[] = [];
  private truncated = false;
  private closedSince: number | null = null;
  private closures: { at: number; dt: number; closed: boolean }[] = [];
  private blinks: number[] = [];
  private awaySince: number | null = null;
  private alertAt: number | null = null;
  private audioAt = -Infinity;
  private stage: 0 | 1 | 2 = 0;
  private distractions = 0;
  private recoveries: number[] = [];
  private durations: number[] = [];
  private tracked = 0;
  private focused = 0;
  private visible = 0;
  private previousFocused = false;
  private previousVisible = false;
  private affect: AffectState = "Neutral";
  private candidate: AffectState = "Neutral";
  private candidateSince = 0;
  private fatigueCueSuppressed = false;
  private finished: SessionTelemetrySummary | null = null;
  private previousCalibration: AttentionFrame | null = null;
  private missingSince: number | null = null;
  private live = { ...EMPTY_LIVE_METRICS };
  constructor(readonly startedAtMs: number, readonly startedAt: string, private calibrationMs = 2500) {}

  private event(type: AttentionTelemetryEvent["type"], now: number, iso: string, extra: Partial<AttentionTelemetryEvent> = {}) {
    if (this.events.length >= 1000) { this.truncated = true; return; }
    this.events.push({ type, performanceNow: now, timestamp: iso, elapsedMs: Math.max(0, now - this.startedAtMs), ...extra });
  }
  private endAway(now: number, iso: string, recovered: boolean, reason: string) {
    if (this.awaySince === null) return;
    const durationMs = Math.max(0, now - this.awaySince);
    const recoveryLatencyMs = Math.max(0, now - (this.alertAt ?? this.awaySince));
    this.durations.push(durationMs);
    if (recovered) this.recoveries.push(recoveryLatencyMs);
    this.event("DISTRACTION_END", now, iso, { durationMs, ...(recovered ? { recoveryLatencyMs } : {}), reason });
    this.awaySince = null; this.alertAt = null; this.stage = 0;
  }
  pause(now: number, iso: string) {
    this.endAway(now, iso, false, "monitoring-paused");
    this.last = null; this.closedSince = null; this.closures = []; this.candidateSince = now; this.missingSince = null;
  }
  recalibrate(now: number, iso: string) {
    if (this.finished) return;
    this.pause(now, iso);
    this.calibratedMs = 0; this.samples = 0; this.baseline = {}; this.ema = {}; this.previousCalibration = null;
    this.live = { ...EMPTY_LIVE_METRICS, calibrating: true, calibrationProgress: 0 };
  }
  ingest(frame: AttentionFrame, audioEnabled = true): AttentionLiveMetrics {
    if (this.finished) return this.live;
    const now = frame.performanceNow, iso = frame.timestamp;
    const gap = this.last === null ? 0 : now - this.last;
    // CPU inference commonly exceeds 250ms. It is not an activity pause.
    // Real pauses are explicit; only long observation gaps break continuity.
    if (gap > 2000) this.pause(this.last!, iso);
    const dt = gap >= 0 && gap <= 2000 ? gap : 0;
    this.last = now;
    if (this.calibratedMs < this.calibrationMs) {
      const valid = frame.facePresent && frame.ear > .08 && frame.blinkLeft < .4 && frame.blinkRight < .4
        && Math.abs(frame.yawDeg) < 30 && Math.abs(frame.pitchDeg) < 40
        && Number.isFinite(frame.irisHorizontal) && Number.isFinite(frame.irisVertical);
      const prior = this.previousCalibration;
      const stable = !prior || (Math.abs(frame.yawDeg - prior.yawDeg) < 5 && Math.abs(frame.pitchDeg - prior.pitchDeg) < 5
        && Math.abs(frame.irisHorizontal - prior.irisHorizontal) < .15 && Math.abs(frame.irisVertical - prior.irisVertical) < .25);
      this.previousCalibration = valid ? { ...frame } : null;
      if (!valid || !stable) { this.calibratedMs = 0; this.samples = 0; this.baseline = {}; }
      if (valid && stable) {
        this.calibratedMs += dt; this.samples++;
        for (const key of calibrationKeys) this.baseline[key] = (this.baseline[key] ?? 0) + (frame[key] ?? 0);
        if (this.calibratedMs >= this.calibrationMs) {
          for (const key of calibrationKeys) this.baseline[key] /= this.samples;
          this.last = null;
        }
      }
      return this.live = { ...EMPTY_LIVE_METRICS, facePresent: frame.facePresent, calibrating: this.calibratedMs < this.calibrationMs,
        calibrationProgress: Math.min(1, this.calibratedMs / this.calibrationMs),
        trackingReason: !frame.facePresent ? "Face not visible — check camera and lighting" : !valid ? "Face the screen with eyes open" : "Look at the activity centre and hold still" };
    }
    const corrected = { ...frame, yawDeg: frame.yawDeg - (this.baseline.yawDeg ?? 0), pitchDeg: frame.pitchDeg - (this.baseline.pitchDeg ?? 0),
      irisHorizontal: frame.irisHorizontal - (this.baseline.irisHorizontal ?? 0), irisVertical: frame.irisVertical - (this.baseline.irisVertical ?? 0) };
    const closedThreshold = this.baseline.ear ? Math.max(.08, Math.min(T.closedEar, this.baseline.ear * .65)) : T.closedEar;
    const closed = frame.facePresent && (Math.max(frame.leftEar ?? frame.ear, frame.rightEar ?? frame.ear) < closedThreshold || (frame.blinkLeft > .65 && frame.blinkRight > .65));
    // Eyelid closure makes the iris estimate unreliable; fatigue handles closure separately.
    const gazeFrame = closed ? { ...corrected, irisHorizontal: 0, irisVertical: 0 } : corrected;
    const gaze = gazeState(gazeFrame);
    if (closed && this.live.state === "OFF_SCREEN") {
      gaze.state = "OFF_SCREEN"; gaze.reason = "Eyes closed during look-away";
    }
    if (!frame.facePresent) this.missingSince ??= now; else this.missingSince = null;
    if (this.missingSince !== null && now - this.missingSince < 250 && this.live.state === "ON_SCREEN") {
      gaze.state = "ON_SCREEN"; gaze.reason = "Brief tracking interruption";
    }
    // A lower return threshold prevents boundary jitter from repeatedly resetting an alert.
    if (this.live.state === "OFF_SCREEN" && gaze.state === "ON_SCREEN" && frame.facePresent && !closed
      && (Math.abs(corrected.yawDeg) > T.yawDeg * .8 || Math.abs(corrected.pitchDeg) > T.pitchDeg * .8
        || Math.abs(corrected.irisHorizontal) > T.irisHorizontal * .8 || Math.abs(corrected.irisVertical) > T.irisVertical * .8)) {
      gaze.state = "OFF_SCREEN"; gaze.reason = "Looking away";
    }
    this.tracked += dt;
    if (this.previousFocused) this.focused += dt;
    if (this.previousVisible) this.visible += dt;
    this.closures.push({ at: now, dt: frame.facePresent ? dt : 0, closed });
    this.closures = this.closures.filter((s) => s.at >= now - 60_000).slice(-1200);
    const windowMs = this.closures.reduce((n, s) => n + s.dt, 0);
    const perclos = windowMs >= 10_000 ? this.closures.reduce((n, s) => n + (s.closed ? s.dt : 0), 0) / windowMs : 0;
    const reopening = this.closedSince !== null && !closed && frame.facePresent;
    if (closed || frame.jawOpen > .50 || gaze.state === "OFF_SCREEN") this.fatigueCueSuppressed = false;
    else if (reopening || this.live.state === "OFF_SCREEN") this.fatigueCueSuppressed = true;
    if (!frame.facePresent) this.closedSince = null;
    else if (closed) this.closedSince ??= now;
    else if (this.closedSince !== null) {
      const durationMs = now - this.closedSince;
      if (durationMs >= T.blinkMinMs && durationMs <= T.blinkMaxMs) { this.blinks.push(now); this.event("BLINK", now, iso, { durationMs }); }
      this.closedSince = null;
    }
    const prolonged = this.closedSince !== null && now - this.closedSince > T.drowsyMs;
    const fatigued = frame.facePresent && (prolonged || frame.jawOpen > .50 || perclos > .15);
    for (const key of keys) this.ema[key] = .2 * Math.max(0, (frame[key] ?? 0) - (this.baseline[key] ?? 0)) + .8 * (this.ema[key] ?? 0);
    const brow = (this.ema.browDownLeft + this.ema.browDownRight) / 2;
    const mouth = Math.max((this.ema.mouthPressLeft + this.ema.mouthPressRight) / 2, (this.ema.mouthFrownLeft + this.ema.mouthFrownRight) / 2);
    const raw: AffectState = !frame.facePresent ? "Neutral" : fatigued ? "Fatigued" : brow > .15 && mouth > .12 ? "Frustrated" :
      gaze.state === "ON_SCREEN" && !closed && frame.taskFocused && Math.abs(corrected.yawDeg) < 10 && Math.abs(corrected.pitchDeg) < 10 ? "Engaged" : "Neutral";
    if (!this.timeline.length) this.timeline.push({ state: this.affect, performanceNow: now, timestamp: iso, elapsedMs: now - this.startedAtMs });
    if (raw !== this.candidate) { this.candidate = raw; this.candidateSince = now; }
    if (raw !== this.affect && now - this.candidateSince >= 1500) {
      this.affect = raw;
      if (this.timeline.length < 200) this.timeline.push({ state: raw, performanceNow: now, timestamp: iso, elapsedMs: now - this.startedAtMs });
      else this.truncated = true;
      this.event("EMOTION_SHIFT", now, iso, { affect: raw });
    }
    // Historical PERCLOS can retain a fatigue label, but returning open eyes to
    // the task must clear cues immediately; another closure/aversion re-arms them.
    const distracted = gaze.state === "OFF_SCREEN" || (fatigued && !this.fatigueCueSuppressed);
    if (distracted && this.awaySince === null) {
      this.awaySince = now; this.distractions++;
      this.event("DISTRACTION_START", now, iso, { state: gaze.state, reason: fatigued ? "fatigue-heuristic" : gaze.reason });
    } else if (!distracted) this.endAway(now, iso, true, "returned-to-target");
    const duration = this.awaySince === null ? 0 : now - this.awaySince;
    if (distracted && duration >= 2500 && this.stage === 0) {
      this.stage = 1; this.alertAt = now; this.event("ALERT_TRIGGERED", now, iso, { channel: "visual", stage: 1 });
    }
    if (audioEnabled && distracted && duration >= 4500 && now - this.audioAt >= 10_000) {
      this.stage = 2; this.audioAt = now; this.event("ALERT_TRIGGERED", now, iso, { channel: "audio", stage: 2 });
    }
    this.previousFocused = !distracted; this.previousVisible = frame.facePresent;
    return this.live = { state: gaze.state, affect: this.affect, facePresent: frame.facePresent, ear: frame.ear,
      yawDeg: corrected.yawDeg, pitchDeg: corrected.pitchDeg, irisOffset: Math.max(Math.abs(corrected.irisHorizontal), Math.abs(corrected.irisVertical)),
      blinkRatePerMin: this.blinks.filter((at) => at >= now - 60_000).length * 60_000 / Math.max(10_000, Math.min(60_000, this.tracked)),
      totalBlinks: this.blinks.length, distractionDurationMs: duration, alertStage: this.stage, visualCue: this.stage > 0,
      cooldownRemainingMs: Math.max(0, 10_000 - now + this.audioAt), calibrating: false, perclos, trackingReason: closed ? "Eyes closed" : gaze.reason };
  }
  get lastAudioAt() { return this.audioAt; }
  finish(now: number, iso: string): SessionTelemetrySummary {
    if (this.finished) return structuredClone(this.finished);
    this.endAway(this.last ?? now, iso, false, "session-ended");
    this.finished = { schemaVersion: 1, provenance: "on-device-heuristic-v1", calibrationComplete: this.calibratedMs >= this.calibrationMs,
      observedDurationMs: this.tracked, eventsTruncated: this.truncated,
      focusPercentage: this.tracked ? this.focused / this.tracked * 100 : 0,
      totalBlinks: this.blinks.length, meanBlinkRatePerMin: this.tracked ? this.blinks.length * 60_000 / this.tracked : 0,
      distractionCount: this.distractions, avgRecoveryLatencyMs: this.recoveries.length ? this.recoveries.reduce((a, b) => a + b, 0) / this.recoveries.length : 0,
      emotionTimeline: this.timeline.map((p) => ({ ...p })), telemetryEvents: this.events.map((e) => ({ ...e })),
      sessionDurationMs: now - this.startedAtMs, faceVisiblePercentage: this.tracked ? this.visible / this.tracked * 100 : 0,
      totalDistractionDurationMs: this.durations.reduce((a, b) => a + b, 0), longestDistractionMs: Math.max(0, ...this.durations) };
    return structuredClone(this.finished);
  }
}
