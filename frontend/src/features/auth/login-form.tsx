"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFirebaseAuth } from "./firebase-auth-provider";
import { validateEmail, validatePassword } from "./validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

export function LoginForm() {
  const auth = useFirebaseAuth(), router = useRouter(), submitting = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (auth.user && ["signed-in", "profile-error", "account-error"].includes(auth.status)) router.replace("/participant");
  }, [auth.user, auth.status, router]);
  async function run(action: () => Promise<void>) {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(null); setMessage(null);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed. Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? ""), password = String(data.get("password") ?? "");
    const next = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(next); if (next.email || next.password) return;
    await run(() => auth.signIn(email, password));
  }
  const unavailable = auth.providerMode !== "firebase" || auth.status === "unavailable";
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-semibold">Sign in</h2><p className="mt-2 text-sm text-ink-muted">Open your activities, EEG analyses and saved progress.</p></div>
    {error || auth.error ? <Alert tone="danger" title="Sign-in needs attention">{error ?? auth.error?.message}</Alert> : null}
    {message ? <p role="status" className="text-sm text-brand-700">{message}</p> : null}
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} required /><FieldError>{errors.email}</FieldError></div>
      <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} required /><FieldError>{errors.password}</FieldError></div>
      <Button type="submit" className="w-full" disabled={busy || unavailable}>{busy ? "Signing in…" : "Sign in"}</Button>
      <button type="button" className="min-h-11 text-sm text-brand-700 underline" disabled={busy || unavailable} onClick={() => {
        const email = String(new FormData(formRef.current!).get("email") ?? "");
        const invalid = validateEmail(email); if (invalid) { setErrors({ email: invalid }); return; }
        void run(async () => { await auth.resetPassword(email); setMessage("If this email has an account, password reset instructions will be sent."); });
      }}>Forgot password?</button>
    </form>
    <Button type="button" variant="outline" className="w-full" disabled={busy || unavailable} onClick={() => void run(auth.signInWithGoogle)}>Continue with Google</Button>
    <p className="text-sm text-ink-muted">New here? <Link className="text-brand-700 underline" href="/register">Create an account</Link></p>
  </div>;
}
