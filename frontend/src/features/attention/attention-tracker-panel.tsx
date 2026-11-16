"use client";

import {
  Activity,
  Camera,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttentionTracker } from "@/features/attention/use-attention-tracker";
import { cn } from "@/lib/utils";

function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "brand" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        tone === "warning"
          ? "border-demo-line bg-demo-soft"
          : tone === "brand"
            ? "border-brand-200 bg-brand-50/70"
            : "border-line bg-slate-50/60",
      )}
    >
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-lg font-semibold leading-6 text-ink">
        {value}
      </dd>
      {detail ? (
        <dd className="text-[0.6875rem] leading-4 text-ink-subtle">{detail}</dd>
      ) : null}
    </div>
  );
}

function AlertToast() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] animate-[attention-toast-in_180ms_ease-out] rounded-full border border-demo-line bg-demo-soft px-4 py-2.5 text-sm font-medium text-demo shadow-raised"
    >
      Focus check — eyes back on target
    </div>
  );
}

export function AttentionTrackerPanel({
  tracker,
  className,
}: {
  tracker: AttentionTracker;
  className?: string;
}) {
  const busy =
    tracker.status === "requesting-camera" ||
    tracker.status === "loading-model";
  const denied =
    tracker.status === "denied" ||
    tracker.status === "unsupported" ||
    tracker.status === "error";

  return (
    <>
      {tracker.visualCue ? <AlertToast /> : null}

      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-4 text-brand-700" />
              Focus monitor
            </CardTitle>
            <CardDescription>
              Optional real-time attention check. Video frames are processed in
              this browser tab and are never recorded or uploaded.
            </CardDescription>
          </div>
          <Badge
            tone={tracker.isRunning ? "success" : tracker.status === "complete" ? "brand" : "neutral"}
            dot
          >
            {tracker.isRunning
              ? "On-device · live"
              : tracker.status === "complete"
                ? "Session complete"
                : "Camera off"}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {tracker.status === "idle" ? (
            <>
              <ul className="grid gap-2 text-sm leading-6 text-ink-muted sm:grid-cols-2">
                <li className="flex gap-2">
                  <Eye aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-700" />
                  Gaze, blink and expression are estimated from 478 face
                  landmarks.
                </li>
                <li className="flex gap-2">
                  <Activity aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-700" />
                  Only timestamps and derived numbers are kept for EEG artifact
                  masking.
                </li>
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void tracker.start()}>
                  <Camera aria-hidden="true" className="size-4" />
                  Enable focus monitoring
                </Button>
                <span className="text-xs text-ink-subtle">
                  You can stop at any time. The task works without it.
                </span>
              </div>
            </>
          ) : null}

          {busy ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-3 rounded-lg border border-line bg-slate-50/60 px-4 py-3 text-sm text-ink-muted"
            >
              <Loader2 aria-hidden="true" className="size-4 animate-spin text-brand-700" />
              {tracker.status === "requesting-camera"
                ? "Waiting for camera permission…"
                : "Loading the on-device face model…"}
            </div>
          ) : null}

          {denied ? (
            <Alert
              tone={tracker.status === "denied" ? "warning" : "danger"}
              title="Focus monitoring is off"
            >
              <p>{tracker.error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void tracker.start()}>
                  Try again
                </Button>
              </div>
            </Alert>
          ) : null}

          {tracker.isRunning ? (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Metric
                  label="Gaze"
                  value={tracker.metrics.state === "ON_SCREEN" ? "On screen" : "Away"}
                  detail={
                    tracker.metrics.state === "ON_SCREEN"
                      ? "Eyes on target"
                      : "Looking away"
                  }
                  tone={tracker.metrics.state === "ON_SCREEN" ? "brand" : "warning"}
                />
                <Metric
                  label="Face"
                  value={tracker.metrics.facePresent ? "Detected" : "Not found"}
                  detail="Camera frame"
                  tone={tracker.metrics.facePresent ? "brand" : "warning"}
                />
                <Metric label="Expression" value={tracker.metrics.affect} />
                <Metric
                  label="Blinks"
                  value={String(tracker.metrics.totalBlinks)}
                  detail="This session"
                />
                <Metric
                  label="Blink rate"
                  value={tracker.metrics.blinkRatePerMin.toFixed(1)}
                  detail="per minute"
                />
              </dl>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                <span>Yaw {tracker.metrics.yawDeg.toFixed(0)}°</span>
                <span>Pitch {tracker.metrics.pitchDeg.toFixed(0)}°</span>
                <span>Iris offset {tracker.metrics.irisOffset.toFixed(2)}</span>
                <span>{tracker.fps} FPS</span>
                {tracker.metrics.alertStage >= 1 ? (
                  <span className="font-medium text-demo">
                    Focus cue active
                  </span>
                ) : null}
              </div>

              {tracker.metrics.alertStage === 2 ? (
                <p className="flex items-start gap-2 rounded-lg border border-demo-line bg-demo-soft px-3 py-2 text-xs leading-5 text-demo">
                  <Volume2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  A soft 440 Hz chime played. Audio cues pause for 10 seconds
                  before another chime can play.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={tracker.stop}>
                  <EyeOff aria-hidden="true" className="size-4" />
                  Stop monitoring
                </Button>
                <span className="text-xs text-ink-subtle">
                  Nothing is saved until the scored activity completes.
                </span>
              </div>
            </>
          ) : null}

          {tracker.status === "complete" && tracker.summary ? (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric
                  label="Focus"
                  value={`${tracker.summary.focusPercentage.toFixed(1)}%`}
                  detail="On-screen time"
                  tone="brand"
                />
                <Metric
                  label="Blinks"
                  value={String(tracker.summary.totalBlinks)}
                  detail={`${tracker.summary.meanBlinkRatePerMin.toFixed(1)}/min`}
                />
                <Metric
                  label="Distractions"
                  value={String(tracker.summary.distractionCount)}
                  detail={`${Math.round(tracker.summary.avgRecoveryLatencyMs)} ms recovery`}
                />
                <Metric
                  label="Face visible"
                  value={`${tracker.summary.faceVisiblePercentage.toFixed(0)}%`}
                  detail={`${Math.round(tracker.summary.sessionDurationMs / 1000)} s tracked`}
                />
              </dl>

              {tracker.submitStatus === "sent" ? (
                <p className="text-xs leading-5 text-ink-subtle">
                  Attention telemetry was accepted for analysis. Raw video never
                  left this device.
                </p>
              ) : null}

              {tracker.submitStatus === "failed" ? (
                <Alert tone="warning" title="Attention telemetry was not sent">
                  {tracker.submitError ??
                    "The activity results are unaffected. You can continue without telemetry."}
                </Alert>
              ) : null}

              <Button variant="outline" size="sm" onClick={() => void tracker.start()}>
                <Camera aria-hidden="true" className="size-4" />
                Monitor another run
              </Button>
            </>
          ) : null}

          <details className="rounded-lg border border-line bg-slate-50/60 px-3 py-2 text-xs leading-5 text-ink-muted">
            <summary className="cursor-pointer font-medium text-ink">
              Privacy and limits
            </summary>
            <p className="mt-2">
              Camera frames stay in memory for the duration of this tab. The
              tracker stores only derived values and event timestamps:
              BLINK, DISTRACTION_START, DISTRACTION_END, ALERT_TRIGGERED and
              EMOTION_SHIFT. Affect labels are non-diagnostic UX hints, not
              clinical measurements.
            </p>
          </details>
        </CardContent>
      </Card>
    </>
  );
}
