"use client";

import { useSyncExternalStore } from "react";
import {
  LOCAL_CELLS,
  type LocalSummaries,
  type ResultActivityId,
  type ResultRow,
} from "@/features/activities/activity-results";

const STORAGE_KEY = "attune:activity-run-log";

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

function persistLog(data: Log): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage errors in non-browser environments or when storage is restricted
  }
}

const EMPTY_ALL: LoggedRunItem[] = [];
const EMPTY: ResultRow[] = [];

let log: Log = {};
let cachedAllRuns: LoggedRunItem[] = EMPTY_ALL;
let isInitialized = false;
const listeners = new Set<() => void>();

function updateLogAndNotify(nextLog: Log): void {
  log = nextLog;
  cachedAllRuns = flattenLog(nextLog);
  listeners.forEach((listener) => listener());
}

function ensureClientInitialized(): void {
  if (isInitialized || typeof window === "undefined" || !window.localStorage) return;
  isInitialized = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Log;
      if (parsed && typeof parsed === "object") {
        updateLogAndNotify(parsed);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

// Ensure storage is initialized on client
if (typeof window !== "undefined") {
  setTimeout(ensureClientInitialized, 0);
}

export function recordRun<K extends ResultActivityId>(
  activity: K,
  id: string,
  summary: LocalSummaries[K],
): void {
  const row: ResultRow = {
    id,
    at: new Date().toISOString(),
    cells: (LOCAL_CELLS[activity] as (summary: LocalSummaries[K]) => string[])(summary),
  };
  // Newest first; a re-recorded run id replaces the earlier row.
  const currentRuns = log[activity] ?? [];
  const updatedRuns = [row, ...currentRuns.filter((existing) => existing.id !== id)];
  const nextLog = { ...log, [activity]: updatedRuns };
  persistLog(nextLog);
  updateLogAndNotify(nextLog);
}

export function clearRunLog(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
  updateLogAndNotify({});
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
