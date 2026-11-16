# Firebase saving verification — 2026-11-16

The participant's `permission-denied` saving error was caused by the live
Firestore policy not yet allowing the new participant-owned `activityResults`
documents (including optional attention telemetry).

After explicit approval for publishing the tested rules only, this command ran
successfully from `frontend/`, using the existing Firebase CLI login:

```powershell
npx --yes firebase-tools@15.34.2 deploy --only firestore:rules --project adhd-bf37a --non-interactive
```

Firebase confirmed successful compilation, upload and release to Cloud Firestore.
The deployed file's SHA-256 was:
`2233bf3b42ee744bd4209f238e4b634ff9bd5ffa8694ac39c32b43ef8320378b`.

The deployment changed rules only. IAM, authentication settings, indexes and
participant records were not changed. No participant records were read. Local
Admin ADC credentials and the Desktop OAuth file are not used by direct saving.

The 13 local Firestore rules tests passed before deployment. They cover both
modes for all eleven activity types, optional telemetry, owner-only access,
explicit cloud-saving consent, immutable results and rejected malformed writes.
The direct Firebase browser regression also covers the Data & Privacy route,
trial/scored saving and history/progress/Twin/session reload. It now deliberately
reproduces denied saving under old-style rules, restores the actual rules, and
retries the same pending result without a reload, checking for duplicates.

The browser/rules checks use local emulators and synthetic accounts, not live
participant data. Cloud deployment success is verified; an existing participant's
pending result must still be acknowledged by Firestore through the app. Select
**Retry Firebase saving** on that visit before reloading. Unsaved visit results
are not claimed to be cloud-saved.
