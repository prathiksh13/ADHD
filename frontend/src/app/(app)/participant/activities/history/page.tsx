import { ActivityOverview } from "@/features/activities/activity-overview";
export const metadata = { title: "Activity history" };
export const instant = false;
export default function Page() { return <ActivityOverview view="history" />; }
