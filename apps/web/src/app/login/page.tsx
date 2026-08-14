"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth-provider";
import { Alert, Button, IconButton, InputAdornment, Paper, TextField } from "@mui/material";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const subscribeToHydration = () => () => undefined;

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

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
    <div className="login-root" style={{ display: "flex", minHeight: "100vh", background: "#f7f7f5", fontFamily: "'DM Sans', Inter, system-ui, sans-serif", color: "#1c1d21" }}>
      {/* Left Visual Branding Hero Side */}
      <div className="login-visual" style={{ flex: 1.2, background: "linear-gradient(105deg, rgba(255,255,255,.96), rgba(255,255,255,.76)), url('/images/hero.jpg') center / cover", padding: 52, display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden", borderRight: "1px solid #e4e2de" }}>
        {/* Glow Effects */}
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", pointerEvents: "none" }} />

        {/* Brand Header */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <BrandLogo size="md" href="/" dark={false} />
        </div>

        {/* Hero Copy & Visual Cards */}
        <div style={{ position: "relative", zIndex: 2, margin: "40px 0" }}>
          <span style={{ display: "inline-block", background: "#fce8e8", border: "1px solid #f3c3c1", color: "#9b2422", padding: "4px 12px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700, marginBottom: 16 }}>
            CONNECTED ESTATE OPERATIONS
          </span>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.15, margin: "0 0 16px 0", color: "#111827" }}>
            Run every estate with clarity and control
          </h1>
          <p style={{ color: "#44484f", fontSize: "1rem", lineHeight: 1.6, maxWidth: 520, margin: "0 0 32px 0" }}>
            Property, facilities and team work—connected in one trusted operational record.
          </p>

          {/* Module Feature Chips */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 520 }}>
            {[
              { icon: "🏢", name: "Property Management", desc: "Leases, collections & occupancy", color: "#c22e2a" },
              { icon: "🔧", name: "Facility Management", desc: "Work orders & compliance", color: "#1a7a4a" },
              { icon: "📐", name: "Valuation", desc: "Instructions & reporting", color: "#1d4ed8" },
              { icon: "🧭", name: "Companion", desc: "Team tasks & priorities", color: "#b45309" },
            ].map((m) => (
              <div key={m.name} style={{ background: "rgba(255,255,255,.82)", backdropFilter: "blur(8px)", border: "1px solid #e4e2de", borderRadius: 12, padding: 14, boxShadow: "0 4px 12px rgba(0,0,0,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.1rem" }}>{m.icon}</span>
                  <strong style={{ fontSize: "0.85rem", color: "#1c1d21" }}>{m.name}</strong>
                </div>
                <small style={{ color: "#44484f", fontSize: "0.75rem" }}>{m.desc}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", color: "#8a909b", fontSize: "0.75rem" }}>
          <span>© 2026 Center Estates ERP. All rights reserved.</span>
          <span>v2.4 Production Build · ISO 27001</span>
        </div>
      </div>

      {/* Right Login Form Side */}
      <div className="login-form-panel" style={{ flex: 1, background: "#fff", padding: 48, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Paper elevation={0} sx={{ width: "100%", maxWidth: 440, p: { xs: 3, sm: 4 }, border: "1px solid #e4e2de", borderRadius: 3, boxShadow: "0 12px 36px rgba(0,0,0,.08)" }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 8px 0", color: "#1c1d21" }}>Welcome back</h1>
            <p style={{ color: "#44484f", fontSize: "0.875rem", margin: 0 }}>Sign in to access your subscribed workspaces.</p>
          </div>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <TextField label="Username or email" fullWidth
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or john.doe"
                autoComplete="username"
                disabled={!hydrated}
                required
                sx={{ "& .MuiOutlinedInput-root": { background: "#fff" } }}
              />

            <TextField label="Password" fullWidth
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={!hydrated}
                  required
                  slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} edge="end">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton></InputAdornment> } }}
            />

            <Button type="submit" variant="contained" size="large" disabled={loading || !hydrated} aria-busy={loading} startIcon={<LockKeyhole size={16} />} sx={{ py: 1.4, mt: 0.5, bgcolor: "#c22e2a", "&:hover": { bgcolor: "#9b2422" } }}>
              {loading ? "Signing in…" : "Sign In to Workspace →"}
            </Button>
          </form>

          {/* Quick Identity Switcher for Demo / Testing */}
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #e4e2de" }}>
            <small style={{ color: "#8a909b", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 10 }}>
              Quick Demo Personas (1-Click Fill)
            </small>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Super Admin", user: "admin" },
                { label: "Portfolio Manager", user: "role-portfolio-manager" },
                { label: "Operations Staff", user: "role-operations-staff" },
                { label: "Finance Officer", user: "role-finance-officer" },
              ].map((p) => (
                <button
                  key={p.user}
                  type="button"
                  onClick={() => fillQuickLogin(p.user)}
                  style={{ background: "#f7f7f5", border: "1px solid #e4e2de", color: "#44484f", padding: "6px 10px", borderRadius: 6, fontSize: "0.75rem", cursor: "pointer", textAlign: "left" }}
                >
                  👤 {p.label}
                </button>
              ))}
            </div>
          </div>
        </Paper>
      </div>
    </div>
  );
}
