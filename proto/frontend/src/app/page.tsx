import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Brain,
  Database,
  Eye,
  FlaskConical,
  Layers,
  LineChart,
  Radio,
  ScanLine,
  ShieldCheck,
  Timer,
  Waves,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, StepList } from "@/components/ui/data";
import { PublicPage } from "@/components/layout/public-page";
import { ResearchDisclaimer } from "@/components/layout/research-disclaimer";
import { FREQUENCY_BANDS, SIGNAL_CONFIG } from "@/lib/constants";
import { formatNumber } from "@/lib/format";

const PIPELINE = [
  { label: "EEG input", detail: "Offline dataset upload today; a live device stream through the same interface later." },
  { label: "Preprocessing", detail: "Montage selection, verified sampling rate, per-channel normalisation." },
  { label: "Experiment", detail: "Behavioural task blocks with events aligned to the recording." },
  { label: "Model", detail: "LSTM, CNN-LSTM or CNN-LSTM with temporal attention." },
  { label: "Analysis", detail: "Band power, channel and time importance, confusion and calibration." },
  { label: "Result", detail: "Participant-level research screening output with full provenance." },
];

const PRINCIPLES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Eye,
    title: "The process stays visible",
    body: "Every screen names the stage it represents, so a reviewer can trace what entered the system, how it was processed, and which model produced the output.",
  },
  {
    icon: ShieldCheck,
    title: "No clinical claims",
    body: "Outputs are described as model output and classification probability. The platform never states a diagnosis, and it labels every result as research-only.",
  },
  {
    icon: Database,
    title: "Provenance over polish",
    body: "Fields the source data does not state — sampling rates, class mappings, participant links — are shown as unknown rather than guessed.",
  },
];

const BAND_CHIPS = FREQUENCY_BANDS.filter((b) => b.baseline);

export default function LandingPage() {
  return (
    <PublicPage>
      <main>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(60% 100% at 50% 0%, var(--color-primary-50) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-14 sm:pt-20 sm:pb-20">
          <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Badge tone="primary" className="mb-5">
                <FlaskConical className="size-3" />
                Research prototype
              </Badge>

              <h1 className="text-3xl leading-[1.15] font-semibold tracking-tight text-balance text-ink sm:text-4xl">
                EEG-Based Analysis of Neurological State Changes Associated with ADHD
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-muted">
                A research platform for analysing EEG time-series patterns using deep learning.
                Participants upload a recording, complete an attention task, and receive a
                transparent, model-attributed research screening result.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <ButtonLink href="/login" size="lg">
                  Get started
                  <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/research" variant="secondary" size="lg">
                  Read the methodology
                </ButtonLink>
              </div>

              <p className="mt-4 text-[12.5px] text-ink-subtle">
                Three portals: participant / guardian, doctor / clinician, researcher / admin.
              </p>
            </div>

            <HeroFigure />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- overview */}
      <section id="about" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="section-label">What is the project?</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink">
                ADHD is not a single moment. EEG patterns change over time.
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                Most EEG classification work treats a recording as one static snapshot and reduces
                it to a single number. That discards the part of the signal most relevant to
                attention: how the brain behaves second after second while a task is running.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                This project keeps the temporal structure. Recordings are cut into one-second
                band-power windows, grouped into short sequences, and classified by models built
                to model sequences — LSTM, CNN-LSTM, and CNN-LSTM with temporal attention.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Fact
                icon={Timer}
                title="Temporal resolution"
                value={`${SIGNAL_CONFIG.windowSeconds} s windows · ${SIGNAL_CONFIG.sequenceLength} steps`}
                body={`Each sequence spans ${SIGNAL_CONFIG.sequenceLength} seconds at ${SIGNAL_CONFIG.samplingRateHz} Hz, so the model sees a trajectory rather than a snapshot.`}
              />
              <Fact
                icon={Layers}
                title="Feature space"
                value={`${SIGNAL_CONFIG.channels} channels × ${SIGNAL_CONFIG.bands} bands`}
                body={`${SIGNAL_CONFIG.featuresPerStep} features per timestep. Model input tensor: ${SIGNAL_CONFIG.modelInputShape}.`}
              />
              <Fact
                icon={Brain}
                title="Models compared"
                value="Baseline, CNN, LSTM, CNN-LSTM, +Attention"
                body="Every deep model is measured against a simple band-power baseline and against a purely convolutional encoder."
              />
              <Fact
                icon={LineChart}
                title="Explainability"
                value="Channels, bands, attention, time"
                body="The platform shows which channels, bands and time windows the model relied on — as model-internal evidence, not biological proof."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ band explainer */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="section-label">How EEG analysis works</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink">
                Every window becomes a small spectral fingerprint
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                Each channel is measured for the amount of energy it carries in four
                well-established frequency bands. Those values — not raw samples — are what the
                sequence models actually consume.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                Gamma is available as an explicit experimental extension and is kept out of the
                baseline configuration, so band-set ablations stay honest.
              </p>
            </div>

            <Panel bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {BAND_CHIPS.map((band) => (
                  <li key={band.key} className="flex items-center gap-4 px-5 py-3.5">
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--color-band-${band.key})` }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink">{band.label}</p>
                      <p className="text-[12px] text-ink-muted tabular-nums">{band.range}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10.5px] tracking-[0.05em] text-ink-subtle uppercase">
                        share of features
                      </p>
                      <p className="text-[13px] font-semibold text-ink tabular-nums">25%</p>
                    </div>
                  </li>
                ))}
                <li className="flex items-center gap-4 bg-surface-subtle px-5 py-3.5">
                  <span className="h-8 w-1 shrink-0 rounded-full bg-neutral-300" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink">Gamma</p>
                    <p className="text-[12px] text-ink-muted tabular-nums">30 – 45 Hz</p>
                  </div>
                  <Badge tone="outline">extension only</Badge>
                </li>
              </ul>
            </Panel>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- workflow */}
      <section id="workflow" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="section-label">Research workflow</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink">
                Six stages, all visible in the interface
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                The platform is organised around the same stages as the Python pipeline. Each one
                has a screen, so nothing about the computation is hidden behind a progress bar.
              </p>
              <ButtonLink href="/research" variant="secondary" className="mt-5">
                Full methodology
                <ArrowRight className="size-4" />
              </ButtonLink>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PIPELINE.map((step, i) => (
                <div
                  key={step.label}
                  className="rounded-lg border border-line bg-surface p-4 shadow-card"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-ink-subtle tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <p className="mt-2.5 text-[13.5px] font-semibold text-ink">{step.label}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- architecture */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="section-label">Model architecture</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-balance text-ink">
            Convolution for local structure, recurrence for time
          </h2>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <ArchCard
              title="1D CNN"
              subtitle="Local temporal patterns"
              steps={["Band-power sequence", "1D convolutions", "Pooling", "Dense"]}
              body="No recurrence at all. Included to show how much of the signal is explainable by local structure alone."
            />
            <ArchCard
              title="CNN-LSTM"
              subtitle="Local + temporal"
              steps={["Band-power sequence", "1D CNN", "ReLU / Dropout", "LSTM", "Dense", "Prediction"]}
              body="The convolution stage sharpens local band-power structure; the LSTM stage models how that structure evolves across the 16-step window."
              featured
            />
            <ArchCard
              title="CNN-LSTM + Attention"
              subtitle="Local + temporal + weighting"
              steps={["Band-power sequence", "1D CNN", "LSTM", "Temporal attention", "Context vector", "Dense", "Prediction"]}
              body="Adds a learned weight over timesteps. The saved attention weights drive the explainability screen — as model-internal information, not biological evidence."
            />
          </div>

          <div className="mt-8 rounded-lg border border-line bg-surface-subtle p-5">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h3 className="text-[14px] font-semibold text-ink">Multimodal extension</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                  Behavioural information is tracked alongside EEG so three research views can be
                  compared independently: EEG only, behaviour only, and EEG + behaviour. Fusion is
                  only attempted where participant-level linkage is verifiable.
                </p>
              </div>
              <div className="rounded-md border border-line bg-surface p-4 font-mono text-[11.5px] leading-relaxed text-ink-muted">
                <pre className="overflow-x-auto">
                  {`EEG     → CNN → LSTM → Attention → EEG embedding
                                              \\
                                               Fusion → Dense → Prediction
                                              /
Behavior → MLP → Behavior embedding`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- temporal why */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="section-label">Why temporal EEG matters</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink">
                Attention is a process, and processes have transitions
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                Sustained attention is not constant within a single task block. Averages across a
                whole recording flatten those transitions, and a flat signal hides exactly the
                variation a recurrent model is designed to exploit.
              </p>
            </div>

            <StepList
              steps={[
                {
                  label: "Sequences preserve order",
                  detail:
                    "Sixteen consecutive one-second windows are read in order. A model can learn that step 22 means something different from step 6.",
                },
                {
                  label: "Sequences never cross participants",
                  detail:
                    "Grouping is done at participant level, so no sequence can mix signals from two people — the most common source of leakage in EEG studies.",
                },
                {
                  label: "Attention exposes the trajectory",
                  detail:
                    "A learned weight per timestep makes the model's preferred moments inspectable instead of opaque.",
                },
                {
                  label: "Evaluation is participant-level",
                  detail:
                    "Window predictions are aggregated to one result per person before scoring, so a long recording cannot inflate the metric.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- principles */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="section-label">Design principles</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-lg border border-line bg-canvas p-5">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                  <p.icon className="size-4.5" />
                </span>
                <h3 className="mt-3.5 text-[14px] font-semibold text-ink">{p.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- cohorts */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="section-label">Data</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink">
                Public cohorts, documented limits
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                The platform is built on two public sources. Where a source does not state a fact —
                a sampling rate, a class mapping, a participant link — the interface reports it as
                unknown rather than filling in a plausible value.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Stat label="BALLADEER EEG" value="156" unit="participants" />
                <Stat label="BALLADEER labels" value="88 / 50" unit="ADHD / control" />
                <Stat label="adhdata EEG" value="121" unit="participants" />
                <Stat label="Behavioural cohort" value="6,500" unit="rows, unlinked" />
              </div>
            </div>

            <Panel title="Documented constraints" icon={Database}>
              <ul className="flex flex-col gap-3 text-[13px] leading-relaxed text-ink-muted">
                <li>
                  <span className="font-semibold text-ink">20 participants are undetermined.</span>{" "}
                  They are visible in the registry and excluded from binary ADHD/control analysis.
                </li>
                <li>
                  <span className="font-semibold text-ink">adhdata states no sampling rate.</span>{" "}
                  Time-domain processing on that cohort is undefined without external metadata, so
                  the rate is left blank.
                </li>
                <li>
                  <span className="font-semibold text-ink">
                    Diagnosis_Class 0/1/2/3 has no codebook.
                  </span>{" "}
                  It is never converted into ADHD or control.
                </li>
                <li>
                  <span className="font-semibold text-ink">
                    The two EEG cohorts cannot be joined to the behavioural cohort.
                  </span>{" "}
                  Multimodal fusion is limited to the BALLADEER participants where identifiers align.
                </li>
              </ul>
              <ButtonLink href="/research#datasets" variant="secondary" size="sm" className="mt-5">
                Dataset reference
                <ArrowRight className="size-3.5" />
              </ButtonLink>
            </Panel>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- live EEG */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="section-label">Designed for live acquisition</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink">
                Same screens, new input source
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                Today a session starts with a dataset upload. The architecture treats EEG input as
                replaceable: a device bridge would stream over the same WebSocket contract and reuse
                the same waveform, band-power and results components unchanged.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                Live acquisition is designed but not yet implemented. The screens are marked so
                nothing appears available that is not.
              </p>
              <ButtonLink href="/participant/live" variant="secondary" className="mt-5">
                See the live EEG screens
              </ButtonLink>
            </div>

            <div className="rounded-lg border border-line bg-canvas p-5">
              <p className="section-label">Planned pipeline</p>
              <pre className="mt-3 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-ink-muted">
                {`EEG device
    ↓  USB / Bluetooth
BrainFlow / device SDK
    ↓
Python (FastAPI)
    ↓  WebSocket  /ws/eeg/{sessionId}
Next.js frontend
    ↓
Preprocessing → Band power
    ↓
LSTM / CNN-LSTM
    ↓
Research result`}
              </pre>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="outline">
                  <ScanLine className="size-3" />
                  Reuses existing EEG components
                </Badge>
                <Badge tone="outline">
                  <Radio className="size-3" />
                  Backend-driven state
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- final CTA */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-xl border border-line bg-surface p-8 shadow-card sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-balance text-ink">
                  Follow the research from raw signal to model output
                </h2>
                <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
                  Sign in to a portal and walk the full path: dashboard, EEG upload, experiment,
                  processing, results, then the clinician and researcher views.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <ButtonLink href="/login" size="lg">
                    Enter the platform
                    <ArrowRight className="size-4" />
                  </ButtonLink>
                  <ButtonLink href="/about" variant="secondary" size="lg">
                    About the project
                  </ButtonLink>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <PortalLink
                  href="/login"
                  title="Participant / Guardian"
                  body="Upload a recording, run a task, view your own results."
                />
                <PortalLink
                  href="/login"
                  title="Doctor / Clinician"
                  body="Review participants, EEG analytics and research reports."
                />
                <PortalLink
                  href="/login"
                  title="Researcher / Admin"
                  body="Compare models, run experiments, inspect explainability."
                />
              </div>
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <ResearchDisclaimer />
            </div>
          </div>
        </div>
      </section>
      </main>
    </PublicPage>
  );
}

/* ------------------------------------------------------------------ parts */

function HeroFigure() {
  const rows = [
    { channel: "Fz", values: [0.2, 0.55, 0.1, -0.4, -0.7, -0.2, 0.5, 0.9, 0.3, -0.5, -0.85, -0.3, 0.4, 0.75, 0.15, -0.6, -0.9, -0.35, 0.3, 0.6] },
    { channel: "Cz", values: [-0.3, -0.7, -0.2, 0.45, 0.8, 0.25, -0.5, -0.9, -0.3, 0.55, 0.85, 0.2, -0.45, -0.8, -0.25, 0.5, 0.9, 0.35, -0.4, -0.65] },
    { channel: "Pz", values: [0.1, 0.4, -0.1, -0.55, -0.85, -0.3, 0.6, 0.95, 0.4, -0.45, -0.8, -0.15, 0.35, 0.7, 0.05, -0.7, -0.95, -0.4, 0.2, 0.5] },
    { channel: "Oz", values: [-0.15, -0.45, 0.05, 0.6, 0.9, 0.35, -0.55, -0.95, -0.35, 0.5, 0.8, 0.1, -0.4, -0.75, -0.1, 0.65, 0.95, 0.45, -0.35, -0.6] },
  ];

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-raised">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Waves className="size-4 text-primary-700" />
          <p className="text-[12.5px] font-semibold text-ink">Illustrative EEG trace</p>
        </div>
        <Badge tone="neutral">128 Hz · 14 ch</Badge>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.channel} className="flex items-center gap-2.5">
            <span className="w-7 shrink-0 text-[10.5px] font-semibold text-ink-subtle tabular-nums">
              {row.channel}
            </span>
            <svg viewBox="0 0 400 34" preserveAspectRatio="none" className="h-8 min-w-0 flex-1">
              <line
                x1="0"
                y1="17"
                x2="400"
                y2="17"
                stroke="var(--color-line)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={row.values
                  .map((v, i) => `${(i / (row.values.length - 1)) * 400},${17 - v * 14}`)
                  .join(" ")}
                fill="none"
                stroke="var(--color-primary-600)"
                strokeWidth="1.4"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
        <MiniStat label="Window" value="1 s" />
        <MiniStat label="Sequence" value="16 steps" />
        <MiniStat label="Features / step" value={String(SIGNAL_CONFIG.featuresPerStep)} />
        <MiniStat label="Windows / session" value="4,218" />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-subtle">
        Illustrative rendering for interface demonstration. Not a real recording.
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] tracking-[0.04em] text-ink-subtle uppercase">{label}</p>
      <p className="text-[13.5px] font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

function Fact({
  icon: Icon,
  title,
  value,
  body,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary-700" />
        <p className="text-[12px] font-semibold text-ink">{title}</p>
      </div>
      <p className="mt-2.5 text-[14px] font-semibold text-ink">{value}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

function ArchCard({
  title,
  subtitle,
  steps,
  body,
  featured = false,
}: {
  title: string;
  subtitle: string;
  steps: string[];
  body: string;
  featured?: boolean;
}) {
  return (
    <div
      className={
        featured
          ? "rounded-lg border border-primary-300 bg-primary-50/40 p-5"
          : "rounded-lg border border-line bg-surface p-5"
      }
    >
      <div className="flex items-center gap-2">
        <h3 className="text-[14.5px] font-semibold tracking-tight text-ink">{title}</h3>
        {featured ? <Badge tone="primary">primary</Badge> : null}
      </div>
      <p className="mt-0.5 text-[12px] text-ink-subtle">{subtitle}</p>

      <ol className="mt-4 flex flex-col gap-1.5">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2.5">
            <span className="w-4 shrink-0 text-[10.5px] font-semibold text-ink-subtle tabular-nums">
              {i + 1}
            </span>
            <span className="text-[12.5px] text-ink">{step}</span>
            {i < steps.length - 1 ? (
              <span className="ml-auto h-px w-3 bg-line" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-line pt-3.5 text-[12.5px] leading-relaxed text-ink-muted">
        {body}
      </p>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md border border-line bg-surface px-4 py-3">
      <p className="text-[10.5px] font-medium tracking-[0.05em] text-ink-subtle uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-ink tabular-nums">
        {value.startsWith("6,5") ? formatNumber(Number(value.replace(",", ""))) : value}
      </p>
      <p className="text-[11.5px] text-ink-subtle">{unit}</p>
    </div>
  );
}

function PortalLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-line bg-canvas px-4 py-3 transition-colors hover:border-primary-300 hover:bg-primary-50/40"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{body}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary-700" />
    </Link>
  );
}
