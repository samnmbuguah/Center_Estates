"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSubmitting(true);
    const data = new FormData(event.currentTarget);
    try { await login(String(data.get("username")), String(data.get("password"))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in."); setSubmitting(false); }
  }
  return <main className="login-page"><section className="login-panel">
    <div className="brand login-brand"><span className="brand-mark">CE</span><span>Center Estates<br /><small>Unified ERP Platform</small></span></div>
    <p className="eyebrow">Welcome back</p><h1>Sign in to your workspace</h1><p>Use the account assigned by your organization administrator.</p>
    <form onSubmit={submit}>
      <label>Username<input name="username" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
    </form>
  </section><aside><p>One secure platform.</p><h2>Manage every stage of the property lifecycle.</h2><span>Property · Facility · Sales · Tender · Valuation · Monitoring</span></aside></main>;
}
