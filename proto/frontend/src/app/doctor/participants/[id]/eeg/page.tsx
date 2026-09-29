import type { Metadata } from "next";
import { Activity, Brain, Waves } from "lucide-react";
import { Panel } from "@/components/ui/data";
import { Notice } from "@/components/ui/notice";
import { KeyValueList } from "@/components/ui/data";
import { EEGChart } from "@/components/eeg/eeg-chart";
import { Spectrogram } from "@/components/eeg/spectrogram";
import { BandPowerChart, ChannelBandBar } from "@/components/charts/band-charts";
import { SignalQualityBar } from "@/components/eeg/eeg-status";
import { ParticipantShell } from "@/components/doctor/participant-shell";
import { formatPercent, formatRatio } from "@/lib/format";
import { MONTAGE_LABELS, SIGNAL_CONFIG, FREQUENCY_BANDS } from "@/lib/constants";
import type { BandKey } from "@/lib/constants";

export const metadata: Metadata = {
  title: "EEG analysis",
  description: "Waveform, band power, spectrogram and occipital analysis for one participant.",
};

/** Occipital channels used for the posterior alpha reading. All montages have O1 and O2. */
const OCCIPITAL = ["O1", "O2"];

export default async function ParticipantEegPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ParticipantShell id={id} title="EEG analysis" description="Waveform, band power and time–frequency structure for the latest completed session.">
      {({ latest, latestResults }) => {
        if (!latest || !latestResults) {
          return (
            <Notice tone="info">
              <p>No completed session yet, so there is no signal to analyse.</p>
            </Notice>
          );
        }

        const { eeg, channelImportance, bandImportance } = latestResults;
        const channels = eeg.metadata.channels;

        const quality = 1 - eeg.quality.artifactWindows / Math.max(1, eeg.quality.totalWindows);
        const occipital = OCCIPITAL.filter((c) => c in eeg.processed);
        const frontal = ["Fz", "F3", "F4", "Cz"].filter((c) => c in eeg.processed);

        const alpha = FREQUENCY_BANDS.find((b) => b.key === "alpha");
        const theta = FREQUENCY_BANDS.find((b) => b.key === "theta");
        const thetaBand = theta?.key as BandKey;

        return (
          <>
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <Panel
                title="Waveform"
                icon={Waves}
                description={`${MONTAGE_LABELS[eeg.metadata.montage]} · ${eeg.metadata.samplingRateHz} Hz · ${channels.length} channels`}
                actions={
                  <span className="text-[11.5px] text-ink-subtle tabular-nums">
                    {eeg.metadata.fileName}
                  </span>
                }
              >
                <EEGChart
                  raw={eeg.raw}
                  processed={eeg.processed}
                  channels={channels}
                  montage={eeg.metadata.montage}
                  samplingRateHz={eeg.metadata.samplingRateHz}
                  defaultChannels={frontal.length ? frontal : channels.slice(0, 4)}
                  height={320}
                  footerNote={
                    <span>
                      Toggle raw or preprocessed in the chart header. Channel selection is per-view
                      and does not change the analysed set.
                    </span>
                  }
                />
              </Panel>

              <div className="flex flex-col gap-4">
                <Panel title="Signal quality">
                  <SignalQualityBar
                    quality={quality}
                    artifactWindows={eeg.quality.artifactWindows}
                    totalWindows={eeg.quality.totalWindows}
                    flatlineRatio={eeg.quality.flatlineRatio}
                  />
                  <div className="mt-4 border-t border-line pt-4">
                    <KeyValueList
                      items={[
                        {
                          label: "Impedance",
                          value: eeg.quality.impedanceOk ? "within range" : "check contacts",
                        },
                        { label: "Windows", value: String(eeg.quality.totalWindows) },
                        { label: "Rejected", value: String(eeg.quality.artifactWindows) },
                        { label: "Flatline", value: formatPercent(eeg.quality.flatlineRatio, 1) },
                        { label: "Duration", value: `${eeg.metadata.durationSeconds}s` },
                        { label: "Format", value: eeg.metadata.format },
                      ]}
                    />
                  </div>
                </Panel>

                <Panel title="Analysis parameters" description="Shared by the whole cohort.">
                  <KeyValueList
                    items={[
                      { label: "Sampling rate", value: `${eeg.metadata.samplingRateHz} Hz` },
                      { label: "Window", value: `${SIGNAL_CONFIG.windowSeconds}s` },
                      {
                        label: "Samples / window",
                        value: String(SIGNAL_CONFIG.samplesPerWindow),
                      },
                      { label: "Sequence", value: `${SIGNAL_CONFIG.sequenceLength} steps` },
                      { label: "Bands", value: String(SIGNAL_CONFIG.bands) },
                      { label: "Model input", value: SIGNAL_CONFIG.modelInputShape },
                    ]}
                  />
                </Panel>
              </div>
            </div>

            <Panel
              title="Band power over time"
              icon={Activity}
              description="Relative power per analysis window across the whole recording."
            >
              <BandPowerChart
                data={eeg.bandPower}
                bands={["delta", "theta", "alpha", "beta"]}
                height={260}
                title="Band power over time"
                subtitle={`Relative power per ${SIGNAL_CONFIG.windowSeconds}s window`}
              />
              <details className="mt-4 rounded-md border border-line bg-surface-subtle px-4 py-3">
                <summary className="cursor-pointer text-[12.5px] font-medium text-ink-muted">
                  Include gamma (experimental, not used by the deployed model)
                </summary>
                <div className="mt-3">
                  <BandPowerChart
                    data={eeg.bandPower}
                    bands={["delta", "theta", "alpha", "beta", "gamma"]}
                    showGamma
                    height={260}
                    title="Band power with gamma"
                    subtitle="Gamma is a declared extension and is excluded from model input"
                  />
                </div>
              </details>
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel
                title="Spectrogram"
                description="Relative power over time and frequency, after preprocessing."
                bodyClassName="p-0"
              >
                <Spectrogram
                  bins={eeg.spectrogram}
                  timeBins={64}
                  freqBins={40}
                  maxHz={45}
                  title="Time–frequency spectrogram"
                  subtitle="Relative power from the accepted windows of this recording"
                />
              </Panel>

              <Panel
                title="Posterior alpha"
                description={`Occipital channels ${occipital.join(", ") || "not present in this montage"}`}
              >
                {occipital.length ? (
                  <>
                    <EEGChart
                      raw={eeg.raw}
                      processed={eeg.processed}
                      channels={channels}
                      montage={eeg.metadata.montage}
                      samplingRateHz={eeg.metadata.samplingRateHz}
                      defaultChannels={occipital}
                      showSelector={false}
                      height={190}
                      title="O1 / O2"
                      subtitle="Occipital derivation"
                    />
                    <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
                      Posterior alpha rises with eyes closed and falls when the participant opens
                      their eyes. A blunted or absent alpha drop is a common finding in ADHD
                      cohorts, which is why the occipital channels are kept as a distinct view
                      rather than averaged into the frontal analysis. {alpha?.range} Hz is the
                      band to read here.
                    </p>
                  </>
                ) : (
                  <p className="py-8 text-center text-[12.5px] text-ink-subtle">
                    This montage does not include occipital electrodes.
                  </p>
                )}
              </Panel>
            </div>

            <Panel
              title="Important features"
              icon={Brain}
              description="Cohort-level attribution for the deployed architecture, shown against this participant's signal."
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="section-label mb-2">
                    Channels by model weight ({thetaBand ? "theta" : ""} context)
                  </p>
                  <ChannelBandBar
                    data={channelImportance.map((c) => ({
                      channel: c.channel,
                      value: c.importance,
                    }))}
                    band={thetaBand}
                    title="Channel importance"
                    subtitle="Mean absolute attribution, cohort average"
                    height={240}
                  />
                </div>
                <div>
                  <p className="section-label mb-2">Band importance</p>
                  <ul className="grid gap-2">
                    {bandImportance.map((b) => {
                      const max = Math.max(...bandImportance.map((x) => x.importance)) || 1;
                      const meta = FREQUENCY_BANDS.find((f) => f.key === b.band);
                      return (
                        <li key={b.band} className="flex items-center gap-3">
                          <span className="w-20 shrink-0 text-[12.5px] font-medium text-ink">
                            {b.label}
                          </span>
                          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${(b.importance / max) * 100}%`,
                                backgroundColor: "var(--color-primary-500)",
                              }}
                            />
                          </span>
                          <span className="w-16 shrink-0 text-right text-[12px] text-ink-muted tabular-nums">
                            {formatRatio(b.importance, 3)}
                          </span>
                          <span className="w-24 shrink-0 text-right text-[11px] text-ink-subtle">
                            {meta?.range ?? ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
                    These are cohort averages for the architecture, not measurements taken from
                    this participant. Per-session contribution is on the report tab.
                  </p>
                </div>
              </div>
            </Panel>
          </>
        );
      }}
    </ParticipantShell>
  );
}
