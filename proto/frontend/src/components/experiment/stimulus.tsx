"use client";

import { useEffect, useRef, useState } from "react";
import { Hand, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Stimulus } from "@/hooks/useExperiment";

/**
 * CPT-style stimulus panel.
 *
 * The panel is a task surface, not a chart: large targets, generous spacing
 * and keyboard response support. Stimulus events are posted to
 * `POST /api/experiments/event` by the parent so EEG windows stay aligned.
 */
export function Stimulus({
  stimulus,
  index,
  total,
  onRespond,
  disabled,
}: {
  stimulus: Stimulus | null;
  index: number;
  total: number;
  onRespond: (kind: "target" | "distractor") => void;
  disabled?: boolean;
}) {
  /**
   * `armedId` is the id of the stimulus that has been on screen long enough to
   * accept a response. Holding the id (rather than a boolean) means a stale
   * timer can never arm the *next* stimulus, and no state is written
   * synchronously inside the effect.
   */
  const [armedId, setArmedId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stimulus || disabled) return;
    timerRef.current = window.setTimeout(() => setArmedId(stimulus.id), 220);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [stimulus, disabled]);

  const armed = !!stimulus && armedId === stimulus.id;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (disabled || !stimulus) return;
      if (e.key === "1" || e.key.toLowerCase() === "f") onRespond("target");
      if (e.key === "2" || e.key.toLowerCase() === "j") onRespond("distractor");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, onRespond, stimulus]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg border border-line bg-surface-subtle">
        <div className="hairline-grid absolute inset-0 opacity-40" aria-hidden />

        {stimulus && armed ? (
          <div
            className="absolute flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border-2 border-primary-700 bg-primary-50 shadow-raised"
            style={{ left: `${stimulus.position.x}%`, top: `${stimulus.position.y}%` }}
            role="img"
            aria-label={stimulus.label}
          >
            <Hand className="size-6 text-primary-700" />
          </div>
        ) : null}

        <div className="absolute top-3 left-4 flex items-center gap-2 rounded-md bg-surface/90 px-2.5 py-1 text-[11.5px] text-ink-muted">
          Stimulus{" "}
          <span className="font-semibold text-ink tabular-nums">
            {Math.min(index + 1, total)} / {total}
          </span>
        </div>

        {index >= total ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface/95">
            <p className="text-sm font-semibold text-ink">Block complete</p>
            <p className="text-[12.5px] text-ink-muted">Proceed to the post-task recording.</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          className="flex-1"
          disabled={!armed || !stimulus}
          onClick={() => onRespond("target")}
        >
          <Keyboard className="size-4" />
          Respond — target
          <kbd className="ml-1 rounded border border-white/25 px-1 text-[10px] opacity-80">1</kbd>
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="flex-1"
          disabled={!armed || !stimulus}
          onClick={() => onRespond("distractor")}
        >
          <Keyboard className="size-4" />
          Respond — distractor
          <kbd className="ml-1 rounded border border-line-strong px-1 text-[10px] opacity-80">2</kbd>
        </Button>
      </div>

      <p className="text-center text-[11.5px] text-ink-subtle">
        Respond only to target shapes. Every response is time-stamped and aligned to the EEG
        recording on the backend.
      </p>
    </div>
  );
}
