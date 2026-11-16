import { LayoutDashboard, History, UploadCloud, BrainCircuit, ListChecks, TrendingUp, Fingerprint, ShieldCheck, Settings, type LucideIcon } from "lucide-react";
export const userNavigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/participant", icon: LayoutDashboard },
  { label: "Session history", href: "/participant/sessions", icon: History },
  { label: "Upload EEG", href: "/participant/upload", icon: UploadCloud },
  { label: "Cognitive activities", href: "/participant/activities", icon: BrainCircuit },
  { label: "Activity history", href: "/participant/activities/history", icon: ListChecks },
  { label: "Progress", href: "/participant/progress", icon: TrendingUp },
  { label: "Digital Twin", href: "/participant/digital-twin", icon: Fingerprint },
  { label: "Data & privacy", href: "/participant/data", icon: ShieldCheck },
  { label: "Settings", href: "/participant/settings", icon: Settings },
];
export function getPageTitle(pathname: string) {
  return [...userNavigation].reverse().find((item) => pathname === item.href || (item.href !== "/participant" && pathname.startsWith(item.href + "/")))?.label ?? "My workspace";
}
