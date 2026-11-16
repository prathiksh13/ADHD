# Participant results and EEG analysis

Participant activity history, progress, Digital Twin and session history now
read a shared activity-record model. This replaces the previous CPT-only
progress/Twin routes and the isolated non-CPT browser-log history.

## Activities

All eleven activities offer trial/practice and scored task entry directly.
Completed practice runs appear in visit history; scored runs immediately appear
in all result views. Practice does not contribute to scored progress or Twin
measurements and is not uploaded. Non-CPT visits and saved summaries are merged
using the server assignment ID returned on save so a run is not counted twice.
The results table accepts an activity query parameter and includes current-visit
results even when consent is absent or a save is still pending.

Browser records are memory-only, scoped to the active participant and cleared on
account changes. Backend-saved scored summaries are loaded again after reload.
Saving across reloads requires research consent, Firebase identity and a reachable
FastAPI backend. Existing direct-Firestore mode still supports its legacy CPT
summary path; it does not pretend to save other activities without the backend.
No unscoped local-storage history is restored or migrated automatically.

Progress and the Digital Twin read the same activity-record model but present
different questions. Progress follows change over repeated scored runs of one
selected activity at a time, with per-activity run counts; results from
different activities are never pooled. The Twin is a current descriptive
profile: the latest measurement per activity, observation coverage, the
versioned server profile when available, optional consent and journaling, and
the latest EEG summary shown separately. Both views update after the first
completed scored run and show an explicit single-observation state. Neither
substitutes preloaded synthetic runs for real completions. The server's
versioned Twin snapshots and caregiver permissions remain intact.

## EEG

`POST /predict` remains a transient analysis endpoint. Scored responses now
include `signal_preview` and `analysis` in addition to the original fields.
The preview is generated from the first selected Eyes Closed window after the
existing preprocessing. It includes eight harmonized channels, microvolt values
and a reduced sample rate using polyphase resampling. It is a selected segment,
not the complete recording; harmonized channels may include interpolation.

The browser plots these returned samples and can download the plot as an SVG
image. It reports amplitude fallback, selected windows, scaler availability and
training/serving limitations without inferring diagnoses from waveform shape.

For optional account persistence, `POST /api/v1/subjects/{subjectId}/eeg-analyses`
performs server-side inference and saves the result summary only. It requires
the participant owner, active research consent and a separate browser save
checkbox. `GET` on that path returns the latest thirty saved summaries. Records
live under `subjects/{subjectId}/eegAnalyses/{analysisId}`; raw uploads and
`signal_preview` samples are excluded. Export and research-data erasure include
the saved EEG summaries. Unrelated participants and caregivers cannot access
these endpoints. Upload limits apply both to transient and saved analysis routes.

Session history merges current-visit EEG results with account-saved summaries.
It can reopen a result; after reload, a saved summary explains that the recording
must be analyzed again to regenerate the transient signal image. Only the latest
EEG summary is shown in the Twin, separate from activity measurements.

## Verification

Synthetic tests cover practice/scored separation, account isolation, duplicate
suppression, numeric chart values and signal validation. Backend tests cover
the returned preview and owner-only EEG save/list/export/erase/consent behavior,
including a payload larger than the generic JSON request limit.

Focused Playwright tests run real browser flows against Firebase Auth and
Firestore emulators with a `demo-` project and an in-memory API repository. One
checks both entry buttons for all eleven activities, completes a scored Stroop
run and checks all four views after reload. Another generates a synthetic MAT
recording, uploads it, downloads a waveform image and reopens its saved analysis.
These are emulator checks, not live Firebase or clinical validation.
