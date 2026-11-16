# Personal account workspace — 2026-11-16

The frontend now has one user workspace. Firebase Authentication is required;
there are no built-in accounts, password examples, anonymous data-provider modes,
role selectors or cookie-based workspace access. Existing private records remain
scoped to their authenticated UID. This simplifies user types, not ownership:
it does not turn multiple accounts into one shared identity or grant privileged
token roles access to personal records.

The researcher, clinician and caregiver dashboard routes and their UI modules
were removed. Their navigation and landing-page cards were removed as well.
Old dashboard URLs return 404. Backend authorization and existing stored records
remain intact; no cloud accounts, role claims, records or security rules were
modified for this frontend-only cleanup.

The real account dashboard, cognitive activities, trial/scored results, EEG
upload, history, progress, Digital Twin, privacy controls and optional attention
monitor remain. The activity catalog was moved to `frontend/src/data/activities.ts`;
it contains task definitions, not fictitious user results. Demo identity/session
providers, preloaded participant records and simulated upload routes were removed.
Reusable charts and session components remain, accept supplied records, and do
not create sample EEG traces. Internal historical data-provenance markers remain
readable for existing account documents.

`/participant/upload` no longer reads a demonstration-session cookie or chooses a
simulated upload. It renders the real upload component. Following the installed
Next.js 16.4 documentation, the page explicitly exports `instant = false` because
account and file state are resolved client-side and navigation may block. The
application layout remains private; no placeholder server-visible account state
is used to satisfy navigation validation.

Frontend tests retain synthetic data strictly within unit tests and local
Firebase emulators. Firebase's required `demo-` test-project prefix is a safety
boundary preventing accidental production access; it is not an application login
option. Browser checks cover the public account UI, rejection of old dashboard
URLs, ignored stale login cookies, real emulator sign-in, save/retry/reload, and
camera cleanup across all eleven activities. See `frontend/README.md` for commands.
