"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResearchDisclaimer } from "@/components/layout/research-disclaimer";
import { ACCEPTED_EEG_EXTENSIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Participant / guardian registration.
 *
 * Research staff accounts are not created here — they are provisioned by an
 * administrator, so this form only covers the participant side.
 */
export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    confirmEmail: "",
    password: "",
    guardianName: "",
    guardianRelation: "",
    consent: false,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.fullName.trim()) return setError("Enter the participant's full name.");
    if (!form.email.trim()) return setError("Enter an email address.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      return setError("Enter a valid email address.");
    }
    if (form.confirmEmail !== form.email) return setError("Email addresses do not match.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.guardianName.trim() && !form.guardianRelation.trim()) {
      return setError("Select the guardian's relationship to the participant.");
    }
    if (!form.consent) {
      return setError("Consent must be given before an account can be created.");
    }

    setPending(true);
    // No auth backend yet. `POST /api/auth/register` replaces this.
    window.setTimeout(() => router.push("/participant/dashboard"), 600);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-[13px] font-medium text-ink-muted hover:text-ink">
          &larr; Back to site
        </Link>
        <p className="text-[12.5px] text-ink-muted">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-primary-700 hover:underline">
            Sign in
          </Link>
        </p>
      </header>

      <div className="mt-8 grid flex-1 items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <div>
            <p className="section-label">Register</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              Participant / guardian account
            </h1>
            <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-ink-muted">
              This account is used to upload an EEG recording, run the attention task, and view
              research screening results for one participant.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fullName" className="text-[12px] font-medium text-ink-subtle">
              Participant full name
            </label>
            <Input
              id="fullName"
              autoComplete="name"
              placeholder="As recorded on the consent form"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[12px] font-medium text-ink-subtle">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmEmail" className="text-[12px] font-medium text-ink-subtle">
                Confirm email
              </label>
              <Input
                id="confirmEmail"
                type="email"
                autoComplete="email"
                placeholder="Repeat the address"
                value={form.confirmEmail}
                onChange={(e) => set("confirmEmail", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[12px] font-medium text-ink-subtle">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>

          <fieldset className="rounded-lg border border-line bg-surface p-4">
            <legend className="px-1 text-[12px] font-medium text-ink-subtle">
              Guardian details (optional)
            </legend>
            <p className="text-[12px] leading-relaxed text-ink-muted">
              Leave blank when the participant is an adult registering themselves.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="guardianName"
                  className="text-[12px] font-medium text-ink-subtle"
                >
                  Guardian name
                </label>
                <Input
                  id="guardianName"
                  autoComplete="off"
                  placeholder="Full name"
                  value={form.guardianName}
                  onChange={(e) => set("guardianName", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="guardianRelation"
                  className="text-[12px] font-medium text-ink-subtle"
                >
                  Relationship
                </label>
                <select
                  id="guardianRelation"
                  value={form.guardianRelation}
                  onChange={(e) => set("guardianRelation", e.target.value)}
                  className="h-9 w-full rounded-md border border-line bg-surface px-3 text-[13.5px] text-ink transition-colors hover:border-line-strong focus-visible:border-primary-500 focus-visible:outline-none"
                >
                  <option value="">Select…</option>
                  {["Parent", "Guardian", "Legal representative", "Carer", "Other"].map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-4">
            <span
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                form.consent
                  ? "border-primary-600 bg-primary-600"
                  : "border-line-strong bg-surface",
              )}
            >
              {form.consent ? <Check className="size-2.5 text-white" /> : null}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={form.consent}
              onChange={(e) => set("consent", e.target.checked)}
            />
            <span className="text-[12.5px] leading-relaxed text-ink-muted">
              I confirm informed consent has been obtained for recording and analysing this
              participant&rsquo;s EEG data for research purposes, and I understand that results are
              research output, not a diagnosis.
            </span>
          </label>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-critical-100 bg-critical-50 px-3 py-2 text-[12.5px] text-critical-700"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={pending} className="w-fit">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? "Creating account…" : "Create account"}
            {pending ? null : <ArrowRight className="size-4" />}
          </Button>

          <p className="text-[11.5px] text-ink-subtle">
            Registration is not connected to a backend in this prototype. The form validates
            locally and routes to the participant dashboard.
          </p>
        </form>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-8">
          <div className="rounded-lg border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary-700" />
              <h2 className="text-[13.5px] font-semibold text-ink">About data handling</h2>
            </div>
            <ul className="mt-3.5 flex flex-col gap-3 text-[12.5px] leading-relaxed text-ink-muted">
              <li>
                <span className="font-semibold text-ink">Records are pseudonymised.</span>{" "}
                Participants are identified by an internal code, not by name, in EEG and behaviour
                tables.
              </li>
              <li>
                <span className="font-semibold text-ink">Results are research output.</span> The
                platform reports a model classification probability and is not a diagnostic device.
              </li>
              <li>
                <span className="font-semibold text-ink">Only the participant&rsquo;s own data is
                visible in this portal.</span>{" "}
                Clinician and researcher access is separate.
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary-700" />
              <h2 className="text-[13.5px] font-semibold text-ink">What happens next</h2>
            </div>
            <ol className="mt-3.5 flex flex-col gap-2.5 text-[12.5px] leading-relaxed text-ink-muted">
              {[
                "Account created and consent recorded.",
                "Upload an EEG recording to begin a session.",
                "Complete the attention task while recording.",
                "Processing runs, then the result appears here.",
              ].map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="text-[10.5px] font-semibold text-ink-subtle tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-line bg-surface-subtle p-5">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-ink-muted" />
              <h2 className="text-[13.5px] font-semibold text-ink">Research staff</h2>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
              Clinician and researcher accounts are provisioned by an administrator and cannot be
              self-registered. Request access through the study contact.
            </p>
            <div className="mt-3.5 border-t border-line pt-3.5">
              <p className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
                Accepted EEG uploads
              </p>
              <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed text-ink-muted">
                {ACCEPTED_EEG_EXTENSIONS.join("  ")}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface-subtle p-4">
            <ResearchDisclaimer />
          </div>
        </aside>
      </div>
    </div>
  );
}
