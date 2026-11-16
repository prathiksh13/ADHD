# Optional on-device attention monitor

Enable **Enable Real-Time Focus & Eye-Blink Tracking** in participant Settings.
The device preference is `localStorage.attentionTrackingEnabled`; it defaults
to false. Enabling requests a 640×480 user-facing camera with audio disabled,
then immediately stops the permission-probe stream. Denial, missing devices,
insecure contexts and model errors leave every activity usable.

The shared `AttentionMonitorProvider` and `useActivityAttentionMonitor` cover
all eleven interactive activities. Only their running phases acquire a stream.
CPT pauses, N-back level breaks, tracking pause, hidden tabs, completion, route
exit and unmount cancel inference and release tracks. Late camera/model promises
are generation-checked and disposed. The camera remains off on intro/settings
screens. The existing CPT-only controls are replaced by the shared monitor.

FaceLandmarker is loaded dynamically from `@mediapipe/tasks-vision`, with
blendshapes and facial matrices enabled. WASM and model assets are served from
`frontend/public/mediapipe/`, with GPU initialization and CPU fallback. No external
model CDN receives requests. `requestAnimationFrame` throttles inference to a
maximum 20 FPS; actual speed depends on the device. All video processing is
in-browser. No recorder, frame export, image encoding or video upload is used.
Frames, landmarks and blendshape arrays are transient and never persisted.

Each activity starts with 2.5 seconds of stable, visible, open-eye calibration.
The status pill asks the user to look at the activity centre, shows progress and
explains missing-face/open-eye conditions. Calibration does not require the
uncalibrated gaze classifier to already report ON_SCREEN. Mean seated head pose,
iris position, open-eye EAR and resting brow/mouth offsets are learned. Measurements
then use deviations from that baseline; **Recalibrate focus** resets the baseline
without discarding earlier observations/events or treating the reset as recovery.
Expression scores use EMA alpha 0.2 and
1.5-second candidate-state hysteresis. Pauses retain the current run's baseline
and exclude paused time from observations; a new completed run resets it.

Head pose uses the 4×4 transformation matrix and thresholds of ±22° yaw and ±18°
pitch relative to the seated baseline. Iris offsets project onto each eye's local
axes to account for head roll, with aspect-ratio correction. A lower return
threshold prevents boundary jitter from restarting sustained look-away timers.
Brief face losses under 250ms are tolerated; sustained absence is off-screen.
Blink-time iris measurements are ignored. Closure uses 65% of calibrated open-eye
EAR (bounded to 0.08–0.21), or strong bilateral blink blendshapes. Closures
lasting 80–400ms count as blinks. Longer than 800ms, jaw opening >0.5,
or rolling PERCLOS >15% produce a fatigue heuristic. PERCLOS uses a 60-second
window with at least 10 seconds of visible observations. A wink alone does not
count as a bilateral blink. Face absence is off-screen, not an emotional state.

Normal slow CPU observations up to 2 seconds apart retain elapsed calibration and
distraction time. The previous 250ms gap cutoff incorrectly reset timers on slow
inference. Longer interruptions break continuity; explicit pause/visibility and
route cleanup still release the camera immediately. Low sampling rates limit
blink accuracy even when sustained gaze-away alerts remain available.

Neutral is the resting expression. Engaged additionally requires steady gaze,
browser focus and recent task interaction. Frustrated requires both a calibrated
brow-down increase and mouth press/frown increase. These are experimental UX
labels, never evidence of an emotion, ADHD, impairment or diagnosis. Camera
geometry, glasses, lighting, facial differences and posture affect the estimates.

Continuous off-screen/fatigue cues trigger a red dashboard-wide circular gradient
and task border/banner after 2.5s. The gradient strengthens from the transparent
center toward the outer edge and slowly pulses every two seconds, with an
expanding circular wave. It covers the viewport through a portal and never
intercepts controls. Reduced-motion preferences replace animation with a static
gradient. Pause, exit, hidden tabs and recovery remove the overlay.
The same cues trigger
a soft 440→554Hz Web Audio chime after 4.5s, with at least 10s between chimes.
Settings includes **Test alert sound**; the activity pill offers **Enable sound**
if browser autoplay restrictions have kept the audio context suspended.
Mute prevents audio events; pause stops camera and sound. Audio is unlocked by
user gesture and may be unavailable under browser autoplay rules. Cue recovery
clears visuals/sound immediately on the processed frame. Recovery latency is
measured from first visual alert to recovery (or distraction onset if no alert
occurred); full distraction duration is retained separately. Ending or pausing
a session is not counted as gaze recovery. Timestamps represent processed-frame
and audio scheduling times, not hardware-synchronized EEG annotations.

Completed runs attach `attentionTelemetry` to the existing result payload.
It contains the requested aggregate metrics, emotion timeline and events
(`BLINK`, `DISTRACTION_START/END`, `ALERT_TRIGGERED`, `EMOTION_SHIFT`) with
`performance.now()` and ISO timestamps, plus observed duration, calibration
status and provenance. No observations means no invented focus measurement.
Event arrays cap at 1,000; emotion timelines cap at 200 with a truncation flag.
The temporary retry registry holds at most 50 completed summaries and clears
when participant scope changes. Nothing from monitoring is put in localStorage
except the boolean preference.

Default Firebase mode saves derived telemetry inside the participant-owned
activity result only when cloud saving is enabled. Updated `frontend/firestore.rules`
were published to `adhd-bf37a` on 2026-11-16 after explicit approval for rules
deployment only (see `firebase-verification.md`). In explicit backend mode, optional completion telemetry is
strictly validated and stored on the session activity in the existing consent
transaction. It is excluded from scoring and ordinary caregiver/session
responses, and included in owner export/erasure through the existing activity
record. Both routes reject unexpected fields in application validation.

Verification uses deterministic synthetic landmark/measurement tests, local
Firestore rules tests, backend ownership/validation tests and a browser's fake
camera. These checks do not validate attention/emotion accuracy on humans or
promise clinical reliability. No real webcam or participant account is needed.

The local WASM loaders route explicitly declared native INFO/WARNING messages
to console.info/console.warn. This prevents the XNNPACK CPU initialization INFO
from being misreported as a Next.js error. Actual errors and unknown diagnostics
remain console.error. `scripts/prepare-vision-logs.mjs` applies this loader-only
routing reproducibly before dev/build; it never overrides the application console.
