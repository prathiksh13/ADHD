"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { useBackendSync } from "@/features/backend/backend-sync-provider";
import { createBackendClient } from "@/lib/backend/client";
import { describeSyncError } from "@/lib/backend/sync-controller";
import type { TwinJournal, TwinJournalEntry } from "@/lib/backend/twin-journal";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FIELD = "mt-1 min-h-11 w-full rounded-lg border border-line bg-white p-2 text-sm text-ink";
const EMPTY: TwinJournal = { goal: null, entries: [], updatedAt: null };

function localDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Owner-only journal. No draft is written to browser storage or shared with caregivers. */
export function TwinJournalCard() {
  const { user } = useFirebaseAuth();
  const { subjectId, consent } = useBackendSync();
  const config = getFrontendConfig();
  const baseUrl = config.valid ? config.apiBaseUrl : null;
  const client = useMemo(() => user && baseUrl ? createBackendClient({
    baseUrl, getIdToken: (force) => user.getIdToken(force),
  }) : null, [baseUrl, user]);
  // Remount the form when identity/subject changes, clearing private local drafts.
  if (!client || !subjectId || !user) return null;
  return <JournalForm key={`${user.uid}:${subjectId}`} client={client} subjectId={subjectId} canSave={consent.status === "granted"} />;
}

function JournalForm({ client, subjectId, canSave }: {
  client: ReturnType<typeof createBackendClient>; subjectId: string; canSave: boolean;
}) {
  const [journal, setJournal] = useState<TwinJournal>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [goal, setGoal] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [day, setDay] = useState("");
  const [sleep, setSleep] = useState("");
  const [stress, setStress] = useState("");
  const [distractions, setDistractions] = useState("");
  const [progress, setProgress] = useState("");

  useEffect(() => {
    let active = true;
    client.getTwinJournal(subjectId).then((data) => {
      if (active) { setJournal(data); setGoal(data.goal ?? ""); setDay(localDay()); }
    }).catch((err) => { if (active) setError(describeSyncError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, subjectId]);

  async function save(body: Parameters<typeof client.updateTwinJournal>[1]) {
    setBusy(true); setError(null); setMessage("");
    try {
      const data = await client.updateTwinJournal(subjectId, body);
      setJournal(data); setMessage("Saved to your private journal.");
    } catch (err) { setError(describeSyncError(err)); }
    finally { setBusy(false); }
  }

  function chooseDay(value: string) {
    setDay(value);
    const previous = journal.entries.find((e) => e.day === value);
    setSleep(previous?.sleepHours == null ? "" : String(previous.sleepHours));
    setStress(previous?.stress ?? ""); setDistractions(previous?.distractions ?? "");
    setProgress(previous?.goalProgress ?? "");
  }

  async function erase() {
    setBusy(true); setError(null); setMessage("");
    try {
      await client.deleteTwinJournal(subjectId);
      setJournal(EMPTY); setGoal(""); setSleep(""); setStress(""); setDistractions(""); setProgress("");
      setConfirmDelete(false); setMessage("Your journal was deleted. Activity results were kept.");
    } catch (err) { setError(describeSyncError(err)); }
    finally { setBusy(false); }
  }

  const disabled = loading || busy || !canSave;
  return <Card>
    <CardHeader><CardTitle>What matters in everyday life</CardTitle>
      <CardDescription>Choose one small goal, such as starting homework or remembering an appointment.
        Optional check-ins help you record how the day felt alongside task results.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <p className="text-xs leading-5 text-ink-muted">Only you can view this journal. It is included in your data export and erasure.
        The latest 30 dated check-ins are kept. It does not change your cognitive scores or infer causes.</p>
      {loading ? <p role="status" className="text-sm text-ink-muted">Loading your private journal…</p> : null}
      {!canSave ? <p className="text-sm text-ink-muted">Grant research consent above to save optional journal entries. Existing entries remain readable; you can delete them at any time.</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-ink">{message}</p> : null}

      <form onSubmit={(e) => { e.preventDefault(); void save({ goal: goal.trim() || null }); }}>
        <label className="block text-xs font-medium text-ink">My everyday goal
          <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={160} disabled={disabled}
            placeholder="Example: start my homework after a short break" className={FIELD} />
        </label>
        <Button type="submit" variant="outline" disabled={disabled} className="mt-2">Save goal</Button>
      </form>

      <form className="space-y-3 border-t border-line pt-4" onSubmit={(e) => {
        e.preventDefault();
        void save({ entry: { day, sleepHours: sleep === "" ? null : Number(sleep),
          stress: (stress || null) as TwinJournalEntry["stress"],
          distractions: (distractions || null) as TwinJournalEntry["distractions"],
          goalProgress: (progress || null) as TwinJournalEntry["goalProgress"],
        } });
      }}>
        <h4 className="text-sm font-semibold text-ink">Optional check-in</h4>
        <p className="text-xs text-ink-muted">Every field except the date can be skipped. No streaks or penalties for missed days.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink">Date
            <input type="date" value={day} onChange={(e) => chooseDay(e.target.value)} required max={localDay()} disabled={disabled} className={FIELD} /></label>
          <label className="text-xs font-medium text-ink">Sleep (hours, optional)
            <input type="number" min="0" max="24" step="0.5" value={sleep} onChange={(e) => setSleep(e.target.value)} disabled={disabled} className={FIELD} /></label>
          <label className="text-xs font-medium text-ink">Stress (optional)
            <select value={stress} onChange={(e) => setStress(e.target.value)} disabled={disabled} className={FIELD}>
              <option value="">Skip</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select></label>
          <label className="text-xs font-medium text-ink">Distractions (optional)
            <select value={distractions} onChange={(e) => setDistractions(e.target.value)} disabled={disabled} className={FIELD}>
              <option value="">Skip</option><option value="few">Few</option><option value="some">Some</option><option value="many">Many</option>
            </select></label>
        </div>
        <label className="block text-xs font-medium text-ink">Progress on your saved goal (optional)
          <select value={progress} onChange={(e) => setProgress(e.target.value)} disabled={disabled || !journal.goal} className={FIELD}>
            <option value="">Skip</option><option value="not_attempted">Not attempted today</option><option value="partly">Partly done</option><option value="achieved">Done today</option>
          </select></label>
        <p className="text-xs text-ink-subtle">Goal recorded with this check-in: {journal.goal ?? "No saved goal"}.
          Saving again for the same date replaces that check-in.</p>
        <Button type="submit" variant="outline" disabled={disabled}>Save check-in</Button>
      </form>

      {journal.entries.length > 0 ? <details>
        <summary className="cursor-pointer py-2 text-sm font-medium text-ink">My recent check-ins ({journal.entries.length})</summary>
        <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">{journal.entries.map((entry) => <li key={entry.day} className="rounded-lg border border-line p-3 text-xs leading-5 text-ink-muted">
          <span className="font-semibold text-ink">{entry.day}</span> · Sleep: {entry.sleepHours == null ? "skipped" : `${entry.sleepHours} hours`}
          {" · "}Stress: {entry.stress ?? "skipped"} · Distractions: {entry.distractions ?? "skipped"}
          {entry.goalProgress ? <p>{entry.goal ?? "Goal"}: {entry.goalProgress.replaceAll("_", " ")}</p> : null}
        </li>)}</ul>
      </details> : null}
      {!loading && (journal.goal || journal.entries.length > 0) ? <div className="border-t border-line pt-3">
        {confirmDelete ? <div className="space-y-2"><p className="text-sm text-ink">Delete the goal and all journal check-ins? This cannot be undone.</p>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void erase()}>Delete my journal</Button>{" "}
          <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmDelete(false)}>Keep journal</Button>
        </div> : <button type="button" className="min-h-11 text-sm text-ink-muted underline" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete journal</button>}
      </div> : null}
    </CardContent>
  </Card>;
}
