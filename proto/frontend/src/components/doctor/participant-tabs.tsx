"use client";

import { Tabs } from "@/components/ui/tabs";

/**
 * Tab bar for a clinician's participant record.
 *
 * The plan asks for tabs rather than one long scroll, so each analysis view is
 * its own addressable route. Of the plan's six tabs, three are separate routes
 * (`/eeg`, `/behavior`, `/report`); "Sessions" and "Model results" are sections
 * of the Overview screen, so they anchor into it rather than linking to a route
 * that would have no content of its own.
 */
export function ParticipantTabs({
  participantId,
  hasBehavior,
  sessionCount,
}: {
  participantId: string;
  hasBehavior: boolean;
  sessionCount: number;
}) {
  const base = `/doctor/participants/${participantId}`;

  return (
    <Tabs
      items={[
        { label: "Overview", href: base, exact: true },
        { label: "EEG", href: `${base}/eeg` },
        {
          label: "Behavior",
          href: `${base}/behavior`,
          count: hasBehavior ? undefined : 0,
        },
        { label: "Sessions", href: `${base}#sessions`, count: sessionCount },
        { label: "Model results", href: `${base}#model-results` },
        { label: "Reports", href: `${base}/report` },
      ]}
    />
  );
}
