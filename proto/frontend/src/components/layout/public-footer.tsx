import Link from "next/link";
import { BrandLockup } from "./logo";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "About the project", href: "/about" },
      { label: "Research methodology", href: "/research" },
      { label: "Datasets", href: "/research#datasets" },
    ],
  },
  {
    title: "Portals",
    links: [
      { label: "Participant / Guardian", href: "/login" },
      { label: "Doctor / Clinician", href: "/login" },
      { label: "Researcher / Admin", href: "/login" },
    ],
  },
  {
    title: "Prototype",
    links: [
      { label: "Live EEG roadmap", href: "/participant/live" },
      { label: "Device integration", href: "/device" },
      { label: "Sign in", href: "/login" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="no-print border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <BrandLockup />
            <p className="max-w-64 text-[12.5px] leading-relaxed text-ink-muted">
              A research platform for analysing EEG time-series patterns associated with ADHD
              using deep learning.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <p className="section-label">{column.title}</p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-ink-muted transition-colors hover:text-primary-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-[12px] leading-relaxed text-ink-subtle">
            <span className="font-semibold text-ink-muted">Research prototype.</span> This platform
            reports model predictions from a research pipeline. It is not a medical device, does
            not provide diagnoses, and must not be used to make clinical decisions. Participants
            are referred to qualified professionals for any assessment.
          </p>
          <p className="shrink-0 text-[12px] text-ink-subtle">
            © {new Date().getFullYear()} NeuroTrace Research
          </p>
        </div>
      </div>
    </footer>
  );
}
