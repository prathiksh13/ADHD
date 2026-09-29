"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Info,
  Loader2,
  Radio,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { KeyValueList } from "@/components/ui/data";
import { EEGStatus } from "@/components/eeg/eeg-status";
import { cn } from "@/lib/utils";
import { ACCEPTED_EEG_EXTENSIONS, MAX_UPLOAD_MB, MONTAGE_LABELS, SIGNAL_CONFIG } from "@/lib/constants";
import { formatBytes } from "@/lib/format";

/**
 * EEG input.
 *
 * The browser validates what it can — extension, size, and what the filename
 * suggests about a montage. It does not attempt to parse EDF/BDF headers;
 * channel labels and the sampling rate come from the backend after upload, and
 * a file that omits a sampling rate is reported as undefined rather than
 * assumed to be 128 Hz.
 */
type Staged = {
  file: File;
  extension: string;
  sizeMb: number;
  /** Inferred from the filename only. Advisory, never authoritative. */
  guessedMontage: keyof typeof MONTAGE_LABELS | null;
};

export function EEGUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "validating" | "done">("idle");

  const accept = ACCEPTED_EEG_EXTENSIONS.join(",");

  function stage(file: File) {
    setError(null);

    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ACCEPTED_EEG_EXTENSIONS.includes(extension as (typeof ACCEPTED_EEG_EXTENSIONS)[number])) {
      return setError(
        `${extension || "This file type"} is not supported. Accepted: ${ACCEPTED_EEG_EXTENSIONS.join(", ")}.`,
      );
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_UPLOAD_MB) {
      return setError(
        `File is ${formatBytes(sizeMb)} MB, above the ${MAX_UPLOAD_MB} MB limit.`,
      );
    }

    const upper = file.name.toUpperCase();
    const guessedMontage = upper.includes("CGX")
      ? "cgx29"
      : upper.includes("EPOC")
        ? "epoc14"
        : upper.includes("ADHDATA")
          ? "adhdata"
          : null;

    setStaged({ file, extension, sizeMb, guessedMontage });
  }

  async function onSubmit() {
    if (!staged || phase !== "idle") return;
    setPhase("uploading");
    // `POST /api/sessions/{id}/upload` replaces this. The backend response is
    // what will populate channel labels and the declared sampling rate.
    await new Promise((r) => setTimeout(r, 700));
    setPhase("validating");
    await new Promise((r) => setTimeout(r, 600));
    setPhase("done");
  }

  function reset() {
    setStaged(null);
    setError(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      {/* --------------------------------------------------------- dropzone */}
      <div className="flex flex-col gap-4">
        {!staged ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) stage(file);
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
              dragging
                ? "border-primary-400 bg-primary-50"
                : "border-line-strong bg-surface hover:border-primary-300",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <Upload className="size-5" />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold text-ink">Upload EEG recording</h2>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
              Drag a recording here, or choose a file. Nothing is uploaded until you continue.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) stage(file);
              }}
            />

            <Button
              type="button"
              className="mt-5"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="size-4" />
              Choose file
            </Button>

            <p className="mt-4 font-mono text-[11.5px] text-ink-subtle">
              {ACCEPTED_EEG_EXTENSIONS.join("  ")}
            </p>
            <p className="mt-1 text-[11.5px] text-ink-subtle">
              Maximum {MAX_UPLOAD_MB} MB per file
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-muted">
                <FileUp className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{staged.file.name}</p>
                <p className="mt-0.5 text-[12px] text-ink-muted tabular-nums">
                  {formatBytes(staged.sizeMb)} · {staged.extension}
                </p>
              </div>
              {phase === "idle" ? (
                <button
                  type="button"
                  onClick={reset}
                  aria-label="Remove file"
                  className="rounded p-1.5 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-4">
              <KeyValueList
                columns={2}
                items={[
                  { label: "File size", value: formatBytes(staged.sizeMb) },
                  { label: "Format", value: staged.extension.replace(".", "").toUpperCase() },
                  {
                    label: "Montage (from filename)",
                    value: staged.guessedMontage
                      ? MONTAGE_LABELS[staged.guessedMontage]
                      : "not determinable",
                    hint: staged.guessedMontage
                      ? "Inferred from the filename only. The backend reads the real channel labels."
                      : "The backend reads channel labels from the file header.",
                  },
                  {
                    label: "Sampling rate",
                    value: "read by backend",
                    hint: "Never assumed from the source dataset. A file that omits it is reported as undefined.",
                  },
                ]}
              />
            </div>

            {phase !== "idle" ? (
              <div className="mt-5 rounded-lg border border-line bg-surface-subtle p-4">
                <ul className="flex flex-col gap-2.5">
                  {(["uploading", "validating", "done"] as const).map((step) => {
                    const order = { uploading: 0, validating: 1, done: 2 };
                    const current = order[phase];
                    const at = order[step];
                    const done = at < current || phase === "done";
                    const active = at === current && phase !== "done";
                    return (
                      <li key={step} className="flex items-center gap-2.5">
                        {done ? (
                          <CheckCircle2 className="size-4 shrink-0 text-positive-600" />
                        ) : active ? (
                          <Loader2 className="size-4 shrink-0 animate-spin text-primary-600" />
                        ) : (
                          <span className="size-4 shrink-0 rounded-full border border-line-strong" />
                        )}
                        <span
                          className={cn(
                            "text-[12.5px] font-medium capitalize",
                            done || active ? "text-ink" : "text-ink-subtle",
                          )}
                        >
                          {step === "done" ? "Session created" : step}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3.5 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-subtle">
                  The processing screen is driven by backend stage state. No progress percentage is
                  generated in the browser.
                </p>
              </div>
            ) : null}

            {phase === "done" ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={() => router.push("/participant/session/S-2409-0031/processing")}
                >
                  Follow processing
                </Button>
                <Button variant="secondary" onClick={() => router.push("/participant/experiment")}>
                  Continue to experiment
                </Button>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={onSubmit} disabled={phase !== "idle"}>
                  {phase === "idle" ? (
                    <>
                      <Upload className="size-4" />
                      Upload and create session
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Working…
                    </>
                  )}
                </Button>
                <Button variant="secondary" onClick={reset} disabled={phase !== "idle"}>
                  Choose a different file
                </Button>
              </div>
            )}
          </div>
        )}

        {error ? (
          <Notice tone="critical" icon={<AlertTriangle className="size-4" />} title="File rejected">
            <p>{error}</p>
          </Notice>
        ) : null}
      </div>

      {/* ------------------------------------------------------------ aside */}
      <div className="flex flex-col gap-4">
        <EEGStatus
          state={staged ? "ready" : "idle"}
          source="upload"
          device={staged?.guessedMontage ? MONTAGE_LABELS[staged.guessedMontage] : undefined}
          samplingRateHz={undefined}
          channels={
            staged?.guessedMontage === "cgx29"
              ? 29
              : staged?.guessedMontage === "epoc14"
                ? 14
                : staged?.guessedMontage === "adhdata"
                  ? 19
                  : undefined
          }
        />

        <div className="rounded-lg border border-dashed border-line-strong bg-surface-subtle p-5">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-ink-subtle" />
            <h2 className="text-[13.5px] font-semibold text-ink">Connect an EEG device</h2>
            <Badge tone="outline" className="ml-auto">
              not available
            </Badge>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
            Live acquisition from a connected headset is designed but not implemented. When it
            arrives it will stream over <span className="font-mono text-[11.5px]">/ws/eeg/{"{sessionId}"}</span>{" "}
            and reuse the same waveform, band-power and result components as this offline path.
          </p>
          <Button variant="secondary" size="sm" className="mt-3.5" disabled>
            <Radio className="size-3.5" />
            Connect device
          </Button>
        </div>

        <Notice tone="info" icon={<Info className="size-4" />} title="What happens after upload">
          <ul className="mt-1 flex flex-col gap-1.5">
            <li>· Channel selection and normalisation to the 14-channel EPOC set</li>
            <li>· Artifact rejection, then band-power extraction per 1 s window</li>
            <li>· Grouping into 16-step sequences, never across participants</li>
            <li>· CNN-LSTM inference, then a participant-level result</li>
          </ul>
        </Notice>

        <Notice
          tone="caution"
          icon={<AlertTriangle className="size-4" />}
          title="Sampling rate is verified, not assumed"
        >
          <p>
            A recording without a declared sampling rate cannot be processed in the time domain, so
            the platform reports it as unknown instead of defaulting to{" "}
            {SIGNAL_CONFIG.samplingRateHz} Hz. Spectral features remain computable, but window
            lengths in seconds cannot be asserted.
          </p>
        </Notice>
      </div>
    </div>
  );
}
