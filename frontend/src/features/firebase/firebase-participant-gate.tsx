"use client";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { ApiBackedActivityProvider } from "@/features/backend/activity-providers";
import { BackendSyncProvider } from "@/features/backend/backend-sync-provider";
import { FirebaseActivityRecordsProvider } from "./firebase-activity-records";
import { getFrontendConfig } from "@/lib/config/frontend-config";

export function FirebaseParticipantGate({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuth(), config = getFrontendConfig();
  const [actionError, setActionError] = useState<string | null>(null);
  if (auth.status === "loading" || auth.status === "loading-account") return <p role="status">Loading your account…</p>;
  if (auth.status === "unavailable") return <Alert tone="danger" title="Account connection unavailable">{auth.error?.message ?? "Check the Firebase configuration."}</Alert>;
  if (!auth.user) return <div className="space-y-4"><h1 className="text-2xl font-semibold">Sign in to your account</h1><p>Your workspace requires your own account.</p><ButtonLink href="/login">Sign in</ButtonLink></div>;
  if (auth.authorizedRole !== "participant") return <Alert tone="warning" title="This account cannot open this workspace">This application supports personal user accounts only.<Button variant="outline" onClick={() => void auth.signOutUser()}>Sign out</Button></Alert>;
  if (!auth.account) return <div className="space-y-4"><Alert tone="danger" title="Account setup needs attention">{auth.error?.message ?? "Your profile could not be loaded."}</Alert>
    <Button onClick={() => { setActionError(null); void auth.retryProfileSetup().catch((e: unknown) => setActionError(e instanceof Error ? e.message : "Account setup failed.")); }}>Retry account setup</Button>
    {actionError ? <p role="alert">{actionError}</p> : null}</div>;
  const content = <>{auth.error ? <Alert tone="warning" title="Account refresh failed">{auth.error.message}</Alert> : null}{children}</>;
  if (config.valid && config.apiBaseUrl && process.env.NEXT_PUBLIC_ACTIVITY_PERSISTENCE === "backend") return <BackendSyncProvider key={auth.user.uid} user={auth.user} baseUrl={config.apiBaseUrl}>
    <ApiBackedActivityProvider participantId={auth.user.uid} legacyRuns={auth.account.activityRuns}>{content}</ApiBackedActivityProvider>
  </BackendSyncProvider>;
  return <FirebaseActivityRecordsProvider key={auth.user.uid}>{content}</FirebaseActivityRecordsProvider>;
}
