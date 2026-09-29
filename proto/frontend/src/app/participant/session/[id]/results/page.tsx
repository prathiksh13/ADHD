import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brain, ChartNoAxesColumn, Info, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { PredictionCard, ImportanceBars } from "@/components/models/prediction-card";
import { BandComparisonChart, ChannelBandBar } from "@/components/charts/band-charts";
import { EEGChart } from "@/components/eeg/eeg-chart";
import { Spectrogram } from "@/components/eeg/spectrogram";
import { SignalQualityBar } from "@/components/eeg/eeg-status";
import { Notice } from "@/components/ui/notice";
import { KeyValueList, Panel } from "@/components/ui/data";
import { ButtonLink } from "@/components/ui/button";
import { getSessionResults, getSessionSummary } from "@/lib/api";
import { SIGNAL_CONFIG } from "@/lib/constants";
import { formatDateTime, formatPercent } from "@/lib/format";

export const metadata: Metadata = {
  title: "Result",
  description: "Model output, EEG summary and contributing patterns for one session.",
};

export default async function SessionResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getSessionSummary(id))) notFound();

  const data = await getSessionResults(id);
  if (!data) notFound();

  const { session, eeg, model, result, bandImportance, channelImportance, temporalImportance } =
    data;

  if (result === null) {
    return (
      <>
        <PageHeader title="Result" icon={Brain} breadcrumb={crumb(id)} />
        <PortalBody className="mx-auto w-full max-w-[1400px]">
          <Notice tone="caution" icon={<Info className="size-4" />} title="No result yet">
            <p>
              This session has not produced a model output. If it is still processing, follow the
              stage list; if it failed, the reason is recorded on the processing screen.
            </p>
            <ButtonLink
              href={`/participant/session/${id}/processing`}
              variant="secondary"
              size="sm"
              className="mt-3"
            >
              Go to processing
            </ButtonLink>
          </Notice>
        </PortalBody>
      </>
    );
  }

  const qualityScore =
    1 - eeg.quality.artifactWindows / Math.max(1, eeg.quality.totalWindows);

  /**
   * The highest-weighted baseline band, paired with per-channel power for that
   * band. Gamma is excluded: it is a declared extension, not part of the
   * baseline band set the model was trained on.
   */
  const topBand = (() => {
    const candidate = bandImportance
      .filter((b) => b.band !== "gamma")
      .sort((a, b) => b.importance - a.importance)[0];
    if (!candidate) return null;
    return {
      key: candidate.band,
      label: candidate.label,
      importance: candidate.importance,
      byChannel: channelImportance.slice(0, 8).map((c) => ({
        channel: c.channel,
        value: c.importance * candidate.importance,
      })),
    };
  })();

  return (
    <>
      <PageHeader
        title="Research screening result"
        icon={Brain}
        breadcrumb={crumb(id)}
        description="Model output for one recorded session, with the EEG patterns that contributed to it."
        meta={[
          { label: "Session", value: session.id },
          { label: "Experiment", value: session.experiment },
          { label: "Model", value: model?.short ?? "unknown" },
        ]}
        actions={
          <ButtonLink href={`/participant/session/${id}/processing`} variant="secondary">
            Processing stages
          </ButtonLink>
        }
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <PredictionCard
          result={session.resultLabel ?? "Model output unavailable"}
          probability={result}
          model={model}
          sessionId={session.id}
          evaluatedAt={session.completedAt ?? undefined}
          confidenceNote={
            result >= 0.5 && result < 0.65
              ? "This probability sits close to the 0.5 decision threshold, so the model output is weakly separated. Treat it as uninformative rather than as a weak positive."
              : undefined
          }
        />

        {/* ------------------------------------------------------ EEG summary */}
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel
            title="EEG summary"
            icon={ChartNoAxesColumn}
            description={`${SIGNAL_CONFIG.channels} channels · ${SIGNAL_CONFIG.windowSeconds}s windows · ${SIGNAL_CONFIG.bands} bands`}
          >
            <div className="grid gap-5">
              <div>
                <p className="mb-2 text-[12px] font-medium text-ink-subtle">
                  Mean band power over the session
                </p>
                <BandComparisonChart
                  data={meanBandPower(eeg.bandPower)}
                  title="Mean relative band power"
                  subtitle="Averaged over every accepted window in this recording"
                />
              </div>

              {topBand ? (
                <div>
                  <p className="mb-2 text-[12px] font-medium text-ink-subtle">
                    {topBand.label} power by channel
                  </p>
                  <p className="mb-2 text-[11.5px] text-ink-subtle">
                    {topBand.label} carries the highest model weight of the four baseline bands
                    ({formatPercent(topBand.importance)}).
                  </p>
                  <ChannelBandBar
                    data={topBand.byChannel}
                    band={topBand.key}
                    title={`${topBand.label} power by channel`}
                    subtitle="Mean relative power, this session"
                    height={200}
                  />
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-[12px] font-medium text-ink-subtle">
                  Representative channels
                </p>
                <EEGChart
                  raw={eeg.raw}
                  processed={eeg.processed}
                  channels={eeg.metadata.channels}
                  montage={eeg.metadata.montage}
                  samplingRateHz={eeg.metadata.samplingRateHz}
                  defaultChannels={["Fz", "Cz", "Pz"].filter((c) => c in eeg.processed)}
                  title="Representative channels"
                  height={190}
                />
              </div>
            </div>
          </Panel>

          <div className="flex flex-col gap-6">
            <Panel title="Contributing patterns" icon={Sparkles}>
              <div className="flex flex-col gap-5">
                <div>
                  <p className="mb-2 text-[12px] font-medium text-ink-subtle">
                    Channels the model weighted
                  </p>
                  <ImportanceBars
                    items={channelImportance.slice(0, 8).map((c) => ({
                      label: c.channel,
                      value: c.importance,
                      note: c.region,
                    }))}
                  />
                </div>

                <div>
                  <p className="mb-2 text-[12px] font-medium text-ink-subtle">
                    Frequency bands the model weighted
                  </p>
                  <ImportanceBars
                    items={bandImportance.map((b) => ({
                      label: b.label,
                      value: b.importance,
                    }))}
                  />
                </div>

                <div>
                  <p className="mb-2 text-[12px] font-medium text-ink-subtle">
                    Time regions the model weighted
                  </p>
                  <ImportanceBars
                    items={temporalImportance.map((t) => ({
                      label: t.label,
                      value: t.weight,
                    }))}
                  />
                  <p className="mt-2 text-[11.5px] leading-relaxed text-ink-subtle">
                    {temporalImportance[0]?.description}
                  </p>
                </div>
              </div>

              <p className="mt-5 rounded-md border border-line bg-surface-subtle p-3 text-[11.5px] leading-relaxed text-ink-subtle">
                These are model-internal importance values, not physiological findings. A channel
                the model weighted heavily may be carrying artifact rather than cognitive signal.
              </p>
            </Panel>

            <Panel title="Recording details">
              <KeyValueList
                columns={1}
                items={[
                  { label: "Session", value: session.id },
                  { label: "Started", value: formatDateTime(session.startedAt) },
                  {
                    label: "Completed",
                    value: session.completedAt ? formatDateTime(session.completedAt) : "—",
                  },
                  { label: "Experiment", value: session.experiment },
                  { label: "Device", value: session.device },
                  { label: "Montage", value: session.montage },
                  { label: "Sampling rate", value: `${session.samplingRateHz} Hz (declared)` },
                  { label: "Channels", value: String(session.channels) },
                  { label: "Windows", value: session.windows.toLocaleString("en-US") },
                  { label: "Sequences", value: session.sequences.toLocaleString("en-US") },
                  {
                    label: "Behaviour",
                    value: session.behavior ? "linked to this session" : "not linked",
                  },
                ]}
              />
            </Panel>
          </div>
        </div>

        {/* --------------------------------------------------------- quality */}
        <Panel
          title="Signal quality"
          description="Quality gates applied before the model saw any of this data."
        >
          <SignalQualityBar
            quality={qualityScore}
            artifactWindows={eeg.quality.artifactWindows}
            totalWindows={eeg.quality.totalWindows}
            flatlineRatio={eeg.quality.flatlineRatio}
          />
        </Panel>

        {/* ------------------------------------------------- model context */}
        {model ? (
          <Notice tone="neutral">
            <p>
              Produced by <span className="font-medium text-ink">{model.name}</span> — a{" "}
              {model.family.toLowerCase()} architecture with {model.parameters} parameters trained
              for {model.epochs} epochs. Cohort-level performance for this architecture is on the{" "}
              <ButtonLink href="/research/models" variant="ghost" size="sm" className="h-auto p-0 align-baseline underline">
                model comparison
              </ButtonLink>{" "}
              screen; a single session carries no labels, so it is not scored here.
            </p>
          </Notice>
        ) : null}

        {/* --------------------------------------------------- spectrogram */}
        <Panel title="Spectrogram" bodyClassName="p-0">
          <Spectrogram
            bins={eeg.spectrogram}
            timeBins={64}
            freqBins={40}
            maxHz={45}
            title="Time–frequency spectrogram"
            subtitle="Relative power after preprocessing, from the accepted windows of this recording"
          />
        </Panel>

        <p className="text-[11.5px] leading-relaxed text-ink-subtle">
          Research output, not a diagnosis. Classification probability{" "}
          {formatPercent(result, 1)} is the confidence of one trained research model on one recorded
          session. It cannot confirm or rule out any condition, and it should not be used as the
          basis for a clinical decision. This platform is not a medical device.
        </p>
      </PortalBody>
    </>
  );
}

function crumb(id: string) {
  return [
    { label: "Participant", href: "/participant/dashboard" },
    { label: "History", href: "/participant/history" },
    { label: id },
  ];
}

type BandPoint = { label: string; delta: number; theta: number; alpha: number; beta: number };

/** Mean power per band across every window in the session. */
function meanBandPower(
  points: { delta: number; theta: number; alpha: number; beta: number }[],
): BandPoint[] {
  if (!points.length) return [];
  type BandName = "delta" | "theta" | "alpha" | "beta";
  const mean = (k: BandName) => points.reduce((sum, p) => sum + p[k], 0) / points.length;

  return [
    {
      label: "This session",
      delta: Number(mean("delta").toFixed(3)),
      theta: Number(mean("theta").toFixed(3)),
      alpha: Number(mean("alpha").toFixed(3)),
      beta: Number(mean("beta").toFixed(3)),
    },
  ];
}
