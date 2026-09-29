import type { Metadata } from "next";
import {
  Filter,
  Layers,
  ListChecks,
  Ruler,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Split,
  Table2,
} from "lucide-react";
import { PublicPage } from "@/components/layout/public-page";
import { ResearchDisclaimer } from "@/components/layout/research-disclaimer";
import { ChipList, KeyValueList, Panel, StepList } from "@/components/ui/data";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  DATASETS,
  FREQUENCY_BANDS,
  PIPELINE_STAGES,
  SIGNAL_CONFIG,
  type DatasetRecord,
} from "@/lib/constants";
import { formatNumber } from "@/lib/format";

/**
 * Participant populations, kept separate so the per-class splits are never
 * read as if they applied to a cohort they were not published for.
 */
const POPULATIONS: {
  label: string;
  total: number;
  adhd: number | null;
  control: number | null;
  undetermined: number | null;
}[] = [
  { label: "BALLADEER demographics", total: 158, adhd: 88, control: 50, undetermined: 20 },
  { label: "BALLADEER EEG + behaviour", total: 156, adhd: null, control: null, undetermined: null },
  { label: "adhdata EEG", total: 121, adhd: 61, control: 60, undetermined: 0 },
  { label: "EEG_ONLY view (all sources)", total: 277, adhd: 147, control: 110, undetermined: 20 },
  { label: "adhd_data_behaviour (no IDs)", total: 6500, adhd: null, control: null, undetermined: null },
];

/** Never render a class count that the source does not publish. */
function classChips(dataset: DatasetRecord) {
  const parts: string[] = [];
  if (dataset.adhd !== null) parts.push(`ADHD-associated ${dataset.adhd}`);
  if (dataset.control !== null) parts.push(`Control ${dataset.control}`);
  if (dataset.undetermined !== null) parts.push(`Undetermined ${dataset.undetermined}`);
  if (dataset.unknown) parts.push(`Unclassified ${dataset.unknown}`);
  if (!parts.length) return ["per-class split not published"];
  return parts;
}

export const metadata: Metadata = {
  title: "Research Methodology",
  description:
    "Dataset, preprocessing, band-power feature extraction, sequence construction, LSTM / CNN-LSTM training, evaluation and interpretation — with documented data limitations.",
};

export default function ResearchPage() {
  return (
    <PublicPage>
      {/* -------------------------------------------------------- overview */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="section-label">Methodology</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance text-ink">
            From a public dataset to an attributable model output
          </h1>
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink-muted">
            Every step below is a place where a plausible-looking shortcut could quietly change the
            result. They are written out explicitly, including the places where the available data
            does not support the step people would want to take.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#methodology">Pipeline</ButtonLink>
            <ButtonLink href="#evaluation" variant="secondary">
              Evaluation
            </ButtonLink>
            <ButtonLink href="#datasets" variant="secondary">
              Datasets
            </ButtonLink>
            <ButtonLink href="#limitations" variant="ghost">
              Limitations
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ methodology */}
      <section id="methodology" className="scroll-mt-20 border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="section-label">Pipeline</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink">
                Seven stages, in order
              </h2>

              <div className="mt-8">
                <StepList
                  steps={[
                    {
                      label: "Dataset",
                      detail:
                        "A labelled public cohort is selected and the participant count, channel count, sampling rate and label distribution are recorded before any processing.",
                    },
                    {
                      label: "Preprocessing",
                      detail:
                        "The recording is read with the correct montage, the sampling rate is verified rather than assumed, and each channel is normalised.",
                    },
                    {
                      label: "Feature extraction",
                      detail: `Welch-style band power is computed per channel for ${FREQUENCY_BANDS.filter((b) => b.baseline).length} baseline bands, plus gamma as a declared extension.`,
                    },
                    {
                      label: "Time-series construction",
                      detail: `Band-power values are grouped into ${SIGNAL_CONFIG.sequenceLength}-step sequences of ${SIGNAL_CONFIG.windowSeconds}s windows. Grouping never crosses a participant boundary.`,
                    },
                    {
                      label: "LSTM / CNN-LSTM",
                      detail:
                        "The sequence is encoded, classified, and attention weights are retained when the architecture produces them.",
                    },
                    {
                      label: "Evaluation",
                      detail:
                        "Sequences are aggregated to one prediction per participant before scoring, so no single recording can inflate a metric.",
                    },
                    {
                      label: "Interpretation",
                      detail:
                        "Channel, band, attention and temporal importance are reported as model-internal evidence, alongside the metrics.",
                    },
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              <Panel title="Stage registry" description="The same stage keys the backend reports progress against.">
                <ul className="flex flex-col">
                  {PIPELINE_STAGES.map((stage, i) => (
                    <li
                      key={stage.key}
                      className="flex items-center gap-3 border-b border-line py-2.5 last:border-0 last:pb-0 first:pt-0"
                    >
                      <span className="w-4 shrink-0 text-[10.5px] font-semibold text-ink-subtle tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[13px] font-medium text-ink">{stage.label}</span>
                      <span className="ml-auto font-mono text-[10.5px] text-ink-subtle">
                        {stage.key}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-subtle">
                  The processing screen is driven by these keys. Progress is never simulated — a
                  stage shows complete only when the backend says so.
                </p>
              </Panel>

              <Panel title="Derived tensor" icon={Layers}>
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Channels", value: SIGNAL_CONFIG.channels },
                    { label: "Bands", value: SIGNAL_CONFIG.bands },
                    { label: "Window", value: `${SIGNAL_CONFIG.windowSeconds} s` },
                    { label: "Sequence", value: `${SIGNAL_CONFIG.sequenceLength} steps` },
                    {
                      label: "Features / step",
                      value: SIGNAL_CONFIG.featuresPerStep,
                      hint: `${SIGNAL_CONFIG.channels} × ${SIGNAL_CONFIG.bands}`,
                    },
                    {
                      label: "Model input",
                      value: SIGNAL_CONFIG.modelInputShape,
                      hint: "samples × timesteps × features",
                    },
                  ]}
                />
              </Panel>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- safeguards */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="section-label">Integrity</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-balance text-ink">
            The four mistakes this pipeline is built to prevent
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Guard
              icon={Split}
              title="Participant leakage"
              body="Overlapping sequences from one participant are highly correlated. If they cross the train/test split, the model is scored on data it has effectively memorised. Grouping is done at participant level, so this cannot occur."
            />
            <Guard
              icon={Ruler}
              title="Window-level scoring"
              body="A long recording yields many windows. Scoring per window makes a 60-minute recording count 3,600 times. Predictions are aggregated to one result per participant before any metric is computed."
            />
            <Guard
              icon={SlidersHorizontal}
              title="Assumed sampling rate"
              body="Where a source file does not state its sampling rate, time-domain processing is undefined. The platform reports it as unknown instead of defaulting, because a wrong rate silently rescales every band."
            />
            <Guard
              icon={Filter}
              title="Unresolved labels"
              body="A label column with no codebook cannot be mapped to classes. Such a column is carried as an unresolved category and excluded from binary analysis, never guessed at."
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- evaluation */}
      <section id="evaluation" className="scroll-mt-20 border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="section-label">Evaluation</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink">
                What is measured, and what is deliberately not
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                The headline metric is a band-power baseline, and it is not a formality. If a deep
                sequence model cannot beat it, the sequence machinery is not earning its complexity
                and the honest conclusion is that the extra structure did not help.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                Every model is reported on the same metric set, from the same evaluation, so the
                comparison is like-for-like.
              </p>
            </div>

            <Panel title="Reported metrics" icon={ListChecks}>
              <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {[
                  ["Accuracy", "Participant-level, after aggregation."],
                  ["F1", "Harmonic mean of precision and recall."],
                  ["Sensitivity", "Share of ADHD-associated cases detected."],
                  ["Specificity", "Share of control cases correctly excluded."],
                  ["AUC", "Ranking quality across all thresholds."],
                  ["Calibration", "Whether stated probability is trustworthy."],
                ].map(([name, body]) => (
                  <li key={name} className="border-b border-line pb-2.5">
                    <p className="text-[13px] font-semibold text-ink">{name}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{body}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Exclusion
              title="Not claimed"
              items={["Diagnostic accuracy", "Clinical utility", "Screening decisions"]}
            />
            <Exclusion
              title="Not comparable"
              items={["Across cohorts", "Across montages", "Across window lengths"]}
            />
            <Exclusion
              title="Not supported"
              items={["Unlinked behavioural data", "Uncoded label classes"]}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- datasets */}
      <section id="datasets" className="scroll-mt-20 border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="section-label">Data</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-balance text-ink">
            Datasets and their constraints
          </h2>
          <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
            Two public sources, each with a different set of usable fields. Values below are
            reported as the source states them; where a field is absent it is marked unavailable
            rather than filled in.
          </p>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {DATASETS.map((dataset) => (
              <Panel
                key={dataset.id}
                title={dataset.name}
                description={dataset.modality}
                icon={Table2}
                actions={<Badge tone="outline">{dataset.id}</Badge>}
              >
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Participants", value: formatNumber(dataset.participants) },
                    {
                      label: "EEG channels",
                      value: dataset.channels ?? "not applicable",
                    },
                    {
                      label: "Sampling rate",
                      value: dataset.samplingRate,
                      hint: dataset.samplingRate === "not stated in file"
                        ? "Time-domain processing is undefined without it."
                        : undefined,
                    },
                    { label: "Size on disk", value: dataset.sizeOnDisk },
                    {
                      label: "Behavioural data",
                      value: dataset.behavior ? "available" : "not available",
                    },
                    { label: "Structural MRI", value: dataset.mri ? "available" : "not available" },
                  ]}
                />

                <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
                      Group distribution
                    </p>
                    <div className="mt-1.5">
                      <ChipList
                        items={classChips(dataset)}
                        tone="neutral"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
                      File types
                    </p>
                    <div className="mt-1.5">
                      <ChipList items={dataset.fileTypes} tone="outline" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
                      Device / tasks
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                      {dataset.device}
                    </p>
                    <div className="mt-1.5">
                      <ChipList items={dataset.tasks} tone="outline" />
                    </div>
                  </div>
                </div>

                <p className="mt-4 rounded-md border border-line bg-surface-subtle p-3 text-[12.5px] leading-relaxed text-ink-muted">
                  {dataset.notes}
                </p>
              </Panel>
            ))}
          </div>

          <Panel className="mt-5" title="Label accounting must reconcile" icon={Scale}>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              A participant count is only meaningful if the per-class counts sum back to it. The
              EEG-only view spans 277 subjects across all sources, which is where the
              147 / 110 / 20 figures come from — they are view-wide totals, not BALLADEER-EEG
              counts. Attributing them to the 156-participant subset would overstate it by 121.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line-strong">
                    <th className="pb-2.5 pr-4 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      Population
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      Participants
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      ADHD
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      Control
                    </th>
                    <th className="pb-2.5 text-right text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                      Undetermined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {POPULATIONS.map((row) => (
                    <tr key={row.label} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-4 text-ink-muted">{row.label}</td>
                      <td className="py-2.5 pr-4 text-right text-ink tabular-nums">
                        {formatNumber(row.total)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-ink-muted tabular-nums">
                        {row.adhd === null ? "—" : formatNumber(row.adhd)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-ink-muted tabular-nums">
                        {row.control === null ? "—" : formatNumber(row.control)}
                      </td>
                      <td className="py-2.5 text-right text-ink-muted tabular-nums">
                        {row.undetermined === null ? "—" : formatNumber(row.undetermined)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
              &ldquo;&mdash;&rdquo; means the source does not publish a per-class split for that
              population, so none is shown.
            </p>
          </Panel>
        </div>
      </section>

      {/* ------------------------------------------------------- limitations */}
      <section id="limitations" className="scroll-mt-20 border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="section-label">Limitations</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink">
                What this work cannot show
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                Stated plainly, because a research prototype that hides its limits is more
                misleading than one that has none.
              </p>
              <div className="mt-6 rounded-md border border-line bg-canvas p-4">
                <ResearchDisclaimer />
              </div>
            </div>

            <Panel title="Documented constraints" icon={ShieldCheck}>
              <ul className="flex flex-col gap-3.5 text-[13px] leading-relaxed text-ink-muted">
                <li>
                  <span className="font-semibold text-ink">20 participants are undetermined.</span>{" "}
                  They remain visible in the registry and are excluded from binary ADHD/control
                  analysis rather than reassigned to either group.
                </li>
                <li>
                  <span className="font-semibold text-ink">No participant-level linkage.</span> One
                  behavioural source carries no participant identifier, so it cannot be fused with
                  EEG at all. Multi-view results are reported per source.
                </li>
                <li>
                  <span className="font-semibold text-ink">No label codebook.</span> A behavioural
                  label column is present but its four integer values are not documented. It is
                  never mapped to ADHD or control.
                </li>
                <li>
                  <span className="font-semibold text-ink">No stated sampling rate.</span> On the
                  affected cohort, spectral features remain computable but window lengths in seconds
                  cannot be asserted.
                </li>
                <li>
                  <span className="font-semibold text-ink">Group-level inference only.</span> A
                  pattern that separates two cohorts says nothing certain about an individual, which
                  is the main reason the participant result is framed as research output.
                </li>
              </ul>
            </Panel>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <ButtonLink href="/login">Enter the platform</ButtonLink>
            <ButtonLink href="/about" variant="secondary">
              Background reading
            </ButtonLink>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}

/* ------------------------------------------------------------------ parts */

function Guard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-critical-600" />
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

function Exclusion({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-5">
      <p className="text-[11px] font-semibold tracking-[0.05em] text-ink-subtle uppercase">
        {title}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[13px] text-ink-muted">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-neutral-300" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
