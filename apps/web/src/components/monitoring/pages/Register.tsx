import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/components/monitoring/react-router-shim";
import { HardHat } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

export function Register() {
  const { signIn, me } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (me) navigate("/workspaces");
  }, [me, navigate]);

  const submit = async () => {
    setError(null);
    if (!email || !password) { setError("Email and password are required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const response = await apiFetch("/auth/register/", {
        method: "POST",
        body: JSON.stringify({ email, password, organization_name: company }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as Record<string, unknown>;
        const messages = Object.values(body).flat().filter(Boolean).join(" ");
        throw new Error(messages || "Registration failed. Please try again.");
      }
      const payload = await response.json().catch(() => ({})) as { username?: string };
      // New accounts join the Center Estates workspace by default and sign in
      // straight through to the command center.
      await signIn(payload.username ?? email, password);
    } catch (e: any) {
      setError(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="top">
          <span className="logo" style={{ background: "var(--primary)" }}><HardHat size={20} color="#fff" /></span>
          Center Estates ERP
        </div>
        <div>
          <h1>
            One workspace for<br />
            <span className="accent">your entire portfolio.</span>
          </h1>
          <p>
            Property, facilities, valuations and your team — one trusted
            operational record from tenant to boardroom.
          </p>
          <div className="pills">
            <span className="pill">Free trial</span>
            <span className="pill">No credit card</span>
            <span className="pill">Role-based access</span>
            <span className="pill">Audit-sealed</span>
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <div className="card login-card signup-card">
          <h2>Create your account</h2>
          <p className="muted auth-card-copy">
            New accounts join the Center Estates workspace as a Property Manager
            by default. You can create your own organisation later.
          </p>
          <ErrorBanner message={error} />
          <div className="auth-form-stack">
            <div className="field">
              <label htmlFor="company">Company name <small>(optional)</small></label>
              <input id="company" autoComplete="organization" placeholder="Your organisation" value={company} onChange={e => setCompany(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="signup-email">Email address</label>
              <input id="signup-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="signup-password">Password</label>
              <input id="signup-password" type="password" autoComplete="new-password" placeholder="Minimum 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button className="btn auth-primary-action" disabled={loading} onClick={submit}>
              {loading ? "Creating account…" : "Start Free Trial"}
            </button>
            <p className="auth-switch-link">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const SignUp = Register;
