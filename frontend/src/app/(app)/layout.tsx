import { AppShell } from "@/components/layout/app-shell";
import { DataProviderUnavailable } from "@/components/feedback/data-provider-unavailable";
import { FirebaseParticipantGate } from "@/features/firebase/firebase-participant-gate";
import { AttentionMonitorProvider } from "@/features/attention/attention-monitor-provider";
import { getFrontendConfig } from "@/lib/config/frontend-config";
export const instant = false;
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const config = getFrontendConfig();
  return <AppShell><AttentionMonitorProvider>{config.valid && config.provider === "firebase"
    ? <FirebaseParticipantGate>{children}</FirebaseParticipantGate> : <DataProviderUnavailable config={config} />}
  </AttentionMonitorProvider></AppShell>;
}
