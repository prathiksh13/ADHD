import { ProgressOverview } from "@/features/activities/progress-overview";

export const metadata = {
  title: "Progress",
  description:
    "Track how scored activity results change over repeated runs, one activity at a time.",
};
export const instant = false;

export default function Page() {
  return <ProgressOverview />;
}
