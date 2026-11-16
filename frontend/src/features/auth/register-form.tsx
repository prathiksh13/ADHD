"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFirebaseAuth } from "./firebase-auth-provider";
import { validateName, validateEmail, validatePassword, validatePasswordConfirmation } from "./validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
export function RegisterForm() {
  const auth = useFirebaseAuth(), router = useRouter(), submitting = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  useEffect(() => { if (auth.status === "signed-in") router.replace("/participant"); }, [auth.status, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? ""), email = String(data.get("email") ?? ""), password = String(data.get("password") ?? "");
    const next = { name: validateName(name), email: validateEmail(email), password: validatePassword(password, 10),
      confirmation: validatePasswordConfirmation(password, String(data.get("confirmation") ?? "")),
      consent: data.get("consent") ? undefined : "Acknowledge the account data notice to continue." };
    setErrors(next); if (Object.values(next).some(Boolean)) return;
    submitting.current = true; setBusy(true); setError(null);
    try { await auth.register(name, email, password); }
    catch (e) { setError(e instanceof Error ? e.message : "Account creation failed. Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="space-y-6"><div><h2 className="text-2xl font-semibold">Create your account</h2><p className="mt-2 text-sm text-ink-muted">Your activities, results and privacy settings in one place.</p></div>
    {error || auth.error ? <Alert tone="danger" title="Account creation needs attention">{error ?? auth.error?.message}</Alert> : null}
    <form onSubmit={submit} noValidate className="space-y-4">
      {[["name", "Full name", "text", "name"], ["email", "Email", "email", "email"], ["password", "Password", "password", "new-password"], ["confirmation", "Confirm password", "password", "new-password"]].map(([id, label, type, autocomplete]) =>
        <div key={id} className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={id} type={type} autoComplete={autocomplete} aria-invalid={Boolean(errors[id])} required /><FieldError>{errors[id]}</FieldError></div>)}
      <p className="text-xs text-ink-muted">Use at least 10 characters for your password.</p>
      <label className="flex items-start gap-3 text-sm leading-6 text-ink-muted"><input name="consent" type="checkbox" className="mt-1 size-4 shrink-0 accent-brand-700" />I understand that authentication and my profile are saved to create my account. Activity cloud saving and camera tracking are optional and controlled separately.</label>
      <FieldError>{errors.consent}</FieldError>
      <Button type="submit" className="w-full" disabled={busy || auth.providerMode !== "firebase" || auth.status === "unavailable"}>{busy ? "Creating account…" : "Create account"}</Button>
    </form><p className="text-sm text-ink-muted">Already have an account? <Link href="/login" className="text-brand-700 underline">Sign in</Link></p>
  </div>;
}
