"use client";
import { Menu, X, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "./logo";
import { userNavigation, getPageTitle } from "./navigation";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuth(), pathname = usePathname(), router = useRouter();
  const [open, setOpen] = useState(false), [error, setError] = useState<string | null>(null);
  const drawer = useRef<HTMLDivElement>(null), menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const menuButton = menu.current;
    document.body.style.overflow = "hidden";
    const controls = Array.from(drawer.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    controls[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab" || !controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); document.body.style.overflow = previousOverflow; menuButton?.focus(); };
  }, [open]);
  const links = <nav aria-label="Your workspace" className="space-y-1">{userNavigation.map((item) => {
    const active = pathname === item.href || (item.href !== "/participant" && pathname.startsWith(item.href + "/"));
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white", active && "bg-white/10 text-white")}>
      <Icon aria-hidden="true" className="size-4" />{item.label}
    </Link>;
  })}</nav>;
  return <div className="min-h-screen bg-canvas">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="fixed inset-y-0 left-0 hidden w-[272px] flex-col border-r border-white/10 bg-ink p-5 lg:flex">
      <Logo onDark /><div className="mt-8">{links}</div>
      <p className="mt-auto pt-6 text-sm text-white/70">{auth.account?.profile.displayName ?? "My account"}</p>
    </aside>
    {open ? <div className="fixed inset-0 z-50 lg:hidden">
      <button aria-label="Close navigation" className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
      <div ref={drawer} role="dialog" aria-modal="true" aria-label="Navigation menu" className="absolute inset-y-0 left-0 w-[86%] max-w-80 overflow-y-auto bg-ink p-5">
        <div className="mb-6 flex justify-between"><Logo onDark /><button className="text-white" aria-label="Close navigation" onClick={() => setOpen(false)}><X /></button></div>{links}
      </div>
    </div> : null}
    <div className="lg:pl-[272px]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-8">
        <div className="flex items-center gap-3"><button ref={menu} aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)} className="rounded-lg border border-line p-2 lg:hidden"><Menu className="size-5" /></button><p className="font-medium">{getPageTitle(pathname)}</p></div>
        <div className="flex items-center gap-3"><span className="hidden text-sm text-ink-muted sm:inline">{auth.account?.profile.displayName}</span>
          {auth.user ? <button className="inline-flex min-h-11 items-center gap-2 text-sm" onClick={() => {
            setError(null); void auth.signOutUser().then(() => { router.replace("/login"); router.refresh(); }).catch(() => setError("Sign-out failed. Please try again."));
          }}><LogOut className="size-4" />Sign out</button> : <Link href="/login">Sign in</Link>}
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">{error ? <p role="alert">{error}</p> : null}{children}</main>
      <footer className="px-8 pb-6 text-xs text-ink-subtle">Activity and EEG results are descriptive research measurements, not a diagnosis.</footer>
    </div>
  </div>;
}
