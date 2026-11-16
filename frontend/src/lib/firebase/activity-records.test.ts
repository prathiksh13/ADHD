import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { ACTIVITY_RESULTS } from "@/features/activities/activity-results";
import { activityColumns, activityTitle, readActivityRecord } from "./activity-records";
import { MonitorEngine } from "@/features/attention/monitor-engine";

describe("Firebase summary decoding", () => {
  it("restores derived telemetry with the activity and rejects raw fields in it", () => {
    const telemetry = new MonitorEngine(0, "2026-01-01T00:00:00.000Z", 0).finish(1000, "2026-01-01T00:00:01.000Z");
    const data = { activityId: "stroop", mode: "scored", cells: Array(6).fill("0"), completedAt: Timestamp.now(), schemaVersion: 1, provenance: "participant-browser-summary-v1", attentionTelemetry: telemetry };
    expect(readActivityRecord("id", data)?.attentionTelemetry).toEqual(telemetry);
    expect(readActivityRecord("id", { ...data, attentionTelemetry: { ...telemetry, rawVideo: "x" } })).toBeNull();
  });
  it("restores both modes and each activity's exact columns", () => {
    for (const id of ["cpt", ...ACTIVITY_RESULTS.map((a) => a.id)]) {
      for (const mode of ["practice", "scored"]) {
        const cells = activityColumns(id).map(() => "0");
        const row = readActivityRecord("id", { activityId: id, mode, cells, completedAt: Timestamp.fromMillis(1000), schemaVersion: 1, provenance: "participant-browser-summary-v1" });
        expect(row).toEqual({ id: "id", activityId: id, mode, cells, at: "1970-01-01T00:00:01.000Z" });
        expect(activityTitle(id).length).toBeGreaterThan(0);
      }
    }
  });
  it("rejects unknown schemas, malformed cells and invalid activity ids", () => {
    const data = { activityId: "stroop", mode: "scored", cells: Array(6).fill("0"), completedAt: Timestamp.now(), schemaVersion: 1, provenance: "participant-browser-summary-v1" };
    for (const override of [{ activityId: "unknown" }, { schemaVersion: 99 }, { cells: [] }, { cells: Array(6).fill(8) }, { mode: "invalid" }]) {
      expect(readActivityRecord("id", { ...data, ...override })).toBeNull();
    }
  });
});
