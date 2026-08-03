import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/components/monitoring/react-router-shim";
import { ArrowLeft, Check, HardHat } from "lucide-react";

import { get, post } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

export function Register() {
  const { signIn, me } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"plan" | "form">("plan");
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("professional");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (me) navigate("/app/projects");
  }, [me, navigate]);

  useEffect(() => {
    get<any[]>("/plans").then(setPlans).catch(() => {});
  }, []);

  const submit = async () => {
    setError(null);
    if (!company || !email || !password) { setError("All fields required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await post<any>("/auth/register", { company, email, password, plan: selectedPlan });
      await signIn(email, password);
      navigate("/app/onboarding");
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
          Construction Management
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
        <div className="card login-card signup-card">
          {step === "plan" ? (
            <>
              <h2>Start your free trial</h2>
              <p className="muted auth-card-copy">Choose a plan to get started. 30-day free trial on all plans. No credit card required.</p>
              <div className="auth-plan-grid">
                {plans.map(p => (
                  <button
                    type="button"
                    key={p.slug}
                    className={`auth-plan-card${selectedPlan === p.slug ? " selected" : ""}`}
                    onClick={() => setSelectedPlan(p.slug)}
                  >
                    <span className="auth-plan-check" aria-hidden="true">
                      {selectedPlan === p.slug && <Check size={13} />}
                    </span>
                    <strong>{p.name}</strong>
                    <span className="auth-plan-price">
                      {Number(p.price_monthly).toLocaleString()}
                      <small>/mo</small>
                    </span>
                    <span className="auth-plan-desc">{p.description}</span>
                    <span className="auth-plan-meta">
                      {p.max_users ? `${p.max_users} users max` : "Unlimited users"} · {p.max_projects ? `${p.max_projects} projects` : "Unlimited projects"}
                    </span>
                  </button>
                ))}
              </div>
              <button className="btn auth-primary-action" onClick={() => setStep("form")}>Continue</button>
              <p className="auth-switch-link">
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <button className="btn ghost sm auth-back-button" onClick={() => setStep("plan")}>
                <ArrowLeft size={14} /> Plans
              </button>
              <h2>Create your account</h2>
              <p className="muted auth-card-copy">You selected <strong>{plans.find(p => p.slug === selectedPlan)?.name}</strong> — 30-day free trial. You'll sign up as an admin for your organization.</p>
              <ErrorBanner message={error} />
              <div className="auth-form-stack">
                <div className="field">
                  <label htmlFor="company">Company name</label>
                  <input id="company" autoComplete="organization" value={company} onChange={e => setCompany(e.target.value)} />
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const SignUp = Register;
