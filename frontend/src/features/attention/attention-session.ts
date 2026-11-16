import type {
  ActivityMetrics,
  AffectState,
  AttentionSessionPayload,
  AttentionSummary,
  AttentionTelemetryEvent,
  AttentionTelemetryEventType,
} from "@/features/attention/attention-types";

const TELEMETRY_TYPES = new Set<AttentionTelemetryEventType>([
  "BLINK",
  "DISTRACTION_START",
  "DISTRACTION_END",
  "ALERT_TRIGGERED",
  "EMOTION_SHIFT",
]);

const AFFECT_STATES = new Set<AffectState>([
  "Engaged",
  "Neutral",
  "Frustrated",
  "Fatigued",
]);

const MAX_EVENTS = 5_000;

export interface BuildAttentionSessionInput {
  sessionId: string;
  activityType: string;
  startedAt: string;
  completedAt: string;
  activityMetrics: ActivityMetrics;
  telemetryEvents: readonly AttentionTelemetryEvent[];
  summary: AttentionSummary;
}

export function buildAttentionSessionPayload(
  input: BuildAttentionSessionInput,
): AttentionSessionPayload {
  return {
    sessionId: input.sessionId,
    activityType: input.activityType,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    activityMetrics: input.activityMetrics,
    telemetryEvents: [...input.telemetryEvents],
    summary: input.summary,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateEvent(value: unknown): string | null {
  if (!isRecord(value)) return "Each telemetry event must be an object.";
  if (Object.keys(value).some((key) => !["type", "performanceNow", "timestamp", "elapsedMs", "state", "affect", "channel", "stage", "durationMs", "reason", "recoveryLatencyMs"].includes(key))) return "Unexpected telemetry event fields are not accepted.";
  if (
    typeof value.type !== "string" ||
    !TELEMETRY_TYPES.has(value.type as AttentionTelemetryEventType)
  ) {
    return "A telemetry event has an unsupported type.";
  }
  if (!isFiniteNumber(value.performanceNow) || value.performanceNow < 0) {
    return "A telemetry event has an invalid performance timestamp.";
  }
  if (!isIsoTimestamp(value.timestamp)) {
    return "A telemetry event has an invalid ISO timestamp.";
  }
  if (!isFiniteNumber(value.elapsedMs) || value.elapsedMs < 0) {
    return "A telemetry event has an invalid elapsed time.";
  }
  if (
    value.affect !== undefined &&
    (typeof value.affect !== "string" ||
      !AFFECT_STATES.has(value.affect as AffectState))
  ) {
    return "A telemetry event has an invalid affect state.";
  }
  if (value.stage !== undefined && value.stage !== 1 && value.stage !== 2) {
    return "A telemetry event has an invalid alert stage.";
  }
  if (value.durationMs !== undefined && !isFiniteNumber(value.durationMs)) {
    return "A telemetry event has an invalid duration.";
  }
  return null;
}

export type AttentionPayloadValidation =
  | { ok: true; payload: AttentionSessionPayload }
  | { ok: false; error: string };

/**
 * Strict, allocation-light validation for the Next route. It accepts telemetry
 * summaries only; raw video and image fields are rejected by construction.
 */
export function validateAttentionSessionPayload(
  value: unknown,
): AttentionPayloadValidation {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  if (Object.keys(value).some((key) => !["sessionId", "activityType", "startedAt", "completedAt", "activityMetrics", "telemetryEvents", "summary"].includes(key))) return { ok: false, error: "Unexpected session fields are not accepted." };

  const sessionId = value.sessionId;
  const activityType = value.activityType;
  if (
    typeof sessionId !== "string" ||
    sessionId.length < 1 ||
    sessionId.length > 128
  ) {
    return { ok: false, error: "sessionId must be a non-empty string." };
  }
  if (
    typeof activityType !== "string" ||
    activityType.length < 1 ||
    activityType.length > 64
  ) {
    return { ok: false, error: "activityType must be a non-empty string." };
  }
  if (!isIsoTimestamp(value.startedAt) || !isIsoTimestamp(value.completedAt)) {
    return { ok: false, error: "startedAt and completedAt must be ISO timestamps." };
  }

  if (!isRecord(value.activityMetrics)) {
    return { ok: false, error: "activityMetrics must be an object." };
  }
  const metrics = value.activityMetrics;
  if (Object.keys(metrics).some((key) => !["accuracy", "reactionTimeMs", "commissionErrors", "omissionErrors"].includes(key))) return { ok: false, error: "Unexpected activity metric fields are not accepted." };
  if (
    !isNullableNumber(metrics.accuracy) ||
    !isNullableNumber(metrics.reactionTimeMs) ||
    !isFiniteNumber(metrics.commissionErrors) ||
    !isFiniteNumber(metrics.omissionErrors)
  ) {
    return { ok: false, error: "activityMetrics contains invalid values." };
  }

  if (
    !Array.isArray(value.telemetryEvents) ||
    value.telemetryEvents.length > MAX_EVENTS
  ) {
    return { ok: false, error: "telemetryEvents must be an array under the size cap." };
  }

  for (const event of value.telemetryEvents) {
    const error = validateEvent(event);
    if (error) return { ok: false, error };
  }

  if (!isRecord(value.summary)) {
    return { ok: false, error: "summary must be an object." };
  }
  const summary = value.summary;
  if (Object.keys(summary).some((key) => !["focusPercentage", "totalBlinks", "meanBlinkRatePerMin", "distractionCount", "avgRecoveryLatencyMs", "sessionDurationMs", "faceVisiblePercentage", "totalDistractionDurationMs", "longestDistractionMs", "emotionTimeline"].includes(key))) return { ok: false, error: "Unexpected summary fields are not accepted." };
  const summaryNumbers = [
    "focusPercentage",
    "totalBlinks",
    "meanBlinkRatePerMin",
    "distractionCount",
    "avgRecoveryLatencyMs",
    "sessionDurationMs",
    "faceVisiblePercentage",
    "totalDistractionDurationMs",
    "longestDistractionMs",
  ] as const;

  for (const key of summaryNumbers) {
    if (!isFiniteNumber(summary[key])) {
      return { ok: false, error: `summary.${key} must be a finite number.` };
    }
  }

  if (!Array.isArray(summary.emotionTimeline)) {
    return { ok: false, error: "summary.emotionTimeline must be an array." };
  }

  for (const point of summary.emotionTimeline) {
    if (
      !isRecord(point) ||
      Object.keys(point).some((key) => !["state", "performanceNow", "timestamp", "elapsedMs"].includes(key)) ||
      typeof point.state !== "string" ||
      !AFFECT_STATES.has(point.state as AffectState) ||
      !isFiniteNumber(point.performanceNow) ||
      !isIsoTimestamp(point.timestamp) ||
      !isFiniteNumber(point.elapsedMs)
    ) {
      return { ok: false, error: "summary.emotionTimeline contains an invalid point." };
    }
  }

  return { ok: true, payload: value as unknown as AttentionSessionPayload };
}

export interface AnalyzeResponse {
  ok: true;
  sessionId: string;
  acceptedEvents: number;
  summary: AttentionSummary;
}

export async function postAttentionSession(
  payload: AttentionSessionPayload,
  fetcher: typeof fetch = fetch,
): Promise<AnalyzeResponse> {
  const response = await fetcher("/api/sessions/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      response.status === 413
        ? "The telemetry payload was too large."
        : "Attention telemetry could not be analyzed.",
    );
  }

  return (await response.json()) as AnalyzeResponse;
}
