import type { Metadata } from "next";
import { ActivityHistory } from "@/features/activities/activity-history";

export const instant = false;

export const metadata: Metadata = {
  title: "Activity history",
  description:
    "Review completed cognitive activities, past records, and performance metrics stored locally on this device.",
};

export default function ActivityHistoryPage() {
  return <ActivityHistory />;
}
