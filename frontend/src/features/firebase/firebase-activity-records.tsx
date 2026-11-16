"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { ActivitySessionProvider, useActivitySessions } from "@/features/activities/activity-session-store";
import { useAllLoggedRuns } from "@/features/activities/run-log";
import { loadActivityRecords, saveActivityRecord, type FirebaseActivityRecord } from "@/lib/firebase/activity-records";
import { getFirebaseClientServices } from "@/lib/firebase/firebase-client";
import { normalizeFirebaseError } from "@/lib/firebase/firebase-errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CptRunSummary } from "@/types";

const Context = createContext<{ records: FirebaseActivityRecord[]; loading: boolean } | null>(null);
export function useFirebaseActivityRecords() { return useContext(Context); }

export function cptRecord(run: CptRunSummary): FirebaseActivityRecord {
  return { id: run.id, activityId: "cpt", at: run.completedAt, mode: run.mode,
    ...(run.attentionTelemetry ? { attentionTelemetry: run.attentionTelemetry } : {}),
    cells: [run.accuracyPercent == null ? "—" : `${run.accuracyPercent}%`, `${run.hitCount}/${run.targetCount}`,
      String(run.falseAlarmCount), run.meanHitReactionTimeMs == null ? "—" : `${run.meanHitReactionTimeMs} ms`] };
}

function CompletedRuns({ enqueue }: { enqueue: (records: FirebaseActivityRecord[]) => void }) {
  const logged = useAllLoggedRuns();
  const { cptRuns } = useActivitySessions();
  useEffect(() => {
    // Queue every visit summary (practice + scored, CPT + non-CPT). Scored CPT may also
    // save through onPersistRun; duplicate writes of the same summary are idempotent.
    enqueue([
      ...logged.map((r) => ({ ...r, mode: r.mode ?? "scored" as const })),
      ...cptRuns.filter((r) => r.events.length > 0).map(cptRecord),
    ]);
  }, [logged, cptRuns, enqueue]);
  return null;
}

function SavingControls({
  enabled, busy, pending, error, onToggle, onRetry,
}: {
  enabled: boolean;
  busy: boolean;
  pending: number;
  error: string | null;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const { retryUnsyncedRuns } = useActivitySessions();
  return (
    <div className="mb-5 rounded-xl border border-line bg-surface p-4" aria-label="Firebase activity saving">
      <p className="text-sm text-ink">{enabled ? pending ? `${pending} activity result(s) waiting to save to Firebase.` : "Activity results save directly to your Firebase account." : "Cloud saving is off. Enable it to save trial and scored activity summaries to your Firebase account."}</p>
      <p className="mt-1 text-xs text-ink-muted">Only summary scores and completion times are uploaded. Raw trial events stay in this visit. History, progress, sessions and Digital Twin use the same saved results.</p>
      <Button variant="outline" size="sm" className="mt-2" disabled={busy} onClick={onToggle}>
        {busy ? "Updating…" : enabled ? "Turn off cloud saving" : "Enable Firebase saving"}
      </Button>
      {error ? (
        <Alert tone="danger" title="Firebase saving needs attention">
          <p>{error} Results from this visit remain visible. If access is denied, the project owner must deploy the updated activity result rules.</p>
          <Button variant="outline" size="sm" onClick={() => { onRetry(); retryUnsyncedRuns(); }}>
            Retry Firebase saving
          </Button>
        </Alert>
      ) : null}
    </div>
  );
}

/** Participant Web SDK access only: never requires an Admin credential or calls FastAPI. */
export function FirebaseActivityRecordsProvider({ children }: { children: ReactNode }) {
  const { user, account, setCloudSyncEnabled } = useFirebaseAuth();
  const uid = user!.uid;
  const enabled = account!.profile.cloudSyncEnabled;
  const [records, setRecords] = useState<FirebaseActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const queue = useRef(new Map<string, FirebaseActivityRecord>());
  const saved = useRef(new Set<string>());
  const inFlight = useRef(new Set<string>());
  const active = useRef(true);
  // Stop new uploads as soon as the participant disables cloud saving.
  const maySave = useRef(enabled);
  useEffect(() => { maySave.current = enabled; }, [enabled]);

  const refresh = useCallback(async () => {
    const services = getFirebaseClientServices();
    if (!services || services.auth.currentUser?.uid !== uid) return;
    setLoading(true);
    try {
      const loaded = await loadActivityRecords(services.db, uid);
      if (!active.current) return;
      loaded.forEach((r) => { saved.current.add(r.id); queue.current.delete(r.id); });
      setPending(queue.current.size);
      // Prefer server copies, then keep any visit rows not yet acknowledged.
      setRecords((previous) => [...new Map([...loaded, ...previous].map((r) => [r.id, r])).values()]
        .sort((a, b) => b.at.localeCompare(a.at)));
      setError(null);
    } catch (e) { if (active.current) setError(normalizeFirebaseError(e).message); }
    finally { if (active.current) setLoading(false); }
  }, [uid]);

  const flush = useCallback(() => {
    const services = getFirebaseClientServices();
    if (!services || services.auth.currentUser?.uid !== uid || !maySave.current) return;
    for (const [id, row] of queue.current) {
      if (saved.current.has(id) || inFlight.current.has(id)) continue;
      inFlight.current.add(id);
      void saveActivityRecord(services.db, uid, row).then(() => {
        if (!active.current) return;
        saved.current.add(id);
        queue.current.delete(id);
        setRecords((previous) => [row, ...previous.filter((r) => r.id !== id)]
          .sort((a, b) => b.at.localeCompare(a.at)));
        setError(null);
      }).catch((e: unknown) => { if (active.current) setError(normalizeFirebaseError(e).message); })
        .finally(() => {
          inFlight.current.delete(id);
          if (active.current) setPending(queue.current.size);
        });
    }
  }, [uid]);

  const enqueue = useCallback((rows: FirebaseActivityRecord[]) => {
    for (const row of rows) if (!saved.current.has(row.id)) queue.current.set(row.id, row);
    setPending(queue.current.size);
    flush();
  }, [flush]);

  const persistCpt = useCallback(async (run: CptRunSummary) => {
    const services = getFirebaseClientServices();
    if (!services || services.auth.currentUser?.uid !== uid || !maySave.current || run.participantId !== uid) {
      throw new Error("Enable Firebase saving in your participant account before saving this result.");
    }
    const row = cptRecord(run);
    try { await saveActivityRecord(services.db, uid, row); }
    catch (e) { throw normalizeFirebaseError(e); }
    if (active.current) {
      saved.current.add(row.id);
      queue.current.delete(row.id);
      setPending(queue.current.size);
      setRecords((previous) => [row, ...previous.filter((r) => r.id !== row.id)]
        .sort((a, b) => b.at.localeCompare(a.at)));
    }
    return { message: "Activity summary saved directly to your Firebase account. Raw trial events were not uploaded." };
  }, [uid]);

  useEffect(() => {
    active.current = true;
    // Synchronize this participant's server records when the owner changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return () => { active.current = false; };
  }, [refresh]);
  useEffect(() => { if (enabled) flush(); }, [enabled, flush]);
  const value = useMemo(() => ({ records, loading }), [records, loading]);

  return <Context.Provider value={value}>
    <ActivitySessionProvider participantId={uid} storageMode="firebase" initialRuns={account!.activityRuns} cloudSyncEnabled={enabled} onPersistRun={persistCpt}>
      <CompletedRuns enqueue={enqueue} />
      <SavingControls
        enabled={enabled}
        busy={busy}
        pending={pending}
        error={error}
        onToggle={() => {
          setBusy(true); setError(null);
          // Prevent additional queued writes while preference withdrawal is being saved.
          if (enabled) maySave.current = false;
          void setCloudSyncEnabled(!enabled)
            .catch((e: unknown) => { maySave.current = enabled; setError(normalizeFirebaseError(e).message); })
            .finally(() => setBusy(false));
        }}
        onRetry={() => { void refresh(); flush(); }}
      />
      {children}
    </ActivitySessionProvider>
  </Context.Provider>;
}
