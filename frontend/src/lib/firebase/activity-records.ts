import { collection, doc, getDocsFromServer, limit, orderBy, query, runTransaction, Timestamp, type Firestore } from "firebase/firestore";
import { ACTIVITY_RESULTS, type ResultRow } from "@/features/activities/activity-results";
import { isSessionTelemetrySummary } from "@/features/attention/telemetry-validation";

export interface FirebaseActivityRecord extends ResultRow {
  activityId: string;
  mode: "practice" | "scored";
}

export const CPT_COLUMNS = ["Accuracy", "Targets detected", "False alarms", "Mean hit response time"];
export function activityColumns(id: string): string[] {
  return id === "cpt" ? CPT_COLUMNS : ACTIVITY_RESULTS.find((a) => a.id === id)?.columns ?? [];
}

export function activityTitle(id: string): string {
  if (id === "cpt") return "Continuous Performance Task";
  return ACTIVITY_RESULTS.find((a) => a.id === id)?.title ?? id;
}

export function readActivityRecord(id: string, data: Record<string, unknown>): FirebaseActivityRecord | null {
  const activityId = typeof data.activityId === "string" ? data.activityId : "";
  const columns = activityColumns(activityId);
  if (data.schemaVersion !== 1 || data.provenance !== "participant-browser-summary-v1" ||
      !columns.length || !["scored", "practice"].includes(String(data.mode)) ||
      !(data.completedAt instanceof Timestamp) || !Array.isArray(data.cells) ||
      data.cells.length !== columns.length || !data.cells.every((c) => typeof c === "string" && c.length <= 100)) return null;
  if (data.attentionTelemetry !== undefined && !isSessionTelemetrySummary(data.attentionTelemetry)) return null;
  return { id, activityId, mode: data.mode as "practice" | "scored", at: data.completedAt.toDate().toISOString(), cells: data.cells,
    ...(data.attentionTelemetry ? { attentionTelemetry: data.attentionTelemetry as FirebaseActivityRecord["attentionTelemetry"] } : {}) };
}

export async function loadActivityRecords(db: Firestore, uid: string): Promise<FirebaseActivityRecord[]> {
  const snapshot = await getDocsFromServer(query(collection(db, "users", uid, "activityResults"), orderBy("completedAt", "desc"), limit(500)));
  const records: FirebaseActivityRecord[] = [];
  for (const entry of snapshot.docs) {
    const record = readActivityRecord(entry.id, entry.data());
    // Skip unsupported legacy/malformed docs so one bad row cannot blank history/progress/twin.
    if (record) records.push(record);
  }
  return records;
}

function completedAtTimestamp(iso: string): Timestamp {
  const completed = new Date(iso);
  const now = Date.now();
  // Clamp slightly-ahead client clocks so Firestore rules (`completedAt <= request.time`) accept the write.
  const millis = Number.isFinite(completed.getTime()) ? Math.min(completed.getTime(), now) : now;
  return Timestamp.fromMillis(millis);
}

/** Immutable, retry-safe summary. Raw trial events are never uploaded here. */
export async function saveActivityRecord(db: Firestore, uid: string, record: FirebaseActivityRecord): Promise<void> {
  const data = { activityId: record.activityId, mode: record.mode, cells: record.cells,
    ...(record.attentionTelemetry ? { attentionTelemetry: record.attentionTelemetry } : {}),
    completedAt: completedAtTimestamp(record.at), schemaVersion: 1, provenance: "participant-browser-summary-v1" };
  if (!readActivityRecord(record.id, data) || !record.id || record.id.includes("/")) throw new Error("This activity result is invalid and was not saved.");
  const ref = doc(db, "users", uid, "activityResults", record.id);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (!existing.exists()) transaction.set(ref, data);
    else {
      const saved = readActivityRecord(existing.id, existing.data());
      if (!saved || saved.activityId !== record.activityId || saved.mode !== record.mode ||
          JSON.stringify(saved.cells) !== JSON.stringify(record.cells) || JSON.stringify(saved.attentionTelemetry) !== JSON.stringify(record.attentionTelemetry)) {
        throw new Error("A different activity result already uses this identifier.");
      }
    }
  });
}
