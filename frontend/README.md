# Attune personal workspace

The existing Next.js application lives here in `frontend/`. It has one user
workspace, authenticated with Firebase. Landing, sign-in and registration pages
are public; activities, EEG upload, history, progress, Digital Twin, data controls
and settings require the user's own account.

## Local development

Copy `.env.example` to `.env.local` and set the public Firebase Web app values.
`NEXT_PUBLIC_DATA_PROVIDER=firebase` is the only supported provider and the default.
For EEG prediction, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` and sign in or create an account. There are no
built-in accounts, passwords, role selectors or anonymous workspace sessions.
The former clinician, researcher and caregiver routes return 404.

## Saving and privacy

The default activity path saves summaries to `users/{uid}/activityResults/{runId}`
using the Firebase Web SDK and the explicit cloud-saving preference. It needs
neither Admin credentials nor a Google Cloud login. History, progress and session
views reload the same records. Optional attention telemetry is derived locally;
raw camera frames are never recorded, uploaded or saved. Existing account records
and their historical schema markers remain readable.

A deliberately configured `NEXT_PUBLIC_ACTIVITY_PERSISTENCE=backend` selects the
existing server-scored research path instead. That path still requires a configured
backend identity and explicit research consent. An API URL alone does not change
activity persistence.

Firebase Web configuration belongs in this folder. Never expose Admin credentials,
service-account keys or OAuth secrets in client code or public environment variables.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:rules
npm run test:e2e
npm run test:e2e:attention
```

Browser and rules checks use local Firebase emulators and synthetic test accounts.
Emulator project IDs begin with Firebase's reserved `demo-` prefix to prevent
tests from reaching production. This is test isolation, not an application login
mode. Set `PLAYWRIGHT_CHANNEL=msedge` to use an installed Edge browser.

The upload page explicitly allows client-authenticated navigation to block
(`instant = false`), because its account and file state are resolved in the browser.
See `../docs/single-user-workspace.md` for the removal and verification scope.
