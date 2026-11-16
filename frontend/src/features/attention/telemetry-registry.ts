import type { SessionTelemetrySummary } from "./attention-types";
let capture: ((activityId: string) => SessionTelemetrySummary | null) | null = null;
const completed = new Map<string, SessionTelemetrySummary>();
export function registerTelemetryCapture(callback: typeof capture) { capture = callback; }
export function captureActivityTelemetry(activityId: string, runId: string) {
  if (completed.has(runId)) return completed.get(runId)!;
  const summary = capture?.(activityId) ?? null;
  if (summary) {
    completed.set(runId, summary);
    if (completed.size > 50) completed.delete(completed.keys().next().value!);
  }
  return summary;
}
export function telemetryForRun(runId: string) { return completed.get(runId) ?? null; }
export function clearActivityTelemetry() { completed.clear(); }
