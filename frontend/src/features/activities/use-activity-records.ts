"use client";

import { useActivitySessions } from "@/features/activities/activity-session-store";
import { ACTIVITY_RESULTS, type ResultRow } from "@/features/activities/activity-results";
import { useAllLoggedRuns } from "@/features/activities/run-log";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import { useFirebaseActivityRecords } from "@/features/firebase/firebase-activity-records";
import { activityColumns, activityTitle } from "@/lib/firebase/activity-records";

export interface ActivityRecord extends ResultRow {
  activityId: string;
  title: string;
  columns: string[];
  mode: "practice" | "scored";
  source: "saved" | "visit";
  href: string;
}

export function mergeResultRows(local: ResultRow[], saved: ResultRow[]): ResultRow[] {
  const aliases = new Set(local.flatMap((row) => [row.id, ...(row.serverId ? [row.serverId] : [])]));
  return [...local, ...saved.filter((row) => !aliases.has(row.id))]
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function numericCell(cell: string): { value: number; unit: string } | null {
  const ratio = cell.match(/^(\d+)\s*(?:of|\/)\s*(\d+)$/);
  if (ratio) return Number(ratio[2]) > 0 ? { value: Number(ratio[1]) / Number(ratio[2]) * 100, unit: "%" } : null;
  const match = cell.match(/^([+-]?\d+(?:\.\d+)?)\s*(%|ms|s|ms\/item)?$/);
  return match ? { value: Number(match[1]), unit: match[2] ?? "" } : null;
}

export function useActivityRecords(): ActivityRecord[] {
  const { cptRuns, storageMode } = useActivitySessions();
  const local = useAllLoggedRuns();
  const sync = useOptionalBackendSync();
  const firebase = useFirebaseActivityRecords();
  const records: ActivityRecord[] = cptRuns.map((run) => ({
    ...(run.attentionTelemetry ? { attentionTelemetry: run.attentionTelemetry } : {}),
    id: run.id, at: run.completedAt, activityId: "cpt", title: "Continuous Performance Task",
    columns: ["Accuracy", "Targets detected", "False alarms", "Mean hit response time"],
    cells: [run.accuracyPercent == null ? "—" : `${run.accuracyPercent}%`, `${run.hitCount}/${run.targetCount}`,
      String(run.falseAlarmCount), run.meanHitReactionTimeMs == null ? "—" : `${run.meanHitReactionTimeMs} ms`],
    mode: run.mode, source: storageMode === "firebase" && run.events.length === 0 ? "saved" : "visit",
    href: `/participant/activities/history/${run.id}`,
  }));
  for (const definition of ACTIVITY_RESULTS) {
    const visit = local.filter((r) => r.activityId === definition.id);
    const saved = sync ? definition.fromServer(sync) : [];
    for (const row of mergeResultRows(visit, saved)) {
      records.push({ ...row, activityId: definition.id, title: definition.title, columns: definition.columns,
        mode: row.mode ?? "scored", source: row.serverId || !visit.some((r) => r.id === row.id) ? "saved" : "visit",
        href: `/participant/activities/results?activity=${definition.id}`,
      });
    }
  }
  for (const row of firebase?.records ?? []) {
    const index = records.findIndex((r) => r.id === row.id && r.activityId === row.activityId);
    const saved: ActivityRecord = {
      ...row,
      title: activityTitle(row.activityId),
      columns: activityColumns(row.activityId),
      source: "saved",
      href: row.activityId === "cpt" && index >= 0
        ? records[index].href
        : `/participant/activities/results?activity=${row.activityId}`,
    };
    if (index >= 0) {
      // Keep visit trial events/href when present; mark the shared row as account-saved.
      records[index] = { ...records[index], source: "saved", mode: row.mode, cells: row.cells, at: row.at };
    } else {
      records.push(saved);
    }
  }
  return records.sort((a, b) => b.at.localeCompare(a.at));
}
