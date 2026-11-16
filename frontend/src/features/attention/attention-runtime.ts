import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { AttentionChime } from "./attention-audio";
import { MonitorEngine } from "./monitor-engine";
import { buildAttentionFrame } from "./attention-metrics";
import { EMPTY_LIVE_METRICS, type AttentionLiveMetrics } from "./attention-types";

export type CameraPermission = "idle" | "requesting" | "granted" | "denied" | "no-camera";
export const CAMERA_CONSTRAINTS = { video: { width: 640, height: 480, facingMode: "user" }, audio: false } as const;
export function cameraError(error: unknown): { permission: CameraPermission; message: string } {
  const name = error instanceof Error ? error.name : "";
  if (["NotAllowedError", "SecurityError"].includes(name)) return { permission: "denied", message: "Camera permission is blocked. Allow camera access in your browser's site settings, then retry. Activities work without tracking." };
  if (["NotFoundError", "OverconstrainedError"].includes(name)) return { permission: "no-camera", message: "No usable camera was found. Connect a camera or continue without tracking." };
  if (name === "NotReadableError") return { permission: "idle", message: "The camera is busy. Close other camera apps, then pause and resume tracking to retry." };
  return { permission: "idle", message: "The camera or face model could not start. Close other camera apps and retry. Activities work without tracking." };
}
export interface MonitorStatus { running: boolean; loading: boolean; metrics: AttentionLiveMetrics; error: string | null; permission: CameraPermission; audioReady: boolean }
export const EMPTY_MONITOR: MonitorStatus = { running: false, loading: false, metrics: EMPTY_LIVE_METRICS, error: null, permission: "idle", audioReady: false };

/** Owns ephemeral video resources. Cancellation invalidates every asynchronous acquisition. */
export class AttentionRuntime {
  readonly chime = new AttentionChime();
  private engine: MonitorEngine | null = null;
  private activityId: string | null = null;
  private owner: symbol | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private detector: FaceLandmarker | null = null;
  private raf: number | null = null;
  private generation = 0;
  private sampled = false;
  private lastUi = 0;
  private lastAudio = -Infinity;
  private interactionAt = -Infinity;
  private metrics = EMPTY_LIVE_METRICS;
  muted = false;
  toggleMute() { this.muted = !this.muted; this.chime.stop(); return this.muted; }
  noteInteraction() { this.interactionAt = performance.now(); }
  recalibrate() {
    if (!this.engine || !this.stream) return;
    this.chime.stop();
    this.engine.recalibrate(performance.now(), new Date().toISOString());
    this.metrics = { ...EMPTY_LIVE_METRICS, calibrating: true, calibrationProgress: 0 };
    this.update({ ...EMPTY_MONITOR, running: true, permission: "granted", metrics: this.metrics, audioReady: this.chime.ready });
  }
  constructor(private update: (status: MonitorStatus) => void) {}
  bind(activityId: string, owner: symbol) {
    if (this.owner !== owner) { this.cancel(false); this.engine = null; this.sampled = false; this.metrics = EMPTY_LIVE_METRICS; this.lastAudio = -Infinity; }
    this.owner = owner; this.activityId = activityId;
  }
  async start(activityId: string, owner: symbol) {
    this.bind(activityId, owner);
    this.cancel(false);
    const token = this.generation;
    this.engine ??= new MonitorEngine(performance.now(), new Date().toISOString());
    this.update({ ...EMPTY_MONITOR, loading: true, permission: "requesting" });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("No camera API"), { name: "NotFoundError" });
      let stream: MediaStream | undefined;
      // Some camera drivers need a short release interval after a route exit or pause.
      for (let attempt = 0; attempt < 3 && token === this.generation; attempt++) {
        try { stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS); break; }
        catch (error) {
          if (!(error instanceof Error) || !["NotReadableError", "AbortError"].includes(error.name) || attempt === 2) throw error;
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      if (!stream) return;
      if (token !== this.generation) { stream.getTracks().forEach((t) => t.stop()); return; }
      this.stream = stream;
      const video = document.createElement("video");
      video.muted = true; video.playsInline = true; video.srcObject = stream; this.video = video;
      await video.play();
      if (token !== this.generation) return;
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      if (token !== this.generation) return;
      const options = { runningMode: "VIDEO" as const, numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true };
      let detector: FaceLandmarker;
      try { detector = await FaceLandmarker.createFromOptions(files, { ...options, baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "GPU" } }); }
      catch { detector = await FaceLandmarker.createFromOptions(files, { ...options, baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "CPU" } }); }
      if (token !== this.generation) { detector.close(); return; }
      this.detector = detector;
      this.update({ ...EMPTY_MONITOR, running: true, permission: "granted", metrics: { ...EMPTY_LIVE_METRICS, calibrating: true } });
      let lastFrame = -Infinity, lastVideo = -1, failures = 0;
      const tick = () => {
        if (token !== this.generation) return;
        const now = performance.now();
        if (video.readyState >= 2 && now - lastFrame >= 50 && video.currentTime !== lastVideo) {
          lastFrame = now; lastVideo = video.currentTime;
          try {
            const result = detector.detectForVideo(video, now);
            const frame = buildAttentionFrame({ landmarks: result.faceLandmarks[0], blendshapes: result.faceBlendshapes?.[0]?.categories,
              matrix: result.facialTransformationMatrixes?.[0]?.data, aspectRatio: video.videoWidth / video.videoHeight,
              performanceNow: now, timestamp: new Date().toISOString() });
            frame.taskFocused = document.hasFocus() && now - this.interactionAt < 5000;
            const previousCue = this.metrics.visualCue;
            this.metrics = this.engine!.ingest(frame, !this.muted && this.chime.ready);
            this.sampled = true; failures = 0;
            if (!this.metrics.visualCue) this.chime.stop();
            if (Number.isFinite(this.engine!.lastAudioAt) && this.engine!.lastAudioAt !== this.lastAudio) {
              this.lastAudio = this.engine!.lastAudioAt;
              if (!this.muted) void this.chime.play().catch(() => {});
            }
            // Recovery clears UI on the same frame; routine measurements render at 5 Hz.
            if ((previousCue && !this.metrics.visualCue) || now - this.lastUi >= 200) {
              this.lastUi = now;
              this.update({ running: true, loading: false, permission: "granted", metrics: this.metrics, error: null, audioReady: this.chime.ready });
            }
          } catch {
            if (++failures >= 20) { this.cancel(true); this.update({ ...EMPTY_MONITOR, permission: "granted", error: "Face tracking stopped after repeated inference errors. Retry or continue without tracking." }); return; }
          }
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => {
        if (token === this.generation) { this.cancel(true); this.update({ ...EMPTY_MONITOR, permission: "denied", error: "Camera access ended. Tracking is off." }); }
      }, { once: true }));
    } catch (error) {
      if (token !== this.generation) return;
      this.cancel(true);
      const readable = cameraError(error);
      this.update({ ...EMPTY_MONITOR, permission: readable.permission, error: readable.message });
    }
  }
  cancel(pauseEngine = true) {
    this.generation++;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null;
    if (this.video) { this.video.pause(); this.video.srcObject = null; this.video.remove(); this.video = null; }
    this.detector?.close(); this.detector = null; this.chime.stop();
    if (pauseEngine) this.engine?.pause(performance.now(), new Date().toISOString());
  }
  finish(activityId: string) {
    if (this.activityId !== activityId) return null;
    const summary = this.sampled ? this.engine?.finish(performance.now(), new Date().toISOString()) ?? null : null;
    this.cancel(false); this.engine = null; this.sampled = false; this.metrics = EMPTY_LIVE_METRICS; this.lastAudio = -Infinity;
    this.update({ ...EMPTY_MONITOR, permission: "granted" });
    return summary;
  }
  release(owner: symbol) {
    if (this.owner !== owner) return;
    this.cancel(true); this.engine = null; this.sampled = false; this.owner = null; this.activityId = null;
    this.update(EMPTY_MONITOR);
  }
}
