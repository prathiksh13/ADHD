import { FirebaseParticipantDashboard } from "@/features/firebase/firebase-participant-dashboard";
export const metadata = { title: "My overview" };
export const instant = false;
export default function Page() { return <FirebaseParticipantDashboard />; }
