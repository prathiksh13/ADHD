"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AttentionRuntime, CAMERA_CONSTRAINTS, EMPTY_MONITOR, cameraError, type CameraPermission } from "./attention-runtime";
import { registerTelemetryCapture, clearActivityTelemetry } from "./telemetry-registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import { DashboardAttentionAlert } from "./dashboard-attention-alert";

const Context = createContext<{
  enabled: boolean; permission: CameraPermission; message: string | null;
  paused: boolean; muted: boolean; hidden: boolean; status: typeof EMPTY_MONITOR;
  setEnabled: (enabled: boolean) => Promise<void>; togglePause: () => void; toggleMute: () => void;
  enableSound: () => Promise<void>; testSound: () => Promise<void>; soundMessage: string | null;
  recalibrate: () => void;
  bind: (activityId: string, owner: symbol) => void; release: (owner: symbol) => void;
  start: (activityId: string, owner: symbol) => void; pause: () => void;
  getSessionTelemetrySummary: (activityId: string) => ReturnType<AttentionRuntime["finish"]>;
} | null>(null);

export function AttentionMonitorProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [permission, setPermission] = useState<CameraPermission>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState(EMPTY_MONITOR);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [soundMessage, setSoundMessage] = useState<string | null>(null);
  const [runtime] = useState(() => new AttentionRuntime(setStatus));
  const permissionToken = useRef({ token: 0 });
  const enableSound = useCallback(async () => {
    try {
      await runtime.chime.prime();
      setSoundMessage(runtime.chime.ready ? "Alert sound is ready. Check your device volume if you cannot hear it." : "Sound is blocked or unavailable. Use Enable sound and allow audio in your browser's site settings.");
    } catch { setSoundMessage("Sound could not start. Check your browser's site audio permission and try again."); }
  }, [runtime]);
  const testSound = useCallback(async () => {
    await enableSound();
    if (runtime.chime.ready) await runtime.chime.play();
  }, [enableSound, runtime]);

  useEffect(() => {
    const cancellation = permissionToken.current;
    try {
      // Hydrate a device preference; this never opens the camera on a settings page.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabledState(localStorage.getItem("attentionTrackingEnabled") === "true");
    } catch { setMessage("This browser cannot retain the tracking preference. It will reset when you reload."); }
    registerTelemetryCapture((id) => runtime.finish(id));
    const visibility = () => { setHidden(document.hidden); if (document.hidden) runtime.cancel(true); };
    const pagehide = () => runtime.cancel(true);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    return () => {
      cancellation.token++;
      runtime.cancel(); void runtime.chime.close(); registerTelemetryCapture(null); clearActivityTelemetry();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [runtime]);

  useEffect(() => {
    if (!enabled) return;
    const unlockAudio = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-attention-activity]")) runtime.noteInteraction();
      void enableSound();
    };
    document.addEventListener("pointerdown", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    return () => { document.removeEventListener("pointerdown", unlockAudio); document.removeEventListener("keydown", unlockAudio); };
  }, [enabled, runtime, enableSound]);

  const setEnabled = useCallback(async (next: boolean) => {
    const token = ++permissionToken.current.token;
    runtime.cancel(); setStatus(EMPTY_MONITOR); setMessage(null); setPaused(false);
    setEnabledState(false);
    try { localStorage.setItem("attentionTrackingEnabled", "false"); } catch { /* preference is still usable in memory */ }
    if (!next) { void runtime.chime.close(); setPermission("idle"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setPermission("no-camera"); setMessage("Camera access needs HTTPS or localhost and a browser with webcam support."); return; }
    setPermission("requesting");
    void runtime.chime.prime().catch(() => {});
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      // Permission probe is always stopped immediately, including stale/unmounted requests.
      stream.getTracks().forEach((track) => track.stop());
      if (token !== permissionToken.current.token) return;
      setPermission("granted"); setEnabledState(true);
      try { localStorage.setItem("attentionTrackingEnabled", "true"); } catch { setMessage("Tracking is enabled for this visit; this browser cannot retain the preference."); }
    } catch (e) {
      if (token !== permissionToken.current.token) return;
      const result = cameraError(e); setPermission(result.permission); setMessage(result.message);
    }
  }, [runtime]);
  const bind = useCallback((id: string, owner: symbol) => { runtime.bind(id, owner); setPaused(false); }, [runtime]);
  const release = useCallback((owner: symbol) => runtime.release(owner), [runtime]);
  const start = useCallback((id: string, owner: symbol) => { void runtime.start(id, owner); }, [runtime]);
  const pause = useCallback(() => { runtime.cancel(true); setStatus((current) => ({ ...current, running: false, loading: false, metrics: { ...current.metrics, visualCue: false, alertStage: 0 } })); }, [runtime]);
  const togglePause = useCallback(() => { runtime.cancel(true); setPaused((current) => !current); }, [runtime]);
  const toggleMute = useCallback(() => { setMuted(runtime.toggleMute()); }, [runtime]);
  const recalibrate = useCallback(() => runtime.recalibrate(), [runtime]);
  const getSessionTelemetrySummary = useCallback((id: string) => runtime.finish(id), [runtime]);
  const value = useMemo(() => ({ enabled, permission, message, status, paused, muted, hidden, setEnabled, togglePause, toggleMute, bind, release, start, pause, getSessionTelemetrySummary, enableSound, testSound, soundMessage, recalibrate }),
    [enabled, permission, message, status, paused, muted, hidden, setEnabled, togglePause, toggleMute, bind, release, start, pause, getSessionTelemetrySummary, enableSound, testSound, soundMessage, recalibrate]);
  const showAlert = enabled && !paused && !hidden && status.running && !status.metrics.calibrating && status.metrics.visualCue;
  return <Context.Provider value={value}>{children}{showAlert && typeof document !== "undefined" ? createPortal(
    <DashboardAttentionAlert active stage={status.metrics.alertStage} durationMs={status.metrics.distractionDurationMs} />, document.body) : null}</Context.Provider>;
}

export function useAttentionMonitor() {
  const value = useContext(Context);
  if (!value) throw new Error("AttentionMonitorProvider is required");
  return value;
}

export function useActivityAttentionMonitor({ activityId, isActive }: { activityId: string; isActive: boolean }) {
  const monitor = useAttentionMonitor();
  const [owner] = useState(() => Symbol(activityId));
  const { bind, release, start, pause, enabled, paused, hidden } = monitor;
  useEffect(() => { bind(activityId, owner); return () => release(owner); }, [activityId, owner, bind, release]);
  useEffect(() => {
    if (isActive && enabled && !paused && !hidden) start(activityId, owner);
    else pause();
    return pause;
  }, [activityId, isActive, owner, enabled, paused, hidden, start, pause]);
  const captureSummary = monitor.getSessionTelemetrySummary;
  const getSessionTelemetrySummary = useCallback(() => captureSummary(activityId), [captureSummary, activityId]);
  return { ...monitor, getSessionTelemetrySummary };
}

export function AttentionMonitorSettingsCard() {
  const monitor = useAttentionMonitor();
  const permission = monitor.status.running ? "granted" : monitor.status.error ? monitor.status.permission : monitor.permission;
  return <Card><CardHeader><CardTitle>Real-time focus monitoring</CardTitle></CardHeader><CardContent className="space-y-3">
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-4 accent-brand-700"
      checked={monitor.enabled || monitor.permission === "requesting"} onChange={(e) => void monitor.setEnabled(e.target.checked)} />Enable Real-Time Focus &amp; Eye-Blink Tracking</label>
    <p role="status" className="text-sm text-ink-muted">Camera permission: {permission}.</p>
    <p className="text-sm text-ink-muted">Optional. Frames are processed only in this browser and are never recorded, uploaded or saved. The camera runs only during active activities. A 2.5-second neutral-face calibration precedes measurements. Derived scores and timestamped events are included in activity results when account saving is enabled.</p>
    <p className="text-xs text-ink-muted">Gaze, blinking and expression labels are experimental cues, not a measurement of ADHD, emotion or mental state. Lighting, glasses, facial differences and posture can affect them. You can mute alerts or pause tracking at any time.</p>
    <Button variant="outline" onClick={() => void monitor.testSound()}>Test alert sound</Button>
    {monitor.soundMessage ? <p role="status" className="text-sm text-ink-muted">{monitor.soundMessage}</p> : null}
    {monitor.message || monitor.status.error ? <p role="alert" className="text-sm text-amber-800">{monitor.message ?? monitor.status.error}</p> : null}
    {permission === "denied" || permission === "no-camera" ? <Button variant="outline" onClick={() => void monitor.setEnabled(true)}>Retry camera permission</Button> : null}
  </CardContent></Card>;
}

export function ActivityAttentionStatus({ isActive }: { isActive: boolean }) {
  const monitor = useAttentionMonitor();
  const { status } = monitor;
  if (!isActive || !monitor.enabled) return null;
  return <aside className="sticky top-20 z-40 ml-auto w-fit max-w-full rounded-2xl border border-line bg-surface p-3 shadow-lg" aria-label="Activity attention monitor">
    <p className="text-xs font-semibold">{monitor.paused || monitor.hidden ? "Camera paused" : status.loading ? "Starting camera…" : status.running ? status.metrics.calibrating ? "Calibrating · rest your face" : `${status.metrics.state} · ${status.metrics.blinkRatePerMin.toFixed(1)} blinks/min` : "Camera off"}</p>
    {status.running && !status.metrics.calibrating ? <p className="mt-1 text-xs text-ink-muted">Experimental cue: {status.metrics.affect}</p> : null}
    {status.running && status.metrics.calibrating ? <div className="mt-2 max-w-64 text-xs text-ink-muted">
      <p>{status.metrics.trackingReason ?? "Look at the activity centre with eyes open"}</p>
      <progress aria-label="Focus calibration" className="mt-1 h-1 w-full accent-brand-700" max={100} value={Math.round((status.metrics.calibrationProgress ?? 0) * 100)} />
      <p>Hold your normal seated position for 2.5 seconds.</p>
    </div> : null}
    {status.running && !status.metrics.calibrating ? <p className="mt-1 max-w-64 text-xs text-ink-muted">Tracking: {status.metrics.trackingReason}</p> : null}
    {status.error ? <p role="status" className="max-w-64 text-xs text-amber-800">{status.error}</p> : null}
    <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={monitor.togglePause}>{monitor.paused ? "Resume tracking" : "Pause tracking"}</Button>
      <Button size="sm" variant="outline" aria-pressed={monitor.muted} onClick={monitor.toggleMute}>{monitor.muted ? "Unmute chime" : "Mute chime"}</Button></div>
    {status.running && !monitor.muted && !status.audioReady ? <Button size="sm" variant="outline" onClick={() => void monitor.enableSound()}>Enable sound</Button> : null}
    {status.running ? <Button size="sm" variant="outline" className="mt-2" onClick={monitor.recalibrate}>Recalibrate focus</Button> : null}
  </aside>;
}
