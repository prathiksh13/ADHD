import { FirebaseActivityLibrary } from "@/features/firebase/firebase-activity-library";
import { cognitiveActivities } from "@/data/activities";
export const metadata = { title: "Cognitive activities", description: "Eleven interactive attention, memory and executive-function activities." };
export const instant = false;
export default function ActivitiesPage() { return <FirebaseActivityLibrary activities={cognitiveActivities} />; }
