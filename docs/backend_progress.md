# Backend Progress

## Cross-modal session analysis endpoint

`POST /api/sessions/analyze` now provides authenticated, stateless cross-modal
analysis. It accepts the original derived field contract: EEG probability,
predicted class, frontal/central theta-beta ratios, frontal alpha asymmetry,
spectral entropy and SHAP values; task type, accuracy, mean reaction time,
reaction-time SD, error counts and block progression; and webcam focus, off-screen
episodes with root cause/recovery latency, blink rate/timestamps, alert
timestamps and emotion timeline. EEG epoch timestamps may be top-level or nested
under `eeg`; session metadata is optional. It never accepts raw video or audio
and writes nothing to Firestore. The response contains an executive summary, EEG
artifact/cleanliness analysis, descriptive phenotype and concordance profile,
minute-level overlay, distraction breakdown by root cause/recovery speed and
non-diagnostic recommendations. The route has a 2 MiB body cap while other
`/api` routes retain the generic limit.

Validation: backend **199 passed / 94 skipped** (Firestore emulator not
configured); `ruff check`, `ruff format --check` and `compileall` passed. Tests
use synthetic payloads and cover authentication, exact snake_case contract
ingestion, missing optional metadata, validation, artifact windows,
time-series/affect math, all four phenotypes, poor EEG quality and the larger
route body cap. No live Firebase, browser, real-camera or clinical validation is
claimed.

## Unified participant results and EEG waveform update

Activity history, progress, Digital Twin and session history now use the same
participant activity-record model, including all eleven activities, current-visit
results and reloaded saved summaries. All activity entry screens expose trial
and scored options. Practice appears in visit history and stays out of scored
progress. Account changes clear visit data, and saved assignment IDs suppress
duplicate browser/server copies. The primary participant Twin is now a concise
results view rather than the previous CPT-only information page.

EEG responses now contain a selected, preprocessed eight-channel signal preview
and quality metadata. The browser plots the samples and downloads an SVG image.
Optional authenticated EEG summary saving/listing uses owner-scoped Firestore
documents and transactional consent checks. Raw files and signal samples are
never stored in those documents. Export, erasure and session history include the
summary records. See [results flow](activity-results-flow.md).

Validation: 191 backend tests and 233 frontend unit tests passed; TypeScript,
ESLint and production builds passed. Focused browser tests passed against local
Auth/Firestore emulators, checking all eleven activity entry options, completion
and reload across the four views, EEG upload, waveform download and saved-result
review. EEG input and accounts were synthetic. No clinical or live-cloud
verification is claimed.

## Personal baseline and private journal update (v4)

The participant Twin now leads with one selectable activity and a few readable
measurements. It compares the median of the first three compatible scored runs
with the median of a separate latest-three group. Six runs are an engineering
reference-window requirement, not a validated clinical threshold. Task/scoring
changes restart the sequence; single-day data is flagged; missing values are
not filled in. Run-count badges no longer imply statistical confidence.

An optional owner-only journal records an everyday goal and up to thirty dated
sleep/stress/distraction/goal-progress check-ins. Saving is transactionally
consent-gated; reading and deletion remain available after withdrawal. Export
and erasure include the journal. It is never included in caregiver-shared Twin
snapshots. Browser CPT history no longer loads or saves through the unscoped
local-storage key. See [Digital Twin](digital_twin.md) for the full contract.

Validation: backend **190 passed / 87 skipped** (emulators unavailable), frontend
unit tests **228 passed**, TypeScript, ESLint and production build passed. The new
TypeScript journal contract test also passed against the actual FastAPI app
using synthetic token claims and an in-memory repository. This does not verify
live Firebase, browser interactions, clinical reliability or clinical benefit.

## Activity Digital Twin v3

The API-backed Twin now includes separate profiles for all eleven activities,
with first/latest numeric measurements, within-task changes, source summary
IDs, provenance and scoring-version quality flags. Every scored activity
completion rebuilds it, including within a session that is still active.
Unchanged rebuilds do not add duplicate history versions. CPT aggregate fields,
reports and trends retain their existing meaning. See [Digital Twin](digital_twin.md)
for the storage contract, compatibility and modality limitations.

Validation for this change: backend 185 passed / 84 skipped (emulators not
configured); frontend 226 passed / 27 skipped; TypeScript and production build
passed. Frontend lint remains blocked by the pre-existing synchronous
`setBrowserRuns` call in the activity-history hydration effect. No live cloud
verification or EEG-to-subject persistence is claimed.

## Architecture correction and implementation

Firebase Authentication plus Cloud Firestore supersede the original PostgreSQL
proposal. The original requirements and proposal remain in `backend_plan.md` as
history, with an explicit correction note. The frontend is preserved and its
existing Firebase provider/rules were inspected but not changed. See
[ADR-001](adr-001-firestore-first.md) for persistence and cutover boundaries.

- Firebase Admin verifies signed ID tokens; UID and allowlisted role come from
  the verified claims. Unknown roles fail closed; public API payloads cannot set
  identity or role.
- Firestore repository implementation lives in `backend/app/repositories/`;
  `InMemoryRepository` supports deterministic unit/API tests.
- Existing frontend-compatible `users/{uid}` profile is preserved. Server role
  metadata is separate at `backendUsers/{uid}`. Subject records, caregiver
  relationships, consents, sessions/activities/events, summaries, reports,
  Twin history and audit events use documented Firestore paths.
- Session creation, consent transitions, event idempotency, report creation,
  caregiver relationships and Twin history use transactions. Consent is checked
  in the same transaction for data collection; pause/cancel remain stop controls.
- FastAPI CPT validation/scoring, analytics, report generation, Twin versions,
  authorization and API response contracts were retained. The API does not write
  the frontend's `users/{uid}/appSessions`, `activityRuns`, `reports`, or
  `digitalTwin/current` paths.
- PostgreSQL-specific code was preserved under
  `backend/archive/postgresql_legacy/` and is inactive. No database or cloud
  resources were deleted.

## API implementation status

Implemented routes include health/readiness and capabilities; `/api/v1/users/me`;
subject CRUD; caregiver relationship grant/list/revoke; consent grant/list/
withdrawal; activity catalog; session lifecycle and listing; activity start,
event batch, completion/skip; feeling check-ins and session summaries; subject
progress, paginated summaries, Twin current/history and reports. AI Buddy returns
an explicit 503 unavailable response. `GET /health` and `POST /predict` implement
the EEG artifact/preprocessing contract; an unavailable artifact produces 503,
and an unreadable or unmappable recording returns HTTP 200 with an explicit
`Unscored` reason, never a simulated prediction. Webcam inference routes do not
pretend to exist.

API schemas and endpoint behavior are documented in [`api_integration.md`](api_integration.md).
The frontend does not yet obtain/send an ID token to these routes. Existing
Firebase profile and demo cloud-sync behavior remains intact until a deliberate
adapter and ownership cutover is implemented.

## Firestore document layout and indexes

See [ADR-001](adr-001-firestore-first.md) and
[`firestore_indexes.md`](firestore_indexes.md). Frontend-owned user subcollections
are preserved and not mirrored. Larger EEG recordings are planned for private
object storage; raw EEG and webcam video are not put into Firestore.

## Phase status

| Area | Status | Evidence / limitation |
|---|---|---|
| Repository and architecture | Implemented | Existing frontend Firebase paths and rules inspected; ADR records document layout and access boundaries. No rules deployment performed. |
| Auth and Firestore foundation | Implemented; unit/API tested | Firebase Admin verifier and Firestore repository; missing project/ADC leaves runtime store unavailable safely. No live token/read/write check. |
| User/subject/caregiver/consent | Implemented; unit/API tested | Frontend-compatible profile shape, trusted role projection, explicit relationship, transactional consent. |
| Activities/sessions/CPT | Implemented for CPT; unit/API tested | Transactional lifecycle and idempotent trial docs; deterministic current frontend 6-trial practice/24-trial scored contract. |
| Check-ins/analytics/reports/Twin | Implemented; unit/API tested | Persisted subject-scoped data, stable cursor ordering, transactional idempotency and version history. |
| EEG model | Implemented; tested with synthetic recordings | XGBoost artifact and optional bundle load once at startup; BDF/EDF/FIF/SET/MAT v5-v7.3 ingestion, optional Fernet decryption, MAT unit normalization, 19/26/>26-channel harmonization to the TDBRAIN montage, 250 Hz / 1000-sample windows, lowest-amplitude-window fallback, required Eyes Closed plus optional Eyes Open reactivity, full 24-value breakdown, `/health` and `/predict`. Limitations: identity scaler and 0.5 threshold because no scaler/optimal-threshold artifact was supplied; `.pt` is a state_dict without a model class and is not loaded. |
| Webcam | Blocked | No approved extractor/input contract/consent protocol; raw video not stored. |
| AI Buddy | Provider-blocked | No approved LLM provider/credential; explicit unavailable response. |
| Frontend API cutover | EEG upload connected; CPT cutover not done | The Firebase participant upload route calls `/predict` with required Eyes Closed and optional Eyes Open files. Firebase token injection/provider mapping and deliberate direct-write disablement remain for CPT and the rest of `/api/v1`. |

## Validation

- `python -m pytest -q` from `backend/` runs every API/repository test against
  the in-memory repository, and, when `FIRESTORE_EMULATOR_HOST` is set (see
  `backend/scripts/run-emulator-tests.ps1` and CI), against the Firestore
  emulator too: **59 passed** (32 in-memory + 27 emulator), synthetic data only.
- The emulator run found and fixed a real defect: Twin history was written to
  the invalid path `subjects/{id}/digitalTwin/history/{historyId}`, so scored
  session completion returned 503 on real Firestore while passing in memory.
  History now lives in `subjects/{id}/digitalTwinHistory/{historyId}`; the
  in-memory repository now rejects invalid path shapes. No live data existed
  at the old path.
- Caregiver sharing (`tests/test_caregiver.py`, 9 tests; `tests/test_set_role.py`,
  7 tests) run on the in-memory repository: **56 passed + 7 role-tool tests**, with the
  emulator parametrizations skipped. The role tool and a real-token caregiver flow
  (`test_auth_emulator.py`, now 7 tests) pass against the Auth emulator. The new
  `GET /caregiver/subjects` endpoint lets a caregiver discover the relationship ID
  they need to stop viewing (previously impossible). The tests also found that
  `GET /subjects/{id}/caregivers` returned 500 for every owner (the stored record
  has an extra `granted_by_user_id` field the strict response model rejects); it now
  returns only the declared fields.
- Data rights (`tests/test_data_rights.py`, 9 tests) and `tests/test_checkins.py`
  (6 tests) run on the in-memory repository: **47 passed, 48 skipped** (the
  skipped ones are the emulator parametrizations). The erasure path
  (`delete_collection` -> Firestore `recursive_delete`) and the check-in/data tests
  have since passed against the Firestore emulator in CI (run 42850582795); run
  `scripts/run-emulator-tests.ps1` locally.
- The new tests found and fixed two defects in the existing feeling check-in
  endpoint (no test covered it): every call returned 500 (`UUID(<UUID>)`), and an
  identical retry returned 500 because the repository wrapper overwrites a stored
  `id` field with the document key. Check-in IDs are now deterministic per
  session and phase.
- `tests/test_auth_emulator.py` (6 tests) verifies the real Firebase ID-token
  path against the Auth emulator: invalid tokens, profile provisioning, custom
  claim roles, unsupported roles failing closed, revoked tokens, and
  cross-user/clinician isolation. Run with `--only auth` alone (no Java needed)
  or together with Firestore via `scripts/run-emulator-tests.ps1`.
- `tests/test_eeg.py` (31 tests) covers the model/bundle loader, Fernet
  decryption, MAT v5/v7.3 loading, MAT unit scaling, 19-to-26-channel alias
  harmonization, channel and duration validation, the training-time
  `max(abs(window)) * 1e6 < 350 µV` check and lowest-amplitude-window fallback,
  250 Hz resampling/windowing, optional Eyes Open
  reactivity, the full 24-value breakdown, `/health`, `/predict`, Unscored
  responses, corrupt uploads and an unavailable model. These use synthetic Raw
  arrays and a temporary synthetic XGBoost model; no participant EEG files are
  read.
- Latest local run: `python -m pytest -q` -> **180 passed, 84 skipped**;
  `tests/test_eeg.py` -> **31 passed**.
- `ruff check`, `ruff format --check`, `compileall` and `pip check` pass.
- Frontend: `npm run lint`, `typecheck`, `npm test` (Vitest unit tests) and
  `npm run test:e2e` (Playwright smoke tests against a production demo build)
  are wired into CI (`.github/workflows/ci.yml`).
- Not verified: live Firebase Auth tokens, a real Firestore project, Firestore
  rules (no rules-unit-tests yet), and browser tests of Firebase mode.
