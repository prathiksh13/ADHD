"use client";

import {
  Activity,
  ArrowLeft,
  BrainCircuit,
  FileUp,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError, Label } from "@/components/ui/input";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { clamp, formatPercent } from "@/lib/utils";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILE_LABEL = "50 MB";

type BiomarkerFormat = "percent" | "decimal" | "ratio";

interface BiomarkerDefinition {
  key: string;
  label: string;
  format: BiomarkerFormat;
  requiresEyesOpen?: boolean;
}

interface BiomarkerGroup {
  title: string;
  features: BiomarkerDefinition[];
}

const BIOMARKER_GROUPS: BiomarkerGroup[] = [
  {
    title: "Frontal relative power",
    features: [
      { key: "frontal_delta_rel", label: "Delta (1-4 Hz)", format: "percent" },
      { key: "frontal_theta_rel", label: "Theta (4-8 Hz)", format: "percent" },
      { key: "frontal_alpha_rel", label: "Alpha (8-13 Hz)", format: "percent" },
      { key: "frontal_beta_rel", label: "Beta (13-30 Hz)", format: "percent" },
      { key: "frontal_gamma_rel", label: "Gamma (30-45 Hz)", format: "percent" },
    ],
  },
  {
    title: "Frontocentral relative power",
    features: [
      { key: "frontocentral_delta_rel", label: "Delta (1-4 Hz)", format: "percent" },
      { key: "frontocentral_theta_rel", label: "Theta (4-8 Hz)", format: "percent" },
      { key: "frontocentral_alpha_rel", label: "Alpha (8-13 Hz)", format: "percent" },
      { key: "frontocentral_beta_rel", label: "Beta (13-30 Hz)", format: "percent" },
      { key: "frontocentral_gamma_rel", label: "Gamma (30-45 Hz)", format: "percent" },
    ],
  },
  {
    title: "Frontal-posterior gradients",
    features: [
      {
        key: "frontal_posterior_delta_gradient",
        label: "Delta gradient",
        format: "decimal",
      },
      {
        key: "frontal_posterior_theta_gradient",
        label: "Theta gradient",
        format: "decimal",
      },
      {
        key: "frontal_posterior_alpha_gradient",
        label: "Alpha gradient",
        format: "decimal",
      },
      {
        key: "frontal_posterior_beta_gradient",
        label: "Beta gradient",
        format: "decimal",
      },
      {
        key: "frontal_posterior_gamma_gradient",
        label: "Gamma gradient",
        format: "decimal",
      },
    ],
  },
  {
    title: "Band ratios",
    features: [
      { key: "theta_beta_ratio", label: "Theta / beta", format: "ratio" },
      { key: "theta_alpha_ratio", label: "Theta / alpha", format: "ratio" },
    ],
  },
  {
    title: "Functional connectivity (PLV)",
    features: [
      {
        key: "plv_theta_frontal_interhemispheric",
        label: "Theta F3-F4",
        format: "decimal",
      },
      {
        key: "plv_alpha_frontal_interhemispheric",
        label: "Alpha F3-F4",
        format: "decimal",
      },
      {
        key: "plv_theta_parietal_interhemispheric",
        label: "Theta P3-P4",
        format: "decimal",
      },
      {
        key: "plv_alpha_frontal_posterior",
        label: "Alpha Fz-Pz",
        format: "decimal",
      },
      { key: "plv_beta_frontal_posterior", label: "Beta Fz-Pz", format: "decimal" },
    ],
  },
  {
    title: "Eyes closed / eyes open reactivity",
    features: [
      {
        key: "ec_eo_frontal_theta_reactivity",
        label: "Frontal theta reactivity",
        format: "percent",
        requiresEyesOpen: true,
      },
      {
        key: "ec_eo_frontal_alpha_reactivity",
        label: "Frontal alpha reactivity",
        format: "percent",
        requiresEyesOpen: true,
      },
    ],
  },
];

const BIOMARKER_DEFINITIONS = BIOMARKER_GROUPS.flatMap((group) => group.features);

interface ScoredPrediction {
  prediction: "ADHD" | "Control";
  probability: number;
  threshold: number;
  confidenceLevel: string;
  windowsAnalyzed: number;
  ecEoUsed: boolean;
  frontalThetaRel: number;
  thetaGradient: number;
  ecEoThetaReactivity: number | null;
  biomarkers: Record<string, number>;
}

type AnalysisResult =
  | { status: "scored"; prediction: ScoredPrediction }
  | { status: "unscored"; reason: string };

class EegRequestError extends Error {
  readonly requestId?: string;

  constructor(message: string, requestId?: string) {
    super(message);
    this.name = "EegRequestError";
    this.requestId = requestId;
  }
}

function validateFile(file: File): string | undefined {
  if (file.size === 0) {
    return "The selected file is empty.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return `The file must be ${MAX_FILE_LABEL} or smaller.`;
  }
  return undefined;
}

function errorMessage(status: number, code?: string): string {
  switch (code) {
    case "eeg_model_unavailable":
      return "The ADHD model is not available on the analysis server.";
    case "eeg_file_too_large":
      return `The file must be ${MAX_FILE_LABEL} or smaller.`;
    case "missing_eeg_channels":
    case "ambiguous_eeg_channels":
    case "unexpected_channel_count":
      return "The recording does not contain the required 26 EEG channels.";
    case "recording_too_short":
    case "all_windows_rejected":
    case "no_valid_windows":
      return "The recording is too short or has too many rejected signal windows.";
    case "invalid_eeg_file":
    case "invalid_eeg_recording":
    case "preprocessing_failed":
    case "feature_extraction_failed":
    case "non_finite_features":
    case "eeg_inference_failed":
      return "That file could not be analyzed as an EEG recording.";
    default:
      return status >= 500
        ? "The analysis service is temporarily unavailable."
        : "The file could not be analyzed.";
  }
}

function readPrediction(payload: unknown): AnalysisResult | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Record<string, unknown>;

  if (data.status === "Unscored" || data.prediction === "Unscored") {
    return {
      status: "unscored",
      reason:
        typeof data.reason === "string" && data.reason.trim()
          ? data.reason
          : "The recording could not be interpreted as EEG data.",
    };
  }

  const highlights = data.biomarker_highlights;
  const breakdown = data.biomarker_breakdown;

  if (
    (data.prediction !== "ADHD" && data.prediction !== "Control") ||
    typeof data.probability !== "number" ||
    typeof data.threshold !== "number" ||
    typeof data.confidence_level !== "string" ||
    typeof data.windows_analyzed !== "number" ||
    typeof data.ec_eo_recording_used !== "boolean" ||
    typeof highlights !== "object" ||
    highlights === null ||
    typeof breakdown !== "object" ||
    breakdown === null
  ) {
    return null;
  }

  const biomarkers = highlights as Record<string, unknown>;
  const breakdownValues = breakdown as Record<string, unknown>;

  if (
    typeof biomarkers.frontal_theta_rel !== "number" ||
    typeof biomarkers.frontal_posterior_theta_gradient !== "number" ||
    (biomarkers.ec_eo_theta_reactivity !== null &&
      typeof biomarkers.ec_eo_theta_reactivity !== "number")
  ) {
    return null;
  }

  for (const definition of BIOMARKER_DEFINITIONS) {
    if (typeof breakdownValues[definition.key] !== "number") {
      return null;
    }
  }

  return {
    status: "scored",
    prediction: {
      prediction: data.prediction,
      probability: data.probability,
      threshold: data.threshold,
      confidenceLevel: data.confidence_level,
      windowsAnalyzed: data.windows_analyzed,
      ecEoUsed: data.ec_eo_recording_used,
      frontalThetaRel: biomarkers.frontal_theta_rel,
      thetaGradient: biomarkers.frontal_posterior_theta_gradient,
      ecEoThetaReactivity: biomarkers.ec_eo_theta_reactivity,
      biomarkers: Object.fromEntries(
        BIOMARKER_DEFINITIONS.map((definition) => [
          definition.key,
          breakdownValues[definition.key] as number,
        ]),
      ),
    },
  };
}

async function requestPrediction(
  baseUrl: string,
  ecFile: File,
  eoFile: File | null,
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("restEC_file", ecFile, ecFile.name);
  if (eoFile) {
    form.append("restEO_file", eoFile, eoFile.name);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/predict`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
  } catch {
    throw new EegRequestError(
      "The analysis service could not be reached. Check that the backend is running.",
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const envelope =
      typeof payload === "object" && payload !== null
        ? (payload as { error?: { code?: unknown; requestId?: unknown } }).error
        : undefined;
    const code = typeof envelope?.code === "string" ? envelope.code : undefined;
    const requestId =
      typeof envelope?.requestId === "string" ? envelope.requestId : undefined;
    throw new EegRequestError(errorMessage(response.status, code), requestId);
  }

  const prediction = readPrediction(payload);
  if (!prediction) {
    throw new EegRequestError("The analysis service returned an unexpected result.");
  }
  return prediction;
}

function formatBiomarkerValue(value: number, format: BiomarkerFormat): string {
  switch (format) {
    case "percent":
      return formatPercent(value, { digits: 1, fromRatio: true });
    case "ratio":
      return value.toFixed(2);
    default:
      return value.toFixed(3);
  }
}

function PredictionResult({ result }: { result: ScoredPrediction }) {
  const isAdhd = result.prediction === "ADHD";
  const biomarkers = [
    {
      label: "Frontal theta",
      value: formatPercent(result.frontalThetaRel, {
        digits: 1,
        fromRatio: true,
      }),
      detail: "Relative frontal theta power",
    },
    {
      label: "Frontal-posterior gradient",
      value: result.thetaGradient.toFixed(3),
      detail: "Theta distribution across the scalp",
    },
    ...(result.ecEoThetaReactivity === null
      ? []
      : [
          {
            label: "Eyes open reactivity",
            value: formatPercent(result.ecEoThetaReactivity, {
              digits: 1,
              fromRatio: true,
            }),
            detail: "Change in frontal theta from eyes closed to eyes open",
          },
        ]),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prediction result</CardTitle>
        <CardDescription>Model output from the uploaded recording.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-line bg-slate-50/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                Model estimate
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">
                {result.prediction}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={isAdhd ? "warning" : "success"} dot>
                {isAdhd ? "ADHD pattern" : "Control pattern"}
              </Badge>
              <Badge tone="outline">{result.confidenceLevel} confidence</Badge>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink-muted">ADHD probability</span>
              <span className="font-mono text-2xl font-semibold text-ink">
                {formatPercent(result.probability, {
                  digits: 1,
                  fromRatio: true,
                })}
              </span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className={isAdhd ? "h-full rounded-full bg-demo" : "h-full rounded-full bg-success"}
                style={{
                  width: `${clamp(result.probability * 100, 0, 100)}%`,
                }}
              />
              <span
                aria-hidden="true"
                className="absolute top-0 h-full w-0.5 bg-ink/70"
                style={{
                  left: `${clamp(result.threshold * 100, 0, 100)}%`,
                }}
              />
            </div>
            <p className="text-xs leading-5 text-ink-subtle">
              Decision threshold:{" "}
              {formatPercent(result.threshold, { digits: 0, fromRatio: true })}
            </p>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line p-3">
            <dt className="text-xs text-ink-subtle">Windows analyzed</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-ink">
              {result.windowsAnalyzed}
            </dd>
          </div>
          <div className="rounded-lg border border-line p-3">
            <dt className="text-xs text-ink-subtle">Model threshold</dt>
            <dd className="mt-1 font-mono text-lg font-semibold text-ink">
              {formatPercent(result.threshold, { digits: 0, fromRatio: true })}
            </dd>
          </div>
        </dl>

        <div>
          <h3 className="text-sm font-semibold text-ink">Biomarker highlights</h3>
          <dl className="mt-2 divide-y divide-line rounded-lg border border-line">
            {biomarkers.map((biomarker) => (
              <div
                key={biomarker.label}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div>
                  <dt className="text-sm text-ink">{biomarker.label}</dt>
                  <dd className="text-xs text-ink-subtle">{biomarker.detail}</dd>
                </div>
                <dd className="shrink-0 font-mono text-sm font-semibold text-ink">
                  {biomarker.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">
              Full biomarker breakdown
            </h3>
            <Badge tone="outline">
              {result.ecEoUsed ? "Eyes closed + eyes open" : "Eyes closed only"}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-subtle">
            All 24 model input features. Reactivity values require an optional
            Eyes Open recording.
          </p>
          <div className="mt-3 space-y-3">
            {BIOMARKER_GROUPS.map((group) => (
              <section
                key={group.title}
                className="rounded-lg border border-line p-3"
              >
                <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                  {group.title}
                </h4>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  {group.features.map((feature) => {
                    const unavailable =
                      feature.requiresEyesOpen && !result.ecEoUsed;
                    return (
                      <div
                        key={feature.key}
                        className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2"
                      >
                        <dt className="text-xs text-ink-muted">{feature.label}</dt>
                        <dd className="shrink-0 font-mono text-xs font-semibold text-ink">
                          {unavailable
                            ? "EO required"
                            : formatBiomarkerValue(
                                result.biomarkers[feature.key],
                                feature.format,
                              )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            ))}
          </div>
        </div>

        <Alert tone="warning" title="Research estimate, not a diagnosis">
          This model output must not be used to diagnose ADHD or make treatment
          decisions. A qualified clinician must interpret any clinical concern.
        </Alert>
      </CardContent>
    </Card>
  );
}

function UnscoredResult({ reason }: { reason: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recording not scored</CardTitle>
        <CardDescription>
          The analysis service received the recordings but could not use them as EEG data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert tone="warning" title="Unscored">
          {reason}
        </Alert>
        <div className="rounded-lg border border-line p-3">
          <p className="text-sm font-medium text-ink">What can be scored</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-ink-subtle">
            <li>BDF, EDF, FIF, or EEGLAB SET recordings.</li>
            <li>MAT files (v5 through v7.3) containing EEG data and channel labels.</li>
            <li>
              At least the core frontal and posterior 10-20 electrodes; missing
              FC/CP/Oz channels are interpolated when possible.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

interface RecordingPickerProps {
  id: string;
  title: string;
  required: boolean;
  file: File | null;
  error?: string;
  hint: string;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

function RecordingPicker({
  id,
  title,
  required,
  file,
  error,
  hint,
  inputRef,
  disabled,
  onChange,
  onClear,
}: RecordingPickerProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{title}</Label>
        <Badge tone={required ? "outline" : "neutral"}>
          {required ? "Required" : "Optional"}
        </Badge>
      </div>
      <div className="rounded-xl border border-dashed border-line-strong bg-slate-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <FileUp aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {file ? file.name : "No file selected"}
              </p>
              <p className="text-xs text-ink-subtle">
                {file
                  ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                  : `Any file type, up to ${MAX_FILE_LABEL}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {file ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              <UploadCloud aria-hidden="true" className="size-4" />
              Choose file
            </Button>
          </div>
        </div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="sr-only"
          onChange={onChange}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
        />
      </div>
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        <p id={`${id}-hint`} className="text-xs leading-5 text-ink-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

export function FirebaseEegUpload() {
  const config = getFrontendConfig();
  const apiBaseUrl = config.valid ? config.apiBaseUrl : null;
  const ecInputRef = useRef<HTMLInputElement>(null);
  const eoInputRef = useRef<HTMLInputElement>(null);

  const [ecFile, setEcFile] = useState<File | null>(null);
  const [eoFile, setEoFile] = useState<File | null>(null);
  const [ecFileError, setEcFileError] = useState<string>();
  const [eoFileError, setEoFileError] = useState<string>();
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  function resetResult() {
    setResult(null);
    setFormError(undefined);
    setRequestId(undefined);
  }

  function selectEcFile(selected: File | null) {
    resetResult();
    if (!selected) {
      setEcFile(null);
      setEcFileError(undefined);
      return;
    }
    const error = validateFile(selected);
    setEcFile(error ? null : selected);
    setEcFileError(error);
  }

  function selectEoFile(selected: File | null) {
    resetResult();
    if (!selected) {
      setEoFile(null);
      setEoFileError(undefined);
      return;
    }
    const error = validateFile(selected);
    setEoFile(error ? null : selected);
    setEoFileError(error);
  }

  function handleEcChange(event: ChangeEvent<HTMLInputElement>) {
    selectEcFile(event.target.files?.item(0) ?? null);
    event.target.value = "";
  }

  function handleEoChange(event: ChangeEvent<HTMLInputElement>) {
    selectEoFile(event.target.files?.item(0) ?? null);
    event.target.value = "";
  }

  function clearEcFile() {
    selectEcFile(null);
    if (ecInputRef.current) ecInputRef.current.value = "";
  }

  function clearEoFile() {
    selectEoFile(null);
    if (eoInputRef.current) eoInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEcFileError = ecFile
      ? undefined
      : "Choose an Eyes Closed recording to analyze.";
    const nextConsentError = consent
      ? undefined
      : "Confirm that you may analyze these files.";

    setEcFileError(nextEcFileError);
    setConsentError(nextConsentError);
    setFormError(undefined);
    setRequestId(undefined);

    if (
      !apiBaseUrl ||
      nextEcFileError ||
      eoFileError ||
      nextConsentError ||
      !ecFile
    ) {
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      setResult(await requestPrediction(apiBaseUrl, ecFile, eoFile));
    } catch (error) {
      if (error instanceof EegRequestError) {
        setFormError(error.message);
        setRequestId(error.requestId);
      } else {
        setFormError("The files could not be analyzed. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="EEG ADHD screening"
        description="Upload Eyes Closed and optional Eyes Open EEG recordings for a research-model ADHD or Control estimate. Files are processed transiently and are not saved."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={apiBaseUrl ? "success" : "warning"} dot>
              {apiBaseUrl ? "Model connected" : "Backend missing"}
            </Badge>
            <Badge tone="outline">Not a diagnosis</Badge>
            <span className="text-xs text-ink-subtle">
              Files are not stored by the analysis service
            </span>
          </div>
        }
        actions={
          <ButtonLink href="/participant" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to overview
          </ButtonLink>
        }
      />

      {!apiBaseUrl ? (
        <Alert tone="warning" title="Analysis backend not configured">
          Set <span className="font-mono">NEXT_PUBLIC_API_BASE_URL</span> to the
          FastAPI backend URL, then restart the frontend. Example:{" "}
          <span className="font-mono">http://localhost:8000</span>.
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload recordings</CardTitle>
            <CardDescription>
              Eyes Closed is required. Adding Eyes Open enables the EC-EO
              reactivity features. Files that cannot be read as EEG return an
              Unscored reason instead of a prediction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {formError ? (
                <Alert tone="danger" title="Analysis failed">
                  <p>{formError}</p>
                  {requestId ? (
                    <p className="mt-1 font-mono text-xs">Request ID: {requestId}</p>
                  ) : null}
                </Alert>
              ) : null}

              <RecordingPicker
                id="restEC-file"
                title="Eyes Closed recording"
                required
                file={ecFile}
                error={ecFileError}
                hint="Required. BDF, EDF, FIF, SET, or MAT (v5-v7.3). Core 10-20 channels are harmonized to the 26-channel model."
                inputRef={ecInputRef}
                disabled={submitting}
                onChange={handleEcChange}
                onClear={clearEcFile}
              />

              <RecordingPicker
                id="restEO-file"
                title="Eyes Open recording"
                required={false}
                file={eoFile}
                error={eoFileError}
                hint="Optional. Adds frontal theta and alpha reactivity to the 24-feature vector."
                inputRef={eoInputRef}
                disabled={submitting}
                onChange={handleEoChange}
                onClear={clearEoFile}
              />

              <div className="space-y-1.5">
                <label className="flex items-start gap-2.5 text-sm leading-6 text-ink-muted">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => {
                      setConsent(event.target.checked);
                      setConsentError(undefined);
                    }}
                    disabled={submitting}
                    aria-invalid={Boolean(consentError)}
                    aria-describedby={consentError ? "eeg-consent-error" : undefined}
                    className="mt-1 size-4 shrink-0 rounded border-line-strong accent-brand-700"
                  />
                  <span>
                    I confirm I have permission to analyze these files and
                    understand that the result is a research estimate, not a
                    diagnosis.
                  </span>
                </label>
                {consentError ? (
                  <FieldError id="eeg-consent-error">{consentError}</FieldError>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-5">
                <Button type="submit" disabled={submitting || !apiBaseUrl}>
                  {submitting ? (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <BrainCircuit aria-hidden="true" className="size-4" />
                  )}
                  {submitting ? "Analyzing recordings..." : "Analyze recordings"}
                </Button>
                <ButtonLink href="/participant" variant="outline">
                  Cancel
                </ButtonLink>
              </div>
              <p aria-live="polite" className="sr-only">
                {submitting ? "Analyzing the uploaded recordings." : ""}
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {result ? (
            result.status === "unscored" ? (
              <UnscoredResult reason={result.reason} />
            ) : (
              <PredictionResult result={result.prediction} />
            )
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>What the result includes</CardTitle>
                <CardDescription>
                  One integrated model estimate plus the full set of EEG features
                  used by the classifier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    icon: BrainCircuit,
                    title: "ADHD or Control estimate",
                    detail:
                      "The model probability is compared with its decision threshold.",
                  },
                  {
                    icon: Activity,
                    title: "Full biomarker breakdown",
                    detail:
                      "All 24 bandpower, gradient, ratio, connectivity, and EC-EO reactivity features.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Transient processing",
                    detail:
                      "Uploaded bytes are analyzed in memory and are not saved to your account.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <item.icon aria-hidden="true" className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-ink">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-ink-subtle">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
                <Alert tone="info" title="Before you upload">
                  Upload a required Eyes Closed recording and, if available, an
                  Eyes Open recording with named 10-20 channels. Files that
                  cannot be mapped to EEG return an Unscored reason instead of a
                  prediction.
                </Alert>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
