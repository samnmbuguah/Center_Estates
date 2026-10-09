"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Alert, Button, IconButton, InputAdornment, Paper, TextField } from "@mui/material";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { isSalesOnlyHost } from "@/lib/site-mode";

interface LoginFormProps {
  isSalesInitial?: boolean;
}

export function LoginForm({ isSalesInitial }: LoginFormProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSales, setIsSales] = useState(() => {
    if (typeof isSalesInitial === "boolean") return isSalesInitial;
    return typeof window !== "undefined" ? isSalesOnlyHost() : false;
  });

  useEffect(() => {
    if (typeof isSalesInitial !== "boolean") {
      setIsSales(isSalesOnlyHost());
    }
  }, [isSalesInitial]);

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

  const salesFeatureCards = [
    { icon: "💼", name: "Sales & CRM Pipeline", desc: "Buyer leads, reservations & offer letters" },
    { icon: "🔑", name: "Buyer & Client Portal", desc: "Milestone progress, agreements & payments" },
    { icon: "🧑‍💼", name: "Agent & Advisory Desk", desc: "Site visits, enquiries & commissions" },
    { icon: "📜", name: "Sectional Title Listings", desc: "Off-plan developments & unit matrices" },
  ];

  const erpFeatureCards = [
    { icon: "🏢", name: "Property Management", desc: "Leases, collections & occupancy" },
    { icon: "🔧", name: "Facility Management", desc: "Work orders & compliance" },
    { icon: "📐", name: "Valuation", desc: "Instructions & reporting" },
    { icon: "🧭", name: "Companion", desc: "Team tasks & priorities" },
  ];

  const featureCards = isSales ? salesFeatureCards : erpFeatureCards;

  return (
    <div
      className="login-root"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--login-page-bg)",
        fontFamily: "'DM Sans', Inter, system-ui, sans-serif",
        color: "var(--login-text)",
      }}
    >
      {/* Left Visual Branding Hero Side */}
      <div
        className="login-visual"
        style={{
          flex: 1.2,
          background: "var(--login-hero-overlay), url('/images/hero.jpg') center / cover",
          padding: 52,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
          borderRight: "1px solid var(--login-border)",
        }}
      >
        {/* Glow Effects */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            left: "-10%",
            width: "50%",
            height: "50%",
            background: isSales
              ? "radial-gradient(circle, rgba(185,28,28,0.2) 0%, rgba(0,0,0,0) 70%)"
              : "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            right: "-10%",
            width: "60%",
            height: "60%",
            background: isSales
              ? "radial-gradient(circle, rgba(220,38,38,0.15) 0%, rgba(0,0,0,0) 70%)"
              : "radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(0,0,0,0) 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        {/* Brand Header */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <BrandLogo
            size="md"
            href="/"
            dark={false}
            brandName={isSales ? "Center Estates" : "CeEst"}
            tagline={isSales ? "Sales & Client Portal" : "Estate ERP"}
          />
        </div>

        {/* Hero Copy & Visual Cards */}
        <div style={{ position: "relative", zIndex: 2, margin: "40px 0" }}>
          <span
            style={{
              display: "inline-block",
              background: "#fce8e8",
              border: "1px solid #f3c3c1",
              color: "#9b2422",
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: "0.75rem",
              fontWeight: 700,
              marginBottom: 16,
              letterSpacing: "0.5px",
            }}
          >
            {isSales ? "SALES, AGENTS & CLIENT PORTAL" : "CONNECTED ESTATE OPERATIONS"}
          </span>
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              lineHeight: 1.15,
              margin: "0 0 16px 0",
              color: "var(--login-text)",
            }}
          >
            {isSales
              ? "Real Estate Sales, Portals & Developments"
              : "Run every estate with clarity and control"}
          </h1>
          <p
            style={{
              color: "var(--login-secondary)",
              fontSize: "1rem",
              lineHeight: 1.6,
              maxWidth: 520,
              margin: "0 0 32px 0",
            }}
          >
            {isSales
              ? "Manage property listings, client pipelines, reservations, and buyer milestone progress in one unified portal."
              : "Property, facilities and team work—connected in one trusted operational record."}
          </p>

          {/* Module Feature Chips */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 520 }}>
            {featureCards.map((m) => (
              <div
                key={m.name}
                className="login-module-card"
                style={{
                  background: "var(--login-module-bg)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid var(--login-border)",
                  borderRadius: 12,
                  padding: 14,
                  boxShadow: "var(--login-module-shadow)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.1rem" }}>{m.icon}</span>
                  <strong style={{ fontSize: "0.85rem", color: "var(--login-text)" }}>{m.name}</strong>
                </div>
                <small style={{ color: "var(--login-secondary)", fontSize: "0.75rem" }}>{m.desc}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            justifyContent: "space-between",
            color: "var(--login-muted)",
            fontSize: "0.75rem",
          }}
        >
          <span>
            © 2026 {isSales ? "Center Estates Kenya" : "CeEst ERP"}. All rights reserved.
          </span>
          <span>
            {isSales ? "Sales & Client Platform · ISO 27001" : "v2.4 Production Build · ISO 27001"}
          </span>
        </div>
      </div>

      {/* Right Login Form Side */}
      <div
        className="login-form-panel"
        style={{
          flex: 1,
          background: "var(--login-panel-bg)",
          padding: 48,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Paper
          className="login-auth-card"
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 440,
            p: { xs: 3, sm: 4 },
            bgcolor: "var(--login-card-bg)",
            color: "var(--login-text)",
            border: "1px solid var(--login-border)",
            borderRadius: 3,
            boxShadow: "var(--login-card-shadow)",
            "& .MuiOutlinedInput-root": { bgcolor: "var(--login-input-bg)" },
            "& .MuiInputLabel-root": { color: "var(--login-secondary)" },
          }}
        >
          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontSize: "1.8rem",
                fontWeight: 800,
                margin: "0 0 8px 0",
                color: "var(--login-text)",
              }}
            >
              {isSales ? "Sign In to Portal" : "Welcome back"}
            </h1>
            <p style={{ color: "var(--login-secondary)", fontSize: "0.875rem", margin: 0 }}>
              {isSales
                ? "Sign in with your staff, sales agent, or client portal account."
                : "Sign in to access your subscribed workspaces."}
            </p>
          </div>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <TextField
              label="Username or email"
              fullWidth
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or agent.john"
              autoComplete="username"
              required
            />

            <TextField
              label="Password"
              fullWidth
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              aria-busy={loading}
              startIcon={<LockKeyhole size={16} />}
              sx={{
                py: 1.4,
                mt: 0.5,
                bgcolor: "#c22e2a",
                "&:hover": { bgcolor: "#9b2422" },
              }}
            >
              {loading
                ? "Signing in…"
                : isSales
                ? "Sign In to Portal →"
                : "Sign In to Workspace →"}
            </Button>
          </form>

          {isSales && (
            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: "1px solid var(--login-border)",
                textAlign: "center",
                fontSize: "0.85rem",
                color: "var(--login-secondary)",
              }}
            >
              Looking for property listings?{" "}
              <Link
                href="/properties"
                style={{
                  color: "#c22e2a",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Browse Properties →
              </Link>
            </div>
          )}
        </Paper>
      </div>
    </div>
  );
}
