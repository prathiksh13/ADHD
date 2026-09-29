"use client";

import { useState } from "react";
import { Check, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { KeyValueList, Panel } from "@/components/ui/data";
import { researchStats } from "@/lib/mock-data";
import { formatNumber } from "@/lib/format";

/**
 * Researcher settings.
 *
 * Read `researchStats` from the data layer so the account panel always matches
 * the study the prototype is configured for.
 */
export function ResearcherSettingsForm() {
  const [saved, setSaved] = useState(false);
  const [defaultModel, setDefaultModel] = useState("cnn-lstm-attn");
  const [split, setSplit] = useState("participant");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="flex flex-col gap-4">
        <Panel
          title="Workspace preferences"
          icon={Settings2}
          description="Defaults applied when opening a research screen."
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(true);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="model">Default model</Label>
              <Select
                id="model"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
              >
                <option value="cnn-lstm-attn">CNN-LSTM + attention</option>
                <option value="cnn-lstm">CNN-LSTM</option>
                <option value="lstm">LSTM</option>
                <option value="cnn">1D CNN</option>
              </Select>
              <p className="text-[11.5px] text-ink-subtle">
                Opens first on the model and explainability screens.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="split">Evaluation split unit</Label>
              <Select id="split" value={split} onChange={(e) => setSplit(e.target.value)}>
                <option value="participant">Participant-level</option>
                <option value="window">Window-level</option>
              </Select>
              <p className="text-[11.5px] text-ink-subtle">
                Participant-level is required for any headline figure. Window-level evaluation
                inflates apparent accuracy because it treats correlated windows from one person as
                independent samples.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" defaultValue="Dr. A. Rivera" />
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
                  No account service is connected, so nothing was persisted.
                </span>
              ) : null}
            </div>
          </form>
        </Panel>

        <Panel
          title="Reporting safeguards"
          description="Applied to every exported summary from this workspace."
        >
          <ul className="grid gap-2.5 text-[12.5px] text-ink-muted">
            {[
              "Every figure is labelled with its evaluation unit and fold count.",
              "Participant labels are used instead of names in all exports.",
              "Model output is never labelled as a diagnosis in generated text.",
              "Held-out results are kept separate from any tuning history.",
            ].map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary-600" />
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Study" description="Configuration of this prototype instance.">
          <KeyValueList
            items={[
              { label: "Architectures", value: String(researchStats.models) },
              { label: "Evaluated", value: String(researchStats.evaluatedModels) },
              { label: "Evaluation", value: researchStats.evaluationStatus },
              { label: "Windows", value: formatNumber(researchStats.windows) },
              { label: "Sequences", value: formatNumber(researchStats.sequences) },
              { label: "Experiments", value: String(researchStats.experiments) },
            ]}
          />
        </Panel>

        <Notice tone="info" title="Research use only">
          <p>
            This workspace exists to support a research study. Nothing produced here is approved
            for diagnosis or clinical decision-making.
          </p>
        </Notice>
      </div>
    </div>
  );
}
