"use client";

import { useState } from "react";
import { Check, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { KeyValueList, Panel } from "@/components/ui/data";
import { doctorStats, sessionStats } from "@/lib/mock-data";
import { formatNumber, formatPercent } from "@/lib/format";

/** Clinician workspace settings for the research review tool. */
export function DoctorSettingsForm() {
  const [saved, setSaved] = useState(false);
  const [qualityThreshold, setQualityThreshold] = useState("0.80");
  const [defaultSort, setDefaultSort] = useState("signalQuality");
  const [notes, setNotes] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="flex flex-col gap-4">
        <Panel
          title="Review preferences"
          icon={Settings2}
          description="Defaults used when opening the participant roster."
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(true);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="threshold">Signal quality review threshold</Label>
              <Select
                id="threshold"
                value={qualityThreshold}
                onChange={(e) => setQualityThreshold(e.target.value)}
              >
                <option value="0.70">0.70 — flag only poor recordings</option>
                <option value="0.80">0.80 — study default</option>
                <option value="0.90">0.90 — strict</option>
              </Select>
              <p className="text-[11.5px] text-ink-subtle">
                Sessions below this share of accepted windows are placed in the review queue. The
                threshold changes triage order only; it never excludes a session from the
                research dataset.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="sort">Default roster sort</Label>
              <Select
                id="sort"
                value={defaultSort}
                onChange={(e) => setDefaultSort(e.target.value)}
              >
                <option value="signalQuality">Lowest signal quality first</option>
                <option value="displayId">Participant ID</option>
                <option value="lastSession">Most recent session</option>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" defaultValue="Dr. M. Okonkwo" />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes">Review notes template</Label>
              <textarea
                id="notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes stay in this browser in the prototype; no note service is connected."
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-subtle focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit">
                {saved ? (
                  <>
                    <Check className="size-4" />
                    Saved
                  </>
                ) : (
                  "Save preferences"
                )}
              </Button>
              {saved ? (
                <span className="text-[12px] text-ink-subtle">
                  Stored in this browser only for the prototype.
                </span>
              ) : null}
            </div>
          </form>
        </Panel>

        <Panel
          title="What this tool will not do"
          description="Scope limits, stated explicitly."
        >
          <ul className="grid gap-2.5 text-[12.5px] text-ink-muted">
            {[
              "It does not connect to a medical record, and holds no diagnosis entered by a clinician.",
              "It does not adjust, exclude or reweight a session based on review. Recorded data is immutable here.",
              "It does not interpret model output. It shows what the research model produced and stops.",
              "It does not share anything outside this study workspace.",
            ].map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-subtle"
                  aria-hidden
                />
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Study workload">
          <KeyValueList
            items={[
              { label: "EEG participants", value: formatNumber(doctorStats.participants) },
              {
                label: "Completed sessions",
                value: formatNumber(doctorStats.completedAssessments),
              },
              { label: "Flagged", value: formatNumber(doctorStats.flagged) },
              { label: "Review queue", value: String(doctorStats.reviewQueue) },
              { label: "In progress", value: String(sessionStats.inProgress) },
              { label: "This week", value: String(sessionStats.thisWeek) },
              {
                label: "Mean quality",
                value: formatPercent(doctorStats.averageSignalQuality, 1),
              },
            ]}
          />
        </Panel>

        <Notice tone="caution" title="Research use only">
          <p>
            This workspace is for reviewing research data. It must not be used to support a
            diagnosis, a treatment decision, or any other clinical judgement.
          </p>
        </Notice>
      </div>
    </div>
  );
}
