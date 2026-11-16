"use client";
import { useActivityAttentionMonitor, ActivityAttentionStatus } from "@/features/attention/attention-monitor-provider";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applyMove,
  canMove,
  isSolved,
  minimumMoves,
  PEGS,
  PLANNING_PRACTICE_PUZZLES,
  PLANNING_PUZZLE_TIME_LIMIT_MS,
  PLANNING_SCORED_PUZZLES,
  startingPegs,
  type Peg,
  type PegState,
} from "@/features/activities/planning-puzzle/planning-puzzle-config";
import {
  summarizePlanningPuzzle,
  type PlanningPuzzleSummary,
} from "@/features/activities/planning-puzzle/planning-puzzle-scoring";
import { recordRun, markRunSaved } from "@/features/activities/run-log";
import { useOptionalBackendSync } from "@/features/backend/backend-sync-provider";
import type { PlanningPuzzleRunView } from "@/lib/backend/summary-mapping";
import type { BackendPlanningPuzzleEvent } from "@/lib/backend/types";
import { formatDateTime } from "@/lib/utils";

type Mode = "practice" | "scored";
type Phase = "intro" | "running" | "practice-done" | "scored-done";
type SaveState =
  | { status: "local" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "failed"; message: string };

const show = (value: number | null, suffix = "") => (value === null ? "—" : `${value}${suffix}`);
const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Summary({ summary }: { summary: PlanningPuzzleSummary }) {
  const rows: [string, string][] = [
    ["Puzzles solved", `${summary.solvedCount} of ${summary.puzzleCount}`],
    ["Solved in fewest moves", String(summary.optimalCount)],
    ["Extra moves (solved)", show(summary.meanExtraMoves)],
    ["Total moves", String(summary.totalMoves)],
    ["Illegal tries", String(summary.illegalAttempts)],
    ["Planning time", seconds(summary.meanPlanningTimeMs)],
    ["Solution time", seconds(summary.meanSolutionTimeMs)],
  ];

  return (
    <div className="space-y-3">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">{label}</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-ink-subtle">
        Extra moves compare each solved puzzle with the fewest moves possible. Planning time is how long it
        took to make the first move. Skipped or timed-out puzzles count as not solved.
      </p>
    </div>
  );
}

function Pegs({
  pegs,
  discs,
  selected,
  onPick,
}: {
  pegs: PegState;
  discs: number;
  selected: Peg | null;
  onPick: (peg: Peg) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {PEGS.map((peg) => (
        <button
          key={peg}
          type="button"
          onClick={() => onPick(peg)}
          aria-pressed={selected === peg}
          aria-label={`Peg ${peg}, ${pegs[peg].length ? `discs from bottom: ${pegs[peg].join(", ")}` : "empty"}${
            peg === "C" ? ", goal" : ""
          }`}
          className={`flex h-48 w-44 flex-col-reverse items-center gap-1 rounded-lg border-2 px-2 pb-2 ${
            selected === peg ? "border-accent bg-accent/10" : "border-line"
          }`}
        >
          {pegs[peg].map((size) => (
            <span
              key={size}
              className="h-7 rounded bg-accent"
              style={{ width: `${30 + (size / discs) * 70}%`, opacity: 0.55 + (size / discs) * 0.45 }}
            >
              <span className="sr-only">{size}</span>
            </span>
          ))}
          <span className="mt-auto pt-2 text-xs font-medium text-ink-subtle">
            {peg === "C" ? "Goal (C)" : peg}
          </span>
        </button>
      ))}
    </div>
  );
}

export function PlanningPuzzleActivity() {
  const sync = useOptionalBackendSync();
  const [phase, setPhase] = useState<Phase>("intro");
  const attention = useActivityAttentionMonitor({ activityId: "planning-puzzle", isActive: phase === "running" });
  const [mode, setMode] = useState<Mode>("practice");
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [pegs, setPegs] = useState<PegState>(startingPegs(3));
  const [selected, setSelected] = useState<Peg | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [summary, setSummary] = useState<PlanningPuzzleSummary | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "local" });
  const [thisVisit, setThisVisit] = useState<{ id: string; at: string; summary: PlanningPuzzleSummary }[]>([]);

  const puzzleStartedAt = useRef(0);
  const moves = useRef<string[]>([]);
  const illegal = useRef(0);
  const firstMoveAt = useRef<number | null>(null);
  const events = useRef<BackendPlanningPuzzleEvent[]>([]);
  const timer = useRef<number | null>(null);
  const runId = useRef(newRunId());

  const puzzles = mode === "practice" ? PLANNING_PRACTICE_PUZZLES : PLANNING_SCORED_PUZZLES;
  const puzzle = puzzles[puzzleIndex];

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const finishRun = useCallback(
    async (finishedMode: Mode) => {
      const result = summarizePlanningPuzzle(events.current);
      setSummary(result);

      if (finishedMode === "practice") {
        recordRun("planning-puzzle", runId.current, result, "practice");
        setPhase("practice-done");
        return;
      }

      setPhase("scored-done");
      recordRun("planning-puzzle", runId.current, result);
      setThisVisit((previous) => [{ id: runId.current, at: new Date().toISOString(), summary: result }, ...previous]);

      // Saved only when the participant has already granted research consent; never otherwise.
      if (sync && sync.consent.status === "granted") {
        setSave({ status: "saving" });
        try {
          const completedId = runId.current;
          const outcome = await sync.persistPlanningPuzzleRun(completedId, events.current);
          markRunSaved(completedId, outcome.serverRunId);
          setSave({ status: "saved", message: outcome.message });
        } catch (error) {
          setSave({
            status: "failed",
            message: error instanceof Error ? error.message : "The run could not be saved.",
          });
        }
      }
    },
    [sync],
  );

  /** Records the current puzzle (solved, skipped or timed out) and moves on. */
  const endPuzzle = useCallback(() => {
    clearTimer();
    const current = puzzles[puzzleIndex];
    if (!current) return;
    const now = performance.now();
    events.current.push({
      trialIndex: puzzleIndex,
      trialId: current.id,
      discCount: current.discs,
      moves: [...moves.current],
      illegalAttempts: Math.min(illegal.current, 500),
      firstMoveLatencyMs:
        firstMoveAt.current === null ? null : Math.round(firstMoveAt.current - puzzleStartedAt.current),
      totalTimeMs: Math.min(Math.round(now - puzzleStartedAt.current), 300_000),
    });
    if (puzzleIndex + 1 < puzzles.length) {
      setPegs(startingPegs(puzzles[puzzleIndex + 1].discs));
      setSelected(null);
      setMoveCount(0);
      setPuzzleIndex(puzzleIndex + 1);
    } else {
      void finishRun(mode);
    }
  }, [clearTimer, puzzles, puzzleIndex, finishRun, mode]);

  const start = useCallback(
    (nextMode: Mode) => {
      clearTimer();
      events.current = [];
      runId.current = newRunId();
      setSave({ status: "local" });
      setSummary(null);
      setMode(nextMode);
      setPegs(startingPegs((nextMode === "practice" ? PLANNING_PRACTICE_PUZZLES : PLANNING_SCORED_PUZZLES)[0].discs));
      setSelected(null);
      setMoveCount(0);
      setPuzzleIndex(0);
      setPhase("running");
    },
    [clearTimer],
  );

  // Each puzzle: reset the board, start the clock, and end it when time runs out.
  useEffect(() => {
    if (phase !== "running" || !puzzle) return;
    moves.current = [];
    illegal.current = 0;
    firstMoveAt.current = null;
    puzzleStartedAt.current = performance.now();

    timer.current = window.setTimeout(endPuzzle, PLANNING_PUZZLE_TIME_LIMIT_MS);
    return clearTimer;
    // endPuzzle changes with puzzleIndex, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, puzzleIndex]);

  useEffect(() => clearTimer, [clearTimer]);

  function pick(peg: Peg) {
    if (phase !== "running" || !puzzle) return;
    if (selected === null) {
      if (pegs[peg].length > 0) setSelected(peg);
      return;
    }
    if (selected === peg) {
      setSelected(null);
      return;
    }
    if (!canMove(pegs, selected, peg)) {
      illegal.current += 1;
      setSelected(null);
      return;
    }

    if (firstMoveAt.current === null) firstMoveAt.current = performance.now();
    moves.current.push(selected + peg);
    const next = applyMove(pegs, selected, peg);
    setPegs(next);
    setSelected(null);
    setMoveCount(moves.current.length);
    if (isSolved(next, puzzle.discs)) endPuzzle();
  }

  return (
    <div data-attention-activity="planning-puzzle" className={attention.status.metrics.visualCue && phase === "running" ? "space-y-6 attention-cue" : "space-y-6"}>
      <ActivityAttentionStatus isActive={phase === "running"} />
      {attention.status.metrics.visualCue && phase === "running" ? <p role="status" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">Focus Alert — Eyes back on the activity</p> : null}
      <PageHeader
        eyebrow="Cognitive activity"
        title="Planning Puzzle"
        description="Move a stack of discs from the first peg to the goal peg, one disc at a time, never putting a larger disc on a smaller one. It measures planning ahead. This is a research task, not a clinical assessment."
      />

      {phase === "intro" ? (
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              Select a peg to pick up its top disc, then select another peg to put it down. Move all the discs
              onto the goal peg (C). A larger disc can never sit on a smaller one. Each puzzle has{" "}
              {PLANNING_PUZZLE_TIME_LIMIT_MS / 1000} s, and you can skip one if it is too hard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-muted">
              A practice puzzle comes first, then {PLANNING_SCORED_PUZZLES.length} scored puzzles. Practice is
              never saved.
            </p>
            <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => start("practice")}>Trial activity (practice)</Button><Button onClick={() => start("scored")}>Start scored task</Button></div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "running" && puzzle ? (
        <Card>
          <CardHeader>
            <CardTitle>{mode === "practice" ? "Practice" : "Scored run"}</CardTitle>
            <CardDescription>
              Puzzle {puzzleIndex + 1} of {puzzles.length}: {puzzle.discs} discs. Moves: {moveCount} (fewest
              possible: {minimumMoves(puzzle.discs)}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Pegs pegs={pegs} discs={puzzle.discs} selected={selected} onPick={pick} />
            <div className="flex justify-center">
              <Button variant="outline" onClick={endPuzzle}>
                Skip puzzle
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "practice-done" && summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Practice complete</CardTitle>
            <CardDescription>Trial results appear in visit history and are excluded from scored progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Summary summary={summary} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => start("scored")}>Start scored run</Button>
              <Button variant="outline" onClick={() => start("practice")}>
                Practice again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "scored-done" && summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Scored run complete</CardTitle>
            <CardDescription>
              {sync
                ? "With your research consent the run is sent to the research backend, which replays the moves and calculates the results."
                : "Enable Firebase saving above to keep this summary in your account. Saved results appear in activity history, progress, sessions and Digital Twin."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Summary summary={summary} />
            {save.status === "saving" ? <p role="status" className="text-sm text-ink-muted">Saving…</p> : null}
            {save.status === "saved" ? (
              <Alert tone="success" title="Saved">
                {save.message}
              </Alert>
            ) : null}
            {save.status === "failed" ? (
              <Alert tone="danger" title="Not saved">
                {save.message}
              </Alert>
            ) : null}
            {sync && sync.consent.status !== "granted" ? (
              <Alert tone="info" title="Not saved">
                Research consent has not been granted, so this run was not saved. You can grant it on the
                Digital Twin page.
              </Alert>
            ) : null}
            <p className="text-xs text-ink-subtle">
Scored results update your progress and Digital Twin activity view.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => start("scored")}>Run again</Button>
              <ButtonLink href="/participant/activities" variant="outline">
                Back to library
              </ButtonLink>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <HistoryCard serverRuns={sync?.planningPuzzleRuns ?? null} thisVisit={thisVisit} />
    </div>
  );
}

function HistoryCard({
  serverRuns,
  thisVisit,
}: {
  /** Null when the app is not connected to the research backend. */
  serverRuns: PlanningPuzzleRunView[] | null;
  thisVisit: { id: string; at: string; summary: PlanningPuzzleSummary }[];
}) {
  const rows =
    serverRuns !== null
      ? serverRuns.map((run) => ({
          id: run.id,
          at: run.completedAt,
          solved: `${run.solvedCount} of ${run.puzzleCount}`,
          extra: run.meanExtraMoves,
          planning: run.meanPlanningTimeMs,
        }))
      : thisVisit.map((run) => ({
          id: run.id,
          at: run.at,
          solved: `${run.summary.solvedCount} of ${run.summary.puzzleCount}`,
          extra: run.summary.meanExtraMoves,
          planning: run.summary.meanPlanningTimeMs,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Planning Puzzle runs</CardTitle>
        <CardDescription>
          {serverRuns !== null
            ? "Scored runs saved to the research backend with your consent, newest first."
            : "This list shows current-visit runs. View activity history for results saved to your account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">No scored runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm text-ink-muted">
              <caption className="sr-only">Previous scored Planning Puzzle runs</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="py-1.5 pr-3 font-medium">When</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Solved</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Extra moves</th>
                  <th scope="col" className="py-1.5 font-medium">Planning time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink">{formatDateTime(row.at)} UTC</th>
                    <td className="py-1.5 pr-3 font-mono">{row.solved}</td>
                    <td className="py-1.5 pr-3 font-mono">{show(row.extra)}</td>
                    <td className="py-1.5 font-mono">{seconds(row.planning)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
