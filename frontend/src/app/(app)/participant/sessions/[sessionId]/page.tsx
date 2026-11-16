import { Suspense } from "react";
import { FirebaseSessionDetail } from "@/features/firebase/firebase-session-detail";
export const metadata = { title: "Session record" };
export const instant = false;
async function Content({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params; return <FirebaseSessionDetail sessionId={sessionId} />;
}
export default function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  return <Suspense fallback={<p role="status">Loading session…</p>}><Content params={params} /></Suspense>;
}
