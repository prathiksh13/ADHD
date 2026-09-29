import type { Metadata } from "next";
import { Activity, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Panel } from "@/components/ui/data";
import { Notice } from "@/components/ui/notice";
import { ChipList, KeyValueList, StepList } from "@/components/ui/data";
import { LiveMonitor } from "@/components/eeg/live-monitor";
import { isLiveModeEnabled } from "@/lib/websocket";
import { SIGNAL_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Live session",
  description: "Run a task block against a live EEG stream. Not available in this build.",
};

export default function LiveSessionPage() {
  const enabled = isLiveModeEnabled();

  return (
    <>
      <PageHeader
        title="Live session"
        icon={Activity}
        breadcrumb={[
          { label: "Researcher", href: "/research/dashboard" },
          { label: "Live session" },
        ]}
        description="Run the rest, task and post-task blocks while the device streams continuously."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        {enabled ? (
          <LiveMonitor sessionId="live-session" />
        ) : (
          <Panel>
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-md bg-surface-sunken text-ink-subtle">
                <CircleAlert className="size-5" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">
                  Live session capture is unavailable
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-ink-muted">
                  A live session needs a device bridge. Until one exists, record offline and upload
                  the file instead — the same stages run over the uploaded recording.
                </p>
              </div>
            </div>
          </Panel>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Planned session shape" description="How a live block would be staged.">
            <StepList
              steps={[
                {
                  label: "Connect",
                  detail: "Open the WebSocket to the device bridge and confirm frames are arriving.",
                },
                {
                  label: "Impedance check",
                  detail: "Verify electrode contact before any data is recorded.",
                },
                {
                  label: "Rest block",
                  detail: "Eyes open then closed, building the resting baseline.",
                },
                {
                  label: "Task block",
                  detail: "Attention task with time-stamped responses.",
                },
                {
                  label: "Post-task block",
                  detail: "Eyes closed comparison baseline.",
                },
                {
                  label: "Close and process",
                  detail: "Stop the stream and run the identical processing pipeline as an upload.",
                },
              ]}
            />
          </Panel>

          <div className="flex flex-col gap-4">
            <Panel title="Analysis parameters" description="Unchanged from the offline path.">
              <KeyValueList
                items={[
                  { label: "Channels", value: String(SIGNAL_CONFIG.channels) },
                  { label: "Sampling rate", value: `${SIGNAL_CONFIG.samplingRateHz} Hz` },
                  { label: "Window", value: `${SIGNAL_CONFIG.windowSeconds}s` },
                  { label: "Samples per window", value: String(SIGNAL_CONFIG.samplesPerWindow) },
                  { label: "Sequence length", value: String(SIGNAL_CONFIG.sequenceLength) },
                  { label: "Model input", value: SIGNAL_CONFIG.modelInputShape },
                ]}
              />
            </Panel>

            <Panel title="Recorded blocks" description="One capture per block.">
              <ChipList items={["rest", "task", "post-task"]} />
              <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
                Blocks are stored separately so a participant-level prediction can be made per
                block and then compared, which is where the temporal attribution on the
                explainability screen comes from.
              </p>
            </Panel>
          </div>
        </div>

        <Notice tone="caution">
          <p>
            Any output produced from a live stream would carry exactly the same research-prototype
            caveat as an uploaded recording. Live capture changes how the signal arrives, never what
            the result means.
          </p>
        </Notice>
      </PortalBody>
    </>
  );
}
