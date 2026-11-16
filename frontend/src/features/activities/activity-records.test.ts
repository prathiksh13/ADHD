import { afterEach, describe, expect, it } from "vitest";
import { clearRunLog, getLoggedRuns, markRunSaved, recordRun, recordEegRun, setRunLogScope } from "@/features/activities/run-log";
import { mergeResultRows, numericCell } from "@/features/activities/use-activity-records";

const summary = { congruentTrialCount: 2, incongruentTrialCount: 2, correctCount: 3, errorCount: 1,
  omissionCount: 0, accuracyPercent: 75, congruentAccuracyPercent: 100, incongruentAccuracyPercent: 50,
  meanCongruentReactionTimeMs: 400, meanIncongruentReactionTimeMs: 450, interferenceMs: 50 };
afterEach(() => clearRunLog());
describe("shared activity records", () => {
  it("records practice separately, immediately records scored runs and removes server duplicates", () => {
    setRunLogScope("synthetic-owner");
    recordRun("stroop", "practice", summary, "practice");
    recordRun("stroop", "browser", summary);
    markRunSaved("browser", "server");
    expect(getLoggedRuns().find((r) => r.id === "practice")?.mode).toBe("practice");
    const rows = mergeResultRows(getLoggedRuns(), [{ id: "server", at: new Date().toISOString(), cells: ["75%"] }]);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.mode === "scored")).toHaveLength(1);
  });
  it("never carries visit records into another signed-in account", () => {
    setRunLogScope("synthetic-one"); recordRun("stroop", "one", summary);
    expect(getLoggedRuns()).toHaveLength(1);
    setRunLogScope("synthetic-two"); expect(getLoggedRuns()).toEqual([]);
    expect(recordEegRun({ id: "old-upload", at: new Date().toISOString(), label: "EEG", result: {}, saved: false }, "synthetic-one")).toBe(false);
  });
  it("charts measured values with units and suppresses absent or unreliable values", () => {
    expect(numericCell("3 of 4")).toEqual({ value: 75, unit: "%" });
    expect(numericCell("300 ms")).toEqual({ value: 300, unit: "ms" });
    expect(numericCell("—")).toBeNull();
    expect(numericCell("300 ms (unreliable)")).toBeNull();
    expect(numericCell("0 of 0")).toBeNull();
  });
});
