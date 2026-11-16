"use client";
import type { CSSProperties } from "react";

export function DashboardAttentionAlert({ active, stage, durationMs }: { active: boolean; stage: number; durationMs: number }) {
  if (!active) return null;
  // Severity increases gradually; the centre remains clear for task stimuli.
  const strength = Math.min(.95, .55 + Math.max(0, durationMs - 2500) / 20_000);
  return <div aria-hidden="true" data-testid="attention-dashboard-alert" data-stage={stage}
    className="attention-radial-alert" style={{ "--attention-alert-strength": strength } as CSSProperties} />;
}
