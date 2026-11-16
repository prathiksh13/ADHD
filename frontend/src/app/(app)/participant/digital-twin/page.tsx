import { DigitalTwinOverview } from "@/features/digital-twin/digital-twin-overview";

export const metadata = {
  title: "Digital Twin",
  description:
    "A descriptive profile of your latest activity measurements, observation coverage, optional journal and saved EEG summary.",
};
export const instant = false;

export default function Page() {
  return <DigitalTwinOverview />;
}
