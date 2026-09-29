import type { Metadata } from "next";
import { CircleHelp, Radio, Usb } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Panel } from "@/components/ui/data";
import { Notice } from "@/components/ui/notice";
import { KeyValueList } from "@/components/ui/data";
import { STREAM_ENDPOINT, isLiveModeEnabled } from "@/lib/websocket";
import { SIGNAL_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Device",
  description: "Device bridge configuration. Not available in this build.",
};

export default function DevicePage() {
  const enabled = isLiveModeEnabled();

  return (
    <>
      <PageHeader
        title="Device"
        icon={Usb}
        breadcrumb={[
          { label: "Researcher", href: "/research/dashboard" },
          { label: "Device" },
        ]}
        description="Configure the bridge between an EEG device and this application."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <Panel>
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-md bg-surface-sunken text-ink-subtle">
              <Radio className="size-5" />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-ink">
                No device bridge is connected
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-ink-muted">
                Live capture needs a local bridge process that reads the device SDK and forwards
                samples over a WebSocket. That process is not part of this build, so there is
                nothing to connect to.
              </p>
            </div>
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Transport contract" description="Fixed now, implemented later.">
            <KeyValueList
              items={[
                { label: "Protocol", value: "WebSocket" },
                { label: "Endpoint", value: STREAM_ENDPOINT("{sessionId}") },
                { label: "Feature flag", value: "NEXT_PUBLIC_LIVE_EEG" },
                { label: "Current state", value: enabled ? "enabled" : "disabled" },
                { label: "API base", value: "NEXT_PUBLIC_API_BASE_URL" },
              ]}
            />
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
              Each frame carries one sample per channel plus an optional device-side quality
              estimate. The interface is written against this shape, so adding a bridge does not
              require changing any screen.
            </p>
          </Panel>

          <Panel title="Expected signal" description="Must match the analysis pipeline.">
            <KeyValueList
              items={[
                { label: "Channels", value: String(SIGNAL_CONFIG.channels) },
                { label: "Sampling rate", value: `${SIGNAL_CONFIG.samplingRateHz} Hz` },
                { label: "Window", value: `${SIGNAL_CONFIG.windowSeconds}s` },
                { label: "Sequence", value: `${SIGNAL_CONFIG.sequenceLength} steps` },
                { label: "Model input", value: SIGNAL_CONFIG.modelInputShape },
              ]}
            />
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
              A bridge that emits a different channel count or rate produces features outside the
              range the model was trained on. The bridge must therefore be configured to match
              these values exactly.
            </p>
          </Panel>
        </div>

        <Notice tone="caution" title="Why this is disabled rather than simulated">
          <p>
            A fake live signal would be indistinguishable from a real one on screen, and the
            resulting output would look like a valid measurement. Until a real bridge exists, this
            screen reports its own absence instead of animating a placeholder trace.
          </p>
        </Notice>

        <Panel title="What to check once a bridge is added" icon={CircleHelp}>
          <ol className="grid gap-2.5 text-[12.5px] text-ink-muted">
            {[
              "Frames arrive continuously and the reported channel names match the montage.",
              "Amplitude stays within a plausible microvolt range rather than clipping.",
              "Electrode impedance passes before a recording is started.",
              "A short offline upload and a live capture of the same rest state give comparable band power.",
            ].map((step, i) => (
              <li key={step} className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </PortalBody>
    </>
  );
}
