import Link from "next/link";
import { Logo } from "./logo";
export function SiteFooter() {
  return <footer className="bg-ink p-8 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6"><Logo onDark />
    <nav aria-label="Footer" className="flex flex-wrap gap-5 text-sm"><Link href="/participant">My workspace</Link><Link href="/login">Sign in</Link><Link href="/register">Create account</Link><Link href="/#research-transparency">Privacy & limits</Link></nav>
    <p className="text-xs text-white/60">© 2026 Attune · Research measurements, not a diagnosis.</p></div></footer>;
}
