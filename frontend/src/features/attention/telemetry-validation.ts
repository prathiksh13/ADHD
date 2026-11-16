import type { SessionTelemetrySummary } from "./attention-types";
const states = ["Engaged", "Neutral", "Frustrated", "Fatigued"];
const types = ["BLINK", "DISTRACTION_START", "DISTRACTION_END", "ALERT_TRIGGERED", "EMOTION_SHIFT"];
const numbers = ["focusPercentage", "totalBlinks", "meanBlinkRatePerMin", "distractionCount", "avgRecoveryLatencyMs", "sessionDurationMs", "faceVisiblePercentage", "totalDistractionDurationMs", "longestDistractionMs", "observedDurationMs"];
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const iso = (v: unknown) => typeof v === "string" && v.length <= 35 && Number.isFinite(Date.parse(v));
const only = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every((k) => keys.includes(k));

/** Reject unexpected fields at every level; never serialise detector results or arbitrary extras. */
export function isSessionTelemetrySummary(value: unknown): value is SessionTelemetrySummary {
  if (!object(value) || !only(value, [...numbers, "schemaVersion", "provenance", "calibrationComplete", "eventsTruncated", "emotionTimeline", "telemetryEvents"]) ||
      value.schemaVersion !== 1 || value.provenance !== "on-device-heuristic-v1" || typeof value.calibrationComplete !== "boolean" || typeof value.eventsTruncated !== "boolean" ||
      !numbers.every((k) => finite(value[k])) || (value.focusPercentage as number) > 100 || (value.faceVisiblePercentage as number) > 100 ||
      !Array.isArray(value.telemetryEvents) || value.telemetryEvents.length > 1000 || !Array.isArray(value.emotionTimeline) || value.emotionTimeline.length > 200) return false;
  for (const event of value.telemetryEvents) {
    if (!object(event) || !only(event, ["type", "performanceNow", "timestamp", "elapsedMs", "state", "affect", "channel", "stage", "durationMs", "recoveryLatencyMs", "reason"]) ||
      !types.includes(String(event.type)) || !finite(event.performanceNow) || !finite(event.elapsedMs) || !iso(event.timestamp) ||
      (event.durationMs !== undefined && !finite(event.durationMs)) || (event.recoveryLatencyMs !== undefined && !finite(event.recoveryLatencyMs)) ||
      (event.state !== undefined && !["ON_SCREEN", "OFF_SCREEN"].includes(String(event.state))) ||
      (event.affect !== undefined && !states.includes(String(event.affect))) ||
      (event.channel !== undefined && !["visual", "audio"].includes(String(event.channel))) ||
      (event.stage !== undefined && event.stage !== 1 && event.stage !== 2) ||
      (event.reason !== undefined && (typeof event.reason !== "string" || event.reason.length > 80))) return false;
  }
  return value.emotionTimeline.every((point) => object(point) && only(point, ["state", "performanceNow", "timestamp", "elapsedMs"]) &&
    states.includes(String(point.state)) && finite(point.performanceNow) && finite(point.elapsedMs) && iso(point.timestamp));
}
