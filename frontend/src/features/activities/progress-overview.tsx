"use client";

import Link from "next/link";
import { ArrowRight, Fingerprint, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ActivityTrend,
  recordBox,
} from "@/features/activities/activity-record-parts";
import {
  useActivityRecords,
  type ActivityRecord,
} from "@/features/activities/use-activity-records";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import { useFirebaseActivityRecords } from "@/features/firebase/firebase-activity-records";
import { formatDate } from "@/lib/utils";

interface ActivityProgress {
  activityId: string;
  title: string;
  runs: ActivityRecord[];
  latest: ActivityRecord;
}

export function ProgressOverview() {
  const records = useActivityRecords();
  const sync = useOptionalBackendSync();
  const firebase = useFirebaseActivityRecords();
  const scored = records.filter((run) => run.mode === "scored");
  const waiting =
    (sync?.status === "loading" || firebase?.loading) && records.length === 0;

  const groups = new Map<string, ActivityRecord[]>();
  for (const run of scored) {
    groups.set(run.activityId, [...(groups.get(run.activityId) ?? []), run]);
  }
  const activities: ActivityProgress[] = [...groups.entries()]
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

  const repeatedActivities = activities.filter(
    (activity) => activity.runs.length > 1,
  ).length;
  const firstObservation = scored.at(-1)?.at;
  const latestObservation = scored[0]?.at;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Your progress"
        description="See how your scored results change over repeated runs. Each activity is tracked separately because each one measures something different."
        meta={
          <Badge tone="brand" dot>
            Change over time
          </Badge>
        }
        actions={
          <>
            <ButtonLink href="/participant/digital-twin" variant="outline">
              <Fingerprint aria-hidden="true" className="size-4" />
              Digital Twin
            </ButtonLink>
            <ButtonLink href="/participant/activities" variant="outline">
              Activity library
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ["Scored runs", scored.length],
          ["Activities measured", activities.length],
          ["Activities with 2+ runs", repeatedActivities],
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
        Completed results appear immediately.
        {firstObservation && latestObservation
          ? ` This history covers ${formatDate(firstObservation)} to ${formatDate(latestObservation)} UTC.`
          : ""}{" "}
        {firebase
          ? "Scored summaries saved to your account are included. Progress uses scored runs only; trial and practice runs appear in activity history."
          : sync
            ? "Saved runs are included after consent. Progress uses scored runs only; trial and practice runs appear in activity history."
            : "Results from this visit remain available while you navigate. Trial and practice runs appear in activity history."}
      </p>

      {scored.length ? (
        <ActivityTrend runs={scored} />
      ) : !waiting && !sync?.loadError ? (
        <EmptyState
          icon={TrendingUp}
          title="No scored result yet"
          description="Complete a scored task to start tracking change over time. Trial and practice activities appear in history but do not affect progress."
          action={<ButtonLink href="/participant/activities">Open the activity library</ButtonLink>}
        />
      ) : null}

      {activities.length > 1 ? (
        <section aria-labelledby="progress-activities" className="space-y-4">
          <div>
            <h2 id="progress-activities" className="text-lg font-semibold text-ink">
              Progress by activity
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              A change over time needs repeated scored runs of the same
              activity. Practice runs never count.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {activities.map((activity) => (
              <li key={activity.activityId} className={recordBox}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-ink">{activity.title}</h3>
                  <Badge tone={activity.runs.length > 1 ? "brand" : "outline"}>
                    {activity.runs.length} scored run
                    {activity.runs.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-ink-muted">
                  {activity.runs.length > 1
                    ? `Compare all ${activity.runs.length} scored runs to see how this result moves over time.`
                    : "One observation is recorded. Another scored run will make a comparison possible."}
                </p>
                <Link
                  href={activity.latest.href}
                  className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-700 underline hover:text-brand-600"
                >
                  View results
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs leading-5 text-ink-subtle">
        Scores can change with practice, sleep, distractions and your device.
        They do not establish ADHD severity or a clinical diagnosis.
      </p>
    </div>
  );
}
