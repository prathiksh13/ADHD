"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Fingerprint, ShieldCheck, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useActivityRecords,
  type ActivityRecord,
} from "@/features/activities/use-activity-records";
import { recordBox } from "@/features/activities/activity-record-parts";
import { recordEegRun, useEegRuns } from "@/features/activities/run-log";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import { ResearchConsentCard } from "@/features/backend/research-consent-card";
import { ServerDigitalTwinCard, ServerReportsCard } from "@/features/backend/server-insights";
import { TwinJournalCard } from "@/features/backend/twin-journal";
import { readPrediction } from "@/features/eeg/firebase-eeg-upload";
import { createBackendClient } from "@/lib/backend/client";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { formatDateTime } from "@/lib/utils";

interface ActivityProfile {
  activityId: string;
  title: string;
  runs: ActivityRecord[];
  latest: ActivityRecord;
}

function sourceLabel(run: ActivityRecord): string {
  return run.source === "saved" ? "Saved to your account" : "Current visit";
}

export function DigitalTwinOverview() {
  const records = useActivityRecords();
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
    if (!client || !subjectId) return;
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
  }, [client, subjectId]);

  const scored = records.filter((run) => run.mode === "scored");
  const waiting = sync?.status === "loading" && records.length === 0;

  const groups = new Map<string, ActivityRecord[]>();
  for (const run of scored) {
    groups.set(run.activityId, [...(groups.get(run.activityId) ?? []), run]);
  }
  const activityProfiles: ActivityProfile[] = [...groups.entries()]
    .map(([activityId, runs]) => {
      const ordered = [...runs].sort((a, b) => a.at.localeCompare(b.at));
      return {
        activityId,
        title: ordered[0].title,
        runs: ordered,
        latest: ordered[ordered.length - 1],
      };
    })
    .sort((a, b) => b.latest.at.localeCompare(a.latest.at));

  const latestObservation = scored
    .map((run) => run.at)
    .sort((a, b) => b.localeCompare(a))[0];
  const observationDays = new Set(scored.map((run) => run.at.slice(0, 10))).size;
  const openConsent =
    sync?.status === "ready" && sync.consent.status !== "granted";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Your Digital Twin"
        description="A descriptive snapshot of your latest activity measurements, the observations behind them and the everyday context you choose to record. Each activity is shown separately."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent" dot>
              Research profile
            </Badge>
            <span className="text-xs text-ink-subtle">
              {scored.length} scored observation{scored.length === 1 ? "" : "s"}
            </span>
            {latestObservation ? (
              <span className="text-xs text-ink-subtle">
                Latest {formatDateTime(latestObservation)} UTC
              </span>
            ) : null}
          </div>
        }
        actions={
          <>
            <ButtonLink href="/participant/progress" variant="outline">
              <TrendingUp aria-hidden="true" className="size-4" />
              Progress over time
            </ButtonLink>
            <ButtonLink href="/participant/data" variant="outline">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Privacy and data controls
            </ButtonLink>
          </>
        }
      />

      <Alert tone="info" title="A profile, not a diagnosis">
        This page summarizes your own activity results. It does not combine
        tasks into one cognitive score, predict ADHD, or replace a clinical
        assessment. EEG and webcam data are not part of the activity profile.
      </Alert>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {[
          ["Activities measured", activityProfiles.length],
          ["Scored observations", scored.length],
          ["Days with results", observationDays],
          [
            "Activities with 2+ runs",
            activityProfiles.filter((profile) => profile.runs.length > 1).length,
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
        </Alert>
      ) : null}

      {sync ? <ServerDigitalTwinCard /> : null}

      <section aria-labelledby="twin-current-profile" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="twin-current-profile" className="text-lg font-semibold text-ink">
              Latest measurements
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Your most recent scored result for each activity. A second run of
              the same activity starts a comparison; open Progress to see change
              over time.
            </p>
          </div>
          <Badge tone="outline">Descriptive only</Badge>
        </div>

        {activityProfiles.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {activityProfiles.map((profile) => (
              <li key={profile.activityId} className={recordBox}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-ink">{profile.title}</h3>
                    <p className="mt-1 text-xs text-ink-subtle">
                      {formatDateTime(profile.latest.at)} UTC ·{" "}
                      {sourceLabel(profile.latest)}
                    </p>
                  </div>
                  <Badge
                    tone={profile.runs.length > 1 ? "brand" : "outline"}
                  >
                    {profile.runs.length} observation
                    {profile.runs.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  {profile.latest.cells.slice(0, 4).map((cell, index) => (
                    <div key={index}>
                      <dt className="text-xs text-ink-muted">
                        {profile.latest.columns[index]}
                      </dt>
                      <dd className="mt-1 font-mono text-lg text-ink">{cell}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  href={profile.latest.href}
                  className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-700 underline hover:text-brand-600"
                >
                  View all {profile.title} results
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        ) : !waiting && !sync?.loadError ? (
          <EmptyState
            icon={Activity}
            title="No scored activity measurements yet"
            description="Complete a scored task to start your profile. The profile does not invent measurements when data is missing."
            action={<ButtonLink href="/participant/activities">Open the activity library</ButtonLink>}
          />
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={recordBox}>
          <div className="flex items-center gap-2">
            <Fingerprint aria-hidden="true" className="size-4 text-brand-700" />
            <h2 className="font-semibold text-ink">What this profile includes</h2>
          </div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-muted">
            <li>Your latest scored result for each activity, kept separate.</li>
            <li>How many observations and recorded days support each result.</li>
            {sync ? (
              <li>A versioned profile and reports calculated by the research backend.</li>
            ) : null}
            {sync ? (
              <li>An optional private everyday goal and check-ins.</li>
            ) : null}
            {eeg.length ? (
              <li>Your latest EEG summary, shown separately from activity results.</li>
            ) : null}
          </ul>
        </div>
        <div className={recordBox}>
          <h2 className="font-semibold text-ink">What it does not do</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-muted">
            <li>It does not combine activities into one cognitive score.</li>
            <li>It does not diagnose ADHD or measure symptom severity.</li>
            <li>It does not predict how you will perform in everyday life.</li>
            <li>It does not include EEG or webcam data in activity results.</li>
          </ul>
        </div>
      </div>

      {sync ? (
        <details className={recordBox} open={openConsent}>
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Research consent and saving ·{" "}
            {sync.consent.status === "granted" ? "enabled" : "not enabled"}
          </summary>
          <div className="mt-3">
            <ResearchConsentCard />
          </div>
        </details>
      ) : null}

      {sync ? (
        <details className={recordBox}>
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Everyday goal and check-ins (optional)
          </summary>
          <div className="mt-3">
            <TwinJournalCard />
          </div>
        </details>
      ) : null}

      {sync ? (
        <details className={recordBox}>
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Saved research reports
          </summary>
          <div className="mt-3">
            <ServerReportsCard />
          </div>
        </details>
      ) : null}

      {eeg.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Latest EEG analysis</h2>
          {eegLoadError ? (
            <p role="alert" className="text-sm text-red-700">
              {eegLoadError}
            </p>
          ) : null}
          {eeg
            .slice(0, 1)
            .map((run) => {
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
          <p className="text-xs leading-5 text-ink-subtle">
            EEG is shown for reference only and is not merged into the activity
            profile.
          </p>
        </section>
      ) : null}

      <p className="text-xs leading-5 text-ink-subtle">
        Practice runs are excluded. More observations do not, by themselves,
        establish clinical validity. Task results can change with practice,
        sleep, distractions and your device.
      </p>
    </div>
  );
}
