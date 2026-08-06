"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid username or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillQuickLogin = (u: string) => {
    setUsername(u);
    setPassword("admin123");
    setError("");
  };

  return (
    <div className="login-root" style={{ display: "flex", minHeight: "100vh", background: "#0f172a", fontFamily: "Inter, system-ui, sans-serif", color: "#f8fafc" }}>
      {/* Left Visual Branding Hero Side */}
      <div style={{ flex: 1.2, background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)", padding: 48, display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden", borderRight: "1px solid #1e293b" }}>
        {/* Glow Effects */}
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", pointerEvents: "none" }} />

        {/* Brand Header */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 22, boxShadow: "0 4px 12px rgba(99,102,241,0.4)" }}>
              CE
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#ffffff" }}>Center Estates</h2>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Enterprise Real Estate Platform</span>
            </div>
          </div>
        </div>

        {/* Hero Copy & Visual Cards */}
        <div style={{ position: "relative", zIndex: 2, margin: "40px 0" }}>
          <span style={{ display: "inline-block", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", padding: "4px 12px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700, marginBottom: 16 }}>
            INTEGRATED ERP & FACILITY ENGINE
          </span>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.15, margin: "0 0 16px 0", color: "#ffffff" }}>
            Unified Real Estate & Facility Intelligence
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "1rem", lineHeight: 1.6, maxWidth: 520, margin: "0 0 32px 0" }}>
            Streamline lease accounting, asset maintenance schedules, valuation compliance, and automated staff task workflows in one unified operating system.
          </p>

          {/* Module Feature Chips */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 520 }}>
            {[
              { icon: "🏢", name: "Property Management", desc: "Lease roll & rent collection", color: "#e23b3b" },
              { icon: "🔧", name: "Facility Management", desc: "Work orders & PPM SLA", color: "#16a34a" },
              { icon: "📐", name: "Valuation", desc: "Site inspection & RICS reports", color: "#0891b2" },
              { icon: "🧭", name: "Companion Tasks", desc: "Staff task command center", color: "#0d9488" },
            ].map((m) => (
              <div key={m.name} style={{ background: "rgba(30, 41, 59, 0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.1rem" }}>{m.icon}</span>
                  <strong style={{ fontSize: "0.85rem", color: "#f8fafc" }}>{m.name}</strong>
                </div>
                <small style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{m.desc}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "0.75rem" }}>
          <span>© 2026 Center Estates ERP. All rights reserved.</span>
          <span>v2.4 Production Build · ISO 27001</span>
        </div>
      </div>

      {/* Right Login Form Side */}
      <div style={{ flex: 1, background: "#0f172a", padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 8px 0", color: "#ffffff" }}>Sign in to your account</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>Enter your organization credentials to access your workspace.</p>
          </div>

          {error && (
            <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "12px 16px", borderRadius: 8, fontSize: "0.85rem", marginBottom: 20 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>Username or Email</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or john.doe"
                autoComplete="username"
                required
                style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "12px 14px", color: "#ffffff", fontSize: "0.9rem", outline: "none" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "12px 40px 12px 14px", color: "#ffffff", fontSize: "0.9rem", outline: "none" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #6366f1, #2563eb)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: 14,
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: loading ? "wait" : "pointer",
                boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                marginTop: 6,
              }}
            >
              {loading ? "Signing in…" : "Sign In to Workspace →"}
            </button>
          </form>

          {/* Quick Identity Switcher for Demo / Testing */}
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #1e293b" }}>
            <small style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 10 }}>
              Quick Demo Personas (1-Click Fill)
            </small>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Super Admin", user: "admin" },
                { label: "Property Manager", user: "role-property-admin" },
                { label: "Facility Technician", user: "role-facility-technician" },
                { label: "Valuation Inspector", user: "role-valuer-inspector" },
              ].map((p) => (
                <button
                  key={p.user}
                  type="button"
                  onClick={() => fillQuickLogin(p.user)}
                  style={{ background: "#1e293b", border: "1px solid #334155", color: "#cbd5e1", padding: "6px 10px", borderRadius: 6, fontSize: "0.75rem", cursor: "pointer", textAlign: "left" }}
                >
                  👤 {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
