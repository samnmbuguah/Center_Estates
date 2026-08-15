"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink, ShieldCheck, Users, Activity, Layers,
  RefreshCw, BarChart2, Eye, Settings, Search, CheckCircle2,
  Clock, TrendingUp, Sparkles, Maximize2
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

const DEFAULT_POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
const DEFAULT_DASHBOARD_URL = process.env.NEXT_PUBLIC_POSTHOG_DASHBOARD_URL || "";

type UserStats = { events: number; modules: string[]; last_seen: string | null };
type TelemetryResponse = {
  by_module: Record<string, number>;
  by_user: Record<string, UserStats>;
  events: { id: string; actor: string; note: string; created_at: string }[];
};

const moduleLabels: Record<string, { label: string; icon: string; color: string }> = {
  property: { label: "Property Management", icon: "🏢", color: "#4f46e5" },
  facility: { label: "Facility Management", icon: "🔧", color: "#0284c7" },
  sales: { label: "Sales & Leasing", icon: "💰", color: "#16a34a" },
  tender: { label: "Tender Engine", icon: "📋", color: "#d97706" },
  valuation: { label: "Valuation Services", icon: "📜", color: "#9333ea" },
  monitoring: { label: "Construction Monitoring", icon: "📊", color: "#ea580c" },
  companion: { label: "Companion & Staff Ops", icon: "🧭", color: "#059669" },
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export default function UsageAnalyticsPage() {
  const { session } = useAuth();
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // PostHog Embed State
  const [customDashboardUrl, setCustomDashboardUrl] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"staff" | "modules" | "feed">("staff");
  const [userSearch, setUserSearch] = useState("");

  const isAdministrator = Boolean(
    session?.user.isSuperuser || session?.permissions.includes("*") || session?.roles.includes("admin")
  );

  useEffect(() => {
    const saved = localStorage.getItem("center_estates_posthog_embed_url");
    if (saved) setCustomDashboardUrl(saved);
  }, []);

  const activeDashboardUrl = customDashboardUrl || DEFAULT_DASHBOARD_URL;

  const loadTelemetry = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/companion/telemetry/", {}, session?.activeOrganizationId ?? null);
      if (response.ok) {
        setTelemetry(await response.json());
      } else {
        setError("Telemetry data could not be retrieved.");
      }
    } catch {
      setError("Failed to connect to telemetry service.");
    } finally {
      setLoading(false);
    }
  }, [session?.activeOrganizationId]);

  useEffect(() => {
    if (isAdministrator) void loadTelemetry();
  }, [isAdministrator, loadTelemetry]);

  if (!isAdministrator) {
    return (
      <div className="page-wrap" style={{ maxWidth: 800, margin: "60px auto", textAlign: "center" }}>
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: "48px 24px" }}>
          <ShieldCheck size={48} style={{ color: "#d92d2d", marginBottom: 16 }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>Administrator Access Required</h1>
          <p style={{ color: "var(--muted)", maxWidth: 480, margin: "0 auto", fontSize: 14 }}>
            Usage analytics contains organization-wide staff activity, feature telemetry, and product insights restricted to authorized platform administrators.
          </p>
        </div>
      </div>
    );
  }

  const users = telemetry ? Object.entries(telemetry.by_user).sort((a, b) => b[1].events - a[1].events) : [];
  const modules = telemetry ? Object.entries(telemetry.by_module).sort((a, b) => b[1] - a[1]) : [];
  const totalEvents = users.reduce((sum, [, s]) => sum + s.events, 0);
  const topModule = modules.length > 0 ? modules[0] : null;
  const topUser = users.length > 0 ? users[0] : null;

  const filteredUsers = users.filter(([username]) =>
    username.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleSaveEmbedUrl = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("center_estates_posthog_embed_url", customDashboardUrl.trim());
    setShowConfigModal(false);
  };

  return (
    <div className="page-wrap analytics-page" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400, margin: "0 auto" }}>
      {/* 1. Header & Quick Controls */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#d92d2d", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            <BarChart2 size={15} />
            <span>Platform Intelligence & Telemetry</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Usage & Product Analytics</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Live PostHog product insights, feature adoption metrics, and staff workflow analytics.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => void loadTelemetry()}
            className="btn ghost"
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            title="Refresh Telemetry Metrics"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Refreshing…" : "Refresh"}</span>
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="btn ghost"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <Settings size={14} />
            <span>Configure Embed</span>
          </button>

          <a
            className="btn primary"
            href={DEFAULT_POSTHOG_HOST}
            target="_blank"
            rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#d92d2d", borderColor: "#d92d2d", fontSize: 13 }}
          >
            <span>Open PostHog Cloud</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </header>

      {/* 2. TOP SECTION: POSTHOG DASHBOARD EMBEDMENT */}
      <section style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "var(--surface-2, #f8fafc)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🦔</span>
            <div>
              <strong style={{ fontSize: 14, display: "block" }}>PostHog Analytics Live Embed</strong>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {activeDashboardUrl ? "Displaying embedded dashboard instance" : "Embed ready — Configure shared dashboard URL"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="status-pill active" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
              Telemetry Tracking Live
            </span>
          </div>
        </div>

        {activeDashboardUrl ? (
          <div style={{ position: "relative", width: "100%", height: "640px", background: "#f8fafc" }}>
            <iframe
              title="Center Estates PostHog Analytics Dashboard"
              src={activeDashboardUrl}
              allow="fullscreen"
              sandbox="allow-scripts allow-same-origin allow-popups"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          </div>
        ) : (
          <div style={{ padding: "40px 24px", textAlign: "center", background: "linear-gradient(180deg, rgba(248,250,252,0.6) 0%, rgba(241,245,249,0.8) 100%)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(217, 45, 45, 0.1)", color: "#d92d2d", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Sparkles size={24} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>PostHog Dashboard Embed Ready</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, maxWidth: 500, margin: "0 auto 16px" }}>
              Embed your PostHog Insights or Shared Dashboard directly at the top of this page to view real-time retention, funnel conversion, and staff session recordings.
            </p>
            <button
              onClick={() => setShowConfigModal(true)}
              className="btn primary"
              style={{ background: "#d92d2d", borderColor: "#d92d2d", fontSize: 13 }}
            >
              + Add PostHog Shared Dashboard URL
            </button>
          </div>
        )}
      </section>

      {/* 3. EXECUTIVE KPI STRIP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Total System Events</span>
            <Activity size={18} style={{ color: "#4f46e5" }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--foreground)" }}>{totalEvents.toLocaleString()}</div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Recorded client & staff actions</span>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Active Users</span>
            <Users size={18} style={{ color: "#0284c7" }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--foreground)" }}>{users.length}</div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Engaged team members</span>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Primary Module</span>
            <Layers size={18} style={{ color: "#16a34a" }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", textTransform: "capitalize" }}>
            {topModule ? `${moduleLabels[topModule[0]]?.icon || "📦"} ${moduleLabels[topModule[0]]?.label || topModule[0]}` : "—"}
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {topModule ? `${topModule[1]} logged operations` : "No module events"}
          </span>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Most Active Staff</span>
            <TrendingUp size={18} style={{ color: "#d92d2d" }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)" }}>
            {topUser ? `@${topUser[0]}` : "—"}
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {topUser ? `${topUser[1].events} actions logged` : "No staff activity"}
          </span>
        </div>
      </div>

      {/* 4. AUDITED TABBED SECTIONS (Clutter-Free UI/UX) */}
      <section style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, overflow: "hidden" }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: 8, padding: "12px 20px", background: "var(--surface-2, #f8fafc)", borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => setActiveTab("staff")}
            className={`btn ${activeTab === "staff" ? "primary" : "ghost"}`}
            style={{
              fontSize: 13,
              background: activeTab === "staff" ? "#d92d2d" : "transparent",
              borderColor: activeTab === "staff" ? "#d92d2d" : "transparent",
            }}
          >
            👥 Staff Activity Matrix ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("modules")}
            className={`btn ${activeTab === "modules" ? "primary" : "ghost"}`}
            style={{
              fontSize: 13,
              background: activeTab === "modules" ? "#d92d2d" : "transparent",
              borderColor: activeTab === "modules" ? "#d92d2d" : "transparent",
            }}
          >
            📦 Module Adoption Breakdown ({modules.length})
          </button>
          <button
            onClick={() => setActiveTab("feed")}
            className={`btn ${activeTab === "feed" ? "primary" : "ghost"}`}
            style={{
              fontSize: 13,
              background: activeTab === "feed" ? "#d92d2d" : "transparent",
              borderColor: activeTab === "feed" ? "#d92d2d" : "transparent",
            }}
          >
            ⚡ Live Activity Stream ({telemetry?.events.length || 0})
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* TAB 1: STAFF ACTIVITY */}
          {activeTab === "staff" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                <div style={{ position: "relative", minWidth: 260 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    type="search"
                    placeholder="Search staff by username…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ width: "100%", paddingLeft: 32, paddingRight: 12, height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-sunken)", fontSize: 13 }}
                  />
                </div>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  Showing {filteredUsers.length} of {users.length} tracked staff accounts
                </span>
              </div>

              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead>
                    <tr>
                      <th>Staff Account</th>
                      <th>Total Events</th>
                      <th>Active Modules</th>
                      <th>Last Active Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: 30 }} className="muted">
                          {userSearch ? "No staff accounts matched your search filter." : "No staff telemetry recorded yet."}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(([username, stats]) => (
                        <tr key={username}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#e0e7ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                                {username.slice(0, 2).toUpperCase()}
                              </span>
                              <strong style={{ fontSize: 13 }}>@{username}</strong>
                            </div>
                          </td>
                          <td className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                            {stats.events.toLocaleString()}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {stats.modules.length ? (
                                stats.modules.map((m) => (
                                  <span key={m} className="status-pill" style={{ fontSize: 11, padding: "2px 8px" }}>
                                    {moduleLabels[m]?.icon || "📦"} {moduleLabels[m]?.label || m}
                                  </span>
                                ))
                              ) : (
                                <span className="muted" style={{ fontSize: 12 }}>—</span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>
                            {formatWhen(stats.last_seen)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: MODULE ADOPTION */}
          {activeTab === "modules" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 6px" }}>
                Relative feature usage and event density across the 7 ERP functional modules:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                {modules.map(([modKey, count]) => {
                  const info = moduleLabels[modKey] || { label: modKey, icon: "📦", color: "#64748b" };
                  const percentage = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
                  return (
                    <div
                      key={modKey}
                      style={{
                        padding: 16,
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--surface-2, #f8fafc)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>
                          {info.icon} {info.label}
                        </span>
                        <strong style={{ fontSize: 14, color: info.color }}>{count.toLocaleString()}</strong>
                      </div>
                      <div style={{ width: "100%", height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{ width: `${percentage}%`, height: "100%", background: info.color, borderRadius: 4 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                        <span>Share of total traffic</span>
                        <span>{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: LIVE ACTIVITY FEED */}
          {activeTab === "feed" && (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th style={{ width: 180 }}>When</th>
                    <th style={{ width: 160 }}>Actor</th>
                    <th>Activity Description</th>
                  </tr>
                </thead>
                <tbody>
                  {!telemetry?.events || telemetry.events.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: 30 }} className="muted">
                        No recent telemetry log records found.
                      </td>
                    </tr>
                  ) : (
                    telemetry.events.slice(0, 30).map((e) => (
                      <tr key={e.id}>
                        <td className="muted" style={{ fontSize: 12 }}>
                          {formatWhen(e.created_at)}
                        </td>
                        <td>
                          <strong style={{ fontSize: 13 }}>@{e.actor}</strong>
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {e.note.replace(/^Telemetry \[/, "").replace(/\]$/, "")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* MODAL: CONFIGURE POSTHOG EMBED URL */}
      {showConfigModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border)", borderRadius: 12, width: "100%", maxWidth: 540, padding: 24, boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>Configure PostHog Dashboard Embed</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
              Paste the public or shared dashboard URL from your PostHog Cloud or self-hosted workspace to render it live at the top of the analytics page.
            </p>

            <form onSubmit={handleSaveEmbedUrl} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                  PostHog Shared Dashboard URL
                </label>
                <input
                  type="url"
                  placeholder="https://app.posthog.com/embedded/..."
                  value={customDashboardUrl}
                  onChange={(e) => setCustomDashboardUrl(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}
                />
                <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 4 }}>
                  In PostHog, open your Dashboard → Click &quot;Share&quot; → Toggle &quot;Embed dashboard&quot; → Copy the iframe source link.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setShowConfigModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" style={{ background: "#d92d2d", borderColor: "#d92d2d" }}>
                  Save Embed Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
