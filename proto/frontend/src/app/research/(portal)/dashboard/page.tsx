import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Database,
  FlaskConical,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Panel } from "@/components/ui/data";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { ModelCard } from "@/components/models/model-card";
import { getResearchOverview } from "@/lib/api";
import { formatNumber, formatRatio } from "@/lib/format";
import type { TrainingCurve } from "@/types/model";

export const metadata: Metadata = {
  title: "Research dashboard",
  description: "Model performance, experiment plans and dataset coverage across the study.",
};

export default async function ResearcherDashboardPage() {
  const { stats, experiments, results, architectures, curve } = await getResearchOverview();

  /**
   * `results` is ordered best-first by macro F1 across the evaluated
   * architectures, so the head of the list is the current best model.
   */
  const bestResult = results[0];
  const bestModel = bestResult
    ? architectures.find((a) => a.id === bestResult.modelId)
    : undefined;

  return (
    <>
      <PageHeader
        title="Research dashboard"
        icon={LayoutDashboard}
        breadcrumb={[{ label: "Researcher", href: "/research/dashboard" }, { label: "Dashboard" }]}
        description="Study-wide model performance, experiment coverage and dataset inventory."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Best macro F1"
            value={bestResult ? formatRatio(bestResult.metrics.f1, 3) : "—"}
            hint={bestModel?.short}
            icon={TrendingUp}
            tone="primary"
          />
          <StatCard
            label="Architectures trained"
            value={String(stats.models)}
            hint={`${stats.evaluatedModels} evaluated · ${stats.evaluationStatus}`}
            icon={Brain}
          />
          <StatCard
            label="Experiments"
            value={String(stats.experiments)}
            hint={`${stats.experimentsComplete} complete`}
            icon={FlaskConical}
          />
          <StatCard
            label="Cohort"
            value={formatNumber(stats.participants)}
            hint={`${formatNumber(stats.windows)} windows · ${formatNumber(stats.sequences)} sequences`}
            icon={Database}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Panel
            title="Architecture comparison"
            description="Every architecture trained on the same participant-level split."
            actions={
              <ButtonLink href="/research/models" variant="ghost" size="sm">
                All models
                <ArrowRight className="size-3.5" />
              </ButtonLink>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {architectures.slice(0, 3).map((architecture) => (
                <ModelCard
                  key={architecture.id}
                  model={architecture}
                  result={results.find((r) => r.modelId === architecture.id)}
                  best={architecture.id === bestResult?.modelId}
                />
              ))}
            </div>
          </Panel>

          <Panel
            title="Training curve"
            description="Validation accuracy for the deployed architecture."
          >
            <TrainingCurveMini curve={curve} />
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
              This is the validation trace of one training run, not a population result.
              Held-out performance is reported on the model comparison screen.
            </p>
          </Panel>
        </div>

        <Panel
          title="Experiment coverage"
          description="Registered plans and the primary metric each one is judged on."
          actions={
            <ButtonLink href="/research/experiments" variant="ghost" size="sm">
              All experiments
              <ArrowRight className="size-3.5" />
            </ButtonLink>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  {["Plan", "Dataset", "Variants", "Primary metric", "Status"].map((label) => (
                    <th
                      key={label}
                      className="px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {experiments.map((experiment) => (
                  <tr key={experiment.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3.5">
                      <span className="block font-medium text-ink">{experiment.title}</span>
                      <span className="block font-mono text-[11.5px] text-ink-subtle">
                        {experiment.code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">{experiment.dataset}</td>
                    <td className="px-5 py-3.5 text-ink-muted tabular-nums">
                      {experiment.variants.length}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">{experiment.primaryMetric}</td>
                    <td className="px-5 py-3.5">
                      <Badge
                        tone={
                          experiment.status === "complete"
                            ? "positive"
                            : experiment.status === "running"
                              ? "primary"
                              : "neutral"
                        }
                      >
                        {experiment.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              href: "/research/models",
              icon: Brain,
              title: "Models",
              body: "Architecture comparison, held-out metrics and confusion matrices.",
            },
            {
              href: "/research/explainability",
              icon: TrendingUp,
              title: "Explainability",
              body: "Channel, band, feature and temporal attribution for the deployed model.",
            },
            {
              href: "/research/datasets",
              icon: Database,
              title: "Datasets",
              body: "Public dataset inventory with access notes and column structure.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col gap-2 rounded-lg border border-line bg-surface p-5 shadow-card transition-colors hover:border-line-strong"
              >
                <span className="flex size-8 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                  <Icon className="size-4" />
                </span>
                <span className="text-[13.5px] font-semibold text-ink">{item.title}</span>
                <span className="text-[12px] leading-relaxed text-ink-muted">{item.body}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-primary-700">
                  Open
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="text-[11.5px] leading-relaxed text-ink-subtle">
          Evaluation uses {stats.evaluationStatus} across {stats.models} architectures. These
          figures describe the models on held-out folds of the study cohort; they are not
          diagnostic accuracy and do not transfer to individual clinical use.
        </p>
      </PortalBody>
    </>
  );
}

function TrainingCurveMini({ curve }: { curve: TrainingCurve[] }) {
  if (!curve.length) return null;

  const accuracies = curve.map((point) => point.valAccuracy);
  const max = Math.max(...accuracies);
  const min = Math.min(...accuracies);
  const span = max - min || 1;
  const last = curve[curve.length - 1];

  const toPoints = (read: (point: TrainingCurve) => number) =>
    curve
      .map((point) => {
        const x = (point.epoch / Math.max(1, curve[curve.length - 1].epoch)) * 300;
        const y = 80 - ((read(point) - min) / span) * 70;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[26px] leading-none font-semibold tracking-tight text-ink tabular-nums">
          {formatRatio(last.valAccuracy, 3)}
        </span>
        <span className="text-[12px] text-ink-subtle">final validation accuracy</span>
      </div>

      <svg
        viewBox="0 0 300 90"
        className="mt-4 w-full"
        role="img"
        aria-label="Training and validation accuracy by epoch"
      >
        <polyline
          points={toPoints((p) => p.trainAccuracy)}
          fill="none"
          stroke="var(--color-ink-subtle)"
          strokeWidth={1.3}
          strokeDasharray="3 3"
        />
        <polyline
          points={toPoints((p) => p.valAccuracy)}
          fill="none"
          stroke="var(--color-primary-600)"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <line x1={0} x2={300} y1={80} y2={80} stroke="var(--color-line)" strokeWidth={1} />
      </svg>

      <div className="mt-2 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <span
            className="h-0.5 w-3.5 rounded-full"
            style={{ backgroundColor: "var(--color-primary-600)" }}
            aria-hidden
          />
          validation
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <span
            className="h-0.5 w-3.5 rounded-full"
            style={{ backgroundColor: "var(--color-ink-subtle)" }}
            aria-hidden
          />
          train
        </span>
      </div>

      <p className="mt-2 text-[11.5px] text-ink-subtle tabular-nums">
        epoch 1 → {last.epoch} · accuracy range {formatRatio(min, 3)}–{formatRatio(max, 3)}
      </p>
    </div>
  );
}
