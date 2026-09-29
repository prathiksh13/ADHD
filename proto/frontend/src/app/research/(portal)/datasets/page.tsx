import type { Metadata } from "next";
import { Database } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Panel } from "@/components/ui/data";
import { Badge } from "@/components/ui/badge";
import { ChipList, KeyValueList } from "@/components/ui/data";
import { Notice } from "@/components/ui/notice";
import { getDatasets } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { DatasetRecord } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Datasets",
  description: "Inventory of the public datasets used by the study, with access notes.",
};

export default async function ResearchDatasetsPage() {
  const datasets = await getDatasets();
  const eegDatasets = datasets.filter((d) => d.modality !== "Behavior");

  const totalParticipants = datasets.reduce((sum, d) => sum + d.participants, 0);
  const uniqueDatasets = datasets.length;

  return (
    <>
      <PageHeader
        title="Dataset inventory"
        icon={Database}
        breadcrumb={[{ label: "Researcher", href: "/research/dashboard" }, { label: "Datasets" }]}
        description="Every public dataset referenced by the study, its modality split, and the structural caveats that affect how it can be used."
        meta={[
          { label: "Datasets", value: String(uniqueDatasets) },
          { label: "With EEG", value: String(eegDatasets.length) },
          { label: "Rows, summed", value: formatNumber(totalParticipants) },
        ]}
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <Notice tone="caution" title="Population counts are not interchangeable">
          <p>
            Several of these sources publish more than one cohort with different sizes, and the
            per-class split is not always the one that matches the EEG subset actually used. Check
            each record&apos;s notes before quoting a class balance.
          </p>
        </Notice>

        <div className="grid gap-4 xl:grid-cols-2">
          {datasets.map((dataset) => (
            <Panel
              key={dataset.id}
              title={dataset.name}
              description={dataset.id}
              actions={
                <Badge tone={dataset.modality === "Behavior" ? "secondary" : "primary"}>
                  {dataset.modality}
                </Badge>
              }
            >
              <div className="grid gap-4">
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Participants", value: formatNumber(dataset.participants) },
                    { label: "Channels", value: dataset.channels ? String(dataset.channels) : "—" },
                    { label: "Sampling rate", value: dataset.samplingRate },
                    { label: "On disk", value: dataset.sizeOnDisk },
                    { label: "Device", value: dataset.device },
                    { label: "File types", value: dataset.fileTypes.join(", ") },
                  ]}
                />

                <div>
                  <p className="section-label">Class composition</p>
                  <div className="mt-1.5">
                    <ChipList
                      items={[
                        { label: `ADHD ${dataset.adhd ?? "not published"}`, value: "ADHD" },
                        { label: `Control ${dataset.control ?? "not published"}`, value: "Control" },
                        ...(dataset.undetermined
                          ? [{ label: `Undetermined ${dataset.undetermined}`, value: "Other" }]
                          : []),
                        ...(dataset.unknown
                          ? [{ label: `Unknown ${dataset.unknown}`, value: "Other" }]
                          : []),
                      ].map((chip) => chip.label)}
                    />
                  </div>
                </div>

                {dataset.tasks.length ? (
                  <div>
                    <p className="section-label">Tasks recorded</p>
                    <div className="mt-1.5">
                      <ChipList items={dataset.tasks} />
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="section-label">Modality flags</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={dataset.behavior ? "positive" : "neutral"}>
                      {dataset.behavior ? "behavioural labels" : "no behavioural labels"}
                    </Badge>
                    <Badge tone={dataset.mri ? "positive" : "neutral"}>
                      {dataset.mri ? "MRI available" : "no MRI"}
                    </Badge>
                  </div>
                </div>

                <p className="border-t border-line pt-3 text-[12px] leading-relaxed text-ink-muted">
                  {dataset.notes}
                </p>
              </div>
            </Panel>
          ))}
        </div>

        <Panel
          title="Cohort reconciliation"
          description="How the EEG cohorts add up, and where the commonly quoted figures differ."
        >
          <CohortReconciliation datasets={datasets} />
        </Panel>
      </PortalBody>
    </>
  );
}

function CohortReconciliation({ datasets }: { datasets: DatasetRecord[] }) {
  const balladeerEeg = datasets.find((d) => d.id === "balladeer_eeg");
  const balladeerDemo = datasets.find((d) => d.id === "balladeer_demographics");

  const rows = [
    {
      claim: "158 participants, 88 / 50 / 20",
      belongs: "BALLADEER demographics cohort",
      note: "Correct split, but this is the wider population, not the EEG subset used for modelling.",
    },
    {
      claim: "156 participants, no published per-class split",
      belongs: "BALLADEER EEG + behaviour subset",
      note: "This is the population the model input actually comes from.",
    },
    {
      claim: "147 / 110 / 20",
      belongs: "BALLADEER EEG_ONLY view, 277 participants",
      note: "View-wide totals across every EEG dataset, not BALLADEER class counts.",
    },
    {
      claim: "121 participants, 61 / 60",
      belongs: "adhdata EEG",
      note: "Independently published, self-contained cohort with its own class split.",
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line">
              {["Commonly quoted figure", "What it belongs to", "How to use it"].map((label) => (
                <th
                  key={label}
                  className="px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.03em] text-ink-subtle uppercase"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.claim} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono font-medium text-ink">{row.claim}</td>
                <td className="px-4 py-3 text-ink-muted">{row.belongs}</td>
                <td className="px-4 py-3 text-ink-muted">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11.5px] leading-relaxed text-ink-subtle">
        EEG participants available for modelling:{" "}
        <span className="font-medium text-ink-muted">
          {formatNumber((balladeerEeg?.participants ?? 0) + 121)}
        </span>{" "}
        across BALLADEER and adhdata. Demographics coverage reaches{" "}
        <span className="font-medium text-ink-muted">
          {formatNumber(balladeerDemo?.participants ?? 0)}
        </span>{" "}
        participants, so behavioural covariates are not available for every EEG recording.
      </p>
    </div>
  );
}
