"use client";

import { money } from "@/components/module-ui";
import { FacilityTab, FacilityDashboard } from "../../types/facility.types";
import { FcStatus } from "../FacilityToolbar";

function PanelHeader({
  title,
  action,
  badge,
}: {
  title: string;
  action?: () => void;
  badge?: number;
}) {
  return (
    <header className="panel-title">
      <h2 style={{ fontSize: 14, margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
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
        <button onClick={action} style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          View all →
        </button>
      )}
    </header>
  );
}

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "#8a96a7" }}>
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
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
  link?: string;
  onClick?: () => void;
}) {
  return (
    <button className="fc-kpi-card" onClick={onClick} style={{ textAlign: "left" }}>
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
  const kpi = dashboard.kpis;
  const openWO = Number(kpi.openWorkOrders ?? 0);
  const overdueWO = Number(kpi.overdueWorkOrders ?? 0);
  const inProgressWO = Math.max(openWO - overdueWO, 0);
  const compliance = Number(kpi.maintenanceCompliance ?? 0);
  const assetCategories = dashboard.assetCategories ?? [];
  const totalAssets = assetCategories.reduce((s, i) => s + i.count, 0) || Number(kpi.activeAssets ?? 0);

  const donutGrad = openWO
    ? `conic-gradient(
        #ef4444 0% ${((overdueWO / Math.max(openWO, 1)) * 100).toFixed(1)}%,
        #3b82f6 ${((overdueWO / Math.max(openWO, 1)) * 100).toFixed(1)}% 60%,
        #f59e0b 60% 78%,
        #22c55e 78% 100%
      )`
    : `conic-gradient(#e5e7eb 0% 100%)`;

  const slaDonut = `conic-gradient(#22c55e 0% ${compliance}%, #edf0f5 ${compliance}% 100%)`;

  return (
    <>
      {/* KPI Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Buildings" value={String(kpi.buildings ?? 0)} sub="Active locations" link="View all" onClick={() => setTab("buildings")} />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active Assets" value={String(kpi.activeAssets ?? 0)} sub={`Total value: ${money.format(Number(kpi.assetValue ?? 0))}`} link="View assets" onClick={() => setTab("assets")} />
        <FcKpiCard icon="🔧" iconBg="#dbeafe" iconColor="#2563eb" label="Open Work Orders" value={String(openWO)} sub={`Urgent: ${overdueWO} overdue`} link="View work orders" onClick={() => setTab("work-orders")} />
        <FcKpiCard icon="📋" iconBg="#ffedd5" iconColor="#ea580c" label="Preventive Maintenance" value={`${compliance}%`} sub="Schedule compliance" link="View schedule" onClick={() => setTab("planned-maintenance")} />
        <FcKpiCard icon="⚡" iconBg="#e0f2fe" iconColor="#0284c7" label="Energy Usage" value={`${Number(kpi.utilityConsumption ?? 0).toLocaleString()} kWh`} sub={money.format(Number(kpi.utilityCost ?? 0)) + " YTD"} link="View utilities" onClick={() => setTab("meters")} />
      </div>

      {/* Main layout */}
      <div className="fc-dash-layout">
        {/* Left column */}
        <div className="fc-dash-main">
          {/* Work Orders Overview */}
          <article className="data-panel">
            <PanelHeader title="Work Orders Overview" action={() => setTab("work-orders")} />
            <div className="fc-wo-panel-grid">
              {/* Donut */}
              <div>
                <div className="fc-donut-lg" style={{ background: donutGrad }}>
                  <strong>{openWO}</strong>
                  <small>Total</small>
                </div>
                <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                  {[
                    { color: "#ef4444", label: "Overdue", count: overdueWO },
                    { color: "#3b82f6", label: "In Progress", count: inProgressWO },
                    { color: "#f59e0b", label: "Pending", count: Math.round(openWO * 0.27) },
                    { color: "#22c55e", label: "Completed Today", count: Number(kpi.completedToday ?? 0) },
                  ].map((item) => (
                    <span key={item.label} style={{ alignItems: "center", color: "var(--text-primary)", display: "flex", fontSize: 12, fontWeight: 800, gap: 8 }}>
                      <i style={{ background: item.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                      {item.label}
                      <b style={{ marginLeft: "auto", color: "var(--text-primary)" }}>{item.count}</b>
                    </span>
                  ))}
                </div>
              </div>

              {/* Recent Work Orders & SLA Alert */}
              <div>
                {overdueWO > 0 && (
                  <div style={{ background: "#fee2e2", border: "1px solid #f87171", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                      <div>
                        <strong style={{ color: "#991b1b", fontSize: "0.88rem", fontWeight: 800 }}>SLA Escalation Alert: {overdueWO} Overdue Orders</strong>
                        <div style={{ color: "#7f1d1d", fontSize: "0.78rem", fontWeight: 700 }}>High-priority tickets require immediate technician dispatch</div>
                      </div>
                    </div>
                    <button onClick={() => setTab("work-orders")} style={{ background: "#dc2626", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 800, cursor: "pointer" }}>
                      Dispatch Now
                    </button>
                  </div>
                )}
                <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 900, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Recent Work Orders
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
                  {dashboard.recentWorkOrders.length === 0 && <EmptyState message="No recent work orders." />}
                </div>
              </div>
            </div>
          </article>

          {/* Charts row: Assets by Category + Maintenance Compliance + Service Requests */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {/* Assets by Category */}
            <article className="data-panel">
              <PanelHeader title="Assets by Category" action={() => setTab("assets")} />
              <div style={{ padding: "14px 18px" }}>
                {/* Mini donut */}
                <div style={{ alignItems: "center", display: "flex", gap: 12, marginBottom: 14 }}>
                  <div
                    className="donut"
                    style={{
                      background: `conic-gradient(#6366f1 0% 28%, #3b82f6 28% 48%, #8b5cf6 48% 66%, #f59e0b 66% 81%, #ec4899 81% 91%, #94a3b8 91% 100%)`,
                      flexShrink: 0,
                      height: 80,
                      width: 80,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{totalAssets}</strong>
                    <small>Total</small>
                  </div>
                  <div style={{ display: "grid", gap: 5, flex: 1 }}>
                    {assetCategories.slice(0, 6).map((item, i) => {
                      const colors = ["#6366f1", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#94a3b8"];
                      const pct = totalAssets ? Math.round((item.count / totalAssets) * 100) : 0;
                      return (
                        <div key={item.category} style={{ alignItems: "center", display: "flex", fontSize: 11, gap: 6 }}>
                          <i style={{ background: colors[i], borderRadius: "50%", display: "inline-block", flexShrink: 0, height: 7, width: 7 }} />
                          <span style={{ color: "var(--text-secondary)", flex: 1 }}>{item.category || "Other"}</span>
                          <b style={{ color: "var(--text-primary)" }}>{pct}%</b>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>

            {/* Maintenance Compliance */}
            <article className="data-panel">
              <PanelHeader title="Maintenance Compliance" action={() => setTab("planned-maintenance")} />
              <div className="fc-sla-gauge">
                <div
                  className="donut"
                  style={{
                    background: slaDonut,
                    height: 120,
                    width: 120,
                    marginBottom: 10,
                  }}
                >
                  <strong style={{ fontSize: 20 }}>{compliance}%</strong>
                  <small>On Track</small>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ background: "#edf0f5", borderRadius: 99, height: 4, marginBottom: 8, overflow: "hidden", width: 120 }}>
                    <i style={{ background: "#22c55e", borderRadius: "inherit", display: "block", height: "100%", width: `${compliance}%` }} />
                  </div>
                  <span style={{ color: "#778197", fontSize: 11 }}>Target: 90%</span>
                </div>
              </div>
            </article>

            {/* Service Requests */}
            <article className="data-panel">
              <PanelHeader title="Service Requests" action={() => setTab("service-requests")} />
              <div style={{ padding: "14px 18px" }}>
                {[
                  { icon: "📋", label: "New Requests", value: kpi.openRequests ?? 0, color: "#dbeafe", iconColor: "#1d4ed8" },
                  { icon: "⏳", label: "In Progress", value: dashboard.requestSummary.find((r) => r.status === "in_progress")?.count ?? 0, color: "#fef3c7", iconColor: "#92400e" },
                  { icon: "✓", label: "Resolved Today", value: dashboard.requestSummary.find((r) => r.status === "resolved")?.count ?? 0, color: "#dcfce7", iconColor: "#166534" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{ alignItems: "center", borderBottom: "1px solid #f0f2f6", display: "flex", gap: 10, padding: "10px 0" }}
                  >
                    <span style={{ alignItems: "center", background: item.color, borderRadius: 8, color: item.iconColor, display: "flex", fontSize: 14, height: 32, justifyContent: "center", width: 32 }}>
                      {item.icon}
                    </span>
                    <span style={{ color: "#4b5563", flex: 1, fontSize: 12 }}>{item.label}</span>
                    <strong style={{ fontSize: 16 }}>{String(item.value)}</strong>
                  </div>
                ))}
                <div style={{ alignItems: "center", display: "flex", gap: 10, marginTop: 12 }}>
                  <span style={{ alignItems: "center", background: "#fee2e2", borderRadius: 8, color: "#b91c1c", display: "flex", fontSize: 14, height: 32, justifyContent: "center", width: 32 }}>
                    ⏱
                  </span>
                  <span style={{ color: "#4b5563", flex: 1, fontSize: 12 }}>Avg. Resolution Time</span>
                  <strong style={{ color: "#e23b3b", fontSize: 14 }}>{String(kpi.avgResolutionHours ?? "2.4")} hrs</strong>
                </div>
              </div>
            </article>
          </div>
        </div>

        {/* Right rail */}
        <div className="fc-dash-right">
          {/* Critical Alerts */}
          <article className="data-panel">
            <PanelHeader title="Critical Alerts" badge={dashboard.urgentWorkOrders.length} action={() => setTab("work-orders")} />
            <div className="fc-alert-list">
              {dashboard.urgentWorkOrders.slice(0, 5).map((row) => {
                const rawNum = String(row.number ?? row.id ?? "—");
                const shortNum = rawNum.length > 12 ? `#WO-${rawNum.slice(-6)}` : rawNum;
                return (
                  <button key={String(row.id)} className="fc-alert-item" onClick={() => setTab("work-orders")}>
                    <span className="fc-alert-icon danger">⚠</span>
                    <div className="fc-alert-body">
                      <strong>{String(row.title ?? "—")}</strong>
                      <small>{String(row.property_name ?? "—")}</small>
                      <em>{shortNum}</em>
                    </div>
                    <span className="fc-alert-chevron">›</span>
                  </button>
                );
              })}
              {dashboard.urgentWorkOrders.length === 0 && (
                <div style={{ color: "#8a96a7", fontSize: 12, padding: "20px 18px", textAlign: "center" }}>
                  No critical alerts. All clear! ✓
                </div>
              )}
            </div>
          </article>

          {/* My Tasks */}
          <article className="data-panel">
            <PanelHeader title="My Tasks" badge={18} />
            <div className="fc-task-list">
              {[
                { label: "Approve Work Order", count: 6 },
                { label: "Review Inspection Reports", count: 4 },
                { label: "Approve Purchase Request", count: 3 },
                { label: "Review Contract Renewal", count: 2 },
                { label: "Utility Bill Review", count: 3 },
              ].map((task) => (
                <div key={task.label} className="fc-task-row">
                  <span className="fc-task-check">☐</span>
                  <span className="fc-task-label">{task.label}</span>
                  <span className="fc-task-count">{task.count}</span>
                </div>
              ))}
            </div>
          </article>

          {/* Maintenance due */}
          {dashboard.dueMaintenance.length > 0 && (
            <article className="data-panel">
              <PanelHeader title="Maintenance Due" action={() => setTab("planned-maintenance")} />
              <div className="fc-alert-list">
                {dashboard.dueMaintenance.slice(0, 4).map((row) => (
                  <button key={String(row.id)} className="fc-alert-item" onClick={() => setTab("planned-maintenance")}>
                    <span className="fc-alert-icon warning">📅</span>
                    <div className="fc-alert-body">
                      <strong>{String(row.name ?? "—")}</strong>
                      <small>{String(row.asset_name ?? "—")}</small>
                    </div>
                    <span style={{ color: "#6b7280", fontSize: 11 }}>{String(row.next_due_on ?? "—")}</span>
                  </button>
                ))}
              </div>
            </article>
          )}
        </div>
      </div>

      {/* Bottom summary strip */}
      <div className="summary-strip" style={{ marginTop: 16 }}>
        <span><b>{String(kpi.buildings ?? 0)}</b> Buildings</span>
        <span><b>{String(kpi.openRequests ?? 0)}</b> Open service requests</span>
        <span><b>{String(kpi.contractors ?? 0)}</b> Active contractors</span>
        {assetCategories.slice(0, 3).map((item) => (
          <span key={item.category}><b>{item.count}</b> {item.category} assets</span>
        ))}
      </div>
    </>
  );
}
