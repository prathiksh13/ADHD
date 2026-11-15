"use client";

import {
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Grid3x3,
  Hand,
  Layers,
  ListChecks,
  OctagonX,
  Orbit,
  Palette,
  Play,
  Puzzle,
  RotateCcw,
  Search,
  Shuffle,
  Timer,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { participantDemoMeta } from "@/data/demo/participant";
import { ACTIVITY_RESULTS } from "@/features/activities/activity-results";
import { useActivitySessions } from "@/features/activities/activity-session-store";
import {
  clearRunLog,
  useAllLoggedRuns,
} from "@/features/activities/run-log";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import { formatDateTime } from "@/lib/utils";

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  cpt: Crosshair,
  "go-no-go": Hand,
  "stop-signal": OctagonX,
  stroop: Palette,
  "task-switching": Shuffle,
  "visual-search": Search,
  "planning-puzzle": Puzzle,
  "n-back": Layers,
  "visual-sequence": Grid3x3,
  "time-perception": Timer,
  "multiple-object-tracking": Orbit,
};

interface UnifiedRun {
  id: string;
  activityId: string;
  activityTitle: string;
  completedAt: string;
  mode: "practice" | "scored";
  metrics: Array<{ label: string; value: string }>;
  detailHref?: string;
  playHref: string;
  isSummaryOnly?: boolean;
}

function RunMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function UnifiedRunRow({ run }: { run: UnifiedRun }) {
  const Icon = ACTIVITY_ICONS[run.activityId] ?? ListChecks;

  return (
    <article className="rounded-xl border border-line p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">
                {run.activityTitle}
              </h3>
              <Badge tone="success" dot>
                Completed
              </Badge>
              <Badge tone={run.mode === "scored" ? "brand" : "neutral"}>
                {run.mode === "scored" ? "Scored" : "Practice"}
              </Badge>
              {run.isSummaryOnly ? (
                <Badge tone="outline">Summary only</Badge>
              ) : null}
            </div>
            <p className="font-mono text-xs text-ink-subtle">
              {run.id} · {formatDateTime(run.completedAt)} UTC
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {run.detailHref ? (
            <ButtonLink
              href={run.detailHref}
              variant="outline"
              size="sm"
              aria-label={`View ${run.id}`}
            >
              {run.activityId === "cpt" ? "View run" : "View in results"}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </ButtonLink>
          ) : null}
          <ButtonLink
            href={run.playHref}
            variant="ghost"
            size="sm"
            aria-label={`Play ${run.activityTitle} again`}
          >
            <Play aria-hidden="true" className="size-3.5" />
            Play again
          </ButtonLink>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line/70 pt-4 sm:grid-cols-3 lg:grid-cols-6">
        {run.metrics.map((metric) => (
          <RunMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </dl>
    </article>
  );
}

export function ActivityHistory() {
  const {
    cptRuns,
    clearCptRuns,
    storageMode,
    persistenceTarget,
    cloudSyncEnabled,
    canClearCptRuns,
    unsyncedRunCount,
  } = useActivitySessions();
  const loggedRuns = useAllLoggedRuns();
  const { account } = useFirebaseAuth();
  const backendSync = useOptionalBackendSync();
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<string>("all");

  const isFirebase = storageMode === "firebase";
  const toBackend = isFirebase && persistenceTarget === "backend";

  // Build unified run history from both CPT sessions and other logged activities
  const allRuns: UnifiedRun[] = useMemo(() => {
    const runs: UnifiedRun[] = [];

    // 1. CPT runs
    for (const run of cptRuns) {
      runs.push({
        id: run.id,
        activityId: "cpt",
        activityTitle: "Continuous Performance Task",
        completedAt: run.completedAt,
        mode: run.mode,
        isSummaryOnly: run.events.length < run.trialCount,
        detailHref: `/participant/activities/history/${run.id}`,
        playHref: "/participant/activities/cpt",
        metrics: [
          { label: "Trials", value: String(run.trialCount) },
          {
            label: "Accuracy",
            value: run.accuracyPercent !== null ? `${run.accuracyPercent}%` : "—",
          },
          {
            label: "Targets",
            value: `${run.hitCount}/${run.targetCount}`,
          },
          { label: "False alarms", value: String(run.falseAlarmCount) },
          { label: "Responses", value: String(run.responseCount) },
          {
            label: "Mean hit RT",
            value:
              run.meanHitReactionTimeMs !== null
                ? `${run.meanHitReactionTimeMs} ms`
                : "—",
          },
        ],
      });
    }

    // 2. Other cognitive activities
    for (const logged of loggedRuns) {
      const def = ACTIVITY_RESULTS.find((item) => item.id === logged.activityId);
      const columns = def?.columns ?? [];
      const metrics = columns.slice(0, 6).map((col, idx) => ({
        label: col,
        value: logged.cells[idx] ?? "—",
      }));

      runs.push({
        id: logged.id,
        activityId: logged.activityId,
        activityTitle: def?.title ?? logged.activityId,
        completedAt: logged.at,
        mode: "scored",
        playHref: def?.href ?? `/participant/activities/${logged.activityId}`,
        detailHref: "/participant/activities/results",
        metrics,
      });
    }

    return runs.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
  }, [cptRuns, loggedRuns]);

  const filteredRuns = useMemo(() => {
    if (selectedActivityFilter === "all") return allRuns;
    return allRuns.filter((run) => run.activityId === selectedActivityFilter);
  }, [allRuns, selectedActivityFilter]);

  const handleClearHistory = () => {
    clearCptRuns();
    clearRunLog();
  };

  const activityOptions = useMemo(() => {
    const presentActivityIds = new Set(allRuns.map((r) => r.activityId));
    const options = [
      { id: "all", label: `All activities (${allRuns.length})` },
      { id: "cpt", label: `Continuous Performance Task (${cptRuns.length})` },
    ];

    for (const item of ACTIVITY_RESULTS) {
      if (presentActivityIds.has(item.id)) {
        const count = allRuns.filter((r) => r.activityId === item.id).length;
        options.push({ id: item.id, label: `${item.title} (${count})` });
      }
    }
    return options;
  }, [allRuns, cptRuns.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Activity history"
        description={
          toBackend
            ? "Review activity summaries saved to the research backend, Firebase summaries, and device storage. Saved runs show validated values; past sessions are preserved."
            : isFirebase
            ? "Review activity records available to this signed-in account and local storage. Sessions are preserved on this device and synced when cloud sync is enabled."
            : "Review completed cognitive activity sessions. Past runs and new completions are automatically stored locally on this device."
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isFirebase ? "success" : "brand"} dot>
              {toBackend
                ? "Research backend"
                : isFirebase
                ? "Firebase account"
                : "Stored locally"}
            </Badge>
            <span className="text-xs text-ink-subtle">
              {allRuns.length} recorded run{allRuns.length === 1 ? "" : "s"}
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink href="/participant/activities/results" variant="outline">
              <ListChecks aria-hidden="true" className="size-4" />
              Results table
            </ButtonLink>
            <ButtonLink href="/participant/activities" variant="outline">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Activity library
            </ButtonLink>
            <ButtonLink href="/participant/activities/cpt">
              Try the CPT
            </ButtonLink>
          </>
        }
      />

      {toBackend ? (
        <Alert tone="info" title="Saved through the research backend">
          With your research consent, scored runs are sent to the backend, which stores the trial events
          and calculates the summary. Runs that could not be saved yet stay in local storage
          {unsyncedRunCount > 0 ? ` (${unsyncedRunCount} waiting)` : ""}. Older Firebase summaries are
          kept as they are.
        </Alert>
      ) : isFirebase ? (
        <Alert tone="info" title="Cloud and device activity history">
          {cloudSyncEnabled
            ? "New scored summaries are saved to this participant account and kept locally. Raw trial events are never uploaded."
            : "Cloud sync is off. Summaries and past runs are safely stored on this device."}
        </Alert>
      ) : (
        <>
          <DemoNotice meta={participantDemoMeta} />
          <Alert tone="info" title="Activity data is stored locally">
            Activity records and past sessions are stored on this device, so your history
            is preserved across page reloads. Practice runs are shown once and are not added to history.
          </Alert>
        </>
      )}

      {/* Activity Filter Chips */}
      <div
        role="group"
        aria-label="Filter activity history by activity"
        className="flex flex-wrap gap-2"
      >
        {activityOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={selectedActivityFilter === option.id}
            onClick={() => setSelectedActivityFilter(option.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedActivityFilter === option.id
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-line text-ink-muted hover:bg-surface-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Recorded runs</CardTitle>
            <CardDescription>
              Newest first. Open CPT runs for full trial-by-trial logs or review metrics for any completed cognitive task.
            </CardDescription>
          </div>
          <ListChecks
            aria-hidden="true"
            className="size-5 shrink-0 text-brand-600"
          />
        </CardHeader>

        {filteredRuns.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={ListChecks}
              title="No recorded activity runs"
              description="Complete a scored activity to add it here. Practice results are shown once but are not saved."
              action={
                <ButtonLink href="/participant/activities">
                  Try an activity
                </ButtonLink>
              }
            />
          </CardContent>
        ) : (
          <CardContent className="space-y-3">
            {filteredRuns.map((run) => (
              <UnifiedRunRow key={`${run.activityId}-${run.id}`} run={run} />
            ))}
          </CardContent>
        )}

        <CardFooter className="flex-wrap">
          <p className="text-xs text-ink-subtle">
            {toBackend
              ? `${backendSync?.serverRuns.length ?? 0} backend runs · ${account?.activityRuns.length ?? 0} Firebase summaries · ${allRuns.length} total local runs`
              : isFirebase
              ? `${account?.activityRuns.length ?? 0} Firebase summaries · ${allRuns.length} device-stored records`
              : `${allRuns.length} stored record${allRuns.length === 1 ? "" : "s"} · saved on device`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/participant/progress"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
            >
              View progress
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
            {allRuns.length > 0 && canClearCptRuns ? (
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                <RotateCcw aria-hidden="true" className="size-3.5" />
                Clear history
              </Button>
            ) : null}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
