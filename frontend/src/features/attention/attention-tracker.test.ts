import { describe, expect, it } from "vitest";
import { AttentionTelemetryEngine } from "@/features/attention/attention-engine";
import {
  buildAttentionSessionPayload,
  validateAttentionSessionPayload,
} from "@/features/attention/attention-session";
import {
  calculateEyeAspectRatio,
  calculateIrisOffset,
  gazeState,
  headPoseFromMatrix,
} from "@/features/attention/attention-metrics";
import type {
  AttentionFrame,
  AttentionSummary,
} from "@/features/attention/attention-types";

const START = 1000;
const ISO = new Date("2026-01-01T10:00:00.000Z").toISOString();

function at(ms: number): string {
  return new Date(Date.parse(ISO) + ms).toISOString();
}

function frame(
  performanceNow: number,
  overrides: Partial<AttentionFrame> = {},
): AttentionFrame {
  return {
    ear: 0.3,
    blinkLeft: 0,
    blinkRight: 0,
    browDownLeft: 0,
    browDownRight: 0,
    mouthPressLeft: 0,
    mouthPressRight: 0,
    eyeSquintLeft: 0,
    eyeSquintRight: 0,
    jawOpen: 0,
    yawDeg: 0,
    pitchDeg: 0,
    irisHorizontal: 0,
    irisVertical: 0,
    facePresent: true,
    performanceNow,
    timestamp: at(performanceNow - START),
    ...overrides,
  };
}

function landmarks(): Array<{ x: number; y: number; z: number }> {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (index: number, x: number, y: number) => {
    points[index] = { x, y, z: 0 };
  };

  set(33, 0.2, 0.5);
  set(133, 0.4, 0.5);
  set(159, 0.3, 0.46);
  set(145, 0.3, 0.54);
  set(158, 0.28, 0.47);
  set(153, 0.28, 0.53);

  set(362, 0.6, 0.5);
  set(263, 0.8, 0.5);
  set(386, 0.7, 0.46);
  set(374, 0.7, 0.54);
  set(385, 0.68, 0.47);
  set(373, 0.68, 0.53);

  for (const index of [468, 469, 470, 471, 472]) set(index, 0.3, 0.5);
  for (const index of [473, 474, 475, 476, 477]) set(index, 0.7, 0.5);

  return points;
}

function validSummary(): AttentionSummary {
  return {
    focusPercentage: 92.5,
    totalBlinks: 14,
    meanBlinkRatePerMin: 17.2,
    distractionCount: 2,
    avgRecoveryLatencyMs: 1200,
    emotionTimeline: [
      {
        state: "Engaged",
        performanceNow: 100,
        timestamp: ISO,
        elapsedMs: 0,
      },
    ],
    sessionDurationMs: 60_000,
    faceVisiblePercentage: 98,
    totalDistractionDurationMs: 4200,
    longestDistractionMs: 2800,
  };
}

describe("attention feature extraction", () => {
  it("computes EAR from the requested eyelid landmarks", () => {
    const open = calculateEyeAspectRatio(landmarks());
    expect(open.average).toBeGreaterThan(0.21);
    expect(open.left).toBeCloseTo(0.35, 3);
    expect(open.right).toBeCloseTo(0.35, 3);

    const closedPoints = landmarks();
    closedPoints[159] = { x: 0.3, y: 0.49, z: 0 };
    closedPoints[145] = { x: 0.3, y: 0.51, z: 0 };
    closedPoints[158] = { x: 0.28, y: 0.495, z: 0 };
    closedPoints[153] = { x: 0.28, y: 0.505, z: 0 };
    closedPoints[386] = { x: 0.7, y: 0.49, z: 0 };
    closedPoints[374] = { x: 0.7, y: 0.51, z: 0 };
    closedPoints[385] = { x: 0.68, y: 0.495, z: 0 };
    closedPoints[373] = { x: 0.68, y: 0.505, z: 0 };
    expect(calculateEyeAspectRatio(closedPoints).average).toBeLessThan(0.21);
  });

  it("normalises iris displacement and classifies off-screen gaze", () => {
    const points = landmarks();
    for (const index of [468, 469, 470, 471, 472]) {
      points[index] = { x: 0.36, y: 0.52, z: 0 };
    }
    for (const index of [473, 474, 475, 476, 477]) {
      points[index] = { x: 0.76, y: 0.52, z: 0 };
    }
    const offset = calculateIrisOffset(points);
    expect(offset.horizontal).toBeCloseTo(0.6, 2);
    expect(offset.vertical).toBeCloseTo(0.5, 2);

    const base = frame(0);
    expect(gazeState(base).state).toBe("ON_SCREEN");
    expect(gazeState({ ...base, yawDeg: 25 }).state).toBe("OFF_SCREEN");
    expect(gazeState({ ...base, pitchDeg: -20 }).state).toBe("OFF_SCREEN");
    expect(
      gazeState({ ...base, irisHorizontal: 0.5 }).reason,
    ).toBe("iris-averted");
    expect(gazeState({ ...base, irisVertical: 0.5 }).state).toBe("OFF_SCREEN");
    expect(gazeState({ ...base, facePresent: false }).state).toBe("OFF_SCREEN");
  });

  it("reads yaw and pitch from the column-major transformation matrix", () => {
    const identity = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    expect(headPoseFromMatrix(identity)?.yawDeg).toBeCloseTo(0, 5);

    const yaw = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      Math.sin(Math.PI / 6), 0, Math.cos(Math.PI / 6), 0,
      0, 0, 0, 1,
    ];
    expect(headPoseFromMatrix(yaw)?.yawDeg).toBeCloseTo(30, 5);

    const pitch = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, -Math.sin(Math.PI / 9), Math.cos(Math.PI / 9), 0,
      0, 0, 0, 1,
    ];
    expect(headPoseFromMatrix(pitch)?.pitchDeg).toBeCloseTo(20, 5);
  });
  it("keeps iris offsets unchanged when the entire head rolls", () => {
    const points = landmarks();
    for (const index of [468, 469, 470, 471, 472, 473, 474, 475, 476, 477]) points[index].x += .04;
    const before = calculateIrisOffset(points);
    const angle = Math.PI / 6;
    const rolled = points.map(({ x, y, z }) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle), z }));
    const after = calculateIrisOffset(rolled);
    expect(after.horizontal).toBeCloseTo(before.horizontal, 6);
    expect(after.vertical).toBeCloseTo(before.vertical, 6);
  });
});

describe("attention telemetry engine", () => {
  it("counts discrete blinks only inside the 80-400 ms band", () => {
    const engine = new AttentionTelemetryEngine(START, ISO);
    engine.ingest(frame(START));
    engine.ingest(frame(START + 100, { ear: 0.1 }));

    engine.ingest(frame(START + 350, { ear: 0.1 }));
    engine.ingest(frame(START + 420));

    engine.ingest(frame(START + 500, { ear: 0.1 }));
    engine.ingest(frame(START + 540));
    engine.ingest(frame(START + 600, { ear: 0.1 }));
    engine.ingest(frame(START + 1100));

    const events = engine.telemetryEvents.filter((event) => event.type === "BLINK");
    expect(events).toHaveLength(1);
    expect(events[0]?.durationMs).toBe(320);
  });

  it("marks prolonged closure as fatigue and records a distraction", () => {
    const engine = new AttentionTelemetryEngine(START, ISO);
    let metrics = engine.ingest(frame(START));
    metrics = engine.ingest(frame(START + 900, { ear: 0.1 }));

    for (let elapsed = 1000; elapsed <= 3000; elapsed += 100) {
      metrics = engine.ingest(frame(START + elapsed, { ear: 0.1 }));
    }

    expect(metrics.state).toBe("OFF_SCREEN");
    expect(metrics.affect).toBe("Fatigued");
    expect(
      engine.telemetryEvents.some(
        (event) =>
          event.type === "DISTRACTION_START" &&
          event.reason === "fatigue-closure",
      ),
    ).toBe(true);
  });

  it("escalates visual and audio alerts and respects the 10-second chime cooldown", () => {
    const engine = new AttentionTelemetryEngine(START, ISO);
    const offscreen = (elapsed: number) =>
      engine.ingest(frame(START + elapsed, { yawDeg: 30 }));

    let metrics = offscreen(0);
    for (let elapsed = 50; elapsed <= 4600; elapsed += 50) {
      metrics = offscreen(elapsed);
    }

    expect(metrics.alertStage).toBe(2);
    const alerts = engine.telemetryEvents.filter(
      (event) => event.type === "ALERT_TRIGGERED",
    );
    expect(alerts.map((event) => event.channel)).toEqual(["visual", "audio"]);
    expect(alerts[0]?.elapsedMs).toBeGreaterThanOrEqual(2500);
    expect(alerts[1]?.elapsedMs).toBeGreaterThanOrEqual(4500);

    engine.ingest(frame(START + 4700));

    for (let elapsed = 6000; elapsed <= 10600; elapsed += 50) {
      metrics = offscreen(elapsed);
    }
    expect(metrics.alertStage).toBe(1);

    for (let elapsed = 10650; elapsed <= 14600; elapsed += 50) {
      metrics = offscreen(elapsed);
    }
    expect(metrics.alertStage).toBe(2);
    expect(
      engine.telemetryEvents.filter(
        (event) => event.type === "ALERT_TRIGGERED" && event.channel === "audio",
      ),
    ).toHaveLength(2);
  });

  it("summarises focus time, blink rate and recovery latency", () => {
    const engine = new AttentionTelemetryEngine(START, ISO);

    for (let elapsed = 0; elapsed <= 1000; elapsed += 50) {
      engine.ingest(frame(START + elapsed));
    }
    for (let elapsed = 1050; elapsed <= 3000; elapsed += 50) {
      engine.ingest(frame(START + elapsed, { yawDeg: 30 }));
    }
    for (let elapsed = 3050; elapsed <= 4000; elapsed += 50) {
      engine.ingest(frame(START + elapsed));
    }

    const summary = engine.finish(START + 4000, at(4000));
    expect(summary.focusPercentage).toBeGreaterThan(40);
    expect(summary.focusPercentage).toBeLessThan(60);
    expect(summary.distractionCount).toBe(1);
    expect(summary.avgRecoveryLatencyMs).toBeGreaterThan(1800);
    expect(summary.faceVisiblePercentage).toBe(100);
    expect(summary.emotionTimeline.length).toBeGreaterThan(0);
  });

  it("smooths emotion shifts before logging them", () => {
    const engine = new AttentionTelemetryEngine(START, ISO);
    const metrics = engine.ingest(
      frame(START, { browDownLeft: 0.9, browDownRight: 0.9 }),
    );
    expect(metrics.affect).toBe("Frustrated");

    for (let elapsed = 200; elapsed <= 1400; elapsed += 200) {
      engine.ingest(
        frame(START + elapsed, { browDownLeft: 0.1, browDownRight: 0.1 }),
      );
    }
    expect(
      engine.telemetryEvents.some((event) => event.type === "EMOTION_SHIFT"),
    ).toBe(true);
  });
});

describe("attention session payload", () => {
  const payload = () =>
    buildAttentionSessionPayload({
      sessionId: "cpt-run-1",
      activityType: "cpt",
      startedAt: ISO,
      completedAt: at(60_000),
      activityMetrics: {
        accuracy: 84,
        reactionTimeMs: 412,
        commissionErrors: 2,
        omissionErrors: 1,
      },
      telemetryEvents: [
        {
          type: "BLINK",
          performanceNow: 1234.5,
          timestamp: ISO,
          elapsedMs: 234.5,
          durationMs: 150,
        },
      ],
      summary: validSummary(),
    });

  it("accepts a structured summary payload", () => {
    const result = validateAttentionSessionPayload(payload());
    expect(result.ok).toBe(true);
  });

  it("rejects unsupported events and malformed summaries", () => {
    const badEvent = payload() as unknown as Record<string, unknown>;
    badEvent.telemetryEvents = [
      { type: "RAW_VIDEO", performanceNow: 1, timestamp: ISO, elapsedMs: 1 },
    ];
    expect(validateAttentionSessionPayload(badEvent).ok).toBe(false);

    const badSummary = payload() as unknown as Record<string, unknown>;
    badSummary.summary = { ...validSummary(), focusPercentage: "high" };
    expect(validateAttentionSessionPayload(badSummary).ok).toBe(false);
  });
});
