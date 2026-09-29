import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Panel } from "@/components/ui/data";
import { Notice } from "@/components/ui/notice";
import { ChipList } from "@/components/ui/data";
import { BandComparisonChart, ChannelBandBar } from "@/components/charts/band-charts";
import { AttentionChart } from "@/components/charts/attention-chart";
import { getExplainability } from "@/lib/api";
import { FREQUENCY_BANDS, SIGNAL_CONFIG } from "@/lib/constants";
import { formatPercent } from "@/lib/format";

export const metadata: Metadata = {
  title: "Explainability",
  description: "Channel, band, feature and temporal attribution for the deployed model.",
};

export default async function ResearchExplainabilityPage() {
  const { modelId, channels, bands, features, temporal, attention } = await getExplainability();

  const bandRows = bands.map((b) => ({
    label: b.label,
    delta: b.band === "delta" ? b.importance : 0,
    theta: b.band === "theta" ? b.importance : 0,
    alpha: b.band === "alpha" ? b.importance : 0,
    beta: b.band === "beta" ? b.importance : 0,
  }));

  const topChannels = channels.slice(0, 10);
  const topBand = [...bands]
    .filter((b) => b.band !== "gamma")
    .sort((a, b) => b.importance - a.importance)[0];

  return (
    <>
      <PageHeader
        title="Explainability"
        icon={BarChart3}
        breadcrumb={[
          { label: "Researcher", href: "/research/dashboard" },
          { label: "Explainability" },
        ]}
        description="Where the deployed architecture draws its signal, decomposed by channel, frequency band, feature group and recording position."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <Notice tone="neutral" title="Model-level attribution, not a per-session explanation">
          <p>
            These values are averaged across the evaluation cohort for architecture{" "}
            <span className="font-mono">{modelId}</span>. They describe what the model tends to use
            in general. A single session&apos;s contribution is shown on its own result screen and
            will differ from these cohort averages.
          </p>
        </Notice>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="Channel attribution"
            description="Mean absolute contribution per electrode, top 10 of {SIGNAL_CONFIG.channels}."
          >
            {topBand ? (
              <ChannelBandBar
                data={topChannels.map((c) => ({
                  channel: c.channel,
                  value: c.importance,
                }))}
                band={topBand.band}
                title="Channel importance"
                subtitle="Mean absolute attribution, cohort average"
                height={240}
              />
            ) : null}
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
              Frontal and midline electrodes dominate in the theta range, which matches the
              published attention-deficit literature and is the reason theta/beta ratio features
              are kept in the input vector.
            </p>
          </Panel>

          <Panel
            title="Band attribution"
            description="Share of total attribution carried by each frequency band."
          >
            <BandComparisonChart
              data={bandRows}
              title="Band importance"
              subtitle="Mean absolute attribution by band"
              height={240}
            />
            <div className="mt-4">
              <ChipList
                items={FREQUENCY_BANDS.map((band) =>
                  `${band.label} (${band.low}–${band.high} Hz)`,
                )}
              />
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel
            title="Attention weights"
            description="Learned weight per step of the {SIGNAL_CONFIG.sequenceLength}-step input sequence."
          >
            <AttentionChart weights={attention} height={230} />
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
              Each step covers {SIGNAL_CONFIG.windowSeconds}s of signal, so the sequence spans{" "}
              {SIGNAL_CONFIG.sequenceLength * SIGNAL_CONFIG.windowSeconds}s of the recording.
              Peaks late in the sequence indicate the model weighting the end of the block most
              heavily.
            </p>
          </Panel>

          <Panel
            title="Feature groups"
            description="Attribution grouped into the three families the model receives."
          >
            <FeatureGroups features={features} />
          </Panel>
        </div>

        <Panel
          title="Temporal attribution"
          description="How much each stage of the experiment contributes to the prediction."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {temporal.map((region) => (
              <div key={region.label} className="rounded-md border border-line p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12.5px] font-semibold text-ink">{region.label}</p>
                  <p className="text-[13px] font-semibold text-primary-700 tabular-nums">
                    {formatPercent(region.weight, 1)}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full bg-primary-500"
                    style={{ width: `${Math.min(100, region.weight * 100)}%` }}
                  />
                </div>
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-muted">
                  {region.description}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </PortalBody>
    </>
  );
}

function FeatureGroups({ features }: { features: { feature: string; importance: number; group: string }[] }) {
  const groups = ["channel", "band", "time"] as const;
  const labels: Record<(typeof groups)[number], string> = {
    channel: "Channel features",
    band: "Band features",
    time: "Temporal features",
  };

  const totals = groups.map((group) => {
    const rows = features.filter((f) => f.group === group);
    return {
      group,
      label: labels[group],
      total: rows.reduce((sum, f) => sum + f.importance, 0),
      count: rows.length,
      top: rows.sort((a, b) => b.importance - a.importance)[0],
    };
  });

  const sum = totals.reduce((acc, t) => acc + t.total, 0) || 1;

  return (
    <div className="grid gap-3">
      {totals.map((row) => (
        <div key={row.group} className="rounded-md border border-line p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[12.5px] font-semibold text-ink">{row.label}</p>
            <p className="text-[12.5px] text-ink-muted tabular-nums">
              {row.count} features · {formatPercent(row.total / sum, 1)}
            </p>
          </div>
          <p className="mt-1 text-[11.5px] text-ink-subtle">
            Strongest: <span className="font-mono text-ink-muted">{row.top?.feature}</span> at{" "}
            {formatPercent(row.top?.importance ?? 0, 1)}
          </p>
        </div>
      ))}
    </div>
  );
}
