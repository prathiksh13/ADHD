import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
export function FirebaseUploadUnavailable({ sessionId }: { sessionId?: string }) {
  return <div className="space-y-4"><Alert tone="info" title="Recording unavailable">{sessionId ? "This recording is not available in your current account." : "Choose a recording to analyze on the EEG upload page."}</Alert><ButtonLink href="/participant/upload">Open EEG upload</ButtonLink></div>;
}
