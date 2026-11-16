import { BrainCircuit, Fingerprint, ShieldCheck, UploadCloud } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ButtonLink } from "@/components/ui/button";
const features = [
  { icon: BrainCircuit, title: "Cognitive activities", text: "Choose a trial activity or scored task, then review your own results." },
  { icon: UploadCloud, title: "EEG analysis", text: "Upload a recording and review the signal preview, analysis and research-model output." },
  { icon: Fingerprint, title: "Your Digital Twin", text: "Track your activity patterns over time and compare with your previous runs." },
  { icon: ShieldCheck, title: "Privacy controls", text: "Choose whether to save activity summaries and enable optional on-device focus tracking." },
];
export default function HomePage() {
  return <><SiteHeader /><main className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
    <section id="platform" className="max-w-3xl space-y-6"><p className="text-sm font-semibold uppercase tracking-widest text-brand-700">Your personal activity workspace</p>
      <h1 className="text-4xl font-semibold leading-tight text-ink sm:text-6xl">Understand your patterns.<br />Follow your progress.</h1>
      <p className="text-lg leading-8 text-ink-muted">Cognitive activities, EEG analysis and your Digital Twin, together in one private account.</p>
      <div className="flex flex-wrap gap-3"><ButtonLink href="/login">Sign in</ButtonLink><ButtonLink href="/register" variant="outline">Create account</ButtonLink></div>
    </section>
    <section id="workflow" className="mt-16 grid gap-5 sm:grid-cols-2">{features.map(({ icon: Icon, title, text }) =>
      <article key={title} className="rounded-xl border border-line bg-surface p-6"><Icon className="size-6 text-brand-700" /><h2 className="mt-4 text-xl font-semibold">{title}</h2><p className="mt-2 leading-7 text-ink-muted">{text}</p></article>)}</section>
    <section id="research-transparency" className="mt-12 rounded-xl border border-line bg-surface p-6"><h2 className="text-xl font-semibold">Understand the limits</h2><p className="mt-3 leading-7 text-ink-muted">Activity scores, camera-derived cues and EEG model estimates are descriptive research outputs. They do not establish ADHD, measure its severity or replace a qualified professional. Raw webcam frames stay in your browser.</p></section>
  </main><SiteFooter /></>;
}
