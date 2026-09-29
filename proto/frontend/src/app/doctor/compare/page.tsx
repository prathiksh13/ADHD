import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PortalBody } from "@/components/layout/portal-shell";
import { Notice } from "@/components/ui/notice";
import { SessionCompare } from "@/components/doctor/session-compare";
import { getSessionResults, listSessions } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { BandPowerPoint } from "@/types/eeg";
import type { BandKey } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Compare sessions",
  description: "Side-by-side comparison of two recorded sessions.",
};

/** Baseline bands only. Gamma is an optional extension and is never compared. */
const BANDS: Exclude<BandKey, "gamma">[] = ["delta", "theta", "alpha", "beta"];

/**
 * Mean power for one band across every window.
 */
function meanOf(points: BandPowerPoint[], band: Exclude<BandKey, "gamma">) {
  if (!points.length) return 0;
  return points.reduce((sum, point) => sum + point[band], 0) / points.length;
}

export default async function DoctorComparePage() {
  const { rows } = await listSessions();

  const candidates = rows
    .filter((s) => s.status === "complete")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 8);

  const details = await Promise.all(candidates.map((session) => getSessionResults(session.id)));

  const items = details.flatMap((detail) => {
    if (!detail) return [];
    const { session, eeg } = detail;
    const bandPoints = eeg.bandPower;

    return [
      {
        id: session.id,
        participant: session.participantLabel,
        startedAt: formatDateTime(session.startedAt),
        duration: formatDuration(session.durationSeconds),
        experiment: session.experiment,
        stage: session.experimentStage,
        device: session.device,
        montage: session.montage,
        samplingRateHz: session.samplingRateHz,
        channels: session.channels,
        windows: session.windows,
        probability: session.probability,
        resultLabel: session.resultLabel,
        flagged: session.flagged,
        flagReason: session.flagReason,
        quality: {
          ...eeg.quality,
          // Share of windows that survived artefact rejection.
          quality: 1 - eeg.quality.artifactWindows / Math.max(1, eeg.quality.totalWindows),
        },
        behavior: session.behavior,
        meanBands: BANDS.map((band) => ({
          band,
          value: meanOf(bandPoints, band),
        })),
      },
    ];
  });

  return (
    <>
      <PageHeader
        title="Compare sessions"
        icon={SlidersHorizontal}
        breadcrumb={[
          { label: "Clinician", href: "/doctor/dashboard" },
          { label: "Compare sessions" },
        ]}
        description="Put two recorded sessions side by side to check what differs in signal, behaviour and model output."
      />

      <PortalBody className="mx-auto w-full max-w-[1400px] space-y-6">
        <Notice tone="caution">
          <p>
            A large difference between two sessions is expected, even from the same person.
            Resting EEG varies with fatigue, medication, time of day and electrode placement, so a
            two-session contrast is a data-quality check, not a clinical comparison.
          </p>
        </Notice>

        {items.length >= 2 ? (
          <SessionCompare items={items} />
        ) : (
          <Notice tone="info">
            <p>At least two completed sessions are needed before a comparison is possible.</p>
          </Notice>
        )}

        <p className="text-[11.5px] leading-relaxed text-ink-subtle">
          Mean band power is shown in relative units averaged over every accepted window. The
          model probability is the classification output of the deployed research architecture
          and is not a diagnosis.
        </p>
      </PortalBody>
    </>
  );
}
