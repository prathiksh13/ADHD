import { ActivityOverview } from "@/features/activities/activity-overview";
export const metadata = { title: "Session history" };
export const instant = false;
export default function Page() { return <ActivityOverview view="sessions" />; }
