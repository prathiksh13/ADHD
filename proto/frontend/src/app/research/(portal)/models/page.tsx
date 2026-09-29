import type { Metadata } from "next";
import { Brain, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Panel } from "@/components/ui/data";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { ModelCard } from "@/components/models/model-card";
import { ConfusionMatrix, MetricsTable } from "@/components/models/metrics-table";
import { RocCurve } from "@/components/charts/roc-curve";
import { listModels } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Models",
  description: "Trained architectures with held-out metrics, confusion matrices and ROC curves.",
};

export default async function ResearchModelsPage() {
  const { results, architectures, best } = await listModels();
  const byModel = new Map(results.map((r) => [r.modelId, r]));

  return (
    <>
      <PageHeader
        title="Model comparison"
        icon={Brain}
        breadcrumb={[{ label: "Researcher", href: "/research/dashboard" }, { label: "Models" }]}
        description="Every architecture trained on the same participant-level split, with the full metric set for each evaluation run."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <Panel
          title="Held-out metrics"
          description="Participant-level evaluation, one prediction per participant after window aggregation."
          bodyClassName="p-0"
        >
          <MetricsTable
            results={results}
            architectures={architectures.map((a) => ({ id: a.id, name: a.name }))}
            caption="Held-out metrics per architecture"
            className="rounded-none border-0 shadow-none"
          />
        </Panel>

        <Notice tone="caution" title="How to read these numbers">
          <p>
            Metrics are measured on held-out folds of this study cohort and describe how a model
            performed against cohort labels. They are not diagnostic accuracy, are not calibrated
            for individual use, and must not be presented as evidence about any person&apos;s
            condition.
          </p>
        </Notice>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <Panel
            title="ROC"
            icon={TrendingUp}
            description={best ? `ROC for the best-performing run, ${best.runId}.` : "No evaluation available."}
          >
            {best ? <RocCurve points={best.roc} /> : null}
          </Panel>

          <Panel
            title="Confusion matrix"
            description={best ? `Participants in ${best.runId}.` : undefined}
          >
            {best ? <ConfusionMatrix result={best} /> : null}
          </Panel>
        </div>

        <Panel
          title="Architectures"
          description="Input shape, size and training configuration for each model."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {architectures.map((architecture) => {
              const result = byModel.get(architecture.id);
              return (
                <div key={architecture.id} className="flex flex-col gap-2">
                  <ModelCard
                    model={architecture}
                    result={result}
                    best={architecture.id === best?.modelId}
                  />
                  {result ? (
                    <p className="px-1 text-[11.5px] text-ink-subtle">
                      Run <span className="font-mono">{result.runId}</span> ·{" "}
                      {result.evaluationLevel}-level · {result.folds} folds · trained{" "}
                      {formatDate(result.trainedAt)}
                    </p>
                  ) : (
                    <p className="px-1 text-[11.5px] text-ink-subtle">
                      No evaluation run recorded for this architecture.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Evaluation protocol">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                term: "Split unit",
                detail: "Participant-level. All windows from one participant stay in the same fold, so leakage between folds is impossible.",
              },
              {
                term: "Window aggregation",
                detail: "Window predictions are aggregated to a single participant prediction before any metric is computed.",
              },
              {
                term: "Brier score",
                detail: "Reported because accuracy alone hides overconfident outputs. Lower is better.",
              },
              {
                term: "Uncertainty",
                detail: "The ± SD column is the standard deviation of accuracy across folds, not a confidence interval on any individual.",
              },
              {
                term: "Seeds",
                detail: "Each run records its random seed, so a result can be reproduced exactly.",
              },
              {
                term: "Missing runs",
                detail: "Architectures without an evaluation run show a gap rather than a placeholder number.",
              },
            ].map((item) => (
              <div key={item.term}>
                <dt className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                  {item.term}
                  {item.term === "Uncertainty" ? <Badge tone="neutral">folds</Badge> : null}
                </dt>
                <dd className="mt-1 text-[12px] leading-relaxed text-ink-muted">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </PortalBody>
    </>
  );
}
