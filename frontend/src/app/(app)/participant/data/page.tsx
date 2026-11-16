import type { Metadata } from "next";
import { DataPrivacyView } from "@/features/backend/data-privacy-view";

export const metadata: Metadata = {
  title: "Data & privacy",
  description: "Manage account saving and the data controls available for your current connection.",
};

export default function DataPrivacyPage() {
  return <DataPrivacyView />;
}
