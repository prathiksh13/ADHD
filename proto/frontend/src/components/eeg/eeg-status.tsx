import { CircleDot, Gauge, Radio, Waves, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";

/** Compact EEG source status, used on dashboards and the input screen. */
export function EEGStatus({
  state,
  device,
  samplingRateHz,
  channels,
  quality,
  source,
  className,
}: {
  state: "idle" | "ready" | "recording" | "processing" | "unsupported";
  device?: string;
  samplingRateHz?: number;
  channels?: number;
  quality?: number;
  source: "upload" | "live";
  className?: string;
}) {
  const config = {
    idle: { tone: "neutral" as const, dot: "neutral" as const, label: "Not connected" },
    ready: { tone: "positive" as const, dot: "positive" as const, label: "Data ready" },
    recording: { tone: "primary" as const, dot: "primary" as const, label: "Recording" },
    processing: { tone: "caution" as const, dot: "caution" as const, label: "Processing" },
    unsupported: { tone: "neutral" as const, dot: "neutral" as const, label: "Not available" },
  }[state];

  const Icon = source === "live" ? Radio : Waves;

  return (
    <Card className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-surface-sunken text-ink-muted">
            <Icon className="size-3.5" />
          </span>
          <p className="section-label">EEG status</p>
        </div>
        <Badge tone={config.tone}>
          <StatusDot tone={config.dot} pulse={state === "recording"} />
          {config.label}
        </Badge>
      </div>

      {source === "live" ? (
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          Live acquisition requires a connected EEG device. The offline upload workflow below is
          fully functional now; the device path is designed but not implemented.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Field label="Source" value={source === "live" ? "EEG device" : "Uploaded file"} />
        <Field label="Device" value={device ?? "—"} />
        <Field label="Sampling rate" value={samplingRateHz ? `${samplingRateHz} Hz` : "—"} />
        <Field label="Channels" value={channels ? String(channels) : "—"} />
        {quality !== undefined ? (
          <Field label="Signal quality" value={`${(quality * 100).toFixed(1)}%`} />
        ) : null}
        <Field label="Window / sequence" value="1 s · 16 steps" />
      </dl>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium text-ink-subtle">{label}</dt>
      <dd className="text-[13px] font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

/** Row of live signal-quality facts shown beside a waveform. */
export function SignalQualityBar({
  quality,
  artifactWindows,
  totalWindows,
  flatlineRatio,
}: {
  quality: number;
  artifactWindows: number;
  totalWindows: number;
  flatlineRatio: number;
}) {
  const usable = totalWindows - artifactWindows;
  const good = quality >= 0.85 && usable / Math.max(1, totalWindows) >= 0.92;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Metric
        icon={Gauge}
        label="Signal quality"
        value={`${(quality * 100).toFixed(1)}%`}
        hint={quality >= 0.85 ? "Above threshold" : "Below 85% — review"}
        tone={quality >= 0.85 ? "positive" : "caution"}
      />
      <Metric
        icon={CircleDot}
        label="Usable windows"
        value={`${usable} / ${totalWindows}`}
        hint="Passed artifact rejection"
        tone={good ? "positive" : "caution"}
      />
      <Metric
        icon={Zap}
        label="Artifact windows"
        value={String(artifactWindows)}
        hint="Excluded from sequences"
        tone={artifactWindows === 0 ? "positive" : "caution"}
      />
      <Metric
        icon={Waves}
        label="Flatline ratio"
        value={`${(flatlineRatio * 100).toFixed(2)}%`}
        hint="Below 1% is expected"
        tone={flatlineRatio < 0.01 ? "positive" : "caution"}
      />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: "positive" | "caution";
}) {
  return (
    <div className="rounded-md border border-line bg-surface-subtle px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-ink-subtle" />
        <p className="text-[11px] font-medium text-ink-subtle">{label}</p>
      </div>
      <p className="mt-1 text-[15px] font-semibold text-ink tabular-nums">{value}</p>
      <p
        className={cn(
          "mt-0.5 text-[11px]",
          tone === "positive" ? "text-positive-600" : "text-caution-600",
        )}
      >
        {hint}
      </p>
    </div>
  );
}
