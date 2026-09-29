"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResearchDisclaimer } from "@/components/layout/research-disclaimer";
import { ROLES, type RoleKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<RoleKey>("participant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = ROLES.find((r) => r.key === role)!;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Enter the email address for your account.");
    if (!password) return setError("Enter your password.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setPending(true);
    // No auth backend yet. The portal is entered directly so the prototype can
    // be reviewed; `POST /api/auth/login` replaces this.
    window.setTimeout(() => router.push(active.href), 550);
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,520px)]">
      {/* ---------------------------------------------------------- context */}
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface p-10 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "radial-gradient(50% 50% at 20% 10%, var(--color-primary-50) 0%, transparent 60%), radial-gradient(40% 40% at 80% 90%, var(--color-secondary-50) 0%, transparent 60%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <p className="section-label">NeuroTrace</p>
          <h2 className="mt-3 max-w-md text-[26px] leading-tight font-semibold tracking-tight text-balance text-ink">
            One platform, three views of the same research.
          </h2>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-muted">
            Each role sees the workflow at a different depth, from a single participant&rsquo;s
            session to cohort-level model comparison.
          </p>
        </div>

        <ul className="relative flex flex-col gap-2">
          {ROLES.map((r) => {
            const on = r.key === role;
            return (
              <li
                key={r.key}
                className={cn(
                  "rounded-lg border p-3.5 transition-colors",
                  on
                    ? "border-primary-300 bg-primary-50/60"
                    : "border-line bg-canvas/60",
                )}
              >
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-ink">{r.label}</p>
                  {on ? (
                    <Badge tone="primary" className="ml-auto">
                      selected
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                  {r.description}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="relative rounded-lg border border-line bg-surface-subtle p-4">
          <ResearchDisclaimer />
        </div>
      </aside>

      {/* ------------------------------------------------------------ form */}
      <main className="flex flex-col justify-center px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <p className="section-label">Sign in</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            Enter the platform
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
            Choose your role to reach the correct portal. Any email and password will be accepted in
            this prototype.
          </p>

          <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4" noValidate>
            <fieldset>
              <legend className="text-[12px] font-medium text-ink-subtle">Role</legend>
              <div className="mt-2 grid gap-2">
                {ROLES.map((r) => {
                  const on = r.key === role;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRole(r.key)}
                      aria-pressed={on}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                        on
                          ? "border-primary-400 bg-primary-50/60"
                          : "border-line bg-surface hover:bg-surface-subtle",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border",
                          on ? "border-primary-600 bg-primary-600" : "border-line-strong",
                        )}
                      >
                        {on ? <Check className="size-2.5 text-white" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink">
                          {r.label}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">
                          {r.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[12px] font-medium text-ink-subtle">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@research.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[12px] font-medium text-ink-subtle">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-critical-100 bg-critical-50 px-3 py-2 text-[12.5px] text-critical-700"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={pending} className="w-full">
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {pending ? "Opening portal…" : `Continue as ${active.short}`}
              {pending ? null : <ArrowRight className="size-4" />}
            </Button>

            <p className="text-center text-[12.5px] text-ink-muted">
              Participant or guardian without an account?{" "}
              <Link href="/register" className="font-medium text-primary-700 hover:underline">
                Register
              </Link>
            </p>
          </form>

          <div className="mt-8 border-t border-line pt-5">
            <p className="text-[11.5px] leading-relaxed text-ink-subtle">
              Authentication is not connected to a backend. This prototype accepts any credentials
              and routes to the selected portal without persisting an account.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
