"use client";

import { useSyncExternalStore } from "react";
import { captureActivityTelemetry, clearActivityTelemetry } from "@/features/attention/telemetry-registry";
import {
  LOCAL_CELLS,
  type LocalSummaries,
  type ResultActivityId,
  type ResultRow,
} from "@/features/activities/activity-results";



type Log = Partial<Record<ResultActivityId, ResultRow[]>>;

export interface LoggedRunItem extends ResultRow {
  activityId: ResultActivityId;
}

function flattenLog(targetLog: Log): LoggedRunItem[] {
  const all: LoggedRunItem[] = [];
  for (const [activityId, rows] of Object.entries(targetLog)) {
    if (Array.isArray(rows)) {
      for (const row of rows) {
        all.push({ ...row, activityId: activityId as ResultActivityId });
      }
    }
  }
  return all.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

const EMPTY_ALL: LoggedRunItem[] = [];
const EMPTY: ResultRow[] = [];

let log: Log = {};
let cachedAllRuns: LoggedRunItem[] = EMPTY_ALL;
let scope = "unscoped";
const listeners = new Set<() => void>();

function updateLogAndNotify(nextLog: Log): void {
  log = nextLog;
  cachedAllRuns = flattenLog(nextLog);
  listeners.forEach((listener) => listener());
}

export function recordRun<K extends ResultActivityId>(
  activity: K,
  id: string,
  summary: LocalSummaries[K],
  mode: "practice" | "scored" = "scored",
): void {
  const attentionTelemetry = captureActivityTelemetry(activity, id);
  const row: ResultRow = {
    ...(attentionTelemetry ? { attentionTelemetry } : {}),
    id,
    mode,
    at: new Date().toISOString(),
    cells: (LOCAL_CELLS[activity] as (summary: LocalSummaries[K]) => string[])(summary),
  };
  // Newest first; a re-recorded run id replaces the earlier row.
  const currentRuns = log[activity] ?? [];
  const updatedRuns = [row, ...currentRuns.filter((existing) => existing.id !== id)];
  const nextLog = { ...log, [activity]: updatedRuns };

  updateLogAndNotify(nextLog);
}

export function clearRunLog(): void { updateLogAndNotify({}); }
export function getLoggedRuns(): LoggedRunItem[] { return cachedAllRuns; }

export function setRunLogScope(nextScope: string): void {
  if (scope !== nextScope) {
    scope = nextScope;
    clearActivityTelemetry();
    clearRunLog();
    eegRuns = [];
    listeners.forEach((listener) => listener());
  }
}

export function markRunSaved(id: string, serverId?: string | null): void {
  if (!serverId) return;
  const next: Log = {};
  for (const [activity, rows] of Object.entries(log)) {
    next[activity as ResultActivityId] = rows?.map((row) => row.id === id ? { ...row, serverId } : row);
  }
  updateLogAndNotify(next);
}

export interface EegRun {
  id: string;
  at: string;
  label: string;
  result: unknown;
  saved: boolean;
}
let eegRuns: EegRun[] = [];
const EMPTY_EEG: EegRun[] = [];
export function recordEegRun(run: EegRun, ownerId?: string) {
  if (ownerId && ownerId !== scope) return false;
  const existing = eegRuns.find((r) => r.id === run.id);
  if (existing) return; // Preserve the transient signal preview when loading a saved summary.
  eegRuns = [run, ...eegRuns.filter((r) => r.id !== run.id)].slice(0, 30);
  listeners.forEach((listener) => listener());
}
export function useEegRuns() {
  return useSyncExternalStore(subscribe, () => eegRuns, () => EMPTY_EEG);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** This activity's real-time runs, newest first. */
export function useRunLog(activity: ResultActivityId): ResultRow[] {
  return useSyncExternalStore(
    subscribe,
    () => log[activity] ?? EMPTY,
    () => EMPTY,
  );
}

/** All logged real-time runs across all cognitive activities, newest first. */
export function useAllLoggedRuns(): LoggedRunItem[] {
  return useSyncExternalStore(
    subscribe,
    () => cachedAllRuns,
    () => EMPTY_ALL,
  );
}
