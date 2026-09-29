"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Cpu, RefreshCw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { KeyValueList } from "@/components/ui/data";
import { PipelineTimeline, stageProgress } from "@/components/session/pipeline-timeline";
import { useSession } from "@/hooks/useSession";
import { formatDateTime, formatDuration } from "@/lib/format";

/**
 * Processing screen.
 *
 * Purely a function of backend stage state. There is no client-side progress
 * model, no percentage that advances on a timer, and no stage that completes
 * because enough time passed.
 */
export function ProcessingTracker({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { session, loading, error } = useSession(sessionId, { poll: true });

  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center">
        <RefreshCw className="mx-auto size-4 animate-spin text-ink-subtle" />
        <p className="mt-3 text-[13px] text-ink-muted">Reading session state…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <Notice tone="critical" icon={<TriangleAlert className="size-4" />} title="Session unavailable">
        <p>{error ?? "This session could not be loaded."}</p>
        <ButtonLink href="/participant/history" variant="secondary" size="sm" className="mt-3">
          Back to history
        </ButtonLink>
      </Notice>
    );
  }

  const progress = stageProgress(session.stages);
  const complete = session.status === "complete";
  const failed = session.status === "failed";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="flex flex-col gap-4">
        {failed ? (
          <Notice tone="critical" icon={<TriangleAlert className="size-4" />} title="Processing failed">
            <p>
              {session.flagReason ??
                "The backend reported a failure at this stage. No result was produced."}
            </p>
          </Notice>
        ) : null}

        {session.flagged && !failed ? (
          <Notice tone="caution" icon={<TriangleAlert className="size-4" />} title="Session flagged">
            <p>
              {session.flagReason ??
                "Part of this recording was excluded during artifact rejection. Fewer windows were available to the model."}
            </p>
          </Notice>
        ) : null}

        {complete ? (
          <Notice tone="positive" title="Processing complete">
            <p>
              The model has produced a participant-level research screening result. This is model
              output, not a diagnosis.
            </p>
          </Notice>
        ) : (
          <Notice tone="info" title="State is read from the backend">
            <p>
              Each stage below shows what the processing service has reported. The browser does
              not estimate progress — a stage turns complete only when the backend says so.
            </p>
          </Notice>
        )}

        <div className="rounded-lg border border-line bg-surface p-5">
          <PipelineTimeline stages={session.stages} />
        </div>

        {complete ? (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => router.push(`/participant/session/${session.id}/results`)}>
              View result
              <ArrowRight className="size-4" />
            </Button>
            <ButtonLink href="/participant/history" variant="secondary">
              All sessions
            </ButtonLink>
          </div>
        ) : (
          <p className="text-[12px] text-ink-subtle">
            This screen re-reads the session every few seconds while a stage is running.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">Session</p>
            <span className="font-mono text-[11.5px] text-ink-subtle">{session.id}</span>
          </div>
          <div className="mt-3">
            <KeyValueList
              columns={1}
              items={[
                { label: "Status", value: session.status },
                { label: "Started", value: formatDateTime(session.startedAt) },
                {
                  label: "Completed",
                  value: session.completedAt ? formatDateTime(session.completedAt) : "not yet",
                },
                { label: "Experiment", value: session.experiment },
                { label: "Device", value: session.device },
                { label: "Montage", value: session.montage },
                {
                  label: "Sampling rate",
                  value: `${session.samplingRateHz} Hz`,
                  hint: "As declared by the source file.",
                },
                { label: "Channels", value: String(session.channels) },
                {
                  label: "Duration",
                  value: formatDuration(session.durationSeconds),
                },
                { label: "Windows", value: formatNumber(session.windows) },
                { label: "Sequences", value: formatNumber(session.sequences) },
                { label: "Source", value: session.source === "live" ? "live device" : "file upload" },
              ]}
            />
          </div>
        </div>

        {progress.current ? (
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-primary-800">
              <Cpu className="size-3.5" />
              Current stage: {progress.current.label}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
              {progress.current.operation}
            </p>
            <p className="mt-2.5 border-t border-primary-200 pt-2.5 text-[11.5px] text-ink-subtle tabular-nums">
              {progress.done} of {progress.total} stages reported complete
            </p>
          </div>
        ) : null}

        <p className="rounded-md border border-line bg-surface-subtle p-3 text-[11.5px] leading-relaxed text-ink-subtle">
          Computation runs in the Python pipeline. The frontend is the interface and
          visualisation layer only — it never executes the model.
        </p>
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export function ProcessingNotFound({ sessionId }: { sessionId: string }) {
  return (
    <Notice tone="critical" icon={<TriangleAlert className="size-4" />} title="Session not found">
      <p>
        No session matches{" "}
        <span className="font-mono text-[12px]">{sessionId}</span>.{" "}
        <Link href="/participant/history" className="font-medium underline">
          Return to session history
        </Link>
        .
      </p>
    </Notice>
  );
}
