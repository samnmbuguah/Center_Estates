import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@/components/monitoring/react-router-shim";

import { fetchPlans } from "../api";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  description: string;
  max_users: number;
  features: Record<string, boolean>;
}

const FALLBACK_PLANS: Plan[] = [
  { id: "starter", name: "Starter", slug: "starter", price_monthly: 49, price_yearly: 490, description: "For small teams getting started", max_users: 5, features: { "Up to 5 users": true, "Progress Tracking": true, "Basic Reporting": true, "Mobile App": true, "Email Support": true, "Daily Logs": true, "Tickets": true } },
  { id: "professional", name: "Professional", slug: "professional", price_monthly: 149, price_yearly: 1490, description: "For growing construction firms", max_users: 20, features: { "Up to 20 users": true, "All Starter Features": true, "Financial Management": true, "Procurement": true, "Quality Management": true, "Cost Dashboard": true, "API Access": true, "Priority Support": true } },
  { id: "enterprise", name: "Enterprise", slug: "enterprise", price_monthly: 399, price_yearly: 3990, description: "For large organisations", max_users: 100, features: { "Up to 100 users": true, "All Professional Features": true, "Consultant Payments": true, "BIM Models": true, "Drone Data": true, "Custom Integrations": true, "Dedicated Support": true, "On-Premise Option": true, "SLA Guarantee": true } },
];

export function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);

  useEffect(() => {
    fetchPlans().then(data => setPlans(data as Plan[])).catch(() => {});
  }, []);

  const allFeatures = [...new Set(plans.flatMap(p => Object.keys(p.features)))];

  return (
    <div>
      <section style={{ padding: "60px 24px 32px", textAlign: "center" }}>
        <h1 style={{ fontSize: 40, marginBottom: 8 }}>Simple, Transparent Pricing</h1>
        <p style={{ color: "var(--muted)", fontSize: 17, marginBottom: 28 }}>No hidden fees. No long-term contracts. Cancel any time.</p>

        <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: 32 }}>
          <button className={`btn sm ${!yearly ? "" : "ghost"}`} style={{ borderRadius: 9 }} onClick={() => setYearly(false)}>Monthly</button>
          <button className={`btn sm ${yearly ? "" : "ghost"}`} style={{ borderRadius: 9 }} onClick={() => setYearly(true)}>Annual <span style={{ fontSize: 11, opacity: 0.8 }}>(save ~17%)</span></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, maxWidth: 960, margin: "0 auto" }}>
          {plans.map(p => {
            const price = yearly ? p.price_yearly / 12 : p.price_monthly;
            return (
              <div key={p.id} className="card" style={{ padding: 28, display: "flex", flexDirection: "column" }}>
                <h3 style={{ margin: "0 0 4px", textTransform: "none", letterSpacing: 0, fontSize: 18, color: "var(--text)" }}>{p.name}</h3>
                <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 16px" }}>{p.description}</p>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 36, fontWeight: 700 }}>${Math.round(price)}</span>
                  <span style={{ color: "var(--muted)", fontSize: 14 }}>/month</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--faint)", marginBottom: 16 }}>Up to {p.max_users} users</p>
                <Link to="/sign-up" className="btn" style={{ justifyContent: "center", marginBottom: 20 }}>
                  {p.name === "Enterprise" ? "Contact Sales" : "Start Free Trial"}
                </Link>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, textAlign: "left" }}>
                  {Object.entries(p.features).map(([k, v]) => (
                    <li key={k} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 14, color: "var(--muted)" }}>
                      <Check size={16} style={{ color: "var(--green)", flex: "none", marginTop: 2 }} />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature comparison */}
      <section style={{ padding: "40px 24px 60px", maxWidth: 960, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, marginBottom: 24 }}>Feature Comparison</h2>
        <div className="card" style={{ overflowX: "auto", padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: "var(--surface)" }}>Feature</th>
                {plans.map(p => <th key={p.id} style={{ textAlign: "center" }}>{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {allFeatures.map(f => (
                <tr key={f}>
                  <td style={{ position: "sticky", left: 0, background: "var(--surface)", fontWeight: 500 }}>{f}</td>
                  {plans.map(p => (
                    <td key={p.id} style={{ textAlign: "center" }}>
                      {p.features[f] ? <Check size={18} style={{ color: "var(--green)", margin: "0 auto" }} /> : <span style={{ color: "var(--faint)" }}>&mdash;</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ padding: "40px 24px 60px", textAlign: "center", background: "var(--surface)" }}>
        <h2 style={{ fontSize: 26, marginBottom: 12 }}>Not sure which plan fits?</h2>
        <p style={{ color: "var(--muted)", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
          Start with a free trial and upgrade as you grow. All plans include a 14-day free trial.
        </p>
        <Link to="/sign-up" className="btn">Start Free Trial</Link>
      </section>
    </div>
  );
}
