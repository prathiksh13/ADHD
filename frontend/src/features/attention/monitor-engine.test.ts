import { describe, expect, it } from "vitest";
import { MonitorEngine } from "./monitor-engine";
import { isSessionTelemetrySummary } from "./telemetry-validation";
import { captureActivityTelemetry, clearActivityTelemetry, registerTelemetryCapture } from "./telemetry-registry";
import type { AttentionFrame } from "./attention-types";
const iso = (ms: number) => new Date(1700000000000 + ms).toISOString();
function frame(ms: number, overrides: Partial<AttentionFrame> = {}): AttentionFrame {
  return { performanceNow: ms, timestamp: iso(ms), facePresent: true, ear: .3, blinkLeft: 0, blinkRight: 0,
    browDownLeft: 0, browDownRight: 0, mouthPressLeft: 0, mouthPressRight: 0, eyeSquintLeft: 0, eyeSquintRight: 0,
    jawOpen: 0, yawDeg: 0, pitchDeg: 0, irisHorizontal: 0, irisVertical: 0, ...overrides };
}
function feed(engine: MonitorEngine, from: number, to: number, overrides: Partial<AttentionFrame> = {}) {
  let live = engine.ingest(frame(from, overrides));
  for (let t = from + 50; t <= to; t += 50) live = engine.ingest(frame(t, overrides));
  return live;
}
describe("global attention engine", () => {
  it("detects sustained looking away during slow CPU inference instead of resetting every frame", () => {
    const engine = new MonitorEngine(0, iso(0));
    for (let time = 0; time <= 2800; time += 350) engine.ingest(frame(time));
    let live = engine.ingest(frame(3150, { yawDeg: 35 }));
    for (let time = 3500; time <= 8400; time += 350) live = engine.ingest(frame(time, { yawDeg: 35 }));
    expect(live.calibrating).toBe(false);
    expect(live.alertStage).toBe(2);
    expect(engine.finish(8400, iso(8400)).distractionCount).toBe(1);
  });
  it("calibrates normal camera offset and naturally narrow eyes without an absolute-gaze deadlock", () => {
    const engine = new MonitorEngine(0, iso(0));
    const rest = { pitchDeg: 23, yawDeg: 8, irisVertical: .65, irisHorizontal: .18, ear: .17 };
    expect(feed(engine, 0, 2600, rest).calibrating).toBe(false);
    expect(feed(engine, 2650, 8000, rest).visualCue).toBe(false);
    expect(feed(engine, 8050, 11000, { ...rest, yawDeg: 40 }).visualCue).toBe(true);
    expect(engine.ingest(frame(11050, rest)).visualCue).toBe(false);
    // Iris-only aversion is also relative to the screen-facing baseline.
    expect(feed(engine, 11100, 14000, { ...rest, irisHorizontal: .8 }).visualCue).toBe(true);
  });
  it("keeps a sustained alert timer through threshold jitter but clears on a centred return", () => {
    const engine = new MonitorEngine(0, iso(0), 0);
    feed(engine, 0, 1000);
    for (let time = 1050; time <= 6000; time += 50) engine.ingest(frame(time, { yawDeg: time % 100 ? 23 : 21 }));
    expect(engine.ingest(frame(6050, { yawDeg: 23 })).visualCue).toBe(true);
    expect(engine.ingest(frame(6100)).visualCue).toBe(false);
  });
  it("ignores iris movement during a blink and brief face detection dropouts", () => {
    const engine = new MonitorEngine(0, iso(0), 0);
    feed(engine, 0, 1000);
    expect(feed(engine, 1050, 1150, { ear: .1, irisVertical: 2 }).state).toBe("ON_SCREEN");
    engine.ingest(frame(1200));
    expect(feed(engine, 1250, 1400, { facePresent: false }).state).toBe("ON_SCREEN");
    engine.ingest(frame(1450));
    expect(engine.finish(1450, iso(1450)).distractionCount).toBe(0);
  });
  it("does not reset an ongoing iris distraction whenever the user blinks", () => {
    const engine = new MonitorEngine(0, iso(0), 0);
    feed(engine, 0, 1000);
    feed(engine, 1050, 3000, { irisHorizontal: .6 });
    feed(engine, 3050, 3200, { ear: .1 });
    expect(feed(engine, 3250, 3800, { irisHorizontal: .6 }).visualCue).toBe(true);
    expect(engine.ingest(frame(3850)).visualCue).toBe(false);
  });
  it("preserves completed observations when manually recalibrating, and excludes the new baseline interval", () => {
    const engine = new MonitorEngine(0, iso(0));
    feed(engine, 0, 2600);
    feed(engine, 2650, 7000, { yawDeg: 35 });
    engine.recalibrate(7050, iso(7050));
    expect(feed(engine, 7100, 9700, { pitchDeg: 24 }).calibrating).toBe(false);
    expect(feed(engine, 9750, 11000, { pitchDeg: 24 }).visualCue).toBe(false);
    const summary = engine.finish(11000, iso(11000));
    expect(summary.distractionCount).toBe(1);
    expect(summary.observedDurationMs).toBeLessThan(8000);
    expect(summary.telemetryEvents.find((event) => event.type === "DISTRACTION_END")?.recoveryLatencyMs).toBeUndefined();
  });
  it("clears cues on open-eye return even while historical PERCLOS is elevated", () => {
    const engine = new MonitorEngine(0, iso(0), 0);
    feed(engine, 0, 1000);
    expect(feed(engine, 1050, 13000, { ear: .1 }).visualCue).toBe(true);
    const recovery = engine.ingest(frame(13050));
    expect(recovery.perclos).toBeGreaterThan(.15);
    expect(recovery.visualCue).toBe(false);
    expect(recovery.alertStage).toBe(0);
  });
  it("silently calibrates 2.5 seconds of visible neutral samples and removes resting offsets", () => {
    const engine = new MonitorEngine(0, iso(0));
    expect(feed(engine, 0, 2000, { facePresent: false }).calibrating).toBe(true);
    const rest = { browDownLeft: .6, browDownRight: .6, mouthPressLeft: .6, mouthPressRight: .6 };
    expect(feed(engine, 2050, 4600, rest).calibrating).toBe(false);
    const live = feed(engine, 4650, 8000, rest);
    expect(live.affect).toBe("Neutral"); expect(live.visualCue).toBe(false);
    expect(engine.finish(8000, iso(8000)).telemetryEvents).toEqual([]);
  });
  it("detects 80–400ms blinks, excludes winks and marks prolonged closure", () => {
    const engine = new MonitorEngine(0, iso(0), 0);
    feed(engine, 0, 1000);
    feed(engine, 1050, 1150, { ear: .1 }); engine.ingest(frame(1200));
    feed(engine, 1250, 1700, { blinkLeft: .9 }); engine.ingest(frame(1750));
    feed(engine, 1760, 1780, { ear: .2, leftEar: .1, rightEar: .3 });
    engine.ingest(frame(1790));
    const live = feed(engine, 1800, 4400, { ear: .1, blinkLeft: .9, blinkRight: .9 });
    expect(live.affect).toBe("Fatigued");
    const summary = engine.finish(4450, iso(4450));
    expect(summary.totalBlinks).toBe(1);
    expect(summary.telemetryEvents.find((e) => e.type === "BLINK")?.durationMs).toBe(150);
  });
  it("triggers exact visual/audio stages, repeats only after cooldown, and records measured recovery", () => {
    const engine = new MonitorEngine(0, iso(0), 0);
    feed(engine, 0, 1000);
    expect(feed(engine, 1050, 3500, { yawDeg: 30 }).alertStage).toBe(0);
    expect(engine.ingest(frame(3550, { yawDeg: 30 })).alertStage).toBe(1);
    expect(feed(engine, 3600, 5550, { yawDeg: 30 }).alertStage).toBe(2);
    feed(engine, 5600, 15600, { yawDeg: 30 });
    expect(engine.ingest(frame(15650)).visualCue).toBe(false);
    const summary = engine.finish(15700, iso(15700));
    expect(summary.telemetryEvents.filter((e) => e.channel === "audio")).toHaveLength(2);
    expect(summary.telemetryEvents.find((e) => e.type === "DISTRACTION_END")?.recoveryLatencyMs).toBe(12100);
    expect(summary.avgRecoveryLatencyMs).toBe(12100);
    expect(isSessionTelemetrySummary(summary)).toBe(true);
  });
  it("does not count pauses, fabricate recovery at exit or emit muted audio events", () => {
    const engine = new MonitorEngine(0, iso(0), 0);
    for (let t = 0; t <= 6000; t += 50) engine.ingest(frame(t, { yawDeg: 30 }), false);
    engine.pause(6000, iso(6000));
    feed(engine, 12000, 13000);
    const summary = engine.finish(13000, iso(13000));
    expect(summary.observedDurationMs).toBe(7000);
    expect(summary.avgRecoveryLatencyMs).toBe(0);
    expect(summary.telemetryEvents.filter((e) => e.channel === "audio")).toEqual([]);
    expect(summary.telemetryEvents.some((e) => e.reason === "monitoring-paused")).toBe(true);
    expect(engine.finish(99999, iso(99999))).toEqual(summary);
  });
  it("uses EMA and 1.5-second hysteresis for frustration, yawning and engagement", () => {
    const engine = new MonitorEngine(0, iso(0), 0);
    feed(engine, 0, 1000);
    const angry = { browDownLeft: .9, browDownRight: .9, mouthFrownLeft: .9, mouthFrownRight: .9 };
    expect(feed(engine, 1050, 2000, angry).affect).toBe("Neutral");
    expect(feed(engine, 2050, 3000, angry).affect).toBe("Frustrated");
    expect(feed(engine, 3050, 5000, { jawOpen: .6 }).affect).toBe("Fatigued");
    expect(feed(engine, 5050, 7500, { taskFocused: true }).affect).toBe("Engaged");
  });
  it("rejects images and arbitrary extras at every telemetry level; scopes completed summaries", () => {
    const engine = new MonitorEngine(0, iso(0), 0); feed(engine, 0, 1000);
    const summary = engine.finish(1000, iso(1000));
    expect(isSessionTelemetrySummary({ ...summary, rawFrame: "data:image/png;base64,x" })).toBe(false);
    expect(isSessionTelemetrySummary({ ...summary, telemetryEvents: [{ type: "BLINK", performanceNow: 1, timestamp: iso(1), elapsedMs: 1, frame: "x" }] })).toBe(false);
    registerTelemetryCapture(() => summary);
    expect(captureActivityTelemetry("stroop", "one")).toEqual(summary);
    registerTelemetryCapture(null); clearActivityTelemetry();
    expect(captureActivityTelemetry("stroop", "one")).toBeNull();
  });
});
