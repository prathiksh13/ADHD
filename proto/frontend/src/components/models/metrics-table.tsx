import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPercent, formatRatio } from "@/lib/format";
import type { MetricKey, ModelResult } from "@/types/model";

export const METRIC_ROWS: { key: MetricKey; label: string; hint: string }[] = [
  { key: "accuracy", label: "Accuracy", hint: "Participant-level, all classes" },
  { key: "precision", label: "Precision", hint: "Positive predictive value" },
  { key: "recall", label: "Recall", hint: "Share of true positives found" },
  { key: "f1", label: "F1", hint: "Precision / recall harmonic mean" },
  { key: "sensitivity", label: "Sensitivity", hint: "True positive rate" },
  { key: "specificity", label: "Specificity", hint: "True negative rate" },
  { key: "auc", label: "ROC-AUC", hint: "Threshold-independent ranking" },
  { key: "brier", label: "Brier score", hint: "Lower is better" },
];

const formatMetric = (key: MetricKey, value: number) =>
  key === "brier" ? formatRatio(value, 4) : formatPercent(value, 1);

/**
 * Model comparison table.
 *
 * Every value comes from a `ModelResult` supplied by the data layer. Models
 * without an evaluation run render as an explicit gap — never a placeholder
 * number — so the table cannot be mistaken for a completed experiment.
 */
export function MetricsTable({
  results,
  architectures,
  caption,
  className,
}: {
  results: ModelResult[];
  architectures: { id: string; name: string }[];
  caption?: string;
  className?: string;
}) {
  const byModel = new Map(results.map((r) => [r.modelId, r]));
  const bestKey = bestMetricKey(results);

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-line bg-surface shadow-card", className)}>
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <THead>
          <TR className="hover:bg-transparent">
            <TH className="sticky left-0 z-10 bg-surface">Model</TH>
            {METRIC_ROWS.map((m) => (
              <TH key={m.key} numeric>
                {m.label}
              </TH>
            ))}
            <TH numeric>± SD</TH>
          </TR>
        </THead>
        <TBody>
          {architectures.map((arch) => {
            const result = byModel.get(arch.id);
            return (
              <TR key={arch.id}>
                <TD className="sticky left-0 z-10 bg-surface font-medium">{arch.name}</TD>
                {METRIC_ROWS.map((m) => {
                  if (!result) {
                    return (
                      <TD key={m.key} numeric className="text-ink-subtle">
                        —
                      </TD>
                    );
                  }
                  const isBest = bestKey?.modelId === arch.id && bestKey.metric === m.key;
                  return (
                    <TD
                      key={m.key}
                      numeric
                      className={cn(
                        "font-medium",
                        isBest && "bg-positive-50 text-positive-700",
                      )}
                    >
                      {formatMetric(m.key, result.metrics[m.key])}
                    </TD>
                  );
                })}
                <TD numeric className="text-ink-muted">
                  {result?.standardDeviation.accuracy
                    ? `± ${(result.standardDeviation.accuracy * 100).toFixed(1)}`
                    : "—"}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

function bestMetricKey(results: ModelResult[]) {
  if (!results.length) return null;
  const scored = results.filter((r) => r.metrics.accuracy > 0);
  if (!scored.length) return null;
  const top = scored.reduce((a, b) => (b.metrics.accuracy > a.metrics.accuracy ? b : a));
  return { modelId: top.modelId, metric: "accuracy" as MetricKey };
}

/** Confusion matrix for a binary participant-level evaluation. */
export function ConfusionMatrix({
  result,
  className,
}: {
  result: ModelResult;
  className?: string;
}) {
  const { tp, fp, tn, fn } = result.confusion;
  const cells = [
    { label: "ADHD", value: tp, tone: "caution" as const, note: "true positive" },
    { label: "ADHD", value: fn, tone: "positive" as const, note: "false negative" },
    { label: "Control", value: fp, tone: "critical" as const, note: "false positive" },
    { label: "Control", value: tn, tone: "positive" as const, note: "true negative" },
  ];

  const toneClass = {
    positive: "bg-positive-50 text-positive-700 border-positive-100",
    caution: "bg-caution-50 text-caution-700 border-caution-100",
    critical: "bg-critical-50 text-critical-700 border-critical-100",
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-2 gap-2">
        {cells.map((cell, i) => (
          <div key={i} className={cn("rounded-md border px-3.5 py-3", toneClass[cell.tone])}>
            <p className="text-[11px] font-medium opacity-80">
              {cell.label} · {cell.note}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{cell.value}</p>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] leading-relaxed text-ink-subtle">
        Counts are participants, not EEG windows. Window-level results are aggregated to one
        prediction per participant before scoring.
      </p>
    </div>
  );
}
