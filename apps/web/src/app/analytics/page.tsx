"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BarChart2, CheckCircle2, ChevronRight,
  Clock, ExternalLink, Filter, HelpCircle, Layers, RefreshCw,
  Search, Settings, ShieldAlert, ShieldCheck, Sparkles, TrendingUp,
  UserCheck, UserMinus, UserPlus, Users, Zap
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

type UserTelemetryStats = {
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  role: string;
  is_admin: boolean;
  events: number;
  modules: string[];
  last_seen: string | null;
  tier: "power" | "active" | "casual" | "inactive";
};

type TelemetrySummary = {
  total_events: number;
  total_members: number;
  active_members: number;
  adoption_rate: number;
  top_module: string;
  window_days?: number;
  period_start?: string;
  generated_at?: string;
  inactive_or_pending_members?: number;
  scope_label?: string;
  activity_sources?: string[];
  staff_events?: number;
  non_staff_or_system_events?: number;
};

type TelemetryInsight = {
  type: "success" | "warning" | "info" | "neutral";
  title: string;
  description: string;
};

type TelemetryResponse = {
  summary?: TelemetrySummary;
  by_module: Record<string, number>;
  by_user: Record<string, UserTelemetryStats>;
  hourly_distribution?: number[];
  insights?: TelemetryInsight[];
  events: { id: string; actor: string; note: string; created_at: string }[];
};

const moduleMeta: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  property: { label: "Property & Leasing", icon: "🏢", color: "#dc2626", desc: "Tenants, Units, Leases & Rent Roll" },
  facility: { label: "Facility & Assets", icon: "🔧", color: "#0284c7", desc: "Work Orders, Preventive PPM, Assets & Meters" },
  sales: { label: "Sales Pipeline", icon: "💰", color: "#16a34a", desc: "Plots, Buyers, Installments & Escrow" },
  tender: { label: "Tender Engine", icon: "📋", color: "#d97706", desc: "RFQs, Contractor Bids & Evaluations" },
  valuation: { label: "Valuation Services", icon: "📜", color: "#9333ea", desc: "Instructions, Site Inspections & Sign-offs" },
  monitoring: { label: "Construction Monitoring", icon: "📊", color: "#ea580c", desc: "Site Snags, IPCs, S-Curves & Programme" },
  companion: { label: "Companion & Operations", icon: "🧭", color: "#059669", desc: "Staff Tasks, Feedback Tickets & Leaves" },
};

function formatWhen(iso: string | null): string {
  if (!iso) return "Never active";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never active";
  const now = new Date();
  const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return "Active just now";
  if (diffHours < 24) return `Active ${Math.round(diffHours)}h ago`;
  if (diffHours < 48) return "Active yesterday";
  const days = Math.round(diffHours / 24);
  if (days < 14) return `Active ${days}d ago`;
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export default function UsageAnalyticsPage() {
  const { session } = useAuth();
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"overview" | "staff" | "modules" | "feed">("overview");
  const [tierFilter, setTierFilter] = useState<"all" | "power" | "active" | "casual" | "inactive">("all");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserTelemetryStats | null>(null);
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);

  const isAdministrator = Boolean(
    session?.user.isSuperuser || session?.permissions.includes("*") || session?.roles.includes("admin") || session?.roles.some(r => r.includes("admin") || r.includes("manager"))
  );

  const loadTelemetry = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`/companion/telemetry/?days=${windowDays}`, { cache: "no-store" }, session?.activeOrganizationId ?? null);
      if (response.ok) {
        setTelemetry(await response.json());
      } else {
        setError("Usage telemetry could not be loaded.");
      }
    } catch {
      setError("Failed to connect to analytics service.");
    } finally {
      setLoading(false);
    }
  }, [session?.activeOrganizationId, windowDays]);

  useEffect(() => {
    if (isAdministrator) void loadTelemetry();
  }, [isAdministrator, loadTelemetry]);

  const users = useMemo(() => {
    if (!telemetry?.by_user) return [];
    return Object.values(telemetry.by_user).sort((a, b) => b.events - a.events);
  }, [telemetry]);

  const modules = useMemo(() => {
    if (!telemetry?.by_module) return [];
    return Object.entries(telemetry.by_module).sort((a, b) => b[1] - a[1]);
  }, [telemetry]);

  const totalEvents = telemetry?.summary?.total_events ?? users.reduce((sum, s) => sum + s.events, 0);
  const activeMembersCount = telemetry?.summary?.active_members ?? users.filter(u => u.tier !== "inactive").length;
  const adoptionRate = telemetry?.summary?.adoption_rate ?? (users.length ? Math.round((activeMembersCount / users.length) * 100) : 0);

  const tierCounts = useMemo(() => ({
    power: users.filter(u => u.tier === "power").length,
    active: users.filter(u => u.tier === "active").length,
    casual: users.filter(u => u.tier === "casual").length,
    inactive: users.filter(u => u.tier === "inactive").length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.role.toLowerCase().includes(userSearch.toLowerCase());
      const matchesTier = tierFilter === "all" || u.tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [users, userSearch, tierFilter]);

  const hourlyData = telemetry?.hourly_distribution ?? Array(24).fill(0);
  const maxHourlyCount = Math.max(1, ...hourlyData);

  const exportUsageReport = () => {
    const exportUsers = selectedUserDetail ? [selectedUserDetail] : filteredUsers;
    downloadCsv(
      `center-estates-usage-${selectedUserDetail?.username || "all-staff"}.csv`,
      [
        ["Staff member", "Username", "Email", "Role", "Adoption tier", "Logged actions", "Modules used", "Last active"],
        ...exportUsers.map(user => [
          user.full_name || user.username, user.username, user.email, user.role, user.tier,
          user.events, user.modules.join("; "), user.last_seen || "Never",
        ]),
      ],
    );
  };

  if (!isAdministrator) {
    return (
      <div className="page-wrap" style={{ maxWidth: 800, margin: "60px auto", textAlign: "center" }}>
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: "48px 24px" }}>
          <ShieldCheck size={48} style={{ color: "#dc2626", marginBottom: 16 }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>Administrator Access Required</h1>
          <p style={{ color: "var(--muted)", maxWidth: 480, margin: "0 auto", fontSize: 14 }}>
            System usage analytics and staff adoption telemetry are restricted to organization administrators and management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap analytics-page" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400, margin: "0 auto" }}>
      {/* 1. Header & Controls */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#dc2626", fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            <BarChart2 size={15} />
            <span>Platform Intelligence &amp; Adoption Matrix</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
            Usage Analytics &amp; User Adoption
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
            Monitor organization engagement, staff adoption velocity, and module workflow utilization across Center Estates.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
            Activity period
            <select
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value) as 7 | 30 | 90)}
              className="fc-toolbar-btn"
              aria-label="Analytics activity period"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
          <button onClick={exportUsageReport} className="fc-toolbar-btn" disabled={loading || users.length === 0} title="Export the filtered staff adoption report">
            <ArrowUpRight size={13} />
            <span>{selectedUserDetail ? `Export ${selectedUserDetail.full_name || selectedUserDetail.username}` : "Export CSV"}</span>
          </button>
          <button
            onClick={() => void loadTelemetry()}
            className="fc-toolbar-btn"
            disabled={loading}
            title="Refresh adoption metrics"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </header>

      {telemetry?.summary && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-sunken)", fontSize: 12, color: "var(--text-secondary)" }}>
          <span>
            <strong style={{ color: "var(--text-primary)" }}>Coverage:</strong> Operations include all organization activity; the adoption matrix includes only {telemetry.summary.scope_label?.toLowerCase() || "active organization staff accounts"} over the last {telemetry.summary.window_days || windowDays} days.
          </span>
          <span title={telemetry.summary.generated_at || undefined}>
            Refreshed {formatWhen(telemetry.summary.generated_at || null)}
            {(telemetry.summary.inactive_or_pending_members || 0) > 0
              ? ` · ${telemetry.summary.inactive_or_pending_members} disabled or pending account(s) excluded`
              : ""}
          </span>
        </div>
      )}

      {/* 2. Executive KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {/* Total Operations */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
            <span>Logged Operations · {windowDays} Days</span>
            <Activity size={16} style={{ color: "#dc2626" }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)" }}>
            {totalEvents.toLocaleString()}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Organization-wide UI and audited transactions
          </span>
        </div>

        {/* Staff Adoption Rate */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
            <span>Staff Adoption Index</span>
            <TrendingUp size={16} style={{ color: "#16a34a" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: adoptionRate >= 70 ? "#16a34a" : "#d97706" }}>
              {adoptionRate}%
            </span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              ({activeMembersCount}/{users.length} active staff)
            </span>
          </div>
          <div style={{ width: "100%", height: 5, borderRadius: 3, background: "var(--border)", marginTop: 2, overflow: "hidden" }}>
            <div style={{ width: `${adoptionRate}%`, height: "100%", background: adoptionRate >= 70 ? "#16a34a" : "#dc2626", borderRadius: 3 }} />
          </div>
        </div>

        {/* Power Users */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
            <span>Power Contributors</span>
            <Zap size={16} style={{ color: "#f59e0b" }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)" }}>
            {tierCounts.power} Staff
          </div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            &gt; 20 operations in this period
          </span>
        </div>

        {/* Inactive / At-Risk */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
            <span>Dormant Accounts</span>
            <UserMinus size={16} style={{ color: tierCounts.inactive > 0 ? "#dc2626" : "#64748b" }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: tierCounts.inactive > 0 ? "#dc2626" : "var(--text-primary)" }}>
            {tierCounts.inactive} Staff
          </div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            No logged activity in this period
          </span>
        </div>
      </div>

      {/* 3. Actionable Insights & Recommendations Banner */}
      {telemetry?.insights && telemetry.insights.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>
          {telemetry.insights.map((insight, idx) => (
            <div
              key={idx}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: insight.type === "warning" ? "rgba(220, 38, 38, 0.05)" : insight.type === "success" ? "rgba(22, 163, 74, 0.05)" : "var(--surface-sunken)",
                border: `1px solid ${insight.type === "warning" ? "rgba(220, 38, 38, 0.2)" : insight.type === "success" ? "rgba(22, 163, 74, 0.2)" : "var(--border)"}`,
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>
                {insight.type === "warning" ? "⚠️" : insight.type === "success" ? "🎯" : "💡"}
              </span>
              <div>
                <strong style={{ fontSize: 13, display: "block", color: "var(--text-primary)" }}>{insight.title}</strong>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Tab Navigation Strip */}
      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
        <button
          onClick={() => setActiveTab("overview")}
          className={`fc-toolbar-btn ${activeTab === "overview" ? "primary" : ""}`}
          style={{ fontWeight: 700 }}
        >
          📊 Adoption Overview &amp; Charts
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`fc-toolbar-btn ${activeTab === "staff" ? "primary" : ""}`}
          style={{ fontWeight: 700 }}
        >
          👥 Staff Adoption Matrix ({users.length})
        </button>
        <button
          onClick={() => setActiveTab("modules")}
          className={`fc-toolbar-btn ${activeTab === "modules" ? "primary" : ""}`}
          style={{ fontWeight: 700 }}
        >
          📦 Module Adoption Breakdown
        </button>
        <button
          onClick={() => setActiveTab("feed")}
          className={`fc-toolbar-btn ${activeTab === "feed" ? "primary" : ""}`}
          style={{ fontWeight: 700 }}
        >
          ⚡ Live Activity Stream ({telemetry?.events.length || 0})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & CHARTS */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Dual Visualization Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
            {/* Left: Module Usage Distribution */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
                    Module Transaction Density
                  </h3>
                  <small style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                    Share of logged operations by functional ERP domain
                  </small>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>{totalEvents} Total</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {modules.map(([modKey, count]) => {
                  const meta = moduleMeta[modKey] || { label: modKey, icon: "📦", color: "#64748b", desc: "" };
                  const percentage = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
                  return (
                    <div key={modKey} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {meta.icon} {meta.label}
                        </span>
                        <span style={{ fontWeight: 700, color: meta.color }}>
                          {count.toLocaleString()} actions ({percentage}%)
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{ width: `${percentage}%`, height: "100%", background: meta.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Hourly Activity Operational Window */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
                    24-Hour Operational Load
                  </h3>
                  <small style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                    System activity distribution across the working day (EAT)
                  </small>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Peak Hours</span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, paddingTop: 10, borderBottom: "1px solid var(--border)" }}>
                {hourlyData.map((count, hour) => {
                  const heightPercent = Math.max(4, Math.round((count / maxHourlyCount) * 100));
                  const isPeak = count === maxHourlyCount && count > 0;
                  return (
                    <div
                      key={hour}
                      style={{
                        flex: 1,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        alignItems: "center",
                      }}
                      title={`${hour}:00 - ${count} actions`}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${heightPercent}%`,
                          background: isPeak ? "#dc2626" : hour >= 8 && hour <= 18 ? "rgba(220,38,38,0.4)" : "rgba(100,116,139,0.3)",
                          borderRadius: "3px 3px 0 0",
                          transition: "height 0.2s ease",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-secondary)", marginTop: 6 }}>
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00 (Noon)</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>
          </div>

          {/* User Adoption Tier Breakdown */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
              Staff Adoption &amp; Engagement Tiers
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div
                onClick={() => { setTierFilter("power"); setActiveTab("staff"); }}
                style={{ padding: 14, borderRadius: 8, background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.2)", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#d97706" }}>⚡ Power Users</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#d97706" }}>{tierCounts.power}</span>
                </div>
                <small style={{ color: "var(--text-secondary)", fontSize: 11 }}>20+ actions recorded · Daily workflow drivers</small>
              </div>

              <div
                onClick={() => { setTierFilter("active"); setActiveTab("staff"); }}
                style={{ padding: 14, borderRadius: 8, background: "rgba(22, 163, 74, 0.06)", border: "1px solid rgba(22, 163, 74, 0.2)", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>✓ Active Contributors</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#16a34a" }}>{tierCounts.active}</span>
                </div>
                <small style={{ color: "var(--text-secondary)", fontSize: 11 }}>5-19 actions · Regular operational users</small>
              </div>

              <div
                onClick={() => { setTierFilter("casual"); setActiveTab("staff"); }}
                style={{ padding: 14, borderRadius: 8, background: "rgba(2, 132, 199, 0.06)", border: "1px solid rgba(2, 132, 199, 0.2)", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0284c7" }}>⏳ Casual Users</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#0284c7" }}>{tierCounts.casual}</span>
                </div>
                <small style={{ color: "var(--text-secondary)", fontSize: 11 }}>1-4 actions · Occasional or new logins</small>
              </div>

              <div
                onClick={() => { setTierFilter("inactive"); setActiveTab("staff"); }}
                style={{ padding: 14, borderRadius: 8, background: "rgba(220, 38, 38, 0.06)", border: "1px solid rgba(220, 38, 38, 0.2)", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>⚠️ Dormant / Inactive</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#dc2626" }}>{tierCounts.inactive}</span>
                </div>
                <small style={{ color: "var(--text-secondary)", fontSize: 11 }}>0 actions · Need onboarding &amp; training</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF ADOPTION MATRIX */}
      {activeTab === "staff" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
          {/* Filter Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative", minWidth: 260 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                <input
                  type="search"
                  placeholder="Search staff by name, username, or role…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ width: "100%", paddingLeft: 32, paddingRight: 12, height: 34, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-sunken)", fontSize: 12 }}
                />
              </div>

              {/* Tier Pills */}
              <div style={{ display: "flex", gap: 4 }}>
                {(["all", "power", "active", "casual", "inactive"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTierFilter(t)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid var(--border)",
                      background: tierFilter === t ? "#dc2626" : "var(--surface-sunken)",
                      color: tierFilter === t ? "#ffffff" : "var(--text-primary)",
                      textTransform: "capitalize",
                    }}
                  >
                    {t === "all" ? "All Tiers" : t}
                  </button>
                ))}
              </div>
            </div>

            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Showing {filteredUsers.length} of {users.length} registered accounts
            </span>
          </div>

          {/* Table */}
          <div className="table-scroll" style={{ overflowX: "auto" }}>
            <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Staff Member &amp; Username</th>
                  <th style={{ textAlign: "left" }}>Assigned Role</th>
                  <th style={{ textAlign: "center" }}>Adoption Tier</th>
                  <th style={{ textAlign: "right" }}>Total Actions</th>
                  <th style={{ textAlign: "left" }}>Active Modules</th>
                  <th style={{ textAlign: "left" }}>Last Active Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--text-secondary)" }}>
                      No staff accounts matched your filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.username} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface-sunken)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
                            {u.username.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong style={{ fontSize: 13, display: "block", color: "var(--text-primary)" }}>
                              {u.full_name}
                            </strong>
                            <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                              @{u.username}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 800,
                            background: u.tier === "power" ? "rgba(245, 158, 11, 0.15)" : u.tier === "active" ? "rgba(22, 163, 74, 0.15)" : u.tier === "casual" ? "rgba(2, 132, 199, 0.15)" : "rgba(220, 38, 38, 0.15)",
                            color: u.tier === "power" ? "#d97706" : u.tier === "active" ? "#16a34a" : u.tier === "casual" ? "#0284c7" : "#dc2626",
                            textTransform: "uppercase",
                          }}
                        >
                          {u.tier === "power" ? "⚡ Power" : u.tier === "active" ? "✓ Active" : u.tier === "casual" ? "⏳ Casual" : "⚠️ Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, fontSize: 13, fontFamily: "monospace" }}>
                        {u.events.toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {u.modules.length ? (
                            u.modules.map((m) => (
                              <span key={m} style={{ fontSize: 11, background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 4 }}>
                                {moduleMeta[m]?.icon || "📦"} {moduleMeta[m]?.label?.split(" ")[0] || m}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: u.tier === "inactive" ? "#dc2626" : "var(--text-secondary)" }}>
                          {formatWhen(u.last_seen)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MODULE ADOPTION */}
      {activeTab === "modules" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          {modules.map(([modKey, count]) => {
            const meta = moduleMeta[modKey] || { label: modKey, icon: "📦", color: "#64748b", desc: "Operational workflows" };
            const percentage = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
            const moduleActiveUsers = users.filter(u => u.modules.includes(modKey)).length;
            return (
              <div
                key={modKey}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{meta.icon}</span>
                      <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{meta.label}</strong>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 900, color: meta.color }}>
                      {count.toLocaleString()} actions
                    </span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-secondary)" }}>{meta.desc}</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)" }}>
                    <span>Traffic share: <strong>{percentage}%</strong></span>
                    <span>Staff adoption: <strong>{moduleActiveUsers}/{users.length} users</strong></span>
                  </div>
                  <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{ width: `${percentage}%`, height: "100%", background: meta.color, borderRadius: 3 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 4: LIVE ACTIVITY STREAM */}
      {activeTab === "feed" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
          <div className="table-scroll">
            <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 160, textAlign: "left" }}>Timestamp</th>
                  <th style={{ width: 180, textAlign: "left" }}>Staff Member</th>
                  <th style={{ textAlign: "left" }}>Operation / Activity Description</th>
                </tr>
              </thead>
              <tbody>
                {!telemetry?.events || telemetry.events.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: 30, color: "var(--text-secondary)" }}>
                      No recent telemetry events recorded.
                    </td>
                  </tr>
                ) : (
                  telemetry.events.slice(0, 50).map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {formatWhen(e.created_at)}
                      </td>
                      <td>
                        <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>@{e.actor}</strong>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-primary)" }}>
                        {e.note.replace(/^Telemetry \[/, "").replace(/\]$/, "")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
