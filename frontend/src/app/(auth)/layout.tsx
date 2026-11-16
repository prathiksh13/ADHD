import Link from "next/link";
import { Logo } from "@/components/layout/logo";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas"><header className="mx-auto flex max-w-6xl items-center justify-between p-6"><Logo /><Link href="/" className="text-sm text-ink-muted">Back to home</Link></header>
    <main className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-2">
      <section className="space-y-5 self-center"><p className="text-sm font-semibold uppercase tracking-widest text-brand-700">Your personal workspace</p><h1 className="text-4xl font-semibold text-ink">Build a clearer picture of your activity patterns.</h1><p className="max-w-lg leading-7 text-ink-muted">Complete cognitive activities, review your progress, analyze EEG recordings and manage your privacy in one account.</p><p className="text-sm text-ink-muted">Research measurements support reflection. They do not establish a diagnosis.</p></section>
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">{children}</section>
    </main></div>;
}
