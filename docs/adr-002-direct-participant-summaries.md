# ADR-002: Direct Firebase participant activity summaries

Accepted following the user's request to save activities to Firebase without
Google Cloud account access or local Admin credentials.

The default participant activity path now uses Firebase Web Authentication and
the Firestore Web SDK. Immutable, browser-calculated summaries for all eleven
activities (practice and scored) go to `users/{uid}/activityResults/{runId}`.
The existing explicit `cloudSyncEnabled` preference gates writes in both UI and
security rules. Reads remain owner-only. Raw trials are not uploaded. Existing
legacy CPT records remain readable and are not migrated or duplicated.

Activity history, progress, session history and Digital Twin derive their views
from these same summary records, with practice excluded from progress. The
latest 500 saved summaries load on navigation/reload. These are participant
observations, not server-validated research results or diagnostic measurements.

FastAPI remains responsible for research operations, EEG inference, staff access
and server-validated results. `NEXT_PUBLIC_ACTIVITY_PERSISTENCE=backend` explicitly
selects the prior API persistence path; an API URL alone no longer switches
activity saving to it. An operation uses exactly one persistence path. There are
no fallback or duplicate writes to subject collections. Backend-only features
still require an authorized server identity; this decision does not bypass that.

Deployment requires the updated `frontend/firestore.rules`. An already signed-in
participant cannot deploy rules or grant themselves access. A project owner can
deploy with `firebase deploy --only firestore:rules --project adhd-bf37a` from
`frontend/`. No Console access, OAuth desktop file, ADC token or Admin credential
is needed by the browser application. On 2026-11-16, following explicit user
approval for rules deployment only, the Firebase CLI compiled and released the
tested rules to `adhd-bf37a`. No IAM permissions or participant records were
changed. See `firebase-verification.md` for verification scope.
