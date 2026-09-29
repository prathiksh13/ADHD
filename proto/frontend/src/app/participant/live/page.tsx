import type { Metadata } from "next";
import { Radio, WifiOff } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Notice } from "@/components/ui/notice";
import { KeyValueList, Panel } from "@/components/ui/data";
import { LiveMonitor } from "@/components/eeg/live-monitor";
import { STREAM_ENDPOINT, isLiveModeEnabled } from "@/lib/websocket";

export const metadata: Metadata = {
  title: "Live capture",
  description: "Live EEG capture from a device bridge. Not available in this build.",
};

export default function ParticipantLivePage() {
  const supported = isLiveModeEnabled();

  return (
    <>
      <PageHeader
        title="Live capture"
        icon={Radio}
        breadcrumb={[
          { label: "Participant", href: "/participant/dashboard" },
          { label: "Live" },
        ]}
        description="Stream EEG straight from a device bridge. The current build records offline uploads instead."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        {supported ? (
          <LiveMonitor sessionId="live-preview" />
        ) : (
          <Panel>
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-md bg-surface-sunken text-ink-subtle">
                <WifiOff className="size-5" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">
                  Live capture is not available in this build
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-ink-muted">
                  Streaming needs a hardware bridge between the EEG device and this application.
                  The supported workflow today is to record offline and upload the file, then run
                  the same processing and analysis stages on it.
                </p>
              </div>
            </div>
          </Panel>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Why this screen exists" description="Planned capability, not shipped work.">
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              The interface is already designed around a live signal so recording, monitoring and
              task blocks can share one view. The transport is the only missing piece; nothing
              else in the pipeline changes when a device bridge is added.
            </p>
            <KeyValueList
              className="mt-4"
              items={[
                { label: "Transport", value: "WebSocket" },
                { label: "Endpoint", value: STREAM_ENDPOINT("{sessionId}") },
                { label: "Feature flag", value: "NEXT_PUBLIC_LIVE_EEG" },
                {
                  label: "Current state",
                  value: supported ? "enabled" : "disabled",
                },
              ]}
            />
          </Panel>

          <Panel title="Use the offline path instead" description="Same stages, fully supported.">
            <ol className="grid gap-2.5 text-[12.5px] text-ink-muted">
              {[
                "Record the session with your EEG software as an EDF or CSV file.",
                "Upload it on the EEG input screen. Channel labels are validated in the browser.",
                "Watch preprocessing, feature extraction and model inference on the processing screen.",
                "Read the model output and contributing signal features on the result screen.",
              ].map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <Notice tone="info" className="mt-4">
              <p>
                Live capture never affects a clinical decision. Any result produced from a live
                stream would carry the same research-prototype caveat as an uploaded recording.
              </p>
            </Notice>
          </Panel>
        </div>
      </PortalBody>
    </>
  );
}
