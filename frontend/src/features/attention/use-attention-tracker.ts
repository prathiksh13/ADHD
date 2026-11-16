"use client";

import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import { AttentionChime } from "@/features/attention/attention-audio";
import { AttentionTelemetryEngine } from "@/features/attention/attention-engine";
import { buildAttentionFrame } from "@/features/attention/attention-metrics";
import {
  buildAttentionSessionPayload,
  postAttentionSession,
} from "@/features/attention/attention-session";
import {
  EMPTY_LIVE_METRICS,
  type ActivityMetrics,
  type AttentionLiveMetrics,
  type AttentionSessionPayload,
  type AttentionSummary,
} from "@/features/attention/attention-types";

const TARGET_FRAME_MS = 50;
const UI_UPDATE_MS = 200;
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/face_landmarker.task";

export type AttentionTrackerStatus =
  | "idle"
  | "requesting-camera"
  | "loading-model"
  | "running"
  | "complete"
  | "denied"
  | "unsupported"
  | "error";

export type AttentionSubmitStatus = "idle" | "sending" | "sent" | "failed";

export interface AttentionTracker {
  status: AttentionTrackerStatus;
  submitStatus: AttentionSubmitStatus;
  error: string | null;
  submitError: string | null;
  metrics: AttentionLiveMetrics;
  summary: AttentionSummary | null;
  fps: number;
  isRunning: boolean;
  visualCue: boolean;
  start: () => Promise<void>;
  stop: () => void;
  restartSession: () => void;
  finish: (
    activityMetrics: ActivityMetrics,
    session: { sessionId: string; activityType: string },
  ) => Promise<AttentionSessionPayload | null>;
}

function readableMediaError(error: unknown): {
  status: "denied" | "unsupported" | "error";
  message: string;
} {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return {
        status: "denied",
        message:
          "Camera access was declined. Focus monitoring stays off; you can still complete the activity.",
      };
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return {
        status: "unsupported",
        message:
          "No usable camera was found. Focus monitoring stays off; the activity is unaffected.",
      };
    }
    if (error.name === "NotReadableError") {
      return {
        status: "error",
        message:
          "The camera is busy in another application. Close it and try again, or continue without monitoring.",
      };
    }
  }

  return {
    status: "error",
    message:
      error instanceof Error
        ? error.message
        : "Focus monitoring could not start. The activity is unaffected.",
  };
}

/**
 * Privacy-first attention tracker.
 *
 * The video element is created in memory, never attached to the DOM, and is
 * never recorded, drawn to a canvas, or uploaded. Only derived numeric
 * telemetry leaves this hook.
 */
export function useAttentionTracker(): AttentionTracker {
  const [status, setStatus] = useState<AttentionTrackerStatus>("idle");
  const [submitStatus, setSubmitStatus] =
    useState<AttentionSubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AttentionLiveMetrics>(EMPTY_LIVE_METRICS);
  const [summary, setSummary] = useState<AttentionSummary | null>(null);
  const [fps, setFps] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const engineRef = useRef<AttentionTelemetryEngine | null>(null);
  const chimeRef = useRef<AttentionChime | null>(null);
  const frameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const startTokenRef = useRef(0);
  const disposedRef = useRef(false);
  const lastFrameAtRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastUiUpdateRef = useRef(0);
  const previousAlertStageRef = useRef<0 | 1 | 2>(0);
  const fpsWindowRef = useRef({ startedAt: 0, frames: 0 });

  const teardown = useCallback(() => {
    runningRef.current = false;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    const chime = chimeRef.current;
    chimeRef.current = null;
    if (chime) void chime.close().catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      teardown();
    };
  }, [teardown]);

  const stop = useCallback(() => {
    startTokenRef.current += 1;
    teardown();
    engineRef.current = null;
    setStatus("idle");
    setMetrics(EMPTY_LIVE_METRICS);
    setFps(0);
    setSummary(null);
    setSubmitStatus("idle");
    setSubmitError(null);
  }, [teardown]);

  const restartSession = useCallback(() => {
    engineRef.current?.reset();
    setSummary(null);
    setSubmitStatus("idle");
    setSubmitError(null);
    setMetrics(EMPTY_LIVE_METRICS);
    setFps(0);
    previousAlertStageRef.current = 0;
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || runningRef.current) return;
    startingRef.current = true;
    const token = startTokenRef.current + 1;
    startTokenRef.current = token;
    setError(null);
    setSubmitError(null);
    setSummary(null);
    setSubmitStatus("idle");
    setMetrics(EMPTY_LIVE_METRICS);
    setFps(0);

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStatus("unsupported");
      setError(
        "This browser does not expose camera access. Focus monitoring stays off.",
      );
      startingRef.current = false;
      return;
    }

    try {
      setStatus("requesting-camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 20, max: 30 },
        },
        audio: false,
      });

      if (disposedRef.current || token !== startTokenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = stream;
      videoRef.current = video;
      await video.play();

      if (disposedRef.current || token !== startTokenRef.current) {
        return;
      }

      setStatus("loading-model");
      const { FaceLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

      let landmarker: FaceLandmarker;
      try {
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_PATH,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch {
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_PATH,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      if (disposedRef.current || token !== startTokenRef.current) {
        landmarker.close();
        return;
      }

      landmarkerRef.current = landmarker;
      engineRef.current = new AttentionTelemetryEngine();
      chimeRef.current = new AttentionChime();
      try {
        await chimeRef.current.prime();
      } catch {
        chimeRef.current = null;
      }

      if (disposedRef.current || token !== startTokenRef.current) {
        return;
      }

      previousAlertStageRef.current = 0;
      lastFrameAtRef.current = 0;
      lastVideoTimeRef.current = -1;
      lastUiUpdateRef.current = 0;
      fpsWindowRef.current = { startedAt: performance.now(), frames: 0 };
      runningRef.current = true;
      setStatus("running");

      const tick = () => {
        if (!runningRef.current) return;

        const now = performance.now();
        const videoElement = videoRef.current;
        const landmarkerInstance = landmarkerRef.current;

        if (
          videoElement &&
          landmarkerInstance &&
          videoElement.readyState >= 2 &&
          now - lastFrameAtRef.current >= TARGET_FRAME_MS &&
          videoElement.currentTime !== lastVideoTimeRef.current
        ) {
          lastFrameAtRef.current = now;
          lastVideoTimeRef.current = videoElement.currentTime;

          try {
            const result: FaceLandmarkerResult =
              landmarkerInstance.detectForVideo(videoElement, now);
            const frame = buildAttentionFrame({
              landmarks: result.faceLandmarks[0],
              blendshapes: result.faceBlendshapes?.[0]?.categories,
              matrix: result.facialTransformationMatrixes?.[0]?.data,
              performanceNow: now,
              timestamp: new Date().toISOString(),
            });

            const next = engineRef.current?.ingest(frame);
            if (next) {
              if (
                next.alertStage === 2 &&
                previousAlertStageRef.current < 2
              ) {
                const chime = chimeRef.current;
                if (chime) void chime.play().catch(() => {});
              }
              previousAlertStageRef.current = next.alertStage;

              const window = fpsWindowRef.current;
              window.frames += 1;
              if (now - window.startedAt >= 1000) {
                setFps(
                  Math.round(
                    (window.frames * 1000) / (now - window.startedAt),
                  ),
                );
                fpsWindowRef.current = { startedAt: now, frames: 0 };
              }

              if (now - lastUiUpdateRef.current >= UI_UPDATE_MS) {
                lastUiUpdateRef.current = now;
                setMetrics(next);
              }
            }
          } catch {
            // A single bad frame must not end the activity. The next frame retries.
          }
        }

        frameRef.current = requestAnimationFrame(tick);
      };

      frameRef.current = requestAnimationFrame(tick);
    } catch (caught) {
      teardown();
      if (!disposedRef.current && token === startTokenRef.current) {
        const readable = readableMediaError(caught);
        setStatus(readable.status);
        setError(readable.message);
      }
    } finally {
      startingRef.current = false;
    }
  }, [teardown]);

  const finish = useCallback(
    async (
      activityMetrics: ActivityMetrics,
      session: { sessionId: string; activityType: string },
    ): Promise<AttentionSessionPayload | null> => {
      const engine = engineRef.current;
      if (!engine) return null;

      const completedAt = new Date().toISOString();
      const summary = engine.finish(performance.now(), completedAt);
      const payload = buildAttentionSessionPayload({
        sessionId: session.sessionId,
        activityType: session.activityType,
        startedAt: engine.startedAt,
        completedAt,
        activityMetrics,
        telemetryEvents: engine.telemetryEvents,
        summary,
      });

      teardown();
      engineRef.current = null;
      setMetrics(EMPTY_LIVE_METRICS);
      setFps(0);
      setSummary(summary);
      setStatus("complete");
      setSubmitStatus("sending");
      setSubmitError(null);

      try {
        await postAttentionSession(payload);
        setSubmitStatus("sent");
      } catch (caught) {
        setSubmitStatus("failed");
        setSubmitError(
          caught instanceof Error
            ? caught.message
            : "Attention telemetry could not be analyzed.",
        );
      }

      return payload;
    },
    [teardown],
  );

  return {
    status,
    submitStatus,
    error,
    submitError,
    metrics,
    summary,
    fps,
    isRunning: status === "running",
    visualCue: status === "running" && metrics.visualCue,
    start,
    stop,
    restartSession,
    finish,
  };
}
