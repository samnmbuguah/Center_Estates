"use client";

import { Eye, EyeOff, FileText, HardHat, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/components/monitoring/react-router-shim";
import { useAuth } from "@/components/auth-provider";

export function Login() {
  const { login, session } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session?.user) {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--bg)" }}>
      <div className="login-hero" style={{ background: "linear-gradient(135deg, #0b1727, #071524)", color: "#fff", padding: 48, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div className="top" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="Center Estates ERP" style={{ height: 44, width: "auto", background: "#ffffff", padding: "6px 14px", borderRadius: 8, objectFit: "contain" }} />
        </div>
        <div style={{ margin: "auto 0" }}>
          <h1 style={{ fontSize: 38, lineHeight: 1.2, margin: "0 0 16px", fontWeight: 800 }}>
            Site to boardroom,<br />
            <span className="accent" style={{ color: "#00a3ff" }}>in real time.</span>
          </h1>
          <p style={{ color: "#cbd5e1", fontSize: 15, maxWidth: 480, lineHeight: 1.6, margin: "0 0 24px" }}>
            Geofenced photo evidence, milestone verification, property accounting, valuation tracking, and bid intelligence — one source of truth across all operations.
          </p>
          <div className="pills" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 14px", fontSize: 12 }}>Property Portfolio</span>
            <span className="pill" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 14px", fontSize: 12 }}>Sales CRM</span>
            <span className="pill" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 14px", fontSize: 12 }}>Tender Vault</span>
            <span className="pill" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 14px", fontSize: 12 }}>Valuation Tracker</span>
            <span className="pill" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 14px", fontSize: 12 }}>Construction Control</span>
          </div>
        </div>
      </div>

      <div className="login-form-side" style={{ display: "grid", placeItems: "center", padding: 32 }}>
        <form className="card login-card" onSubmit={submit} style={{ maxWidth: 420, width: "100%", padding: 32, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <h2 style={{ fontSize: 24, margin: "0 0 6px", fontWeight: 800, color: "var(--text)" }}>Welcome back</h2>
          <p className="muted" style={{ marginBottom: 20, fontSize: 14, color: "var(--muted)" }}>Sign in to your organization workspace.</p>
          
          <div className="field" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="username" style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Email / Username</label>
            <input id="username" name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14 }} required />
          </div>

          <div className="field" style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="password" style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input id="password" name="password" type={showPw ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "10px 40px 10px 12px", width: "100%", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14 }} required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="btn ghost icon-only" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, cursor: "pointer", color: "var(--muted)" }} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <div style={{ padding: 12, borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <button className="btn primary" style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: 8, background: "var(--primary)", color: "#fff", border: 0, cursor: "pointer" }} disabled={busy || !username || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p style={{ marginTop: 16, fontSize: 13, textAlign: "center", color: "var(--muted)" }}>
            Don&apos;t have an account? <Link to="/sign-up" style={{ color: "var(--primary)", fontWeight: 700 }}>Start a free trial</Link>
          </p>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/home" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>← Back to Public Website</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
