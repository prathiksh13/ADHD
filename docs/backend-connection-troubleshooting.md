# Saved records cannot be refreshed

The default participant activity pages now use direct Firebase Web SDK saving
per [ADR-002](adr-002-direct-participant-summaries.md). They do not require local
Admin credentials. Deploy the updated frontend Firestore rules and enable
Firebase saving inside the participant workspace. Do not use Google Cloud
account sign-in to repair this direct path.

The following applies only to explicit `NEXT_PUBLIC_ACTIVITY_PERSISTENCE=backend`
mode and other server-only features. A frontend Firebase sign-in is not sufficient: FastAPI also
needs the matching Firebase project ID, an approved Firebase Admin credential
and Firestore access for that credential.

Check `/health/live`, `/health/ready` and `/api/v1/capabilities` before changing
activity code. These public status checks do not expose participant records.

* Liveness 200 and readiness `firestore_not_configured` mean the process is
  running without an initialized persistence repository. Check `backend/.env`
  and the server's Application Default Credentials, then restart FastAPI.
* `firebase_project_not_configured` means the running server lacks its project
  setting. Browser Web configuration does not automatically configure FastAPI.
* `firebase_credentials_unavailable` requires approved server authentication.
* `firestore_unavailable` can indicate denied access, connectivity or query
  configuration. Consult the server log; do not weaken ownership checks/rules.

The frontend now identifies setup errors explicitly and offers a retry action.
Retrying retains previously loaded records and current-visit results. It does
not invent saved data, migrate records or silently substitute demo data.

For local Google user authentication, follow the Desktop OAuth client flow in
`backend/README.md`. The account must be allowed to access the project's
resources. A Google Console "You need additional access" page is an IAM blocker;
requesting access or granting roles requires an action by the project owner.
Do not place OAuth client files, service account keys or ADC tokens in Git or
frontend variables. Local `backend/.env` is ignored by Git.
