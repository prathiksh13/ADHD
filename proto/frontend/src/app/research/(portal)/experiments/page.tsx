import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Panel } from "@/components/ui/data";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { ChipList } from "@/components/ui/data";
import { listExperiments } from "@/lib/api";

export const metadata: Metadata = {
  title: "Experiments",
  description: "Registered experiment plans with variants, datasets and primary metrics.",
};

const TONE = {
  complete: "positive",
  running: "primary",
  planned: "neutral",
} as const;

export default async function ResearchExperimentsPage() {
  const experiments = await listExperiments();

  return (
    <>
      <PageHeader
        title="Experiment plans"
        icon={FlaskConical}
        breadcrumb={[
          { label: "Researcher", href: "/research/dashboard" },
          { label: "Experiments" },
        ]}
        description="Every registered plan, the variants it compares, and the metric each one is judged on."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {experiments.map((experiment) => (
            <Panel
              key={experiment.id}
              title={experiment.title}
              description={experiment.code}
              actions={
                <Badge tone={TONE[experiment.status]}>{experiment.status}</Badge>
              }
            >
              <div className="grid gap-4">
                <div>
                  <p className="section-label">Research question</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                    {experiment.question}
                  </p>
                </div>

                <div>
                  <p className="section-label">Variants</p>
                  <div className="mt-1.5">
                    <ChipList items={experiment.variants} />
                  </div>
                </div>

                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11.5px] text-ink-subtle">Primary metric</dt>
                    <dd className="mt-0.5 text-[12.5px] font-medium text-ink">
                      {experiment.primaryMetric}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] text-ink-subtle">Dataset</dt>
                    <dd className="mt-0.5 text-[12.5px] font-medium text-ink">
                      {experiment.dataset}
                    </dd>
                  </div>
                </dl>

                <p className="border-t border-line pt-3 text-[12px] leading-relaxed text-ink-muted">
                  {experiment.notes}
                </p>
              </div>
            </Panel>
          ))}
        </div>

        <Notice tone="neutral" title="Why these are pre-registered">
          <p>
            Each plan states the question, the compared variants and the deciding metric before
            results are inspected. That ordering is what makes a negative result interpretable
            rather than a failure to find something.
          </p>
        </Notice>
      </PortalBody>
    </>
  );
}
