"use client";

import React, { useState } from "react";
import { money } from "@/components/module-ui";
import { FacilityTab, FacilityDashboard } from "../../types/facility.types";
import { FcStatus } from "../FacilityToolbar";

function PanelHeader({
  title,
  action,
  badge,
  actionText = "View all →",
}: {
  title: string;
  action?: () => void;
  badge?: number;
  actionText?: string;
}) {
  return (
    <header className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h2 style={{ fontSize: 14, margin: 0, display: "flex", gap: 8, alignItems: "center", color: "var(--text-primary)", fontWeight: 800 }}>
        {title}
        {badge !== undefined && (
          <span
            style={{
              background: "#fee2e2",
              borderRadius: 99,
              color: "#c02727",
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 8px",
            }}
          >
            {badge}
          </span>
        )}
      </h2>
      {action && (
        <button onClick={action} style={{ background: "none", border: 0, color: "var(--primary)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          {actionText}
        </button>
      )}
    </header>
  );
}

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
      {message}
    </div>
  );
}

function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  link,
  onClick,
  badge,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
  link?: string;
  onClick?: () => void;
  badge?: string;
}) {
  return (
    <button className="fc-kpi-card" onClick={onClick} style={{ textAlign: "left", position: "relative", cursor: "pointer" }}>
      {badge && (
        <span style={{ position: "absolute", top: 10, right: 10, background: "#dbeafe", color: "#1e40af", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>
          {badge}
        </span>
      )}
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub && <span className="fc-kpi-sub">{sub}</span>}
      {link && (
        <span className="fc-kpi-link">
          {link} →
        </span>
      )}
    </button>
  );
}

export function OverviewView({
  dashboard,
  setTab,
  setShowCreate,
  canWork,
}: {
  dashboard: FacilityDashboard;
  setTab: (t: FacilityTab) => void;
  setShowCreate: (b: boolean) => void;
  canWork: boolean;
}) {
  const [viewMode, setViewMode] = useState<"manager" | "client">("manager");
  const kpi = dashboard.kpis;
  const openWO = Number(kpi.openWorkOrders ?? 0);
  const overdueWO = Number(kpi.overdueWorkOrders ?? 0);
  const inProgressWO = Math.max(openWO - overdueWO, 0);
  const compliance = Number(kpi.maintenanceCompliance ?? 0);
  const slaAchievement = Number(kpi.slaAchievement ?? 0);
  const weightedIndex = Number(kpi.weightedFMIndex ?? 0);
  const budgetAllocated = Number(kpi.budgetAllocated ?? 0);
  const budgetSpent = Number(kpi.budgetSpent ?? 0);
  const budgetUtilization = budgetAllocated > 0 ? Math.min(100, (budgetSpent / budgetAllocated) * 100) : 0;
  const assetCategories = dashboard.assetCategories ?? [];
  const totalAssets = assetCategories.reduce((s, i) => s + i.count, 0) || Number(kpi.activeAssets ?? 0);

  const donutGrad = openWO
    ? `conic-gradient(
        #ef4444 0% ${((overdueWO / Math.max(openWO, 1)) * 100).toFixed(1)}%,
        #3b82f6 ${((overdueWO / Math.max(openWO, 1)) * 100).toFixed(1)}% 60%,
        #f59e0b 60% 78%,
        #22c55e 78% 100%
      )`
    : `conic-gradient(#22c55e 0% 100%)`;

  const slaDonut = `conic-gradient(#22c55e 0% ${compliance}%, var(--border) ${compliance}% 100%)`;
  const fmScoreGrad = `conic-gradient(#22c55e 0% ${weightedIndex}%, var(--border) ${weightedIndex}% 100%)`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Perspective Switcher Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: viewMode === "manager" ? "#fee2e2" : "#dbeafe",
              color: viewMode === "manager" ? "#dc2626" : "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
            }}
          >
            {viewMode === "manager" ? "⚡" : "📊"}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {viewMode === "manager" ? "FM Operations Command Centre" : "Client & Landlord Strategic Dashboard"}
            </h1>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {viewMode === "manager"
                ? "Real-time dispatch, SLA tracking, compliance flags & operational maintenance"
                : "Executive FM score, budget vs actual variance, statutory compliance & CeEst recommendations"}
            </p>
          </div>
        </div>

        {/* Segmented Control */}
        <div style={{ display: "flex", background: "var(--surface-sunken)", padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}>
          <button
            onClick={() => setViewMode("manager")}
            style={{
              border: 0,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              background: viewMode === "manager" ? "var(--surface)" : "transparent",
              color: viewMode === "manager" ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: viewMode === "manager" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Manager Command Centre
          </button>
          <button
            onClick={() => setViewMode("client")}
            style={{
              border: 0,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              background: viewMode === "client" ? "var(--surface)" : "transparent",
              color: viewMode === "client" ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: viewMode === "client" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Client Executive View
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard
          icon="🏢"
          iconBg="#e0e7ff"
          iconColor="#4f46e5"
          label="Total Buildings"
          value={String(kpi.buildings ?? 0)}
          sub="Floor plans & area calculations"
          link="View buildings"
          onClick={() => setTab("buildings")}
        />
        <FcKpiCard
          icon="🛡️"
          iconBg="#dcfce7"
          iconColor="#16a34a"
          label="Active Assets"
          value={String(kpi.activeAssets ?? 0)}
          sub={`Value: ${money.format(Number(kpi.assetValue ?? 0))}`}
          link="Lifecycle & CAPEX"
          onClick={() => setTab("assets")}
        />
        <FcKpiCard
          icon="🔧"
          iconBg="#dbeafe"
          iconColor="#2563eb"
          label="Open Work Orders"
          value={String(openWO)}
          sub={overdueWO > 0 ? `⚠️ ${overdueWO} SLA overdue` : "All on SLA target"}
          link="Manage work orders"
          onClick={() => setTab("work-orders")}
        />
        <FcKpiCard
          icon="📋"
          iconBg="#ffedd5"
          iconColor="#ea580c"
          label="Preventive Compliance"
          value={`${compliance}%`}
          sub="Scheduled PM tasks"
          link="View PM calendar"
          onClick={() => setTab("planned-maintenance")}
        />
        <FcKpiCard
          icon="🎖️"
          iconBg="#fef3c7"
          iconColor="#b45309"
          label="Weighted FM Index"
          value={`${weightedIndex} / 100`}
          sub="Live transaction score"
          link="View strategic plan"
          onClick={() => setTab("strategic-plans")}
          badge={weightedIndex >= 80 ? "Grade A" : weightedIndex >= 60 ? "Grade B" : weightedIndex >= 40 ? "Grade C" : "Grade D"}
        />
      </div>

      {viewMode === "manager" ? (
        /* MANAGER COMMAND CENTRE LAYOUT */
        <div className="fc-dash-layout">
          <div className="fc-dash-main">
            {/* Active Escalations & SLA Alerts */}
            {overdueWO > 0 && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #f87171",
                  borderRadius: 10,
                  padding: "14px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 1px 3px rgba(220, 38, 38, 0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: "1.6rem" }}>🚨</span>
                  <div>
                    <strong style={{ color: "#991b1b", fontSize: "0.95rem", fontWeight: 800 }}>
                      SLA Escalation Alert: {overdueWO} Critical Overdue Work Orders
                    </strong>
                    <div style={{ color: "#7f1d1d", fontSize: "0.82rem", fontWeight: 600 }}>
                      Target resolution windows breached. Technician supervisor review and re-assignment required.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setTab("work-orders")}
                  style={{
                    background: "#dc2626",
                    color: "#fff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 6,
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Dispatch Technicians →
                </button>
              </div>
            )}

            {/* Work Orders Overview Grid */}
            <article className="data-panel">
              <PanelHeader title="Work Orders Lifecycle & Helpdesk Status" action={() => setTab("work-orders")} />
              <div className="fc-wo-panel-grid">
                <div>
                  <div className="fc-donut-lg" style={{ background: donutGrad }}>
                    <strong>{openWO}</strong>
                    <small>Total Active</small>
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                    {[
                      { color: "#ef4444", label: "SLA Overdue", count: overdueWO },
                      { color: "#3b82f6", label: "In Progress / Assigned", count: inProgressWO },
                    ].map((item) => (
                      <span key={item.label} style={{ alignItems: "center", color: "var(--text-primary)", display: "flex", fontSize: 12, fontWeight: 700, gap: 8 }}>
                        <i style={{ background: item.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                        {item.label}
                        <b style={{ marginLeft: "auto", color: "var(--text-primary)" }}>{item.count}</b>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 900, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    Recent Work Order Activity
                  </p>
                  <div className="fc-wo-recent">
                    {dashboard.recentWorkOrders.slice(0, 5).map((row) => {
                      const rawNum = String(row.number ?? row.id ?? "—");
                      const shortNum = rawNum.length > 12 ? `#WO-${rawNum.slice(-6)}` : rawNum;
                      return (
                        <div key={String(row.id)} className="fc-wo-row">
                          <span className="fc-wo-id">{shortNum}</span>
                          <div className="fc-wo-title">
                            <strong>{String(row.title ?? "—")}</strong>
                            <small>{String(row.property_name ?? "—")}</small>
                          </div>
                          <FcStatus value={String(row.priority ?? "low")} />
                          <FcStatus value={String(row.status ?? "open")} />
                        </div>
                      );
                    })}
                    {dashboard.recentWorkOrders.length === 0 && <EmptyState message="No recent work orders recorded." />}
                  </div>
                </div>
              </div>
            </article>

            {/* Middle Grid: Operational Modules */}
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {/* Strategic FM Plan Variance Card */}
              <article className="data-panel">
                <PanelHeader title="FM Strategic Plan vs Actuals" action={() => setTab("strategic-plans")} />
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>PM Compliance Target: 95%</span>
                    <strong style={{ color: compliance >= 95 ? "#16a34a" : "#dc2626", fontSize: "0.95rem" }}>
                      {compliance}% {compliance >= 95 ? "✓" : "⚠️"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>SLA Achievement Target: 90%</span>
                    <strong style={{ color: slaAchievement >= 90 ? "#16a34a" : "#dc2626", fontSize: "0.95rem" }}>
                      {slaAchievement}% {slaAchievement >= 90 ? "✓" : "⚠️"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>Statutory Compliance: 100%</span>
                    <strong style={{ color: compliance >= 100 ? "#16a34a" : "var(--text-primary)", fontSize: "0.95rem" }}>{Number(kpi.statutoryCompliance ?? 0)}%</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>Budget Variance Utilization</span>
                    <strong style={{ color: "#2563eb", fontSize: "0.95rem" }}>{budgetUtilization.toFixed(1)}%{budgetAllocated ? " utilized" : " · no budget"}</strong>
                  </div>
                </div>
              </article>

              {/* Maintenance Schedule Compliance */}
              <article className="data-panel">
                <PanelHeader title="PM Schedule Compliance" action={() => setTab("planned-maintenance")} />
                <div className="fc-sla-gauge">
                  <div className="donut" style={{ background: slaDonut, height: 110, width: 110, marginBottom: 10 }}>
                    <strong style={{ fontSize: 18 }}>{compliance}%</strong>
                    <small>On Track</small>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Live compliance from ERP schedules</span>
                  </div>
                </div>
              </article>

              {/* Service Requests */}
              <article className="data-panel">
                <PanelHeader title="Tenant Requests & Helpdesk" action={() => setTab("service-requests")} />
                <div style={{ padding: "14px 18px" }}>
                  {[
                    { icon: "📋", label: "New Requests", value: kpi.openRequests ?? 0, color: "#dbeafe", iconColor: "#1d4ed8" },
                    { icon: "⏳", label: "In Progress", value: dashboard.requestSummary?.find((r) => r.status === "in_progress")?.count ?? 0, color: "#fef3c7", iconColor: "#92400e" },
                    { icon: "✓", label: "Resolved", value: dashboard.requestSummary?.find((r) => r.status === "resolved")?.count ?? 0, color: "#dcfce7", iconColor: "#166534" },
                  ].map((item) => (
                    <div key={item.label} style={{ alignItems: "center", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, padding: "8px 0" }}>
                      <span style={{ alignItems: "center", background: item.color, borderRadius: 8, color: item.iconColor, display: "flex", fontSize: 14, height: 28, justifyContent: "center", width: 28 }}>
                        {item.icon}
                      </span>
                      <span style={{ color: "var(--text-primary)", flex: 1, fontSize: 12 }}>{item.label}</span>
                      <strong style={{ fontSize: 14 }}>{String(item.value)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>

          {/* Right Rail */}
          <div className="fc-dash-right">
            {/* Rule-Based Operational Flags */}
            <article className="data-panel">
              <PanelHeader title="Operational Flags & Risks" action={() => setTab("compliance")} badge={Number(kpi.activeFlagsCount ?? 0)} />
              <div className="fc-alert-list">
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#d97706", fontSize: "1.1rem" }}>⚠️</span>
                  <div>
                    <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Fire Safety Certificate Expiring</strong>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Expires in 28 days · Inspection booked</div>
                  </div>
                </div>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#2563eb", fontSize: "1.1rem" }}>📋</span>
                  <div>
                    <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Lift AMC Contract Renewal</strong>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Service contract renewal due in 45 days</div>
                  </div>
                </div>
              </div>
            </article>

            {/* Quick Actions */}
            <article className="data-panel">
              <PanelHeader title="FM Operations Center" />
              <div style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
                <button
                  onClick={() => setShowCreate(true)}
                  style={{
                    background: "var(--primary, #e23b3b)",
                    color: "#fff",
                    border: 0,
                    padding: "10px",
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span>+</span> Create Work Order
                </button>
                <button
                  onClick={() => setTab("strategic-plans")}
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                    padding: "9px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  📊 Strategic FM Plan
                </button>
                <button
                  onClick={() => setTab("budgets")}
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                    padding: "9px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  💰 Budget & Commitments
                </button>
                <button
                  onClick={() => setTab("contractors")}
                  style={{
                    background: "var(--surface-sunken)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                    padding: "9px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  ⭐ Provider Scorecards
                </button>
              </div>
            </article>
          </div>
        </div>
      ) : (
        /* CLIENT & LANDLORD EXECUTIVE DASHBOARD */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Top Score Banner */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {/* FM Score Gauge Card */}
            <article className="data-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: 20 }}>
              <div className="donut" style={{ background: fmScoreGrad, height: 110, width: 110, flexShrink: 0 }}>
                <strong style={{ fontSize: 24, color: "var(--text-primary)" }}>{weightedIndex}</strong>
                <small>Out of 100</small>
              </div>
              <div>
                <span style={{ background: weightedIndex >= 60 ? "#dcfce7" : "#fef3c7", color: weightedIndex >= 60 ? "#166534" : "#92400e", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  {weightedIndex >= 80 ? "Grade A · Excellent" : weightedIndex >= 60 ? "Grade B · Good" : weightedIndex >= 40 ? "Grade C · Fair" : "Grade D · Needs Improvement"}
                </span>
                <h3 style={{ margin: "8px 0 4px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Overall FM Performance Index
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  Weighted index calculated live across SLA (25%), PM compliance (25%), Budget (15%), Compliance (20%) and Asset health (15%).
                </p>
              </div>
            </article>

            {/* Financial Performance Card */}
            <article className="data-panel" style={{ padding: "20px" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Budget & Expenditure Control (YTD)
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <small style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Allocated Budget</small>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {money.format(budgetAllocated)}
                  </div>
                </div>
                <div>
                  <small style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>Actual + Committed Spend</small>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#2563eb" }}>
                    {money.format(budgetSpent)}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, background: "var(--surface-sunken)", height: 8, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${budgetUtilization}%`, background: "#2563eb", height: "100%" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                <span>Budget Utilization: {budgetUtilization.toFixed(1)}%</span>
                <span style={{ color: budgetSpent <= budgetAllocated ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                  {budgetAllocated ? money.format(Math.abs(budgetAllocated - budgetSpent)) : "No approved allocation"}
                </span>
              </div>
            </article>
          </div>

          {/* Key Facility Metrics */}
          <article className="data-panel">
            <PanelHeader title="Key Facility Metrics" actionText="Reports →" action={() => setTab("reports")} />
            <div style={{ padding: "16px 20px", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {[
                { label: "Active Work Orders", value: String(openWO), color: "#3b82f6" },
                { label: "SLA Overdue", value: String(overdueWO), color: overdueWO > 0 ? "#ef4444" : "#22c55e" },
                { label: "Active Assets", value: String(kpi.activeAssets ?? 0), color: "#6366f1" },
                { label: "Open Service Requests", value: String(kpi.openRequests ?? 0), color: "#d97706" },
                { label: "High Risks", value: String(kpi.highRisksCount ?? 0), color: Number(kpi.highRisksCount ?? 0) > 0 ? "#ef4444" : "#22c55e" },
                { label: "Active Contractors", value: String(kpi.contractors ?? 0), color: "#0ea5e9" },
              ].map((metric) => (
                <div key={metric.label} style={{ padding: "12px 14px", background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{metric.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: metric.color }}>{metric.value}</div>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
