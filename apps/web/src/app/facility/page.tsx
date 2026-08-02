"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { facilityNav } from "@/lib/module-nav";

type Tab =
  | "overview"
  | "buildings"
  | "assets"
  | "work-orders"
  | "work-order-events"
  | "work-order-cost-items"
  | "work-order-attachments"
  | "planned-maintenance"
  | "inspections"
  | "service-requests"
  | "meters"
  | "contractors";

type Row = Record<string, string | number | boolean | null>;
type Dashboard = {
  kpis: Record<string, string | number>;
  recentWorkOrders: Row[];
  urgentWorkOrders: Row[];
  requestSummary: { status: string; count: number }[];
  assetCategories: { category: string; count: number }[];
  dueMaintenance: Row[];
};

const labels: Record<Tab, string> = {
  overview: "Dashboard",
  buildings: "Buildings & Locations",
  assets: "Assets & Inventory",
  "work-orders": "Work Orders",
  "work-order-events": "Work History",
  "work-order-cost-items": "Labor & Parts",
  "work-order-attachments": "Work Media",
  "planned-maintenance": "Planned Maintenance",
  inspections: "Inspections",
  "service-requests": "Service Requests",
  meters: "Utility Management",
  contractors: "Contractors",
};

const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

/* ─── helpers ─── */
function FcStatus({ value }: { value: string }) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[\s_]/g, "-");
  const display = String(value ?? "").replace(/_/g, " ");
  return (
    <span className={`fc-status fc-status-${slug}`}>{display}</span>
  );
}

function HealthBar({ pct }: { pct: number }) {
  const cls = pct >= 75 ? "good" : pct >= 50 ? "fair" : "poor";
  return (
    <div className="fc-health-bar">
      <div className="fc-health-track">
        <i className={`fc-health-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="fc-health-pct">{pct}%</span>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="fc-stars">
      {"★".repeat(full)}
      <span className="fc-stars-grey">{"★".repeat(5 - full)}</span>
    </span>
  );
}

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

/* ─── KPI Card ─── */
function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  link,
  trendUp,
  onClick,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
  link?: string;
  trendUp?: boolean;
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

/* ─── Dashboard tab ─── */
function DashboardView({
  dashboard,
  setTab,
  setShowCreate,
  canWork,
}: {
  dashboard: Dashboard;
  setTab: (t: Tab) => void;
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

  const priorityMax = openWO || 1;

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
                    <span key={item.label} style={{ alignItems: "center", color: "#667084", display: "flex", fontSize: 12, gap: 8 }}>
                      <i style={{ background: item.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                      {item.label}
                      <b style={{ marginLeft: "auto" }}>{item.count}</b>
                    </span>
                  ))}
                </div>
              </div>

              {/* Recent Work Orders */}
              <div>
                <p style={{ color: "#8a96a7", fontSize: 11, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase" }}>
                  Recent Work Orders
                </p>
                <div className="fc-wo-recent">
                  {dashboard.recentWorkOrders.slice(0, 5).map((row) => (
                    <div key={String(row.id)} className="fc-wo-row">
                      <span className="fc-wo-id">{String(row.number ?? "—")}</span>
                      <div className="fc-wo-title">
                        <strong>{String(row.title ?? "—")}</strong>
                        <small>{String(row.property_name ?? "—")}</small>
                      </div>
                      <FcStatus value={String(row.priority ?? "low")} />
                      <FcStatus value={String(row.status ?? "open")} />
                    </div>
                  ))}
                  {dashboard.recentWorkOrders.length === 0 && <EmptyState message="No recent work orders." />}
                </div>
              </div>
            </div>
          </article>

          {/* Charts row: Assets by Category + Maintenance Compliance + Service Requests */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.1fr .9fr 1fr" }}>
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
                          <span style={{ color: "#5a6478", flex: 1 }}>{item.category || "Other"}</span>
                          <b style={{ color: "#27364a" }}>{pct}%</b>
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
              {dashboard.urgentWorkOrders.slice(0, 5).map((row) => (
                <button key={String(row.id)} className="fc-alert-item" onClick={() => setTab("work-orders")}>
                  <span className="fc-alert-icon danger">⚠</span>
                  <div className="fc-alert-body">
                    <strong>{String(row.title ?? "—")}</strong>
                    <small>{String(row.property_name ?? "—")}</small>
                    <em>{String(row.number ?? "—")}</em>
                  </div>
                  <span className="fc-alert-chevron">›</span>
                </button>
              ))}
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
            <div style={{ borderTop: "1px solid var(--line)", padding: "10px 18px" }}>
              <button onClick={() => {}} style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                Go to My Tasks →
              </button>
            </div>
          </article>

          {/* Quick Actions */}
          <article className="data-panel">
            <PanelHeader title="Quick Actions" />
            <div className="fc-quick-actions">
              {canWork && (
                <button className="fc-quick-action" onClick={() => setShowCreate(true)}>
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="fc-qa-icon" style={{ background: "#fee2e2", color: "#b91c1c" }}>📝</span>
                    New Work Order
                  </span>
                  <span className="fc-qa-chevron">›</span>
                </button>
              )}
              {[
                { icon: "📨", bg: "#dbeafe", color: "#1d4ed8", label: "New Service Request", tab: "service-requests" as Tab },
                { icon: "📅", bg: "#fef3c7", color: "#92400e", label: "Schedule Maintenance", tab: "planned-maintenance" as Tab },
                { icon: "▣", bg: "#dcfce7", color: "#166534", label: "Add New Asset", tab: "assets" as Tab },
                { icon: "🏢", bg: "#ede9fe", color: "#6d28d9", label: "Buildings & Locations", tab: "buildings" as Tab },
                { icon: "⚡", bg: "#e0f2fe", color: "#0284c7", label: "Report an Issue", tab: "service-requests" as Tab },
              ].map((item) => (
                <button key={item.label} className="fc-quick-action" onClick={() => setTab(item.tab)}>
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="fc-qa-icon" style={{ background: item.bg, color: item.color }}>{item.icon}</span>
                    {item.label}
                  </span>
                  <span className="fc-qa-chevron">›</span>
                </button>
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

/* ─── Buildings & Locations tab ─── */
function BuildingsView({ rows, setTab }: { rows: Row[]; setTab: (t: Tab) => void }) {
  const [selectedLoc, setSelectedLoc] = useState(0);
  const locations = [
    { name: "Nairobi Head Office", county: "Nairobi County", count: 5, color: "#e23b3b" },
    { name: "Mombasa Branch", county: "Mombasa County", count: 2, color: "#3b82f6" },
    { name: "Kisumu Office", county: "Kisumu County", count: 1, color: "#8b5cf6" },
    { name: "Eldoret Office", county: "Uasin Gishu County", count: 1, color: "#f59e0b" },
    { name: "Nakuru Office", county: "Nakuru County", count: 1, color: "#10b981" },
    { name: "Nyeri Office", county: "Nyeri County", count: 1, color: "#6366f1" },
    { name: "Meru Office", county: "Meru County", count: 1, color: "#ec4899" },
    { name: "Remote Sites", county: "Various Counties", count: 2, color: "#9ca3af" },
  ];
  const mapPins = [
    { top: "52%", left: "48%", color: "#e23b3b", label: "NH" },
    { top: "68%", left: "62%", color: "#3b82f6", label: "MB" },
    { top: "45%", left: "36%", color: "#8b5cf6", label: "KS" },
    { top: "38%", left: "30%", color: "#f59e0b", label: "EL" },
    { top: "46%", left: "40%", color: "#10b981", label: "NK" },
  ];

  return (
    <>
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Buildings" value="12" sub="Across all locations" onClick={() => {}} />
        <FcKpiCard icon="📍" iconBg="#dcfce7" iconColor="#16a34a" label="Locations" value="8" sub="Active sites" onClick={() => {}} />
        <FcKpiCard icon="📐" iconBg="#dbeafe" iconColor="#2563eb" label="Total Floor Area" value="125,420 m²" sub="Gross floor area" onClick={() => {}} />
        <FcKpiCard icon="▦" iconBg="#fdf4ff" iconColor="#9333ea" label="Avg. Occupancy" value="93%" sub="All buildings" onClick={() => {}} />
        <FcKpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Monthly Operations Cost" value="KSh 3.8M" sub="All buildings" onClick={() => {}} />
      </div>

      <div className="fc-locations-layout">
        {/* Location list */}
        <article className="data-panel">
          <PanelHeader title="Locations Overview" />
          <div className="fc-location-list">
            {locations.map((loc, i) => (
              <button
                key={loc.name}
                className={`fc-location-item ${i === selectedLoc ? "active" : ""}`}
                onClick={() => setSelectedLoc(i)}
              >
                <span className="fc-location-dot" style={{ background: loc.color }} />
                <div className="fc-location-name">
                  <strong>{loc.name}</strong>
                  <small>{loc.county}</small>
                </div>
                <span className="fc-location-count">
                  {loc.count} {loc.count === 1 ? "Building" : "Buildings"}
                </span>
              </button>
            ))}
          </div>
        </article>

        {/* Map + table */}
        <div style={{ display: "grid", gap: 16 }}>
          <article className="data-panel">
            <PanelHeader title="Location Map" />
            <div className="fc-map-placeholder" style={{ margin: 0, borderRadius: 0, minHeight: 300 }}>
              {mapPins.map((pin, i) => (
                <div
                  key={i}
                  className="fc-map-pin"
                  style={{ top: pin.top, left: pin.left }}
                >
                  <div className="fc-map-pin-dot" style={{ background: pin.color, color: "white" }}>
                    <span>{pin.label}</span>
                  </div>
                </div>
              ))}
              <div style={{ bottom: 10, right: 12, position: "absolute", background: "white", border: "1px solid #d7dce5", borderRadius: 8, padding: "6px 8px", fontSize: 11, color: "#6b7280" }}>
                📍 {locations[selectedLoc].name}
              </div>
            </div>
          </article>

          {/* Buildings table */}
          <article className="data-panel">
            <div className="fc-table-toolbar">
              <span style={{ color: "#27364a", fontWeight: 700, fontSize: 13 }}>All Buildings (12)</span>
              <button className="fc-toolbar-btn">↓ Export</button>
            </div>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Building Name</th>
                    <th>Location</th>
                    <th>Building Type</th>
                    <th>Floor Area</th>
                    <th>Occupancy</th>
                    <th>Status</th>
                    <th>Monthly Cost</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0
                    ? rows.slice(0, 8).map((row) => (
                        <tr key={String(row.id)}>
                          <td>
                            <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
                              <div className="fc-detail-thumb-placeholder" style={{ height: 36, width: 36, fontSize: 16, borderRadius: 6 }}>
                                🏢
                              </div>
                              <div>
                                <strong style={{ display: "block", fontSize: 12 }}>{String(row.name ?? "—")}</strong>
                                <small style={{ color: "#8a96a7", fontSize: 10 }}>{String(row.code ?? "—")}</small>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <span style={{ color: "#e23b3b", marginRight: 4 }}>📍</span>
                            {String(row.location ?? "Nairobi")}
                          </td>
                          <td style={{ fontSize: 12 }}>{String(row.type ?? "Commercial Office")}</td>
                          <td style={{ fontSize: 12 }}>{String(row.floor_area ?? "—")} m²</td>
                          <td>
                            <HealthBar pct={Number(row.occupancy ?? 85)} />
                          </td>
                          <td><FcStatus value="active" /></td>
                          <td style={{ fontSize: 12 }}>{money.format(Number(row.monthly_cost ?? 0))}</td>
                          <td>
                            <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button>
                          </td>
                        </tr>
                      ))
                    : [
                        { id: 1, name: "Finance House", code: "BLD-001", location: "Nairobi Head Office", type: "Commercial Office", floor: "25,000", occupancy: 98, cost: 850000 },
                        { id: 2, name: "Uchumi House", code: "BLD-002", location: "Nairobi Head Office", type: "Commercial Office", floor: "18,500", occupancy: 92, cost: 620000 },
                        { id: 3, name: "Utalii House", code: "BLD-003", location: "Nairobi Head Office", type: "Commercial Office", floor: "22,000", occupancy: 95, cost: 710000 },
                        { id: 4, name: "Mombasa Offices", code: "BLD-004", location: "Mombasa Branch", type: "Commercial Office", floor: "8,500", occupancy: 85, cost: 280000 },
                      ].map((b) => (
                        <tr key={b.id}>
                          <td>
                            <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
                              <div className="fc-detail-thumb-placeholder" style={{ height: 36, width: 36, fontSize: 16, borderRadius: 6 }}>🏢</div>
                              <div>
                                <strong style={{ display: "block", fontSize: 12 }}>{b.name}</strong>
                                <small style={{ color: "#8a96a7", fontSize: 10 }}>Building ID: {b.code}</small>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}><span style={{ color: "#e23b3b", marginRight: 4 }}>📍</span>{b.location}</td>
                          <td style={{ fontSize: 12 }}>{b.type}</td>
                          <td style={{ fontSize: 12 }}>{b.floor} m²</td>
                          <td><HealthBar pct={b.occupancy} /></td>
                          <td><FcStatus value="active" /></td>
                          <td style={{ fontSize: 12 }}>KSh {b.cost.toLocaleString()}</td>
                          <td><button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button></td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <div className="fc-pagination">
              <span className="fc-pager-info">Showing 1 to 4 of 12 buildings</span>
              <div className="fc-pager">
                <button className="fc-page-btn active">1</button>
                <button className="fc-page-btn">2</button>
                <button className="fc-page-btn">3</button>
                <button className="fc-page-btn">›</button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}

/* ─── Assets & Inventory tab ─── */
function AssetsView({
  rows,
  onAction,
  permissions,
}: {
  rows: Row[];
  onAction: (row: Row, action: string) => void;
  permissions: { canWork: boolean; canAdminister: boolean };
}) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const assetIcons: Record<string, string> = {
    "Lift Systems": "🛗",
    "Fire Safety": "🔥",
    "Electrical Systems": "⚡",
    "Water Supply": "💧",
    "CCTV / Access Control": "📹",
    "Mechanical": "⚙️",
    "Plumbing & Drainage": "🔧",
  };

  const displayRows =
    rows.length > 0
      ? rows
      : [
          { id: 1, code: "AST-0001248", name: "OTIS Lift – Lift 1", category: "Lift Systems", property_name: "Cradle Building – Ground Floor", condition: "operational", health_score: 92 },
          { id: 2, code: "AST-0001247", name: "Fire Pump Set 1", category: "Fire Safety", property_name: "Cradle Building – Basement", condition: "operational", health_score: 89 },
          { id: 3, code: "AST-0001246", name: "Main DB – MDB 1", category: "Electrical Systems", property_name: "Cradle Building – Ground Floor", condition: "operational", health_score: 90 },
          { id: 4, code: "AST-0001245", name: "Water Tank – 20,000L", category: "Water Supply", property_name: "Roof Level", condition: "operational", health_score: 85 },
          { id: 5, code: "AST-0001244", name: "CCTV Camera – CAM 12", category: "CCTV / Access Control", property_name: "Block A – Lobby", condition: "operational", health_score: 83 },
          { id: 6, code: "AST-0001243", name: "Generator 500KVA", category: "Electrical Systems", property_name: "Generator Room", condition: "maintenance", health_score: 65 },
          { id: 7, code: "AST-0001242", name: "Plumbing Booster Pump", category: "Plumbing & Drainage", property_name: "Basement", condition: "operational", health_score: 87 },
          { id: 8, code: "AST-0001241", name: "Water Heater – WH 2", category: "Water Supply", property_name: "5th Floor", condition: "out_of_service", health_score: 30 },
        ];

  return (
    <>
      {/* KPI strip */}
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="📦" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Assets" value="1,248" sub="All buildings" onClick={() => {}} />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Operational" value="1,074" sub="86% of total assets" onClick={() => {}} />
        <FcKpiCard icon="🔧" iconBg="#fef3c7" iconColor="#92400e" label="Under Maintenance" value="98" sub="8% of total assets" onClick={() => {}} />
        <FcKpiCard icon="⚠" iconBg="#fee2e2" iconColor="#b91c1c" label="Out of Service" value="76" sub="6% of total assets" onClick={() => {}} />
        <FcKpiCard icon="💰" iconBg="#f0fdf4" iconColor="#15803d" label="Total Asset Value" value="KES 245.6M" sub="Replacement cost" onClick={() => {}} />
        <FcKpiCard icon="📊" iconBg="#fdf4ff" iconColor="#9333ea" label="Avg. Asset Health" value="82%" sub="Good" onClick={() => {}} />
      </div>

      <div className="fc-assets-layout">
        {/* Filters */}
        <div>
          <div className="fc-filter-panel">
            <div className="fc-filter-header">
              <strong>Filters</strong>
              <button>Clear All</button>
            </div>
            {[
              { label: "Building", options: ["All Buildings", "Finance House", "Uchumi House", "Utalii House"] },
              { label: "Floor / Location", options: ["All Floors", "Ground Floor", "Basement", "Roof Level"] },
              { label: "Category", options: ["All Categories", "HVAC", "Electrical", "Mechanical", "Fire Safety", "Plumbing"] },
              { label: "Asset Type", options: ["All Types"] },
              { label: "Status", options: ["All Status", "Operational", "Under Maintenance", "Out of Service"] },
              { label: "Condition", options: ["All Conditions", "Good", "Fair", "Poor"] },
              { label: "Vendor", options: ["All Vendors"] },
            ].map((f) => (
              <div key={f.label} className="fc-filter-section">
                <label>{f.label}</label>
                <select className="fc-toolbar-select" style={{ width: "100%" }}>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div style={{ padding: "14px 16px", display: "flex", gap: 8 }}>
              <button className="fc-toolbar-btn primary" style={{ flex: 1, justifyContent: "center" }}>Apply Filters</button>
              <button className="fc-toolbar-btn" style={{ flex: 1, justifyContent: "center" }}>Reset</button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 320px" : "1fr" }}>
          <article className="data-panel">
            <div className="fc-table-toolbar">
              <div className="fc-table-toolbar-left">
                <span style={{ color: "#27364a", fontWeight: 700, fontSize: 13 }}>Assets ({displayRows.length})</span>
              </div>
              <div className="fc-table-toolbar-right">
                <button className="fc-toolbar-btn">↑ Export</button>
                <button className="fc-toolbar-btn">↓ Import</button>
                <button className="fc-toolbar-btn primary">+ Add New Asset</button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" /></th>
                    <th>Asset ID</th>
                    <th>Asset Name</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Condition</th>
                    <th>Health Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => {
                    const cond = String(row.condition ?? "operational");
                    const health = Number(row.health_score ?? 80);
                    const cat = String(row.category ?? "");
                    return (
                      <tr
                        key={String(row.id)}
                        className={selectedRow?.id === row.id ? "selected" : ""}
                        onClick={() => setSelectedRow(selectedRow?.id === row.id ? null : row)}
                      >
                        <td><input type="checkbox" onClick={(e) => e.stopPropagation()} /></td>
                        <td>
                          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                            <span className="fc-asset-icon" style={{ background: "#f0f4ff", color: "#4f46e5" }}>
                              {assetIcons[cat] ?? "⚙️"}
                            </span>
                            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>
                              {String(row.code ?? "—")}
                            </span>
                          </div>
                        </td>
                        <td><strong style={{ fontSize: 12 }}>{String(row.name ?? "—")}</strong></td>
                        <td style={{ fontSize: 12 }}>{cat}</td>
                        <td style={{ fontSize: 11, color: "#6b7890" }}>{String(row.property_name ?? "—")}</td>
                        <td><FcStatus value={cond.replace("_", " ")} /></td>
                        <td><FcStatus value={health >= 75 ? "good" : health >= 50 ? "fair" : "poor"} /></td>
                        <td><HealthBar pct={health} /></td>
                        <td>
                          <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="fc-pagination">
              <span className="fc-pager-info">Showing 1 to 8 of 1,248 assets</span>
              <div className="fc-pager">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={`fc-page-btn ${n === 1 ? "active" : ""}`}>{n}</button>
                ))}
                <button className="fc-page-btn">…</button>
                <button className="fc-page-btn">156</button>
                <button className="fc-page-btn">›</button>
              </div>
              <select className="fc-toolbar-select">
                <option>10 / page</option>
                <option>25 / page</option>
                <option>50 / page</option>
              </select>
            </div>
          </article>

          {/* Detail panel */}
          {selectedRow && (
            <div className="fc-detail-panel">
              <div className="fc-detail-header">
                <div className="fc-detail-thumb-placeholder">
                  {assetIcons[String(selectedRow.category ?? "")] ?? "⚙️"}
                </div>
                <div className="fc-detail-meta">
                  <strong>{String(selectedRow.name ?? "—")}</strong>
                  <small>
                    <span style={{ color: "#22c55e" }}>● </span>
                    {String(selectedRow.condition ?? "Operational")}
                  </small>
                  <small style={{ color: "#8a96a7" }}>{String(selectedRow.code ?? "—")}</small>
                </div>
                <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: 0, color: "#8a96a7", cursor: "pointer", fontSize: 20 }}>×</button>
              </div>
              <div className="fc-detail-tabs">
                {["Overview", "History", "Documents", "Images"].map((t, i) => (
                  <button key={t} className={i === 0 ? "active" : ""}>{t}</button>
                ))}
              </div>
              <div className="fc-detail-grid">
                {[
                  { label: "Category", value: String(selectedRow.category ?? "—") },
                  { label: "Location", value: String(selectedRow.property_name ?? "—") },
                  { label: "Manufacturer", value: "OTIS" },
                  { label: "Model", value: "Gen2 Comfort" },
                  { label: "Serial Number", value: "OT-G2-12345" },
                  { label: "Installation Date", value: "15 Jan 2021" },
                  { label: "Warranty Expiry", value: "14 Jan 2026" },
                  { label: "Expected Life", value: "20 Years" },
                  { label: "Replacement Cost", value: "KES 12,500,000" },
                  { label: "Current Condition", value: String(selectedRow.condition ?? "Good") },
                ].map((field) => (
                  <div key={field.label} className="fc-detail-field">
                    <label>{field.label}</label>
                    <span>{field.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "8px 18px 0" }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: "#8a96a7", fontSize: 10, textTransform: "uppercase" }}>Health Score</span>
                  <HealthBar pct={Number(selectedRow.health_score ?? 82)} />
                </div>
                {[
                  { label: "Last Maintenance", value: "22 Jul 2026" },
                  { label: "Next Maintenance", value: "22 Aug 2026" },
                ].map((f) => (
                  <div key={f.label} style={{ borderBottom: "1px solid #f0f2f6", display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                    <span style={{ color: "#8a96a7", fontSize: 11 }}>{f.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{f.value}</span>
                  </div>
                ))}
              </div>
              <button className="fc-detail-cta">View Full Details</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Work Orders tab ─── */
function WorkOrdersView({
  rows,
  onAction,
  permissions,
  setShowCreate,
}: {
  rows: Row[];
  onAction: (row: Row, action: string) => void;
  permissions: { canWork: boolean };
  setShowCreate: (b: boolean) => void;
}) {
  const displayRows = rows.length > 0 ? rows : [
    { id: 1, number: "WO-2026-1789", title: "Lift not functioning – Finance House", property_name: "Finance House", priority: "high", status: "overdue", progress: 0, total_cost: 0 },
    { id: 2, number: "WO-2026-1788", title: "AMC Service – Generator (Utalii House)", property_name: "Utalii House", priority: "high", status: "in_progress", progress: 60, total_cost: 45000 },
    { id: 3, number: "WO-2026-1787", title: "Water leakage – Basement Parking", property_name: "Cradle Building", priority: "medium", status: "open", progress: 0, total_cost: 0 },
    { id: 4, number: "WO-2026-1786", title: "AC not cooling – Office 3B", property_name: "Cradle Building", priority: "low", status: "completed", progress: 100, total_cost: 12500 },
    { id: 5, number: "WO-2026-1785", title: "Fire extinguisher inspection", property_name: "Finance House", priority: "low", status: "completed", progress: 100, total_cost: 8000 },
  ];

  const priorityColors: Record<string, string> = {
    critical: "#b91c1c", high: "#c2410c", medium: "#a16207", low: "#15803d",
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, margin: "0 0 4px", letterSpacing: "-.02em" }}>Maintenance Overview</h2>
          <p style={{ color: "#8a96a7", fontSize: 13, margin: 0 }}>Monitor maintenance performance, compliance and asset reliability in real time.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="fc-toolbar-btn">Quick Actions</button>
          {permissions.canWork && (
            <button className="fc-toolbar-btn primary" onClick={() => setShowCreate(true)}>+ Create Work Order</button>
          )}
        </div>
      </div>

      <div className="fc-kpi-strip">
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="PPM Compliance" value="92%" sub="Target ≥ 95%" link="View PPM Calendar" onClick={() => {}} />
        <FcKpiCard icon="📂" iconBg="#dcfce7" iconColor="#16a34a" label="Open Work Orders" value="134" sub="↑ 8 vs yesterday" link="View all work orders" onClick={() => {}} />
        <FcKpiCard icon="⏰" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue Work Orders" value="27" sub="↓ 5 vs yesterday" link="View overdue" onClick={() => {}} />
        <FcKpiCard icon="⏱" iconBg="#fef3c7" iconColor="#92400e" label="Avg. Resolution Time" value="6.2 hrs" sub="Target 24 hrs" link="View SLA Performance" onClick={() => {}} />
        <FcKpiCard icon="📈" iconBg="#f0fdf4" iconColor="#15803d" label="Asset Health Index" value="82%" sub="Good" link="View Asset Health" onClick={() => {}} />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        {/* Work orders list */}
        <div style={{ display: "grid", gap: 16 }}>
          <article className="data-panel">
            <div className="fc-table-toolbar">
              <div className="fc-table-toolbar-left">
                <input placeholder="Search work orders…" style={{ border: "1px solid #d7dce5", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 220 }} />
                {["All Buildings", "All Categories", "All Priority", "All Status"].map((opt) => (
                  <select key={opt} className="fc-toolbar-select"><option>{opt}</option></select>
                ))}
              </div>
              <button className="fc-toolbar-btn">↓ Export</button>
            </div>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Work Order</th>
                    <th>Title</th>
                    <th>Property</th>
                    <th>Priority</th>
                    <th>Progress</th>
                    <th>Cost</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => {
                    const progress = Number(row.progress ?? 0);
                    const priority = String(row.priority ?? "low");
                    return (
                      <tr key={String(row.id)}>
                        <td><FcStatus value={String(row.status ?? "open").replace("_", " ")} /></td>
                        <td><span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>{String(row.number ?? "—")}</span></td>
                        <td><strong style={{ fontSize: 12 }}>{String(row.title ?? "—")}</strong></td>
                        <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.property_name ?? "—")}</td>
                        <td>
                          <span className="fc-priority-chip">
                            <i style={{ background: priorityColors[priority] ?? "#9ca3af" }} />
                            <span style={{ color: priorityColors[priority] ?? "#9ca3af", textTransform: "capitalize" }}>{priority}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                            <div style={{ background: "#edf0f5", borderRadius: 99, flex: 1, height: 6, minWidth: 70, overflow: "hidden" }}>
                              <i style={{ background: "#3b82f6", borderRadius: "inherit", display: "block", height: "100%", width: `${progress}%` }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>{progress}%</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>{Number(row.total_cost ?? 0) > 0 ? money.format(Number(row.total_cost)) : "—"}</td>
                        <td>
                          <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="fc-pagination">
              <span className="fc-pager-info">Showing 1 to 5 of 134 work orders</span>
              <div className="fc-pager">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={`fc-page-btn ${n === 1 ? "active" : ""}`}>{n}</button>
                ))}
                <button className="fc-page-btn">›</button>
              </div>
            </div>
          </article>
        </div>

        {/* SLA + Priority bars */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <article className="data-panel">
            <PanelHeader title="SLA Performance (This Month)" />
            <div className="fc-sla-gauge">
              <div className="donut" style={{ background: "conic-gradient(#22c55e 0% 88%, #f59e0b 88% 95%, #ef4444 95% 100%)", height: 130, width: 130, marginBottom: 12 }}>
                <strong style={{ fontSize: 22 }}>88%</strong>
                <small>Within SLA</small>
              </div>
              <div style={{ display: "grid", gap: 8, width: "100%" }}>
                {[
                  { label: "Within SLA", pct: 88, count: 236, color: "#22c55e" },
                  { label: "At Risk", pct: 7, count: 19, color: "#f59e0b" },
                  { label: "Breached", pct: 5, count: 13, color: "#ef4444" },
                ].map((item) => (
                  <div key={item.label} style={{ alignItems: "center", display: "flex", fontSize: 12, gap: 8 }}>
                    <i style={{ background: item.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                    <span style={{ color: "#6b7280", flex: 1 }}>{item.label}</span>
                    <span style={{ color: "#27364a", fontWeight: 700 }}>{item.pct}%</span>
                    <span style={{ color: "#9aacbf", fontSize: 11 }}>({item.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="data-panel">
            <PanelHeader title="Work Orders by Priority" />
            <div className="fc-priority-bars">
              {[
                { label: "Critical", count: 38, color: "#ef4444", max: 52 },
                { label: "High", count: 52, color: "#f97316", max: 52 },
                { label: "Medium", count: 28, color: "#f59e0b", max: 52 },
                { label: "Low", count: 16, color: "#22c55e", max: 52 },
              ].map((item) => (
                <div key={item.label} className="fc-priority-row">
                  <i className="fc-priority-dot" style={{ background: item.color }} />
                  <span className="fc-priority-label">{item.label}</span>
                  <div className="fc-priority-bar">
                    <i style={{ background: item.color, width: `${(item.count / item.max) * 100}%` }} />
                  </div>
                  <span className="fc-priority-count">{item.count}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="data-panel">
            <PanelHeader title="Maintenance Cost (This Month)" />
            <div style={{ padding: "16px 18px" }}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: "#8a96a7", display: "block", fontSize: 11 }}>Total Cost</span>
                <strong style={{ fontSize: 22 }}>KES 4.25M</strong>
                <span style={{ color: "#16a34a", fontSize: 11 }}> ↓ 8.5% vs last month</span>
              </div>
              <p style={{ color: "#8a96a7", fontSize: 11, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase" }}>Top Cost by Category</p>
              {[
                { label: "Electrical Systems", pct: 34, amount: "1.45M" },
                { label: "Lift Systems", pct: 28, amount: "1.20M" },
                { label: "Plumbing & Drainage", pct: 20, amount: "860K" },
                { label: "HVAC Systems", pct: 11, amount: "450K" },
                { label: "Fire Safety Systems", pct: 7, amount: "290K" },
              ].map((item, i) => {
                const colors = ["#4f46e5", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];
                return (
                  <div key={item.label} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: "#4b5563" }}>{item.label}</span>
                      <span style={{ fontWeight: 700 }}>KES {item.amount}</span>
                    </div>
                    <div style={{ background: "#edf0f5", borderRadius: 99, height: 5, overflow: "hidden" }}>
                      <i style={{ background: colors[i], borderRadius: "inherit", display: "block", height: "100%", width: `${item.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </div>
    </>
  );
}

/* ─── Planned Maintenance tab ─── */
function PlannedMaintenanceView({ rows, onAction, permissions }: { rows: Row[]; onAction: (row: Row, action: string) => void; permissions: { canAdminister: boolean } }) {
  const days = ["Mon 12 May", "Tue 13 May", "Wed 14 May", "Thu 15 May", "Fri 16 May", "Sat 17 May", "Sun 18 May"];
  const calEvents = [
    [
      { name: "Generator Monthly Service", id: "GEN-001", type: "gen" },
    ],
    [
      { name: "Fire Pump Test", id: "FP-01, FP-02", type: "fire" },
      { name: "Lift Preventive Maintenance", id: "LIFT-1", type: "cctv" },
    ],
    [
      { name: "Lift Inspection", id: "LIFT-1, LIFT-2", type: "cctv" },
      { name: "Fire Extinguisher Check", id: "FE-01 to 35", type: "fire" },
    ],
    [
      { name: "Water Tank Cleaning", id: "WT-1", type: "water" },
      { name: "Electrical DB Inspection", id: "DB-MDB-1", type: "elec" },
    ],
    [
      { name: "CCTV System Check", id: "CCTV-01 to 08", type: "cctv" },
      { name: "Water Pump Service", id: "WP-1, WP-2", type: "water" },
    ],
    [],
    [],
  ];

  const displayRows = rows.length > 0 ? rows : [
    { id: 1, code: "PPM-2026-0456", name: "Lift Preventive Maintenance", asset_name: "LIFT-2", property_name: "Cradle Building – Block A", frequency: "Monthly", next_due_on: "15 May 2026, 09:00 AM", is_active: true },
    { id: 2, code: "PPM-2026-0457", name: "Fire Pump Test", asset_name: "FP-02", property_name: "Cradle Building – Basement", frequency: "Monthly", next_due_on: "15 May 2026, 10:00 AM", is_active: true },
    { id: 3, code: "PPM-2026-0458", name: "Electrical DB Inspection", asset_name: "DB-MDB-1", property_name: "Cradle Building – Ground Floor", frequency: "Monthly", next_due_on: "15 May 2026, 09:30 AM", is_active: true },
  ];

  return (
    <>
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="📊" iconBg="#e0e7ff" iconColor="#4f46e5" label="PPM Compliance" value="92%" sub="Target ≥ 95%" onClick={() => {}} />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Completed Tasks" value="168" sub="of 183 scheduled" onClick={() => {}} />
        <FcKpiCard icon="⏰" iconBg="#fef3c7" iconColor="#92400e" label="Upcoming Tasks" value="24" sub="Next 7 days" onClick={() => {}} />
        <FcKpiCard icon="⚠" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue Tasks" value="7" sub="Require attention" onClick={() => {}} />
        <FcKpiCard icon="👷" iconBg="#f0f4ff" iconColor="#4f46e5" label="Technicians Assigned" value="18" sub="Active this week" onClick={() => {}} />
        <FcKpiCard icon="💰" iconBg="#f0fdf4" iconColor="#15803d" label="Maintenance Cost (MTD)" value="KES 1.45M" sub="↓ 8.4% vs last month" onClick={() => {}} />
      </div>

      {/* View tabs */}
      <div style={{ borderBottom: "1px solid var(--line)", display: "flex", gap: 0, marginBottom: 16 }}>
        {["Calendar View", "List View", "Gantt View", "Task Templates", "Maintenance Plans"].map((t, i) => (
          <button
            key={t}
            style={{ background: "transparent", border: 0, borderBottom: i === 0 ? "2px solid #e23b3b" : "2px solid transparent", color: i === 0 ? "#e23b3b" : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "12px 16px", whiteSpace: "nowrap" }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "240px minmax(0,1fr)" }}>
        {/* Maintenance plans sidebar */}
        <div>
          <article className="data-panel">
            <div style={{ borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", padding: "14px 16px" }}>
              <strong style={{ fontSize: 13 }}>Maintenance Plans</strong>
              <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>View all</button>
            </div>
            {[
              { name: "Lift Systems Maintenance", freq: "Monthly", done: 16, total: 18, pct: 89 },
              { name: "Fire Safety Systems", freq: "Quarterly", done: 18, total: 20, pct: 90 },
              { name: "Generator Maintenance", freq: "Monthly", done: 8, total: 12, pct: 67 },
              { name: "Water Supply Systems", freq: "Monthly", done: 9, total: 12, pct: 75 },
              { name: "Electrical Systems", freq: "Monthly", done: 14, total: 16, pct: 88 },
              { name: "CCTV & Access Control", freq: "Monthly", done: 7, total: 8, pct: 88 },
              { name: "Plumbing & Drainage", freq: "Monthly", done: 6, total: 10, pct: 60 },
            ].map((plan) => {
              const colors = ["#4f46e5", "#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#10b981", "#6366f1"];
              const ci = ["Lift", "Fire", "Generator", "Water", "Electrical", "CCTV", "Plumbing"].findIndex((k) => plan.name.includes(k));
              const col = colors[Math.max(0, ci)];
              return (
                <div key={plan.name} style={{ borderBottom: "1px solid #f0f2f6", padding: "12px 16px" }}>
                  <div style={{ alignItems: "center", display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ alignItems: "center", background: col + "22", borderRadius: 6, color: col, display: "flex", fontSize: 14, height: 28, justifyContent: "center", width: 28 }}>
                      {ci === 0 ? "🛗" : ci === 1 ? "🔥" : ci === 2 ? "⚡" : ci === 3 ? "💧" : ci === 4 ? "🔌" : ci === 5 ? "📹" : "🔧"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.name}</strong>
                      <small style={{ color: "#8a96a7", fontSize: 9 }}>{plan.freq}</small>
                    </div>
                  </div>
                  <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                    <div style={{ background: "#edf0f5", borderRadius: 99, flex: 1, height: 5, overflow: "hidden" }}>
                      <i style={{ background: col, borderRadius: "inherit", display: "block", height: "100%", width: `${plan.pct}%` }} />
                    </div>
                    <span style={{ color: "#27364a", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{plan.done}/{plan.total}</span>
                    <span style={{ color: "#8a96a7", fontSize: 10 }}>{plan.pct}%</span>
                  </div>
                </div>
              );
            })}
            <div style={{ padding: "12px 16px" }}>
              <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Add New Maintenance Plan</button>
            </div>
          </article>
        </div>

        {/* Calendar + tasks */}
        <div style={{ display: "grid", gap: 16 }}>
          {/* Calendar week header */}
          <article className="data-panel" style={{ overflow: "hidden" }}>
            <div className="fc-ppm-header">
              <div className="fc-ppm-cal-nav">
                <button>‹</button>
                <strong className="fc-ppm-cal-month">May 12 – 18, 2026</strong>
                <button>›</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["All Buildings", "All Categories", "All Status", "All Technicians"].map((f) => (
                  <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
                ))}
              </div>
              <button className="fc-toolbar-btn primary">+ Create PPM Task</button>
            </div>
            {/* Week grid */}
            <div className="fc-ppm-week-grid" style={{ overflowX: "auto" }}>
              <div className="fc-ppm-time-col">
                <div className="fc-ppm-day-header" />
                {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"].map((t) => (
                  <div key={t} className="fc-ppm-time-slot">{t}</div>
                ))}
              </div>
              {days.map((day, di) => (
                <div key={day} className="fc-ppm-day-col">
                  <div className={`fc-ppm-day-header ${di === 2 ? "today" : ""}`}>{day}</div>
                  {Array.from({ length: 7 }, (_, hi) => {
                    const event = calEvents[di]?.[hi];
                    return (
                      <div key={hi} className="fc-ppm-time-slot">
                        {event && (
                          <div className={`fc-ppm-event ${event.type}`}>
                            <div className="fc-ppm-event-name">{event.name}</div>
                            <div className="fc-ppm-event-id">{event.id}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </article>

          {/* Upcoming tasks table */}
          <article className="data-panel">
            <div style={{ borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
              <strong style={{ fontSize: 14 }}>Upcoming PPM Tasks</strong>
              <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>View all</button>
            </div>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Task ID</th>
                    <th>Task Name</th>
                    <th>Asset</th>
                    <th>Building / Location</th>
                    <th>Frequency</th>
                    <th>Due Date</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr key={String(row.id)}>
                      <td><span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>{String(row.code ?? "—")}</span></td>
                      <td><strong style={{ fontSize: 12 }}>{String(row.name ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{String(row.asset_name ?? "—")}</td>
                      <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.property_name ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(row.frequency ?? "Monthly")}</td>
                      <td style={{ fontSize: 12 }}>{String(row.next_due_on ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>James Kariuki</td>
                      <td><FcStatus value="scheduled" /></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "3px 7px" }}>👁</button>
                          <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "3px 7px" }}>✏</button>
                          {permissions.canAdminister && row.is_active && (
                            <button onClick={() => onAction(row, "generate-work-order")} style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "3px 7px" }}>⋯</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}

/* ─── Inspections tab ─── */
function InspectionsView({ rows, onAction, permissions }: { rows: Row[]; onAction: (row: Row, action: string) => void; permissions: { canInspect: boolean } }) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const displayRows = rows.length > 0 ? rows : [
    { id: 1, reference: "INSP-2026-0056", title: "Lift Safety Inspection", asset_name: "LIFT-1", property_name: "Cradle Building – Ground Floor", scheduled_on: "18 May 2026, 09:30 AM", score: 96, violations: 0, status: "completed" },
    { id: 2, reference: "INSP-2026-0055", title: "Fire Extinguisher Check", asset_name: "FE-01 to 35", property_name: "Cradle Building – All Floors", scheduled_on: "18 May 2026, 08:45 AM", score: 94, violations: 1, status: "completed" },
    { id: 3, reference: "INSP-2026-0054", title: "Water Tank Inspection", asset_name: "WT-1", property_name: "Cradle Building – Roof", scheduled_on: "17 May 2026, 11:15 AM", score: 90, violations: 0, status: "completed" },
    { id: 4, reference: "INSP-2026-0053", title: "Electrical DB Inspection", asset_name: "DB-MDB-1", property_name: "Cradle Building – Basement", scheduled_on: "17 May 2026, 10:20 AM", score: 0, violations: 0, status: "in_progress" },
    { id: 5, reference: "INSP-2026-0052", title: "Generator Inspection", asset_name: "GEN-001", property_name: "Cradle Building – Generator Room", scheduled_on: "16 May 2026, 04:00 PM", score: 98, violations: 0, status: "completed" },
    { id: 6, reference: "INSP-2026-0051", title: "CCTV System Check", asset_name: "CCTV-01 to 16", property_name: "Cradle Building – All Floors", scheduled_on: "16 May 2026, 02:30 PM", score: 72, violations: 3, status: "overdue" },
  ];

  return (
    <>
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Inspections" value="56" sub="↑ 12% vs last month" onClick={() => {}} />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value="42" sub="75%" onClick={() => {}} />
        <FcKpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="In Progress" value="8" sub="14%" onClick={() => {}} />
        <FcKpiCard icon="⚠" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value="6" sub="11%" onClick={() => {}} />
        <FcKpiCard icon="🔍" iconBg="#fdf4ff" iconColor="#9333ea" label="Defects Found" value="38" sub="This month" onClick={() => {}} />
        <FcKpiCard icon="🛡" iconBg="#f0fdf4" iconColor="#15803d" label="Compliance Score" value="92%" sub="↑ 8% vs last month" onClick={() => {}} />
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--line)", display: "flex", gap: 0, marginBottom: 16 }}>
        {["Inspection List", "Calendar View", "Templates", "Checklists", "Reports"].map((t, i) => (
          <button key={t} style={{ background: "transparent", border: 0, borderBottom: i === 0 ? "2px solid #e23b3b" : "2px solid transparent", color: i === 0 ? "#e23b3b" : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "12px 16px" }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 340px" : "1fr" }}>
        <article className="data-panel">
          <div className="fc-table-toolbar">
            <div className="fc-table-toolbar-left">
              <input placeholder="Search inspections…" style={{ border: "1px solid #d7dce5", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 200 }} />
              {["All Buildings", "All Categories", "All Types", "All Status"].map((f) => (
                <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
              ))}
            </div>
            <div className="fc-table-toolbar-right">
              <button className="fc-toolbar-btn">Filters</button>
              <button className="fc-toolbar-btn">↓ Export</button>
              <button className="fc-toolbar-btn primary">+ New Inspection</button>
            </div>
          </div>
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Inspection ID</th>
                  <th>Inspection Name</th>
                  <th>Asset / System</th>
                  <th>Building / Location</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => {
                  const score = Number(row.score ?? 0);
                  const status = String(row.status ?? "scheduled");
                  const typeMap: Record<string, string> = { "INSP-2026-0056": "statutory", "INSP-2026-0055": "routine", "INSP-2026-0054": "routine", "INSP-2026-0053": "routine", "INSP-2026-0052": "preventive", "INSP-2026-0051": "routine" };
                  const insType = typeMap[String(row.reference)] ?? "routine";
                  return (
                    <tr key={String(row.id)} className={selectedRow?.id === row.id ? "selected" : ""} onClick={() => setSelectedRow(selectedRow?.id === row.id ? null : row)}>
                      <td><span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>{String(row.reference ?? "—")}</span></td>
                      <td><strong style={{ fontSize: 12 }}>{String(row.title ?? "—")}</strong></td>
                      <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.asset_name ?? "—")}</td>
                      <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.property_name ?? "—")}</td>
                      <td><FcStatus value={insType} /></td>
                      <td style={{ fontSize: 11, color: "#6b7890" }}>{String(row.scheduled_on ?? "—")}</td>
                      <td><FcStatus value={status.replace("_", "-")} /></td>
                      <td>
                        {score > 0 ? (
                          <div className="fc-score">
                            <span className="fc-score-dot" style={{ background: score >= 90 ? "#22c55e" : score >= 75 ? "#f59e0b" : "#ef4444" }} />
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{score}%</span>
                          </div>
                        ) : <span style={{ color: "#9aacbf", fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "3px 7px" }}>👁</button>
                          {permissions.canInspect && ["scheduled", "in_progress"].includes(status) && (
                            <button onClick={(e) => { e.stopPropagation(); onAction(row, "complete"); }} style={{ background: "#e23b3b", border: 0, borderRadius: 6, color: "white", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
                              Complete
                            </button>
                          )}
                          <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="fc-pagination">
            <span className="fc-pager-info">Showing 1 to 6 of 56 inspections</span>
            <div className="fc-pager">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`fc-page-btn ${n === 1 ? "active" : ""}`}>{n}</button>
              ))}
              <button className="fc-page-btn">…</button>
              <button className="fc-page-btn">7</button>
              <button className="fc-page-btn">›</button>
            </div>
          </div>
        </article>

        {/* Inspection detail */}
        {selectedRow && (
          <div className="fc-detail-panel">
            <div className="fc-detail-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>{String(selectedRow.reference ?? "")}</span>
                  <FcStatus value={String(selectedRow.status ?? "completed").replace("_", "-")} />
                </div>
                <strong style={{ display: "block", fontSize: 15 }}>{String(selectedRow.title ?? "—")}</strong>
                <small style={{ color: "#8a96a7" }}>{String(selectedRow.asset_name ?? "—")} • {String(selectedRow.property_name ?? "—")}</small>
              </div>
              <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: 0, color: "#8a96a7", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <div className="fc-detail-tabs">
              {["Overview", "Checklist", "Findings (2)", "Photos (6)", "Documents"].map((t, i) => (
                <button key={t} className={i === 0 ? "active" : ""}>{t}</button>
              ))}
            </div>
            <div style={{ padding: "16px 18px" }}>
              {[
                { label: "Inspection Type", value: "Statutory" },
                { label: "Duration", value: "1h 25m" },
                { label: "Inspection Date", value: String(selectedRow.scheduled_on ?? "—") },
                { label: "Template", value: "Lift Safety Inspection" },
                { label: "Inspector", value: "James Kariuki" },
                { label: "Compliance Standard", value: "KEBS / EAC 81-1" },
                { label: "Next Inspection", value: "18 Jun 2026" },
              ].map((f) => (
                <div key={f.label} style={{ borderBottom: "1px solid #f0f2f6", display: "flex", justifyContent: "space-between", padding: "9px 0" }}>
                  <span style={{ color: "#8a96a7", fontSize: 11 }}>{f.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{f.value}</span>
                </div>
              ))}

              {Number(selectedRow.score ?? 0) > 0 && (
                <div style={{ marginTop: 14 }}>
                  <span style={{ color: "#8a96a7", display: "block", fontSize: 11, marginBottom: 6 }}>Overall Score</span>
                  <strong style={{ fontSize: 22 }}>{String(selectedRow.score ?? 0)}%</strong>
                  <HealthBar pct={Number(selectedRow.score ?? 0)} />
                </div>
              )}

              <div style={{ background: "#f8fafc", borderRadius: 10, display: "grid", gap: 12, gridTemplateColumns: "repeat(4, 1fr)", marginTop: 16, padding: 14 }}>
                {[
                  { label: "Inspected", value: 12 },
                  { label: "Passed", value: 12 },
                  { label: "Failed", value: 0 },
                  { label: "N/A", value: 0 },
                ].map((stat) => (
                  <div key={stat.label} style={{ textAlign: "center" }}>
                    <strong style={{ display: "block", fontSize: 18 }}>{stat.value}</strong>
                    <small style={{ color: "#8a96a7", fontSize: 10 }}>{stat.label}</small>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "0 18px" }}>
              <strong style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Recent Findings</strong>
              {[
                { item: "Car Door Interlock", note: "All doors closing and locking properly.", status: "Passed", color: "#22c55e" },
                { item: "Emergency Light", note: "Battery backup below recommended level.", status: "Minor", color: "#f59e0b" },
              ].map((f) => (
                <div key={f.item} style={{ alignItems: "flex-start", borderBottom: "1px solid #f0f2f6", display: "flex", gap: 10, justifyContent: "space-between", padding: "10px 0" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: 12 }}>{f.item}</strong>
                    <small style={{ color: "#8a96a7", fontSize: 10 }}>{f.note}</small>
                  </div>
                  <span className="fc-status" style={{ background: f.color + "22", color: f.color }}>{f.status}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 8, padding: 18, gridTemplateColumns: "1fr 1fr" }}>
              <button className="fc-detail-cta outline">↓ View Full Report</button>
              <button className="fc-detail-cta">+ Create Work Order</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Service Requests tab ─── */
function ServiceRequestsView({ rows, onAction, permissions }: { rows: Row[]; onAction: (row: Row, action: string) => void; permissions: { canWork: boolean } }) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const displayRows = rows.length > 0 ? rows : [
    { id: 1, reference: "SR-2026-0187", subject: "Toilet flush not working", tenant_name: "John Mwangi (Tenant)", property_name: "Cradle Building – 3rd Floor", priority: "high", status: "in_progress", submitted_at: "18 May 2026, 09:15 AM" },
    { id: 2, reference: "SR-2026-0186", subject: "LED light flickering", tenant_name: "Mary Wanjiku", property_name: "Cradle Building – Ground Floor", priority: "medium", status: "open", submitted_at: "18 May 2026, 08:40 AM" },
    { id: 3, reference: "SR-2026-0185", subject: "AC not cooling properly", tenant_name: "Peter Ndungu", property_name: "Cradle Building – 2nd Floor", priority: "high", status: "in_progress", submitted_at: "18 May 2026, 08:05 AM" },
    { id: 4, reference: "SR-2026-0184", subject: "Door closer damaged", tenant_name: "Security Office", property_name: "Cradle Building – Ground Floor", priority: "low", status: "open", submitted_at: "17 May 2026, 06:30 PM" },
    { id: 5, reference: "SR-2026-0183", subject: "Fire extinguisher gauge low", tenant_name: "David Ochieng", property_name: "Cradle Building – All Floors", priority: "high", status: "in_progress", submitted_at: "17 May 2026, 03:20 PM" },
    { id: 6, reference: "SR-2026-0182", subject: "Water leakage on ceiling", tenant_name: "James Kariuki", property_name: "Cradle Building – Parking P2", priority: "high", status: "open", submitted_at: "17 May 2026, 02:15 PM" },
  ];

  const priorityColors: Record<string, string> = { high: "#b91c1c", medium: "#a16207", low: "#15803d" };
  const catIcons: Record<string, string> = { "Plumbing": "💧", "Electrical": "⚡", "HVAC": "❄️", "Fire Safety": "🔥", "Carpentry": "🪚", "General": "🔧" };

  return (
    <>
      <div className="fc-kpi-strip" style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Requests" value="128" sub="↑ 18% vs last month" onClick={() => {}} />
        <FcKpiCard icon="📂" iconBg="#fff3cd" iconColor="#92400e" label="Open" value="38" sub="29.7%" onClick={() => {}} />
        <FcKpiCard icon="⏳" iconBg="#dbeafe" iconColor="#1d4ed8" label="In Progress" value="45" sub="35.2%" onClick={() => {}} />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#166534" label="Completed" value="40" sub="31.3%" onClick={() => {}} />
        <FcKpiCard icon="⏰" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value="5" sub="3.9%" onClick={() => {}} />
        <FcKpiCard icon="⏱" iconBg="#f0fdf4" iconColor="#15803d" label="Avg. Response Time" value="1.8 hrs" sub="Target: 4 hrs" onClick={() => {}} />
        <FcKpiCard icon="⭐" iconBg="#fff7ed" iconColor="#ea580c" label="Satisfaction Score" value="4.6 / 5" sub="↑ 0.3 vs last month" onClick={() => {}} />
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--line)", display: "flex", gap: 0, marginBottom: 16 }}>
        {["All Requests", "My Requests", "Open", "In Progress", "Completed", "Cancelled"].map((t, i) => (
          <button key={t} style={{ background: "transparent", border: 0, borderBottom: i === 0 ? "2px solid #e23b3b" : "2px solid transparent", color: i === 0 ? "#e23b3b" : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "12px 14px", whiteSpace: "nowrap" }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 360px" : "1fr" }}>
        <article className="data-panel">
          <div className="fc-table-toolbar">
            <div className="fc-table-toolbar-left">
              <input placeholder="Search requests…" style={{ border: "1px solid #d7dce5", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 180 }} />
              {["All Buildings", "All Categories", "All Priority", "All Status"].map((f) => (
                <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
              ))}
            </div>
          </div>
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Reported By</th>
                  <th>Reported On</th>
                  <th>SLA</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => {
                  const priority = String(row.priority ?? "low");
                  const status = String(row.status ?? "open");
                  const ref = String(row.reference ?? "");
                  const catMap: Record<string, string> = { "SR-2026-0187": "Plumbing", "SR-2026-0186": "Electrical", "SR-2026-0185": "HVAC", "SR-2026-0184": "Carpentry", "SR-2026-0183": "Fire Safety", "SR-2026-0182": "Plumbing" };
                  const cat = catMap[ref] ?? "General";
                  return (
                    <tr key={String(row.id)} className={selectedRow?.id === row.id ? "selected" : ""} onClick={() => setSelectedRow(selectedRow?.id === row.id ? null : row)}>
                      <td>
                        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                          <span style={{ alignItems: "center", background: "#f0f4ff", borderRadius: 8, color: "#4f46e5", display: "flex", fontSize: 14, height: 30, justifyContent: "center", width: 30 }}>
                            {catIcons[cat] ?? "🔧"}
                          </span>
                          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>{ref}</span>
                        </div>
                      </td>
                      <td><strong style={{ fontSize: 12 }}>{String(row.subject ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{cat}</td>
                      <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.property_name ?? "—")}</td>
                      <td>
                        <span className="fc-priority-chip">
                          <i style={{ background: priorityColors[priority] ?? "#9ca3af" }} />
                          <span style={{ color: priorityColors[priority] ?? "#9ca3af", textTransform: "capitalize" }}>{priority}</span>
                        </span>
                      </td>
                      <td><FcStatus value={status.replace("_", "-")} /></td>
                      <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.tenant_name ?? "—")}</td>
                      <td style={{ fontSize: 11, color: "#6b7890" }}>{String(row.submitted_at ?? "—")}</td>
                      <td><span style={{ color: "#16a34a", fontSize: 11, fontWeight: 700 }}>1h 45m Remaining</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {permissions.canWork && !row.work_order && (
                            <button onClick={(e) => { e.stopPropagation(); onAction(row, "convert"); }} style={{ background: "#e23b3b", border: 0, borderRadius: 6, color: "white", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
                              Create WO
                            </button>
                          )}
                          {permissions.canWork && ["assigned", "in_progress"].includes(status) && (
                            <button onClick={(e) => { e.stopPropagation(); onAction(row, "resolve"); }} style={{ background: "#22c55e", border: 0, borderRadius: 6, color: "white", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
                              Resolve
                            </button>
                          )}
                          <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="fc-pagination">
            <span className="fc-pager-info">Showing 1 to 6 of 128 requests</span>
            <div className="fc-pager">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`fc-page-btn ${n === 1 ? "active" : ""}`}>{n}</button>
              ))}
              <button className="fc-page-btn">…</button>
              <button className="fc-page-btn">16</button>
              <button className="fc-page-btn">›</button>
            </div>
          </div>
        </article>

        {/* Detail panel */}
        {selectedRow && (
          <div className="fc-detail-panel">
            <div className="fc-detail-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>{String(selectedRow.reference ?? "")}</span>
                  <FcStatus value={String(selectedRow.status ?? "").replace("_", "-")} />
                </div>
                <strong style={{ display: "block", fontSize: 15 }}>{String(selectedRow.subject ?? "—")}</strong>
                <small style={{ color: "#8a96a7" }}>{String(selectedRow.property_name ?? "—")}</small>
              </div>
              <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: 0, color: "#8a96a7", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <div className="fc-detail-tabs">
              {["Overview", "Updates (2)", "Photos (2)", "Tasks (1)", "Related"].map((t, i) => (
                <button key={t} className={i === 0 ? "active" : ""}>{t}</button>
              ))}
            </div>
            <div style={{ padding: "14px 18px" }}>
              {[
                { label: "Status", value: String(selectedRow.status ?? "").replace("_", " ") },
                { label: "Reported By", value: String(selectedRow.tenant_name ?? "—") },
                { label: "SLA Response Time", value: "4 hours" },
                { label: "Contact", value: "0712 345 678" },
                { label: "SLA Resolution Time", value: "48 hours" },
                { label: "Assigned To", value: "James Kariuki" },
                { label: "Response Due", value: "18 May 2026, 01:15 PM" },
                { label: "Contractor", value: "Aqua Solutions Ltd." },
                { label: "Resolution Due", value: "20 May 2026, 09:15 AM" },
                { label: "Created By", value: "John Mwangi" },
              ].map((f) => (
                <div key={f.label} style={{ borderBottom: "1px solid #f0f2f6", display: "flex", justifyContent: "space-between", padding: "9px 0" }}>
                  <span style={{ color: "#8a96a7", fontSize: 11 }}>{f.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{f.value}</span>
                </div>
              ))}
              <div style={{ marginTop: 14 }}>
                <strong style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Description</strong>
                <p style={{ color: "#4b5563", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                  The flush is not working in the men's washroom near lift lobby. Water does not refill after flush.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, padding: 18, gridTemplateColumns: "1fr 1fr" }}>
              <button className="fc-detail-cta outline">✏ Edit Request</button>
              <button className="fc-detail-cta outline" style={{ color: "#b91c1c", borderColor: "#e23b3b" }}>× Cancel Request</button>
            </div>
            <button className="fc-detail-cta" style={{ margin: "0 18px 18px" }}>+ Add Update</button>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Utilities tab ─── */
function UtilitiesView({ rows }: { rows: Row[] }) {
  const sparkData = [30, 45, 38, 55, 48, 62, 50, 70, 58, 75, 65, 80];
  const maxSpark = Math.max(...sparkData);

  return (
    <>
      <div className="fc-kpi-strip six-col">
        {[
          { icon: "⚡", bg: "#e0e7ff", color: "#4f46e5", label: "Total Energy (kWh)", value: "125,430", trend: "↑ 8.6%", up: false },
          { icon: "💧", bg: "#dbeafe", color: "#2563eb", label: "Water Consumption (m³)", value: "1,245", trend: "↓ 5.3%", up: true },
          { icon: "⛽", bg: "#dcfce7", color: "#16a34a", label: "Generator Fuel (L)", value: "3,240", trend: "↑ 12.1%", up: false },
          { icon: "🔥", bg: "#fff7ed", color: "#ea580c", label: "Gas Consumption (kg)", value: "620", trend: "↓ 3.6%", up: true },
          { icon: "💰", bg: "#fdf4ff", color: "#9333ea", label: "Utility Cost (KES)", value: "645,780", trend: "↑ 6.8%", up: false },
          { icon: "🌱", bg: "#f0fdf4", color: "#15803d", label: "Carbon Savings (kg CO₂)", value: "2,340", trend: "↑ 9.4%", up: true },
        ].map((kpi) => (
          <div key={kpi.label} className="fc-kpi-card" style={{ cursor: "default" }}>
            <div className="fc-kpi-top">
              <span className="fc-kpi-icon" style={{ background: kpi.bg, color: kpi.color }}>{kpi.icon}</span>
              <span className="fc-kpi-label">{kpi.label}</span>
            </div>
            <strong className="fc-kpi-value" style={{ fontSize: 20 }}>{kpi.value}</strong>
            <span className={kpi.up ? "fc-kpi-trend-up" : "fc-kpi-trend-down"}>{kpi.trend} vs last period</span>
            <div className="fc-sparkline">
              {sparkData.map((v, i) => (
                <i key={i} style={{ background: kpi.color, height: `${(v / maxSpark) * 100}%`, opacity: 0.6 + (i / sparkData.length) * 0.4 }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--line)", display: "flex", gap: 0, marginBottom: 16 }}>
        {["Overview", "Electricity", "Water", "Generator Fuel", "Solar", "Gas", "Waste", "Reports"].map((t, i) => (
          <button key={t} style={{ background: "transparent", border: 0, borderBottom: i === 0 ? "2px solid #e23b3b" : "2px solid transparent", color: i === 0 ? "#e23b3b" : "#6b7280", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "12px 12px", whiteSpace: "nowrap" }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1.5fr) 280px" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {/* Meter readings table */}
          <article className="data-panel">
            <PanelHeader title="Latest Meter Readings" />
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Utility Type</th>
                    <th>Meter / Location</th>
                    <th>Current Reading</th>
                    <th>Previous Reading</th>
                    <th>Consumption</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0
                    ? rows.slice(0, 5).map((row) => (
                        <tr key={String(row.id)}>
                          <td>
                            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                              <span>{row.utility_type === "electricity" ? "⚡" : row.utility_type === "water" ? "💧" : row.utility_type === "gas" ? "🔥" : "⛽"}</span>
                              <span style={{ fontSize: 12, textTransform: "capitalize" }}>{String(row.utility_type ?? "—")} ({String(row.unit ?? "")})</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>{String(row.name ?? "—")}<br /><span style={{ color: "#8a96a7", fontSize: 10 }}>{String(row.property_name ?? "")}</span></td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{String(row.current_reading ?? "—")}</td>
                          <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.previous_reading ?? "—")}</td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{String(row.consumption ?? "—")} {String(row.unit ?? "")}</td>
                          <td style={{ fontSize: 11, color: "#6b7890" }}>{String(row.read_at ?? "—")}</td>
                          <td><FcStatus value="good" /></td>
                        </tr>
                      ))
                    : [
                        { id: 1, type: "⚡", label: "Electricity (kWh)", meter: "Main Incomer – EM-01", loc: "Ground Floor", curr: "54,678.20", prev: "53,210.45", cons: "1,467.75 kWh", date: "18 May 2026, 08:00 AM", status: "good" },
                        { id: 2, type: "💧", label: "Water (m³)", meter: "Main Water Meter – WM-01", loc: "Basement", curr: "12,345.80", prev: "12,201.60", cons: "144.20 m³", date: "18 May 2026, 07:45 AM", status: "good" },
                        { id: 3, type: "⛽", label: "Generator Fuel (L)", meter: "Gen Fuel Tank – GF-01", loc: "Generator Room", curr: "1,260.00", prev: "1,460.00", cons: "200.00 L", date: "18 May 2026, 07:30 AM", status: "low" },
                        { id: 4, type: "🔥", label: "Gas (kg)", meter: "Gas Meter – GM-01", loc: "Kitchen", curr: "2,340.00", prev: "2,410.00", cons: "70.00 kg", date: "18 May 2026, 07:20 AM", status: "good" },
                      ].map((m) => (
                        <tr key={m.id}>
                          <td>
                            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                              <span>{m.type}</span>
                              <span style={{ fontSize: 12 }}>{m.label}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>{m.meter}<br /><span style={{ color: "#8a96a7", fontSize: 10 }}>{m.loc}</span></td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{m.curr}</td>
                          <td style={{ fontSize: 12, color: "#6b7890" }}>{m.prev}</td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{m.cons}</td>
                          <td style={{ fontSize: 11, color: "#6b7890" }}>{m.date}</td>
                          <td><FcStatus value={m.status} /></td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 18px" }}>
              <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>View All Meters →</button>
            </div>
          </article>
        </div>

        {/* Right rail */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <article className="data-panel">
            <PanelHeader title="Active Alerts" />
            <div className="fc-alert-list">
              {[
                { type: "danger", icon: "⚠", title: "High Electricity Usage", sub: "Consumption 18% above baseline", loc: "Cradle Building – Ground Floor", time: "08:15 AM" },
                { type: "warning", icon: "💧", title: "Possible Water Leak", sub: "Continuous flow for 3+ hours", loc: "Cradle Building – Basement", time: "07:45 AM" },
                { type: "danger", icon: "⛽", title: "Generator Fuel Low", sub: "Fuel level below 15%", loc: "Cradle Building – Generator Room", time: "Yesterday" },
                { type: "info", icon: "📅", title: "Water Tank Cleaning Due", sub: "Scheduled on 22 May 2026", loc: "Cradle Building – Roof", time: "Yesterday" },
              ].map((alert) => (
                <button key={alert.title} className="fc-alert-item">
                  <span className={`fc-alert-icon ${alert.type}`}>{alert.icon}</span>
                  <div className="fc-alert-body">
                    <strong>{alert.title}</strong>
                    <small>{alert.sub}</small>
                    <small>{alert.loc}</small>
                  </div>
                  <span style={{ color: "#9aacbf", fontSize: 10 }}>{alert.time}</span>
                </button>
              ))}
              <div style={{ padding: "10px 18px" }}>
                <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>View all alerts →</button>
              </div>
            </div>
          </article>

          <article className="data-panel">
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
              <strong style={{ fontSize: 13 }}>Utility Cost Summary</strong>
              <div style={{ fontSize: 10, color: "#8a96a7" }}>This Month</div>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ marginBottom: 14 }}>
                <span style={{ color: "#8a96a7", display: "block", fontSize: 11 }}>Total Cost</span>
                <strong style={{ fontSize: 22 }}>KES 645,780</strong>
                <span style={{ color: "#ef4444", fontSize: 11 }}> ↑ 6.8% vs last month</span>
              </div>
              {[
                { icon: "⚡", label: "Electricity", value: "KES 412,560", trend: "↑ 7.9%", up: false },
                { icon: "💧", label: "Water", value: "KES 98,450", trend: "↓ 3.2%", up: true },
                { icon: "⛽", label: "Generator Fuel", value: "KES 76,540", trend: "↑ 12.1%", up: false },
                { icon: "🔥", label: "Gas", value: "KES 38,760", trend: "↓ 3.6%", up: true },
                { icon: "♻", label: "Waste", value: "KES 19,470", trend: "↑ 5.3%", up: false },
              ].map((item) => (
                <div key={item.label} style={{ alignItems: "center", borderBottom: "1px solid #f0f2f6", display: "flex", gap: 10, padding: "9px 0" }}>
                  <span>{item.icon}</span>
                  <span style={{ color: "#4b5563", flex: 1, fontSize: 12 }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{item.value}</span>
                  <span style={{ color: item.up ? "#16a34a" : "#ef4444", fontSize: 10, fontWeight: 700 }}>{item.trend}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </>
  );
}

/* ─── Contractors tab ─── */
function ContractorsView({ rows }: { rows: Row[] }) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const displayRows = rows.length > 0 ? rows : [
    { id: 1, code: "C-2018-25487", name: "Aqua Solutions Ltd.", specialty: "Plumbing & Drainage", contact_name: "0721 345 678", rating: 4.6, status: "active", insurance_expires_on: "12 Dec 2026" },
    { id: 2, code: "C-PG-001", name: "PowerGen Ltd.", specialty: "Electrical Systems", contact_name: "0712 654 321", rating: 4.4, status: "active", insurance_expires_on: "24 Aug 2026" },
    { id: 3, code: "C-FT-001", name: "FireTech Services", specialty: "Fire Safety Systems", contact_name: "0733 987 654", rating: 4.8, status: "active", insurance_expires_on: "30 Nov 2026" },
    { id: 4, code: "C-EL-001", name: "Elevate Ltd.", specialty: "Lift Systems", contact_name: "0709 876 543", rating: 4.5, status: "active", insurance_expires_on: "05 Mar 2027" },
    { id: 5, code: "C-SE-001", name: "SecureEye Ltd.", specialty: "CCTV / Access Control", contact_name: "0725 111 222", rating: 4.2, status: "active", insurance_expires_on: "18 Jun 2026" },
    { id: 6, code: "C-CM-001", name: "CoolMax Systems", specialty: "HVAC Systems", contact_name: "0731 222 333", rating: 4.1, status: "active", insurance_expires_on: "22 Oct 2026" },
    { id: 7, code: "C-GC-001", name: "GreenClean Ltd.", specialty: "Cleaning Services", contact_name: "0714 555 888", rating: 3.9, status: "inactive", insurance_expires_on: "15 Jan 2027" },
    { id: 8, code: "C-RF-001", name: "Rapid Fix Ltd.", specialty: "Specialized Repairs", contact_name: "0788 999 111", rating: 2.1, status: "blacklisted", insurance_expires_on: "—" },
  ];

  return (
    <>
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="👷" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Contractors" value="68" sub="↑ 7 this month" onClick={() => {}} />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active Contractors" value="56" sub="82% of total" onClick={() => {}} />
        <FcKpiCard icon="⭐" iconBg="#fff7ed" iconColor="#ea580c" label="Average Rating" value="4.3 / 5" sub="↑ 0.2 vs last month" onClick={() => {}} />
        <FcKpiCard icon="⏱" iconBg="#f0fdf4" iconColor="#15803d" label="Avg. Response Time" value="2.6 hrs" sub="↑ 0.4 hrs vs last month" onClick={() => {}} />
        <FcKpiCard icon="📄" iconBg="#fef3c7" iconColor="#92400e" label="Contracts Expiring" value="7" sub="Next 30 days" onClick={() => {}} />
        <FcKpiCard icon="💰" iconBg="#fdf4ff" iconColor="#9333ea" label="Total Spend (YTD)" value="KES 45.67M" sub="↑ 12.6% vs last year" onClick={() => {}} />
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--line)", display: "flex", gap: 0, marginBottom: 16 }}>
        {["All Contractors", "By Category", "By Performance", "Approved", "Blacklisted"].map((t, i) => (
          <button key={t} style={{ background: "transparent", border: 0, borderBottom: i === 0 ? "2px solid #e23b3b" : "2px solid transparent", color: i === 0 ? "#e23b3b" : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "12px 14px", whiteSpace: "nowrap" }}>
            {t}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, paddingBottom: 8 }}>
          <button className="fc-toolbar-btn primary" style={{ marginRight: 0 }}>+ Add Contractor</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 360px" : "1fr" }}>
        <article className="data-panel">
          <div className="fc-table-toolbar">
            <div className="fc-table-toolbar-left">
              <input placeholder="Search contractors…" style={{ border: "1px solid #d7dce5", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 200 }} />
              {["All Categories", "All Status", "All Risk Levels"].map((f) => (
                <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
              ))}
              <button className="fc-toolbar-btn">Filters</button>
            </div>
            <button className="fc-toolbar-btn">↓ Export</button>
          </div>
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Contractor</th>
                  <th>Category / Specialization</th>
                  <th>Status</th>
                  <th>Performance Rating</th>
                  <th>Avg. Response Time</th>
                  <th>Active Contracts</th>
                  <th>Spend (YTD)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => {
                  const rating = Number(row.rating ?? 0);
                  const statusStr = String(row.status ?? "active");
                  const catColors: Record<string, string> = {
                    "Plumbing & Drainage": "#3b82f6", "Electrical Systems": "#f59e0b", "Fire Safety Systems": "#ef4444",
                    "Lift Systems": "#8b5cf6", "CCTV / Access Control": "#10b981", "HVAC Systems": "#6366f1",
                    "Cleaning Services": "#22c55e", "Specialized Repairs": "#f97316",
                  };
                  const cat = String(row.specialty ?? "General");
                  const col = catColors[cat] ?? "#9ca3af";
                  return (
                    <tr key={String(row.id)} className={selectedRow?.id === row.id ? "selected" : ""} onClick={() => setSelectedRow(selectedRow?.id === row.id ? null : row)}>
                      <td>
                        <div style={{ display: "grid", gap: 1 }}>
                          <strong style={{ fontSize: 13 }}>{String(row.name ?? "—")}</strong>
                          <small style={{ color: "#8a96a7", fontSize: 11 }}>{String(row.contact_name ?? "—")}</small>
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong style={{ display: "block", fontSize: 12 }}>{cat}</strong>
                          <small style={{ color: "#8a96a7", fontSize: 10 }}>Specialization</small>
                        </div>
                      </td>
                      <td><FcStatus value={statusStr} /></td>
                      <td>
                        <div>
                          <Stars rating={rating} />
                          <small style={{ color: "#8a96a7", display: "block", fontSize: 10 }}>{rating.toFixed(1)} (23 reviews)</small>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>2.1 hrs</td>
                      <td style={{ fontSize: 12, fontWeight: 700 }}>{statusStr === "active" ? Math.floor(Math.random() * 5) + 1 : 0}</td>
                      <td style={{ fontSize: 12, fontWeight: 700 }}>KES {(Math.random() * 9 + 1).toFixed(2)}M</td>
                      <td>
                        <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="fc-pagination">
            <span className="fc-pager-info">Showing 1 to 8 of 68 contractors</span>
            <div className="fc-pager">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`fc-page-btn ${n === 1 ? "active" : ""}`}>{n}</button>
              ))}
              <button className="fc-page-btn">…</button>
              <button className="fc-page-btn">8</button>
              <button className="fc-page-btn">›</button>
            </div>
          </div>
        </article>

        {/* Contractor detail */}
        {selectedRow && (
          <div className="fc-detail-panel">
            <div className="fc-detail-header">
              <div className="fc-detail-thumb-placeholder" style={{ background: "linear-gradient(135deg, #1e3a5f, #0f2744)", fontSize: 20 }}>
                👷
              </div>
              <div className="fc-detail-meta">
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <strong style={{ fontSize: 14 }}>{String(selectedRow.name ?? "—")}</strong>
                  <FcStatus value={String(selectedRow.status ?? "active")} />
                </div>
                <small style={{ color: "#4b5563" }}>{String(selectedRow.specialty ?? "—")}</small>
                <small style={{ color: "#8a96a7", display: "block", marginTop: 2 }}>{String(selectedRow.contact_name ?? "—")} • info@aquasolutions.co.ke</small>
              </div>
              <button onClick={() => setSelectedRow(null)} style={{ background: "none", border: 0, color: "#8a96a7", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <div className="fc-detail-tabs">
              {["Overview", "Contracts (5)", "Performance", "Documents", "History"].map((t, i) => (
                <button key={t} className={i === 0 ? "active" : ""}>{t}</button>
              ))}
            </div>
            <div style={{ padding: "14px 18px" }}>
              {[
                { label: "Registration No.", value: String(selectedRow.code ?? "—") },
                { label: "SLA Response Time", value: "2 hrs" },
                { label: "TIN Number", value: "123-456-789" },
                { label: "SLA Resolution Time", value: "24 hrs" },
                { label: "Risk Level", value: "Low", color: "#16a34a" },
                { label: "Payment Terms", value: "30 Days" },
                { label: "Insurance Expiry", value: String(selectedRow.insurance_expires_on ?? "—") },
                { label: "Last Evaluation", value: "15 May 2026" },
                { label: "Years with CeEst", value: "4 years" },
                { label: "Next Evaluation", value: "15 Aug 2026" },
              ].map((f) => (
                <div key={f.label} style={{ borderBottom: "1px solid #f0f2f6", display: "flex", justifyContent: "space-between", padding: "9px 0" }}>
                  <span style={{ color: "#8a96a7", fontSize: 11 }}>{f.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: (f as { color?: string }).color ?? "inherit" }}>{f.value}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <strong style={{ fontSize: 12 }}>Performance Summary</strong>
                <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>View full report →</button>
              </div>
              <div style={{ alignItems: "center", display: "flex", gap: 14, marginBottom: 10 }}>
                <div style={{ textAlign: "center" }}>
                  <Stars rating={Number(selectedRow.rating ?? 4.6)} />
                  <strong style={{ display: "block", fontSize: 22 }}>{Number(selectedRow.rating ?? 4.6).toFixed(1)} / 5</strong>
                  <small style={{ color: "#8a96a7", fontSize: 10 }}>(23 Reviews)</small>
                </div>
                <div style={{ flex: 1, display: "grid", gap: 7 }}>
                  {[
                    { label: "Quality of Work", score: 4.7 },
                    { label: "Timeliness", score: 4.5 },
                    { label: "Communication", score: 4.6 },
                    { label: "Safety Compliance", score: 4.4 },
                  ].map((item) => (
                    <div key={item.label} style={{ alignItems: "center", display: "flex", fontSize: 11, gap: 8 }}>
                      <span style={{ color: "#4b5563", flex: 1 }}>{item.label}</span>
                      <div style={{ background: "#edf0f5", borderRadius: 99, flex: 1, height: 5, overflow: "hidden" }}>
                        <i style={{ background: "#22c55e", borderRadius: "inherit", display: "block", height: "100%", width: `${(item.score / 5) * 100}%` }} />
                      </div>
                      <span style={{ fontWeight: 700, minWidth: 24 }}>{item.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, padding: "0 18px 18px", gridTemplateColumns: "1fr 1fr 1fr" }}>
              <button className="fc-detail-cta outline" style={{ fontSize: 11 }}>👁 View Profile</button>
              <button className="fc-detail-cta outline" style={{ fontSize: 11 }}>✏ Edit</button>
              <button className="fc-detail-cta" style={{ fontSize: 11 }}>📄 Contracts</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Generic list tab ─── */
function GenericListView({
  tab,
  rows,
  onAction,
  permissions,
}: {
  tab: Tab;
  rows: Row[];
  onAction: (row: Row, action: string) => void;
  permissions: { canWork: boolean; canInspect: boolean; canAdminister: boolean };
}) {
  const columns: Record<string, { key: string; label: string }[]> = {
    "work-order-events": [{ key: "created_at", label: "Time" }, { key: "work_order", label: "Work Order" }, { key: "event_type", label: "Event" }, { key: "from_status", label: "From" }, { key: "to_status", label: "To" }, { key: "actor_name", label: "Actor" }, { key: "notes", label: "Notes" }],
    "work-order-cost-items": [{ key: "work_order", label: "Work Order" }, { key: "kind", label: "Type" }, { key: "description", label: "Item" }, { key: "quantity", label: "Quantity" }, { key: "unit_cost", label: "Unit Cost" }, { key: "total", label: "Total" }, { key: "supplier", label: "Supplier" }],
    "work-order-attachments": [{ key: "work_order", label: "Work Order" }, { key: "file_name", label: "File" }, { key: "media_type", label: "Type" }, { key: "caption", label: "Caption" }, { key: "uploaded_by_name", label: "Uploaded By" }, { key: "created_at", label: "Uploaded" }],
  };
  const cols = columns[tab] ?? [];

  return (
    <article className="data-panel">
      <div className="fc-table-toolbar">
        <span style={{ color: "#27364a", fontWeight: 700, fontSize: 13 }}>{labels[tab]}</span>
      </div>
      {rows.length > 0 ? (
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)}>
                  {cols.map((c) => (
                    <td key={c.key} style={{ fontSize: 12 }}>{String(row[c.key] ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState message={`No ${labels[tab].toLowerCase()} records found.`} />}
    </article>
  );
}

/* ─── Main page ─── */
export default function FacilityPage({ initialTab = "overview" }: { initialTab?: Tab }) {
  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const canWork = can("facility.work") || can("facility.manage");
  const canInspect = can("facility.inspect") || can("facility.manage");
  const canAdminister = can("facility.administer") || can("facility.manage");
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (q && labels[q]) return q;
    }
    return initialTab;
  });
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [properties, setProperties] = useState<Row[]>([]);


  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    const apiTab = tab === "buildings" ? "assets" : tab;
    const path =
      tab === "overview"
        ? "/facility/dashboard/"
        : `/facility/${apiTab}/?search=${encodeURIComponent(search)}`;
    const response = await apiFetch(path, {}, organizationId);
    if (!response.ok) {
      setError("Facility data could not be loaded. Please retry.");
      setLoading(false);
      return;
    }
    const data = await response.json();
    if (tab === "overview") setDashboard(data);
    else setRows(data);
    setLoading(false);
  }, [organizationId, search, tab]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    if (showCreate && organizationId)
      apiFetch("/property/properties/", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then(setProperties);
  }, [showCreate, organizationId]);

  async function createWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      "/facility/work-orders/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          ...Object.fromEntries(form.entries()),
          reported_at: new Date().toISOString(),
          progress: 0,
        }),
      },
      organizationId
    );
    if (!response.ok) {
      setError("The work order could not be created. Check its number and required fields.");
      return;
    }
    setShowCreate(false);
    setTab("work-orders");
  }

  async function runAction(row: Row, action: string) {
    await apiFetch("/auth/csrf/");
    let path = "";
    let payload: Record<string, string | number | boolean> = {};
    if (tab === "planned-maintenance") path = `/facility/planned-maintenance/${row.id}/${action}/`;
    if (tab === "service-requests") {
      path = `/facility/service-requests/${row.id}/${action}/`;
      if (action === "resolve")
        payload.satisfaction_score = Number(window.prompt("Satisfaction score (1-5):") ?? 0);
    }
    if (tab === "inspections") {
      path = `/facility/inspections/${row.id}/complete/`;
      const score = window.prompt("Inspection score (0-100):")?.trim();
      if (!score) return;
      const violations = Number(window.prompt("Number of violations:") ?? 0);
      const findings = violations ? window.prompt("Record the inspection findings:")?.trim() : "";
      if (violations && !findings) return;
      payload = { score, violations, findings: findings ?? "", create_work_order: true };
    }
    const response = await apiFetch(
      path,
      { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) },
      organizationId
    );
    if (!response.ok) {
      setError("The facility workflow action could not be completed.");
      return;
    }
    await load();
  }

  const selectTab = (id: string) => {
    setSearch("");
    setRows([]);
    setTab(id as Tab);
  };

  const permissions = { canWork, canInspect, canAdminister };

  return (
    <ModuleShell
      moduleKey="facility"
      moduleName="Facility Management"
      eyebrow="Operations center"
      title="Facility Management"
      subtitle="Assets, maintenance, compliance, services and utility performance."
      accent="#e23b3b"
      groups={facilityNav}
      activeId={tab}
      onSelect={selectTab}
      contextLabel="Section"
      contextValue={labels[tab]}
      actions={
        canWork ? (
          <button className="primary-action" onClick={() => setShowCreate(true)}>
            + New Work Order
          </button>
        ) : null
      }
    >
      <div className="facility-app">
        {error && (
          <div className="form-error" style={{ marginBottom: 16 }}>
            {error}
            <button onClick={load}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="data-loading">Loading facility operations…</div>
        ) : tab === "overview" && dashboard ? (
          <DashboardView dashboard={dashboard} setTab={setTab} setShowCreate={setShowCreate} canWork={canWork} />
        ) : tab === "buildings" ? (
          <BuildingsView rows={rows} setTab={setTab} />
        ) : tab === "assets" ? (
          <AssetsView rows={rows} onAction={runAction} permissions={{ canWork, canAdminister }} />
        ) : tab === "work-orders" ? (
          <WorkOrdersView rows={rows} onAction={runAction} permissions={{ canWork }} setShowCreate={setShowCreate} />
        ) : tab === "planned-maintenance" ? (
          <PlannedMaintenanceView rows={rows} onAction={runAction} permissions={{ canAdminister }} />
        ) : tab === "inspections" ? (
          <InspectionsView rows={rows} onAction={runAction} permissions={{ canInspect }} />
        ) : tab === "service-requests" ? (
          <ServiceRequestsView rows={rows} onAction={runAction} permissions={{ canWork }} />
        ) : tab === "meters" ? (
          <UtilitiesView rows={rows} />
        ) : tab === "contractors" ? (
          <ContractorsView rows={rows} />
        ) : (
          <GenericListView tab={tab} rows={rows} onAction={runAction} permissions={permissions} />
        )}

        {/* Create work order modal */}
        {showCreate && (
          <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}>
            <div className="form-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-title">
                <div>
                  <p className="eyebrow">Corrective maintenance</p>
                  <h2>New Work Order</h2>
                </div>
                <button onClick={() => setShowCreate(false)}>×</button>
              </div>
              <form onSubmit={createWorkOrder}>
                <div className="form-row">
                  <label>
                    Work order number
                    <input name="number" required placeholder="WO-2026-1790" />
                  </label>
                  <label>
                    Priority
                    <select name="priority" defaultValue="medium">
                      <option>low</option>
                      <option>medium</option>
                      <option>high</option>
                      <option>critical</option>
                    </select>
                  </label>
                </div>
                <label>
                  Issue title
                  <input name="title" required placeholder="Describe the maintenance issue" />
                </label>
                <div className="form-row">
                  <label>
                    Category
                    <input name="category" required placeholder="Mechanical" />
                  </label>
                  <label>
                    Property
                    <select name="property" required defaultValue="">
                      <option value="" disabled>Select property</option>
                      {properties.map((row) => (
                        <option key={String(row.id)} value={String(row.id)}>
                          {String(row.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Description
                  <textarea name="description" rows={4} />
                </label>
                <input type="hidden" name="status" value="open" />
                <div className="form-actions">
                  <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button className="primary-action">Create Work Order</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
