import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Email or password is incorrect." : "Login service is unavailable.");
      const result = await response.json();
      onLogin(result.access_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="login-shell">
    <div className="login-brand"><div className="brand-mark">D</div><div><strong>DPM ONE</strong><span>ENTERPRISE OS</span></div></div>
    <form className="login-card" onSubmit={submit}>
      <div className="login-emblem"><LockKeyhole size={22}/></div>
      <div className="eyebrow"><ShieldCheck size={13}/> PRIVATE WORKSPACE</div>
      <h1>Welcome back.</h1>
      <p>Sign in to your DPM Enterprise workspace.</p>
      <label>Work email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button login-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"} <ArrowRight size={16}/></button>
      <div className="login-foot">Access is managed by your DPM ONE administrator.</div>
    </form>
    <div className="login-copyright">© 2026 DPM ENTERPRISE PRIVATE LIMITED</div>
  </div>;
}
