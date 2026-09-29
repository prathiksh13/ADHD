"use client";

import { useState } from "react";
import { Check, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { KeyValueList, Panel } from "@/components/ui/data";
import { SIGNAL_CONFIG } from "@/lib/constants";
import { formatDate } from "@/lib/format";

/**
 * Participant settings.
 *
 * Preferences are local to this prototype: there is no account service behind
 * them yet, so nothing is persisted to a server.
 */
export function SettingsForm() {
  const [saved, setSaved] = useState(false);
  const [unit, setUnit] = useState("microvolts");
  const [windowLength, setWindowLength] = useState("10");
  const [emailUpdates, setEmailUpdates] = useState("off");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="flex flex-col gap-4">
        <Panel
          title="Display preferences"
          icon={Settings2}
          description="Applies to every EEG and result screen in this browser."
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(true);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="unit">Amplitude unit</Label>
              <Select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="microvolts">Microvolts (µV) — default</option>
                <option value="volts">Volts (V)</option>
                <option value="millivolts">Millivolts (mV)</option>
              </Select>
              <p className="text-[11.5px] text-ink-subtle">
                EEG recordings are conventionally plotted in microvolts. Changing this only affects
                axis labels.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="window">Default trace window</Label>
              <Select
                id="window"
                value={windowLength}
                onChange={(e) => setWindowLength(e.target.value)}
              >
                {[2, 5, 10, 20, 30].map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
                  </option>
                ))}
              </Select>
              <p className="text-[11.5px] text-ink-subtle">
                How much signal each trace row shows at once. Analysis windows stay at{" "}
                {SIGNAL_CONFIG.windowSeconds}s regardless of this setting, so results remain
                comparable across the cohort.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="updates">Result notifications</Label>
              <Select
                id="updates"
                value={emailUpdates}
                onChange={(e) => setEmailUpdates(e.target.value)}
              >
                <option value="off">No notifications</option>
                <option value="ready">When a session finishes processing</option>
                <option value="all">All session activity</option>
              </Select>
              <p className="text-[11.5px] text-ink-subtle">
                No email service is connected, so this setting has no effect yet.
              </p>
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
          title="Profile"
          description="Shown on researcher review screens in place of a real name."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="label">Participant label</Label>
              <Input id="label" defaultValue="P-0142" readOnly />
              <p className="text-[11.5px] text-ink-subtle">
                Assigned by the study team and read-only.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="guardian">Guardian contact</Label>
              <Input id="guardian" defaultValue="guardian@example.org" readOnly />
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Analysis defaults" description="Set by the study protocol.">
          <KeyValueList
            items={[
              { label: "Channels", value: String(SIGNAL_CONFIG.channels) },
              { label: "Sampling rate", value: `${SIGNAL_CONFIG.samplingRateHz} Hz` },
              { label: "Window length", value: `${SIGNAL_CONFIG.windowSeconds}s` },
              {
                label: "Samples per window",
                value: String(SIGNAL_CONFIG.samplesPerWindow),
              },
              { label: "Sequence length", value: String(SIGNAL_CONFIG.sequenceLength) },
              { label: "Frequency bands", value: String(SIGNAL_CONFIG.bands) },
              { label: "Model input", value: SIGNAL_CONFIG.modelInputShape },
            ]}
          />
          <Notice tone="neutral" className="mt-4">
            <p>
              These values come from the study protocol and are shared by every session. They
              cannot be changed per participant, because changing them would make results
              incomparable across the cohort.
            </p>
          </Notice>
        </Panel>

        <Panel title="Account">
          <KeyValueList
            items={[
              { label: "Role", value: "Participant" },
              { label: "Member since", value: formatDate("2026-01-14") },
              { label: "Data sharing", value: "Research use only" },
            ]}
          />
          <p className="mt-4 text-[11.5px] leading-relaxed text-ink-subtle">
            Session data is stored for research analysis. It is not part of your medical record and
            is never used to make a diagnosis.
          </p>
        </Panel>
      </div>
    </div>
  );
}
