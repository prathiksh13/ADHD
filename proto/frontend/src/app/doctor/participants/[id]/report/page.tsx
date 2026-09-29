import type { Metadata } from "next";
import { Brain, FileText, TrendingUp } from "lucide-react";
import { Panel, KeyValueList } from "@/components/ui/data";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { PredictionCard, ImportanceBars } from "@/components/models/prediction-card";
import { AttentionChart } from "@/components/charts/attention-chart";
import { ParticipantShell } from "@/components/doctor/participant-shell";
import { getModelDetail } from "@/lib/api";
import { formatDateTime, formatPercent } from "@/lib/format";
import { FREQUENCY_BANDS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Model report",
  description: "Model output, cohort evaluation metrics and feature attribution for one participant.",
};

const METRIC_ROWS = [
  { key: "accuracy", label: "Accuracy" },
  { key: "sensitivity", label: "Sensitivity" },
  { key: "specificity", label: "Specificity" },
  { key: "f1", label: "F1" },
  { key: "auc", label: "AUC" },
  { key: "precision", label: "Precision" },
  { key: "brier", label: "Brier" },
] as const;

export default async function ParticipantReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ParticipantShell
      id={id}
      title="Model report"
      description="Everything the deployed model produced for this participant, with the cohort metrics the model was selected on."
    >
      {async ({ participant, sessions, latest, latestResults }) => {
        if (!latest || !latestResults) {
          return (
            <Notice tone="info" title="No model output yet">
              <p>
                A report becomes available once this participant has at least one fully processed
                session. {sessions.length} session{sessions.length === 1 ? " is" : "s are"} on
                record.
              </p>
            </Notice>
          );
        }

        const modelId = latest.modelId ?? "cnn-lstm-attn";
        const detail = await getModelDetail(modelId);
        const run = detail?.result ?? null;
        const confusion = run?.confusion;

        return (
          <>
            <Notice tone="caution" title="Research prototype output">
              <p>
                This report is a research artifact. The model was trained and evaluated on cohort
                data for a study of ADHD-related EEG patterns; it is not a diagnostic instrument,
                is not validated for clinical use, and must not be used to inform a diagnosis or
                any treatment decision for this individual. The record&apos;s diagnosis label
                comes from {participant.source} and is shown only for comparison.
              </p>
            </Notice>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <PredictionCard
                result={latest.resultLabel ?? "Model output unavailable"}
                probability={latestResults.result}
                model={latestResults.model}
                sessionId={latest.id}
                confidenceNote="Threshold 0.50 separates the two classes in this study's evaluation. Anything close to the threshold should be treated as low confidence."
              />

              <Panel
                title="Interpretation"
                icon={FileText}
                description="Read alongside the source label, not instead of it."
              >
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  {interpret(participant.diagnosis, latest.probability, latestResults.result)}
                </p>
                <div className="mt-4 border-t border-line pt-4">
                  <KeyValueList
                    items={[
                      { label: "Record label", value: participant.diagnosis },
                      { label: "Source", value: participant.source },
                      { label: "Model", value: latestResults.model?.name ?? "unknown" },
                      {
                        label: "Family",
                        value: latestResults.model?.family ?? "unknown",
                      },
                      { label: "Run", value: run?.runId ?? "no run" },
                      { label: "Evaluated", value: run ? formatDateTime(run.trainedAt) : "—", },
                    ]}
                  />
                </div>
              </Panel>
            </div>

            <Panel
              title="Cohort evaluation metrics"
              icon={TrendingUp}
              description={
                run
                  ? `${run.evaluationLevel}-level · ${run.folds}-fold cross-validation · seed ${run.seed}. These are model-level figures, not per-participant scores.`
                  : "No evaluation run recorded for this architecture."
              }
            >
              {run ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                    {METRIC_ROWS.map((m) => (
                      <div
                        key={m.key}
                        className="rounded-md border border-line bg-surface-subtle px-4 py-3"
                      >
                        <p className="text-[11px] font-medium tracking-[0.03em] text-ink-subtle uppercase">
                          {m.label}
                        </p>
                        <p className="mt-1 text-[18px] leading-none font-semibold text-ink tabular-nums">
                          {formatPercent(run.metrics[m.key], 1)}
                        </p>
                        {run.standardDeviation[m.key] !== undefined ? (
                          <p className="mt-1.5 text-[11px] text-ink-subtle tabular-nums">
                            ± {formatPercent(run.standardDeviation[m.key]!, 1)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {confusion ? (
                    <div className="mt-5 border-t border-line pt-5">
                      <p className="section-label mb-3">Confusion matrix</p>
                      <div className="grid max-w-md grid-cols-[auto_1fr_1fr] gap-1.5 text-center text-[12.5px]">
                        <span />
                        <span className="px-2 py-2 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                          Pred. negative
                        </span>
                        <span className="px-2 py-2 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                          Pred. positive
                        </span>
                        <span className="flex items-center justify-start px-2 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                          Actual negative
                        </span>
                        <Cell value={confusion.tn} tone="positive" />
                        <Cell value={confusion.fp} tone="caution" />
                        <span className="flex items-center justify-start px-2 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase">
                          Actual positive
                        </span>
                        <Cell value={confusion.fn} tone="caution" />
                        <Cell value={confusion.tp} tone="positive" />
                      </div>
                      <p className="mt-3 text-[11.5px] text-ink-subtle">
                        False negatives are the failure mode that matters most in a screening
                        context: a participant with the study label who the model scored below
                        threshold.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="py-8 text-center text-[12.5px] text-ink-subtle">
                  This architecture has no recorded evaluation run, so no performance figures are
                  available.
                </p>
              )}
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel
                title="Important channels"
                description="Mean absolute attribution for the cohort, grouped by region."
              >
                <ImportanceBars
                  items={latestResults.channelImportance.map((c) => ({
                    label: c.channel,
                    value: c.importance,
                    note: c.region,
                  }))}
                />
                <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
                  Frontocentral electrodes dominate in this architecture, which is the expected
                  pattern for this literature. Attribution is a description of the trained model,
                  not evidence about an individual.
                </p>
              </Panel>

              <Panel title="Important bands" description="Which frequency ranges the model relies on.">
                <ImportanceBars
                  items={latestResults.bandImportance.map((b) => ({
                    label: b.label,
                    value: b.importance,
                    note: FREQUENCY_BANDS.find((f) => f.key === b.band)?.range,
                  }))}
                />
                <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
                  Slow-wave and theta contributions are higher in the ADHD-indicative class across
                  this cohort. Gamma is tracked as an extension but is excluded from model input.
                </p>
              </Panel>

              <Panel
                title="Important time windows"
                description="Learned weighting across the input sequence."
              >
                <ImportanceBars
                  items={latestResults.temporalImportance.map((t) => ({
                    label: t.label,
                    value: t.weight,
                    note: formatPercent(t.weight, 1),
                  }))}
                />
                <ul className="mt-4 grid gap-1.5">
                  {latestResults.temporalImportance
                    .filter((t) => t.weight >= 0.15)
                    .map((t) => (
                      <li key={t.label} className="text-[11.5px] text-ink-subtle">
                        <span className="font-medium text-ink-muted">{t.label}</span> — {t.description}
                      </li>
                    ))}
                </ul>
              </Panel>

              <Panel
                title="Attention weights"
                icon={Brain}
                description="Per-step attention from the hybrid attention head."
              >
                <AttentionChart
                  weights={latestResults.attentionWeights}
                  subtitle={`Learned attention across ${latestResults.attentionWeights.length} sequence steps`}
                />
                <p className="mt-3 text-[11.5px] leading-relaxed text-ink-subtle">
                  {latestResults.model?.family.includes("Attention")
                    ? "This architecture includes an attention head, so the weights above are reported. Architectures without one return no weights and this panel stays empty."
                    : "This architecture has no attention head, so no per-step weights are available."}
                </p>
              </Panel>
            </div>

            <Panel
              title="Record and session provenance"
              description="What this report is based on."
            >
              <KeyValueList
                columns={3}
                items={[
                  { label: "Participant", value: participant.displayId },
                  { label: "Internal ID", value: participant.id },
                  { label: "Source", value: participant.source },
                  { label: "Record label", value: participant.diagnosis },
                  { label: "Session", value: latest.id },
                  { label: "Session status", value: latest.status },
                  { label: "Windows", value: String(latest.windows) },
                  { label: "Sequences", value: String(latest.sequences) },
                  { label: "Channels", value: String(latest.channels) },
                ]}
              />
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Badge tone="neutral">research prototype</Badge>
                <Badge tone="neutral">cohort-level attribution</Badge>
                {latest.flagged ? <Badge tone="caution">session flagged</Badge> : null}
                {run?.evaluationLevel === "participant"
                  ? null
                  : run
                    ? <Badge tone="caution">{run.evaluationLevel}-level metrics</Badge>
                    : null}
              </div>
            </Panel>
          </>
        );
      }}
    </ParticipantShell>
  );
}

function Cell({ value, tone }: { value: number; tone: "positive" | "caution" }) {
  return (
    <div
      className="rounded-md border border-line px-3 py-3 text-[15px] font-semibold text-ink tabular-nums"
      style={{
        backgroundColor:
          tone === "positive"
            ? "color-mix(in srgb, var(--color-positive-500) 10%, transparent)"
            : "color-mix(in srgb, var(--color-caution-500) 12%, transparent)",
      }}
    >
      {value}
    </div>
  );
}

function interpret(diagnosis: string, probability: number | null, score: number | null) {
  const elevated = (probability ?? score ?? 0) >= 0.5;
  const agrees = elevated === /ADHD/i.test(diagnosis);

  if (probability === null && score === null) {
    return "No classification probability was produced for this session, so no interpretation can be drawn. Check that the session finished processing.";
  }

  if (agrees) {
    return `The model output is consistent with the label already recorded on this record (${
      elevated ? "elevated" : "lower"
    } class). Agreement between the two is expected more often than chance but is not independent confirmation: the model was trained on the same labelling scheme.`;
  }

  return `The model output disagrees with the label recorded on this record (${
    elevated ? "elevated" : "lower"
  } class). Disagreement is a normal outcome for a model operating near its decision boundary, and it can also indicate signal-quality problems in this session. Check the EEG tab before drawing any conclusion.`;
}
