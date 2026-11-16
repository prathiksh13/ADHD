"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  useActivityRecords,
} from "@/features/activities/use-activity-records";
import { RunCard, recordBox } from "@/features/activities/activity-record-parts";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import { recordEegRun, useEegRuns } from "@/features/activities/run-log";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { createBackendClient } from "@/lib/backend/client";
import { readPrediction } from "@/features/eeg/firebase-eeg-upload";
import { formatDateTime } from "@/lib/utils";
import { useFirebaseActivityRecords } from "@/features/firebase/firebase-activity-records";

/** Shared record list for activity history and session history. */
export function ActivityOverview({ view }: { view: "history" | "sessions" }) {
  const records = useActivityRecords();
  const firebase = useFirebaseActivityRecords();
  const sync = useOptionalBackendSync();
  const eeg = useEegRuns();
  const { user } = useFirebaseAuth();
  const config = getFrontendConfig();
  const baseUrl = config.valid ? config.apiBaseUrl : null;
  const subjectId = sync?.subjectId;
  const [eegLoadError, setEegLoadError] = useState<string | null>(null);
  const client = useMemo(
    () =>
      user && baseUrl
        ? createBackendClient({
            baseUrl,
            getIdToken: (force) => user.getIdToken(force),
          })
        : null,
    [baseUrl, user],
  );

  useEffect(() => {
    if (!client || !subjectId || view !== "sessions") return;
    let active = true;
    client
      .listEegAnalyses(subjectId)
      .then(({ items }) => {
        if (!active) return;
        setEegLoadError(null);
        for (const item of items.slice().reverse()) {
          const result = readPrediction({ ...item.result, analysis_id: item.id });
          if (result) {
            recordEegRun({
              id: item.id,
              at: item.createdAt,
              label: "EEG analysis",
              result,
              saved: true,
            });
          }
        }
      })
      .catch(() => {
        if (active) {
          setEegLoadError(
            "Saved EEG analyses could not be loaded. Current-visit analyses remain available.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [client, subjectId, view]);

  const [filter, setFilter] = useState("all");
  const scored = records.filter((run) => run.mode === "scored");
  const waiting =
    (sync?.status === "loading" || firebase?.loading) && records.length === 0;
  const titles = {
    history: "Activity history",
    sessions: "Session history",
  };
  const descriptions = {
    history:
      "Completed trial activities and scored tasks, newest first.",
    sessions:
      "Completed activities and EEG analyses from this visit and your saved account records.",
  };
  const visible =
    filter === "all"
      ? records
      : records.filter((run) => run.activityId === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title={titles[view]}
        description={descriptions[view]}
        actions={
          <ButtonLink href="/participant/activities" variant="outline">
            Open activity library
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ["Scored tasks", scored.length],
          ["Trial activities", records.length - scored.length],
          [
            "Activities completed",
            new Set(scored.map((run) => run.activityId)).size,
          ],
        ].map(([label, count]) => (
          <div key={label} className={recordBox}>
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="mt-1 font-mono text-2xl text-ink">
              {waiting ? "…" : count}
            </p>
          </div>
        ))}
      </div>
      {waiting ? (
        <p role="status" className="text-sm text-ink-muted">
          Loading your saved activity results…
        </p>
      ) : null}
      {sync?.loadError ? (
        <Alert
          tone={sync.setupRequired ? "warning" : "danger"}
          title={
            sync.setupRequired
              ? "Cloud saving needs server setup"
              : "Saved records could not be refreshed"
          }
        >
          <p>{sync.loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={sync.status === "loading"}
            onClick={() => void sync.refresh()}
          >
            {sync.status === "loading"
              ? "Retrying…"
              : "Retry loading saved records"}
          </Button>
        </Alert>
      ) : null}
      <p className="text-sm leading-6 text-ink-muted">
        Completed results appear immediately. Account-saved records reload after
        signing in.
        {firebase
          ? " With Firebase saving enabled, trial and scored summaries save directly to your account. The latest 500 saved results are shown."
          : sync
            ? " Cloud saving requires research consent and a reachable backend."
            : " Results from this visit remain available while you navigate."}
      </p>
      <label className="block text-sm text-ink">
        Filter activity
        <select
          className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface p-3"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All activities</option>
          {[
            ...new Map(records.map((run) => [run.activityId, run.title])).entries(),
          ].map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </label>
      {visible.length ? (
        visible.map((run) => (
          <RunCard key={`${run.activityId}:${run.id}`} run={run} />
        ))
      ) : !waiting && !sync?.loadError ? (
        <div className={recordBox}>
          No completed activities yet. Choose a trial activity or a scored task
          from the library.
        </div>
      ) : null}
      {view === "sessions" ? (
        <>
          {eeg.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">EEG analyses</h2>
              {eegLoadError ? (
                <p role="alert" className="text-sm text-red-700">
                  {eegLoadError}
                </p>
              ) : null}
              {eeg.slice(0, 30).map((run) => {
                const analyzed = run.result as ReturnType<typeof readPrediction>;
                return (
                  <article key={run.id} className={recordBox}>
                    <h3 className="font-semibold text-ink">{run.label}</h3>
                    <p className="mt-1 text-xs text-ink-subtle">
                      {formatDateTime(run.at)} UTC ·{" "}
                      {run.saved ? "Saved analysis" : "Current visit"}
                    </p>
                    <p className="mt-2 text-sm text-ink-muted">
                      {analyzed?.status === "scored"
                        ? `Research model output: ${analyzed.prediction.prediction} · model probability ${(analyzed.prediction.probability * 100).toFixed(1)}%. This is not a diagnosis.`
                        : `Unscored: ${analyzed?.status === "unscored" ? analyzed.reason : "Analysis unavailable"}`}
                    </p>
                    <ButtonLink
                      href={`/participant/upload?analysis=${run.id}`}
                      variant="outline"
                      className="mt-3"
                    >
                      Review EEG analysis
                    </ButtonLink>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">EEG analyses</h2>
              <p className="text-sm text-ink-muted">
                Your EEG analysis will appear here after an upload is analyzed.
              </p>
            </section>
          )}
          {sync?.sessions.length ? (
            <details className={recordBox}>
              <summary className="cursor-pointer font-semibold text-ink">
                Saved research session records ({sync.sessions.length})
              </summary>
              <ul className="mt-3 space-y-3">
                {sync.sessions.map((session) => (
                  <li
                    key={session.id}
                    className="border-t border-line py-3 text-sm text-ink-muted"
                  >
                    <p className="font-medium text-ink">
                      {session.activities
                        .map((activity) => activity.activityCode)
                        .join(", ")}{" "}
                      · {session.status}
                    </p>
                    <p className="mt-1 text-xs">
                      {formatDateTime(session.createdAt)} UTC ·{" "}
                      {session.activities.length} assigned activities
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
