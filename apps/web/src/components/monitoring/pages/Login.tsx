import { Eye, EyeOff, FileText, HardHat, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/components/monitoring/react-router-shim";

import { apkDownloadUrl, usabilityPdfUrl } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

export function Login() {
  const { signIn, error, me } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!me) return;
    // Role-based default home: financiers/execs prefer finance; CoW prefer daily logs.
    const roles = (me.roles || []).map((r) => String(r).toLowerCase());
    const perms = new Set(me.permissions || []);
    let dest = "/app";
    if (roles.some((r) => r.includes("clerk") || r.includes("cow"))) {
      dest = perms.has("site.reporting.view") ? "/app/daily-logs" : "/app";
    } else if (roles.some((r) => r.includes("financ") || r.includes("qs") || r.includes("quantity"))) {
      dest = perms.has("finance.view") ? "/app/finance" : "/app";
    } else if (roles.some((r) => r.includes("admin") || r.includes("subscriber"))) {
      dest = perms.has("users.view") ? "/app/administration" : "/app";
    }
    navigate(dest, { replace: true });
  }, [me, navigate]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  // Read branding from query param or local branding data (set by tenant context)
  const [branding] = useState<{ logo_url?: string; primary_color?: string; company_name?: string } | null>(() => {
    try {
      const el = document.getElementById("branding-data");
      if (el) return JSON.parse(el.textContent || "null");
    } catch {}
    return null;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(username, password);
    } catch {
      /* error shown via context */
    } finally {
      setBusy(false);
    }
  }

  const brandColor = branding?.primary_color || "var(--primary)";
  const brandLogo = branding?.logo_url;
  const brandName = branding?.company_name || "Construction Management";

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="top">
          {brandLogo ? (
            <img src={brandLogo} alt="" style={{ height: 36, borderRadius: 8 }} />
          ) : (
            <span className="logo" style={{ background: brandColor }}><HardHat size={20} color="#fff" /></span>
          )}
          {brandName}
        </div>
        <div>
          <h1>
            Site to boardroom,<br />
            <span className="accent">in real time.</span>
          </h1>
          <p>
            Geofenced photo evidence, biometric-signed milestones and verified
            progress — one source of truth from the trench to the certificate.
          </p>
          <div className="pills">
            <span className="pill">Evidence-grade</span>
            <span className="pill">Geofenced</span>
            <span className="pill">Audit-sealed</span>
            <span className="pill">Offline-first</span>
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <form className="card login-card" onSubmit={submit}>
          <h2>Welcome back</h2>
          <p className="muted" style={{ marginBottom: 18 }}>Sign in to the management portal.</p>
          <div className="field">
            <label htmlFor="username">Email / Username</label>
            <input id="username" name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <input id="password" name="password" type={showPw ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="btn ghost icon-only" style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", padding: 4 }} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <ErrorBanner message={error} />}
          <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={busy || !username || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ marginTop: 12, fontSize: 13, textAlign: "center" }}>
            Don&apos;t have an account? <Link to="/sign-up">Start a free trial</Link>
          </p>
          {/* Public downloads — available without an account. */}
          <div className="row" style={{ marginTop: 16, justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <a className="btn ghost sm" href={usabilityPdfUrl} target="_blank" rel="noreferrer">
              <FileText size={14} /> Usability testing guide (PDF)
            </a>
            <a className="btn ghost sm" href={apkDownloadUrl}>
              <Smartphone size={14} /> Android app (APK)
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
