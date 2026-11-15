# Attune FastAPI Backend

FastAPI uses Firebase Authentication for verified identity and Cloud Firestore
through the Firebase Admin SDK for application persistence. PostgreSQL,
SQLAlchemy, Alembic and the former local PostgreSQL Compose service are archived
under `backend/archive/postgresql_legacy/`; none is an active runtime dependency.
The original PostgreSQL requirements remain historical in `../backend_plan.md`.

The backend keeps the frontend-compatible `users/{uid}` profile shape and uses
subject-scoped Firestore documents for API-owned sessions, event records,
consents, summaries, reports, and Twin history. Existing frontend records are
not migrated, deleted, copied, or dual-written. Current frontend auth/provider
behavior remains intact; API token injection and deliberate cutover remain
future work. See [`../docs/adr-001-firestore-first.md`](../docs/adr-001-firestore-first.md)
and [`../docs/api_integration.md`](../docs/api_integration.md).

## Local setup (PowerShell; no PostgreSQL or Docker)

1. From the backend directory, make a local environment file and keep it
   uncommitted:

   ```powershell
   Set-Location -LiteralPath "C:\Users\Vln Rao\OneDrive\Desktop\ADHD_NEW\backend"
   Copy-Item .env.example .env
   ```

   Set `FIREBASE_PROJECT_ID` to the project ID used by the approved Firebase
   environment. `FIRESTORE_DATABASE_ID` defaults to `(default)`. Never place a
   service-account key or private credential in frontend code or commit it.

2. Create the environment and install the pinned backend/test dependencies:

   ```powershell
   py -3.13 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements-dev.txt
   ```

3. For a developer-owned Firebase project, configure Application Default
   Credentials (for example, `gcloud auth application-default login`). No local
   database or migration step is required.

4. Start FastAPI from `backend/`:

   ```powershell
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   - Liveness: `http://127.0.0.1:8000/health/live`
   - Firestore readiness: `http://127.0.0.1:8000/health/ready`
   - OpenAPI: `http://127.0.0.1:8000/docs`

   If Firebase project configuration or credentials are unavailable, liveness
   remains usable and readiness/protected operations fail safely. Do not point
   this app at production child data for local testing.

5. Optional emulator development can set `FIRESTORE_EMULATOR_HOST` (and, if
   using Auth Emulator tokens, `FIREBASE_AUTH_EMULATOR_HOST`) to an already
   running Firebase Emulator Suite. Unit tests do not require Docker, emulator,
   network access, or developer credentials.

## EEG inference

The classifier is loaded once during FastAPI startup and kept on
`app.state.eeg_model`; requests never reload weights.

- `GET /health` returns model availability, artifact version, the 26 expected
  TDBRAIN channels, the decision threshold, threshold provenance, feature
  schema and preprocessing settings.
- `POST /predict` accepts a required multipart `restEC_file` (Eyes Closed) and
  an optional `restEO_file` (Eyes Open). BDF, EDF, FIF, EEGLAB SET and MAT
  v5-v7.3 files are read in memory. Encrypted uploads are decrypted when
  `EEG_ENCRYPTION_KEY` contains a Fernet key. MAT amplitudes are normalized from
  V/mV/µV/ADC-like units before windowing. Inputs that cannot be parsed, mapped
  to the core 10-20 electrodes, or safely scored return HTTP 200 with
  `{"status": "Unscored", "prediction": "Unscored", "probability": null,
  "reason": "..."}`. Scored responses return `prediction`, `probability`,
  `threshold`, `confidence_level`, `windows_analyzed`, `ec_eo_recording_used`,
  `biomarker_highlights` and the full 24-value `biomarker_breakdown`.

The default artifact directory is the repository's `../models` directory. It
contains `best_xgboost.json` and an explicit `eeg_model_bundle.json` manifest.
The loader also accepts a bundle with `scaler.mean`/`scaler.scale` arrays,
`threshold`, `artifact_version`, class names and metadata. If no bundle exists
it falls back to `best_xgboost.json` with an identity scaler and
`EEG_THRESHOLD` (default `0.5`). Missing scaler statistics are never invented;
`GET /health` reports `scaler_loaded: false` when they are absent.

Ingestion order is fixed: decrypt if needed, load the file, harmonize to the
TDBRAIN montage, extract features, then call the classifier. Recordings with
the 19-channel 10-20 montage (`T3/T4/T5/T6` aliases included) or the 26-channel
TDBRAIN montage are mapped directly; missing `FC`/`CP`/`Oz` channels are
interpolated from `standard_1020`. Recordings with more than 26 channels must
have channel labels. Missing core frontal or posterior electrodes are
unscored rather than guessed.

Preprocessing then applies a common average reference, 1-45 Hz band-pass,
50 Hz notch, resampling to 250 Hz, and 4-second / 1000-sample windows with a
500-sample stride and the training-time single-sided amplitude check
`max(abs(window)) * 1e6 < 350 µV`. When fewer than four windows pass, inference
keeps the lowest-amplitude available windows (up to 20) so high-amplitude or
low-quality recordings can still be scored; only recordings shorter than 1000
samples after resampling are rejected as too short. No amplitude rescaling is
applied to BDF/EDF/FIF/SET inputs because MNE already returns volts; MAT unit
normalization is confined to `_mat_bytes_to_raw`. The 24
features are frontal/fronto-central relative bandpower, frontal-minus-posterior
gradients, theta/beta and theta/alpha ratios, reliability-gated PLV connectivity
and the two reactivity features. Reactivity is computed from the Eyes Closed
and optional Eyes Open recordings. The feature order is in
`app/eeg/schema.py`.

Limitations that are reported rather than hidden:

- No scaler statistics or validation-optimal threshold accompanied the local
  artifacts, so the default bundle uses an identity scaler and `0.5`.
- `models/best_graph_encoder.pt` is a PyTorch `state_dict` without its model
  class definition; it is not loaded by this service.
- `best_xgboost.json` stores no feature names. The 24-feature order above is
  the documented serving contract; it has not been verified against the
  original training notebook. If training consumed encoder latent features
  rather than these hand-crafted biomarkers, faithful reproduction requires
  the encoder class and training preprocessing code.
- Serving now follows the reported training-time window contract: 250 Hz,
  4-second / 1000-sample windows and a 500-sample stride. The saved project
  report describes a 0.5-45 Hz band-pass, while serving keeps 1-45 Hz; these
  settings are configurable via `EEG_TARGET_SFREQ`, `EEG_WINDOW_SECONDS`,
  `EEG_WINDOW_OVERLAP` and related variables in `.env.example`. Confirm the
  remaining filter settings before treating a prediction as comparable to the
  research evaluation.
- Predictions are research/support output, not a diagnosis.

Uploads are capped at 50 MiB by `EEG_MAX_UPLOAD_BYTES`. The generic request
limit still applies to every other route. Local CORS defaults to
`http://localhost:3000` and `http://127.0.0.1:3000`.

Example:

```powershell
curl.exe -X POST http://127.0.0.1:8000/predict `
  -F "restEC_file=@sub-01_task-restEC_eeg.bdf" `
  -F "restEO_file=@sub-01_task-restEO_eeg.bdf"
```

## Checks

Run from `backend/`:

```powershell
python -m pytest -q
python -m compileall -q app tests
ruff check app tests
ruff format --check app tests
```

### Hardening and deployment

The API refuses oversized request bodies (413), rate-limits callers (429 with `Retry-After`),
and sets security headers on every response; see `app/core/hardening.py`, the settings in
`.env.example`, and `../docs/deployment.md` for configuration, the container (`Dockerfile`)
and the pre-launch checklist. The rate limiter is per instance, so add an edge limiter when
running more than one.

### Firestore emulator tests

Every API and repository test also runs against the real Firestore Admin
adapter when `FIRESTORE_EMULATOR_HOST` is set (otherwise those parametrizations
are skipped and only the in-memory repository is used). This needs JDK 21+ and
Node. From `backend/`:

```powershell
powershell -File .\scripts\run-emulator-tests.ps1
```

The same script also starts the Firebase **Auth** emulator, which
`tests/test_auth_emulator.py` uses to verify real Firebase ID tokens (custom-claim
roles, revocation, cross-user isolation). To run only those tests without Java:

```powershell
npx firebase-tools@15.34.2 emulators:exec --config ../frontend/firebase.json --only auth --project demo-attune-tests "python -m pytest -q tests/test_auth_emulator.py"
```

CI runs the same thing with `firebase emulators:exec` (see
`../.github/workflows/ci.yml`). The emulator project ID is `demo-attune-tests`;
`demo-` IDs can never reach a real Firebase project. If a failed run leaves the
emulator holding port 8080, stop the leftover `java` process before retrying.

The in-memory repository enforces Firestore's path rules (documents have an even
number of path segments, collections an odd number) so path mistakes fail in
unit tests too.

The API contract and collection model are documented in
[`../docs/api_integration.md`](../docs/api_integration.md). Tests use synthetic
claims/data. **They still do not verify live Firebase Authentication or a real
Firestore project** (only the emulator). No Firestore rules or indexes are
deployed automatically; review
[`../docs/firestore_indexes.md`](../docs/firestore_indexes.md) before a deliberate
deployment. EEG inference is available when the model directory is configured
and the artifacts load; webcam processing and AI Buddy remain unavailable
without their approved artifacts/providers.
