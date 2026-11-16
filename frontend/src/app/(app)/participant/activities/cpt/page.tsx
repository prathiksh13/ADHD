import type { Metadata } from "next";
import { CptActivity } from "@/features/activities/cpt/cpt-activity";

export const metadata: Metadata = {
  title: "Continuous Performance Task",
  description:
    "Continuous Performance Task with trial activities, scored runs and your saved results.",
};

export default function CptPage() {
  return <CptActivity />;
}
