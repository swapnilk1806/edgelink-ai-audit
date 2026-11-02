"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { readApiResponse } from "@/lib/api-response";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const body = await readApiResponse<{ redirect: string }>(response);
      window.location.assign(body.redirect);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in"); }
    finally { setBusy(false); }
  }
  return <main className="auth"><section className="auth-card">
    <div className="brand" style={{ margin: 0, color: "#142a33" }}>edgelink <span>SEO</span></div>
    <h1 className="page-title" style={{ marginTop: 28 }}>Welcome back</h1><p className="subtle">Sign in to your SEO workspace.</p>
    {error && <div className="notice">{error}</div>}
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" className="input" type="email" autoComplete="username" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" className="input" type="password" autoComplete="current-password" required /></div>
      <Button disabled={busy} style={{ width: "100%", marginTop: 8 }}>{busy ? "Signing in..." : "Sign in"}</Button>
    </form>
  </section></main>;
}
