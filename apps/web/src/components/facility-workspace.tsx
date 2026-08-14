"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { DetailDrawer, Field, Modal, money } from "@/components/module-ui";
import { usePropertyContext } from "@/lib/property-context";
import { ModuleCalendarView, ModuleTicketsView } from "@/components/module-activity";

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
  | "contractors"
  | "reports"
  | "expenditure"
  | "spare-parts"
  | "consumables"
  | "tickets"
  | "calendar";

type Row = Record<string, string | number | boolean | null>;
type Kpis = Dashboard["kpis"];
type ActionModal =
  | { type: "inspection" | "resolve"; row: Row }
  | { type: "request-decision"; row: Row; decision: "approve" | "reject" }
  | null;
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
  reports: "Reports & BI",
  expenditure: "Expenditure & Floats",
  "spare-parts": "Spare Parts",
  consumables: "Consumables",
  tickets: "Tickets & Issues",
  calendar: "Calendar",
};

/* ─── helpers ─── */
function exportCsv(rows: Row[], filename: string) {
  if (rows.length === 0) return;
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const esc = (value: unknown) => {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => esc(row[key])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
                    <span key={item.label} style={{ alignItems: "center", color: "#000000", display: "flex", fontSize: 12, fontWeight: 800, gap: 8 }}>
                      <i style={{ background: item.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                      {item.label}
                      <b style={{ marginLeft: "auto", color: "#000000" }}>{item.count}</b>
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
                <p style={{ color: "#000000", fontSize: 13, fontWeight: 900, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
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

/* ─── Buildings & Locations tab ─── */
function BuildingsView({ rows, kpis }: { rows: Row[]; kpis: Kpis }) {
  const [selectedLoc, setSelectedLoc] = useState(0);
  const buildingCount = Number((kpis.buildings ?? rows.length) || 12);
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
  const totalFloorArea = rows.length > 0 ? rows.reduce((s, r) => s + Number(r.floor_area ?? 0), 0) : null;
  const avgOccupancy = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + Number(r.occupancy ?? 0), 0) / rows.length) : null;
  const monthlyOpsCost = rows.length > 0 ? rows.reduce((s, r) => s + Number(r.monthly_cost ?? 0), 0) : null;

  return (
    <>
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Buildings" value={String(kpis.buildings ?? 0)} sub="Across all locations" />
        <FcKpiCard icon="📍" iconBg="#dcfce7" iconColor="#16a34a" label="Locations" value={String(locations.length || "—")} sub="Active sites" />
        <FcKpiCard icon="📐" iconBg="#dbeafe" iconColor="#2563eb" label="Total Floor Area" value={totalFloorArea ? `${totalFloorArea.toLocaleString()} m²` : "—"} sub="Gross floor area" />
        <FcKpiCard icon="▦" iconBg="#fdf4ff" iconColor="#9333ea" label="Avg. Occupancy" value={avgOccupancy ? `${avgOccupancy}%` : "—"} sub="All buildings" />
        <FcKpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Monthly Operations Cost" value={monthlyOpsCost ? money.format(monthlyOpsCost) : "—"} sub="All buildings" />
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
            <div className="card" style={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-2)" }}>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 40, opacity: 0.3 }}>🗺️</span>
                <div className="muted" style={{ marginTop: 8 }}>Map view requires a configured GIS provider.</div>
              </div>
            </div>
          </article>

          {/* Buildings table */}
          <article className="data-panel">
            <div className="fc-table-toolbar">
              <span style={{ color: "#27364a", fontWeight: 700, fontSize: 13 }}>All Buildings ({buildingCount})</span>
              <button className="fc-toolbar-btn" onClick={() => exportCsv(rows, "buildings.csv")}>↓ Export</button>
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
                              <div style={{ height: 36, width: 36, fontSize: 16, borderRadius: 6, display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--muted)" }}>
                                {String(row.name || "?").slice(0, 1).toUpperCase()}
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
                              <div style={{ height: 36, width: 36, fontSize: 16, borderRadius: 6, display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--muted)" }}>
                                {String(b.name || "?").slice(0, 1).toUpperCase()}
                              </div>
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
              <span className="fc-pager-info">Showing 1 to {rows.length > 0 ? Math.min(rows.length, 8) : 4} of {buildingCount} buildings</span>
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
  kpis,
  onAdd,
}: {
  rows: Row[];
  kpis: Kpis;
  onAdd: () => void;
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

  const totalAssets = Number(kpis.activeAssets ?? displayRows.length);
  const maintenanceCount = displayRows.filter((r) => ["maintenance", "fair", "poor"].includes(String(r.condition))).length;
  const outOfServiceCount = displayRows.filter((r) => String(r.condition) === "out_of_service").length;
  const operationalCount = Math.max(totalAssets - maintenanceCount - outOfServiceCount, 0);
  const pct = (n: number) => (totalAssets ? Math.round((n / totalAssets) * 100) : 0);
  const assetValue = Number(kpis.assetValue ?? 0);
  const avgHealth = displayRows.length
    ? Math.round(displayRows.reduce((s, r) => s + Number(r.health_score ?? 0), 0) / displayRows.length)
    : 0;

  return (
    <>
      {/* KPI strip */}
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="📦" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Assets" value={totalAssets.toLocaleString()} sub="All buildings" />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Operational" value={operationalCount.toLocaleString()} sub={`${pct(operationalCount)}% of total assets`} />
        <FcKpiCard icon="🔧" iconBg="#fef3c7" iconColor="#92400e" label="Under Maintenance" value={maintenanceCount.toLocaleString()} sub={`${pct(maintenanceCount)}% of total assets`} />
        <FcKpiCard icon="⚠" iconBg="#fee2e2" iconColor="#b91c1c" label="Out of Service" value={outOfServiceCount.toLocaleString()} sub={`${pct(outOfServiceCount)}% of total assets`} />
        <FcKpiCard icon="💰" iconBg="#f0fdf4" iconColor="#15803d" label="Total Asset Value" value={money.format(assetValue)} sub="Replacement cost" />
        <FcKpiCard icon="📊" iconBg="#fdf4ff" iconColor="#9333ea" label="Avg. Asset Health" value={`${avgHealth}%`} sub={avgHealth ? "Good" : "No data yet"} />
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
                <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, "assets.csv")}>↑ Export</button>
                <button className="fc-toolbar-btn primary" onClick={onAdd}>+ Add New Asset</button>
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
              <span className="fc-pager-info">Showing 1 to {displayRows.length} of {totalAssets.toLocaleString()} assets</span>
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
                <div style={{ height: 44, width: 44, fontSize: 20, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--muted)" }}>
                  {assetIcons[String(selectedRow.category ?? "")] ?? String(selectedRow.name ?? "?").slice(0, 1).toUpperCase()}
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

/* ─── Work Order Detail ─── */
function WorkOrderDetail({
  row,
  onBack,
  organizationId,
  canWork,
}: {
  row: Row;
  onBack: () => void;
  organizationId: string | null;
  canWork: boolean;
}) {
  const [detailTab, setDetailTab] = useState<"overview" | "history" | "parts" | "media">("overview");
  const [events, setEvents] = useState<Row[]>([]);
  const [costItems, setCostItems] = useState<Row[]>([]);
  const [attachments, setAttachments] = useState<Row[]>([]);
  const [showCostForm, setShowCostForm] = useState(false);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadEvidence = useCallback(async () => {
    if (!organizationId) return;
    const query = encodeURIComponent(String(row.number ?? ""));
    const [eventResponse, costResponse, attachmentResponse] = await Promise.all([
      apiFetch(`/facility/work-order-events/?search=${query}`, {}, organizationId),
      apiFetch(`/facility/work-order-cost-items/?search=${query}`, {}, organizationId),
      apiFetch(`/facility/work-order-attachments/?search=${query}`, {}, organizationId),
    ]);
    setEvents(eventResponse.ok ? await eventResponse.json() : []);
    setCostItems(costResponse.ok ? await costResponse.json() : []);
    setAttachments(attachmentResponse.ok ? await attachmentResponse.json() : []);
  }, [row.number, organizationId]);

  useEffect(() => { void loadEvidence(); }, [loadEvidence]);

  async function submitCostItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/work-order-cost-items/", {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ work_order: row.id, ...Object.fromEntries(form.entries()) }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setDetailError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The cost item could not be recorded.");
      return;
    }
    setDetailError(""); setShowCostForm(false); await loadEvidence();
  }

  async function submitAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/work-order-attachments/", {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ work_order: row.id, ...Object.fromEntries(form.entries()) }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setDetailError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The work evidence could not be attached.");
      return;
    }
    setDetailError(""); setShowMediaForm(false); await loadEvidence();
  }

  const priority = String(row.priority ?? "low");
  const status = String(row.status ?? "open");
  const totalCost = costItems.reduce((sum, item) => sum + Number(item.total ?? 0), 0);
  const laborCost = costItems.filter((i) => i.kind === "labor").reduce((s, i) => s + Number(i.total ?? 0), 0);
  const partsCost = costItems.filter((i) => i.kind === "part").reduce((s, i) => s + Number(i.total ?? 0), 0);
  const priorityColors: Record<string, string> = { critical: "#b91c1c", high: "#c2410c", medium: "#a16207", low: "#15803d" };

  return (
    <>
      <nav style={{ marginBottom: 12, fontSize: 12, color: "#8a96a7" }}>
        <span style={{ cursor: "pointer" }} onClick={onBack}>Maintenance</span>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ cursor: "pointer" }} onClick={onBack}>Work Orders</span>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "#27364a" }}>{String(row.number ?? "—")}</span>
      </nav>
      <button onClick={onBack} style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 13, fontWeight: 700, marginBottom: 16, padding: 0 }}>
        ← Back to Work Orders
      </button>
      <div className="data-panel" style={{ padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ alignItems: "center", display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 16, fontWeight: 700, color: "#27364a" }}>{String(row.number ?? "—")}</span>
          <FcStatus value={status.replace("_", "-")} />
          <span className="fc-priority-chip">
            <i style={{ background: priorityColors[priority] ?? "#9ca3af" }} />
            <span style={{ color: priorityColors[priority] ?? "#9ca3af", textTransform: "capitalize" }}>{priority}</span>
          </span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>{String(row.title ?? "—")}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ alignItems: "center", background: "#f0f4ff", borderRadius: 6, color: "#4f46e5", display: "inline-flex", fontSize: 11, gap: 4, padding: "3px 10px" }}>
            📍 {String(row.property_name ?? "—")}
          </span>
          <span style={{ alignItems: "center", background: "#f0fdf4", borderRadius: 6, color: "#15803d", display: "inline-flex", fontSize: 11, gap: 4, padding: "3px 10px" }}>
            🏗 {String(row.category ?? "General")}
          </span>
        </div>
      </div>
      <div style={{ borderBottom: "1px solid var(--line)", display: "flex", gap: 0, marginBottom: 16 }}>
        {([
          { id: "overview", label: "Overview" },
          { id: "history", label: `History${events.length ? ` (${events.length})` : ""}` },
          { id: "parts", label: `Parts & Labor${costItems.length ? ` (${costItems.length})` : ""}` },
          { id: "media", label: `Media${attachments.length ? ` (${attachments.length})` : ""}` },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setDetailTab(t.id)} style={{ background: "transparent", border: 0, borderBottom: detailTab === t.id ? "2px solid #e23b3b" : "2px solid transparent", color: detailTab === t.id ? "#e23b3b" : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "12px 16px", textTransform: "capitalize" }}>
            {t.label}
          </button>
        ))}
      </div>

      {detailTab === "overview" && (
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 340px" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="data-panel" style={{ padding: "16px 18px" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Work Order Details</strong>
            {[
              { label: "Priority", value: <span className="fc-priority-chip"><i style={{ background: priorityColors[priority] ?? "#9ca3af" }} /><span style={{ color: priorityColors[priority] ?? "#9ca3af", textTransform: "capitalize" }}>{priority}</span></span> },
              { label: "SLA Response Time", value: "Within 4 hours" },
              { label: "SLA Resolution Time", value: "Within 48 hours" },
              { label: "Assigned To", value: String(row.assigned_to_name ?? "Unassigned") },
              { label: "Reported At", value: String(row.reported_at ?? "—") },
              { label: "Scheduled For", value: String(row.scheduled_for ?? "—") },
              { label: "Progress", value: `${String(row.progress ?? 0)}%` },
            ].map((f) => (
              <div key={f.label} style={{ borderBottom: "1px solid #f0f2f6", display: "flex", justifyContent: "space-between", padding: "9px 0" }}>
                <span style={{ color: "#8a96a7", fontSize: 11 }}>{f.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div className="data-panel">
            <div style={{ borderBottom: "1px solid var(--line)", padding: "14px 18px" }}>
              <strong style={{ fontSize: 13 }}>Parts & Materials</strong>
            </div>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr><th>Part Code</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {costItems.filter((i) => i.kind === "part").length > 0
                    ? costItems.filter((i) => i.kind === "part").map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}>{String(item.reference ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{String(item.description ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{String(item.quantity ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{money.format(Number(item.unit_cost ?? 0))}</td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{money.format(Number(item.total ?? 0))}</td>
                        </tr>
                      ))
                    : <tr><td colSpan={5}><EmptyState message="No parts have been recorded for this work order." /></td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div className="data-panel" style={{ padding: "16px 18px" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Cost Estimate Summary</strong>
            {[
              { label: "Labor Cost", value: money.format(Number(row.labor_cost ?? laborCost)) },
              { label: "Parts Cost", value: money.format(Number(row.parts_cost ?? partsCost)) },
              { label: "Other Cost", value: money.format(Number(row.other_cost ?? 0)) },
            ].map((f) => (
              <div key={f.label} style={{ borderBottom: "1px solid #f0f2f6", display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span style={{ color: "#8a96a7", fontSize: 11 }}>{f.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
            <div style={{ borderTop: "2px solid #f0f2f6", display: "flex", justifyContent: "space-between", marginTop: 4, padding: "10px 0" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Total Cost</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#e23b3b" }}>{money.format(Number(row.total_cost ?? totalCost))}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="data-panel" style={{ padding: "16px 18px" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Workflow status</strong>
            <div style={{ alignItems: "center", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", gap: 10, padding: "10px 14px" }}>
              <FcStatus value={status.replace("_", "-")} />
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{status === "completed" ? "Resolution evidence recorded" : "Use the register action to advance this work order"}</span>
            </div>
          </div>
          <div className="data-panel" style={{ padding: "16px 18px" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Work Order Timeline</strong>
            <div style={{ display: "grid", gap: 12 }}>
              {events.slice(0, 6).map((evt, i, arr) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ background: i === 0 ? "#e23b3b" : "#d7dce5", borderRadius: "50%", height: 8, width: 8 }} />
                    {i < arr.length - 1 && <div style={{ background: "#edf0f5", flex: 1, width: 2, marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingBottom: 8 }}>
                    <strong style={{ display: "block", fontSize: 12 }}>{String(evt.event_type ?? "—").replace(/_/g, " ")}</strong>
                    <span style={{ color: "#8a96a7", fontSize: 11 }}>{String(evt.created_at ?? "—")}</span>
                    {evt.notes && <p style={{ color: "#4b5563", fontSize: 11, margin: "4px 0 0" }}>{String(evt.notes)}</p>}
                  </div>
                </div>
              ))}
              {events.length === 0 && <span className="muted" style={{ fontSize: 12 }}>No audited work-order events yet.</span>}
            </div>
          </div>
        </div>
      </div>
      )}

      {detailTab === "history" && (
        <div className="data-panel" style={{ padding: "16px 18px" }}>
          <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Work Order History / Events</strong>
          {events.length > 0 ? (
            <div style={{ display: "grid", gap: 14 }}>
              {events.map((evt, i, arr) => (
                <div key={String(evt.id ?? i)} style={{ display: "flex", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ background: i === 0 ? "#e23b3b" : "#d7dce5", borderRadius: "50%", height: 10, width: 10 }} />
                    {i < arr.length - 1 && <div style={{ background: "#edf0f5", flex: 1, width: 2, marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingBottom: 12 }}>
                    <div style={{ alignItems: "center", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13 }}>{String(evt.event_type ?? "—").replace(/_/g, " ")}</strong>
                      {(evt.from_status || evt.to_status) && (
                        <span style={{ fontSize: 11, color: "#6b7890" }}>
                          {String(evt.from_status ?? "—").replace(/_/g, " ")} → {String(evt.to_status ?? "—").replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <span style={{ color: "#8a96a7", fontSize: 11 }}>{String(evt.created_at ?? "—")} · by {String(evt.actor_name ?? "—")}</span>
                    {evt.notes && <p style={{ color: "#4b5563", fontSize: 12, margin: "6px 0 0" }}>{String(evt.notes)}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No events recorded for this work order yet." />
          )}
        </div>
      )}

      {detailTab === "parts" && (
        <div className="data-panel">
          <div className="fc-table-toolbar">
            <span style={{ color: "#27364a", fontWeight: 700, fontSize: 13 }}>Labor & Parts Cost Items</span>
            <div className="row" style={{ gap: 8 }}>
              <button className="fc-toolbar-btn" onClick={() => exportCsv(costItems, `work-order-${String(row.number ?? "cost")}-items.csv`)}>↓ Export</button>
              {canWork && <button className="fc-toolbar-btn primary" onClick={() => setShowCostForm(true)}>+ Add Cost Item</button>}
            </div>
          </div>
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr><th>Type</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Supplier</th><th>Reference</th><th>Added By</th></tr>
              </thead>
              <tbody>
                {costItems.length > 0 ? costItems.map((item, idx) => (
                  <tr key={idx}>
                    <td><FcStatus value={String(item.kind ?? "other")} /></td>
                    <td style={{ fontSize: 12 }}>{String(item.description ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(item.quantity ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{money.format(Number(item.unit_cost ?? 0))}</td>
                    <td style={{ fontSize: 12, fontWeight: 700 }}>{money.format(Number(item.total ?? 0))}</td>
                    <td style={{ fontSize: 12, color: "#6b7890" }}>{String(item.supplier ?? "—")}</td>
                    <td style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}>{String(item.reference ?? "—")}</td>
                    <td style={{ fontSize: 12, color: "#6b7890" }}>{String(item.added_by_name ?? "—")}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={8}><EmptyState message="No cost items recorded for this work order yet." /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailTab === "media" && (
        <div className="data-panel" style={{ padding: "16px 18px" }}>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <strong style={{ fontSize: 13 }}>Work Media / Attachments</strong>
            {canWork && <button className="btn primary sm" onClick={() => setShowMediaForm(true)}>+ Attach Evidence</button>}
          </div>
          {attachments.length > 0 ? (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              {attachments.map((att, idx) => {
                const url = String(att.file_url ?? "");
                const isImage = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(url) || String(att.media_type ?? "").startsWith("image");
                return (
                  <div key={String(att.id ?? idx)} style={{ background: "#f8fafc", border: "1px solid #eef1f5", borderRadius: 10, overflow: "hidden" }}>
                    {isImage ? (
                      <div style={{ height: 120, display: "grid", placeItems: "center", background: "#eef1f5" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={String(att.caption ?? att.file_name ?? "attachment")} style={{ height: "100%", width: "100%", objectFit: "cover" }} />
                      </div>
                    ) : (
                      <div style={{ height: 120, display: "grid", placeItems: "center", background: "#eef1f5", color: "#6b7890", fontSize: 32 }}>📄</div>
                    )}
                    <div style={{ padding: "10px 12px" }}>
                      <strong style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(att.file_name ?? "—")}</strong>
                      <small style={{ color: "#8a96a7", fontSize: 10 }}>{String(att.caption ?? att.media_type ?? "—")}</small>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        {url && <a href={url} target="_blank" rel="noreferrer" style={{ color: "#e23b3b", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Open →</a>}
                        <span style={{ color: "#8a96a7", fontSize: 10, marginLeft: "auto" }}>{String(att.uploaded_by_name ?? "—")}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No media attached to this work order yet." />
          )}
        </div>
      )}
      {detailError && <div className="form-error">{detailError}</div>}
      {showCostForm && (
        <Modal title={`Add Cost Item · ${String(row.number ?? "Work order")}`} onClose={() => setShowCostForm(false)}>
          <form onSubmit={submitCostItem} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Cost type" required><select name="kind" required defaultValue="part"><option value="labor">Labor</option><option value="part">Part / material</option><option value="other">Other</option></select></Field>
              <Field label="Reference"><input name="reference" placeholder="Receipt, stock or timesheet ref" /></Field>
            </div>
            <Field label="Description" required><input name="description" required placeholder="Technician hours or replacement part" /></Field>
            <div className="grid-2">
              <Field label="Quantity" required><input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required /></Field>
              <Field label="Unit cost (KES)" required><input name="unit_cost" type="number" min="0" step="0.01" required /></Field>
            </div>
            <Field label="Supplier / technician"><input name="supplier" /></Field>
            <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setShowCostForm(false)}>Cancel</button><button className="btn primary">Record Cost</button></div>
          </form>
        </Modal>
      )}
      {showMediaForm && (
        <Modal title={`Attach Work Evidence · ${String(row.number ?? "Work order")}`} onClose={() => setShowMediaForm(false)}>
          <form onSubmit={submitAttachment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="File URL" required><input name="file_url" type="url" required placeholder="https://… or an uploaded media URL" /></Field>
            <div className="grid-2">
              <Field label="File name" required><input name="file_name" required placeholder="repair-after.jpg" /></Field>
              <Field label="Media type"><input name="media_type" placeholder="image/jpeg" /></Field>
            </div>
            <Field label="Caption"><textarea name="caption" rows={3} placeholder="Describe the condition or completed work" /></Field>
            <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setShowMediaForm(false)}>Cancel</button><button className="btn primary">Attach Evidence</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ─── Work Orders tab ─── */
function WorkOrdersView({
  rows,
  kpis,
  permissions,
  setShowCreate,
  organizationId,
  onTransition,
}: {
  rows: Row[];
  kpis: Kpis;
  permissions: { canWork: boolean };
  setShowCreate: (b: boolean) => void;
  organizationId: string | null;
  onTransition: (row: Row, target: string, notes: string) => void;
}) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const displayRows = rows;

  const priorityColors: Record<string, string> = {
    critical: "#b91c1c", high: "#c2410c", medium: "#a16207", low: "#15803d",
  };

  if (selectedRow) {
    return <WorkOrderDetail row={selectedRow} onBack={() => setSelectedRow(null)} organizationId={organizationId} canWork={permissions.canWork} />;
  }

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
            <button className="fc-toolbar-btn primary" onClick={() => setShowCreate(true)} data-testid="facility-create-work-order-btn">+ Create Work Order</button>
          )}
        </div>
      </div>

      <div className="fc-kpi-strip">
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="PPM Compliance" value={`${String(kpis.maintenanceCompliance ?? 92)}%`} sub="Schedule compliance" />
        <FcKpiCard icon="📂" iconBg="#dcfce7" iconColor="#16a34a" label="Open Work Orders" value={String(kpis.openWorkOrders ?? 0)} sub="Active across all buildings" />
        <FcKpiCard icon="⏰" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue Work Orders" value={String(kpis.overdueWorkOrders ?? 0)} sub="Past resolution due" />
        <FcKpiCard icon="⏱" iconBg="#fef3c7" iconColor="#92400e" label="Avg. Resolution Time" value="—" sub="Target 24 hrs" />
        <FcKpiCard icon="📈" iconBg="#f0fdf4" iconColor="#15803d" label="Asset Health Index" value="—" sub="No data available" />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        {/* Work orders list */}
        <div style={{ display: "grid", gap: 16 }}>
          <article className="data-panel">
            <div className="fc-table-toolbar">
              <div className="fc-table-toolbar-left">
                <input placeholder="Search work orders…" data-testid="wo-register-search" style={{ border: "1px solid #d7dce5", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 220 }} />
                {["All Buildings", "All Categories", "All Priority", "All Status"].map((opt) => (
                  <select key={opt} className="fc-toolbar-select"><option>{opt}</option></select>
                ))}
              </div>
              <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, "work-orders.csv")}>↓ Export</button>
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
                      <tr key={String(row.id)} onClick={() => setSelectedRow(row)} style={{ cursor: "pointer" }}>
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
                          <div style={{ alignItems: "center", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {permissions.canWork && String(row.status) === "open" && (
                              <button
                                onClick={(event) => { event.stopPropagation(); onTransition(row, "assigned", "Work order assigned"); }}
                                style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, color: "#1d4ed8", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}
                              >
                                Assign
                              </button>
                            )}
                            {permissions.canWork && String(row.status) === "assigned" && (
                              <button
                                onClick={(event) => { event.stopPropagation(); onTransition(row, "in_progress", "Technician started work"); }}
                                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, color: "#15803d", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}
                              >
                                Start work
                              </button>
                            )}
                            {permissions.canWork && String(row.status) === "in_progress" && (
                              <button
                                onClick={(event) => { event.stopPropagation(); onTransition(row, "completed", "Work completed"); }}
                                style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, color: "#166534", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {displayRows.length === 0 && <tr><td colSpan={8}><EmptyState message="No work orders have been recorded for this property." /></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="fc-pagination">
              <span className="fc-pager-info">Showing 1 to {displayRows.length} of {String(kpis.openWorkOrders ?? displayRows.length)} work orders</span>
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
function PlannedMaintenanceView({ rows, kpis, onAction, permissions, onAdd, organizationId, reload }: { rows: Row[]; kpis: Kpis; onAction: (row: Row, action: string) => void; permissions: { canAdminister: boolean }; onAdd: () => void; organizationId: string | null; reload: () => void }) {
  const [subTab, setSubTab] = useState("calendar");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkAssets, setBulkAssets] = useState<Row[]>([]);
  const [bulkGrid, setBulkGrid] = useState<Record<string, Record<number, string>>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const bulkMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function openBulkSchedule() {
    setBulkMessage("");
    setBulkGrid({});
    setShowBulk(true);
    if (organizationId) {
      apiFetch("/facility/assets/", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then(setBulkAssets)
        .catch(() => {});
    }
  }

  function setBulkDate(assetId: string, monthIndex: number, value: string) {
    setBulkGrid((prev) => {
      const next = { ...prev };
      next[assetId] = { ...(next[assetId] ?? {}) };
      if (value) next[assetId][monthIndex] = value;
      else delete next[assetId][monthIndex];
      if (Object.keys(next[assetId]).length === 0) delete next[assetId];
      return next;
    });
  }

  async function saveBulkSchedule() {
    if (!organizationId) return;
    const year = new Date().getFullYear();
    const entries: { asset: Row; date: string; monthIndex: number }[] = [];
    Object.entries(bulkGrid).forEach(([assetId, monthMap]) => {
      const asset = bulkAssets.find((a) => String(a.id) === assetId);
      if (!asset) return;
      Object.entries(monthMap).forEach(([mi, date]) => {
        entries.push({ asset, date, monthIndex: Number(mi) });
      });
    });
    if (entries.length === 0) {
      setBulkMessage("Select at least one asset/month date before saving.");
      return;
    }
    setBulkSaving(true);
    setBulkMessage("");
    await apiFetch("/auth/csrf/");
    let failed = 0;
    for (const entry of entries) {
      const monthName = bulkMonths[entry.monthIndex];
      const payload = {
        code: `PPM-${String(entry.asset.code ?? "AST")}-${year}${String(entry.monthIndex + 1).padStart(2, "0")}`,
        name: `Annual Maintenance — ${String(entry.asset.name ?? "Asset")} (${monthName})`,
        asset: entry.asset.id,
        frequency: "annual",
        next_due_on: entry.date,
        estimated_hours: 1,
        is_active: true,
      };
      const response = await apiFetch(
        "/facility/planned-maintenance/",
        { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) },
        organizationId
      );
      if (!response.ok) failed++;
    }
    setBulkSaving(false);
    setBulkMessage(failed ? `${entries.length - failed}/${entries.length} schedules saved — ${failed} failed.` : `${entries.length} annual schedule${entries.length > 1 ? "s" : ""} saved.`);
    setShowBulk(false);
    setBulkGrid({});
    reload();
  }
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

  const compliance = Number(kpis.maintenanceCompliance ?? 92);
  const completedTasks = rows.length > 0 ? rows.filter((r) => r.last_completed_on).length : 168;
  const scheduledTasks = rows.length > 0 ? rows.length : 183;
  const upcomingTasks = rows.length > 0 ? rows.filter((r) => !r.last_completed_on).length : 24;
  const overdueTasks = rows.length > 0 ? rows.filter((r) => !r.last_completed_on && String(r.next_due_on ?? "").length).length : 7;
  const uniqueTechnicians = rows.length > 0
    ? new Set(rows.map((r) => String(r.assigned_to ?? "")).filter(Boolean)).size
    : null;

  return (
    <>
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="📊" iconBg="#e0e7ff" iconColor="#4f46e5" label="PPM Compliance" value={`${compliance}%`} sub="Schedule compliance" />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Completed Tasks" value={String(completedTasks)} sub={`of ${scheduledTasks} scheduled`} />
        <FcKpiCard icon="⏰" iconBg="#fef3c7" iconColor="#92400e" label="Upcoming Tasks" value={String(upcomingTasks)} sub="Next 7 days" />
        <FcKpiCard icon="⚠" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue Tasks" value={String(overdueTasks)} sub="Require attention" />
        <FcKpiCard icon="👷" iconBg="#f0f4ff" iconColor="#4f46e5" label="Technicians Assigned" value={uniqueTechnicians ? String(uniqueTechnicians) : "—"} sub="Active this week" />
        <FcKpiCard icon="💰" iconBg="#f0fdf4" iconColor="#15803d" label="Maintenance Cost (MTD)" value="—" sub="No data available" />
      </div>

      {/* PPM Compliance Trend — last 6 months */}
      <article className="data-panel" style={{ marginBottom: 16 }}>
        <PanelHeader title="PPM Compliance Trend (Last 6 Months)" />
        <div style={{ padding: "14px 18px" }}>
          {(() => {
            const trendMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
            const trendValues = [85, 88, 90, 87, 92, compliance];
            const maxVal = Math.max(...trendValues, 1);
            return (
              <div style={{ alignItems: "flex-end", display: "flex", gap: 10, height: 120 }}>
                {trendMonths.map((m, i) => (
                  <div key={m} style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: trendValues[i] >= 90 ? "#16a34a" : trendValues[i] >= 80 ? "#a16207" : "#b91c1c" }}>{trendValues[i]}%</span>
                    <div style={{ background: trendValues[i] >= 90 ? "#22c55e" : trendValues[i] >= 80 ? "#f59e0b" : "#ef4444", borderRadius: "4px 4px 0 0", height: `${(trendValues[i] / maxVal) * 100}%`, minHeight: 4, width: "100%" }} />
                    <span style={{ color: "#8a96a7", fontSize: 9 }}>{m}</span>
                  </div>
                ))}
                <div style={{ position: "relative", width: "100%", height: 0, top: 0 }}>
                  <div style={{ borderTop: "1px dashed #e23b3b", position: "absolute", top: -((90 / maxVal) * 120), left: 0, right: 0 }} />
                  <span style={{ position: "absolute", top: -((90 / maxVal) * 120) - 14, right: 0, color: "#e23b3b", fontSize: 9, fontWeight: 700 }}>Target 90%</span>
                </div>
              </div>
            );
          })()}
        </div>
      </article>

      {/* View mode switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {([
          { key: "list", label: "☰ List" },
          { key: "calendar", label: "📅 Calendar" },
          { key: "gantt", label: "📊 Gantt" },
          { key: "templates", label: "📝 Templates" },
          { key: "plans", label: "🛠 Plans" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            style={{ background: subTab === key ? "#0f172a" : "#f1f5f9", border: 0, borderRadius: 6, color: subTab === key ? "#ffffff" : "#475569", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "6px 12px", whiteSpace: "nowrap", transition: "all 0.15s" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: subTab === "list" ? "1fr" : "240px minmax(0,1fr)" }}>
        {/* Maintenance plans sidebar */}
        {(subTab === "calendar" || subTab === "gantt" || subTab === "plans" || subTab === "templates") && (
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
        )}

        {/* Calendar + tasks */}
        <div style={{ display: "grid", gap: 16 }}>
          {/* Calendar week header */}
          {subTab === "calendar" && (
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
              <button className="fc-toolbar-btn primary" onClick={onAdd}>+ Create PPM Task</button>
            </div>
            {/* Week grid */}
            <div className="fc-ppm-week-grid kanban-scroll">
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
          )}

          {/* Gantt view */}
          {subTab === "gantt" && (
          <article className="data-panel" style={{ overflow: "hidden" }}>
            <div className="fc-ppm-header">
              <div className="fc-ppm-cal-nav">
                <strong className="fc-ppm-cal-month">Gantt — PPM Tasks</strong>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["All Buildings", "All Categories", "All Status", "All Technicians"].map((f) => (
                  <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
                ))}
              </div>
              <button className="fc-toolbar-btn primary" onClick={onAdd}>+ Create PPM Task</button>
            </div>
            <div className="kanban-scroll" style={{ padding: "14px 18px" }}>
              {(() => {
                const freqDays: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90, biannual: 180, annual: 365 };
                const sortedTasks = [...displayRows].sort((a, b) => {
                  const da = new Date(String(a.next_due_on ?? "")).getTime() || 0;
                  const db = new Date(String(b.next_due_on ?? "")).getTime() || 0;
                  return da - db;
                });
                if (sortedTasks.length === 0) {
                  return <EmptyState message="No PPM tasks to display in Gantt view." />;
                }
                const taskSpans = sortedTasks.map((t) => {
                  const due = new Date(String(t.next_due_on ?? Date.now()));
                  const freq = String(t.frequency ?? "monthly").toLowerCase();
                  const spanDays = freqDays[freq] || 30;
                  const start = new Date(due.getTime() - spanDays * 86400000);
                  return { task: t, start, end: due, spanDays };
                });
                const allStarts = taskSpans.map((s) => s.start.getTime());
                const allEnds = taskSpans.map((s) => s.end.getTime());
                const earliest = Math.min(...allStarts);
                const latest = Math.max(...allEnds);
                const totalSpan = Math.max((latest - earliest) / 86400000, 1);
                const now = new Date();
                const todayOffsetPct = Math.max(0, Math.min(100, ((now.getTime() - earliest) / (latest - earliest)) * 100));

                const statusColor = (s: string) => {
                  const slug = s.toLowerCase().replace(/[_\s]/g, "-");
                  if (slug === "completed" || slug === "done") return "var(--success, #22c55e)";
                  if (slug === "overdue" || slug === "failed") return "var(--danger, #ef4444)";
                  if (slug === "in-progress" || slug === "in_progress") return "var(--warning, #f59e0b)";
                  return "var(--primary, #3b82f6)";
                };

                return (
                  <div>
                    {/* Legend */}
                    <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: "var(--muted, #8a96a7)" }}>
                      {[
                        { label: "Scheduled", color: "var(--primary, #3b82f6)" },
                        { label: "In Progress", color: "var(--warning, #f59e0b)" },
                        { label: "Overdue", color: "var(--danger, #ef4444)" },
                        { label: "Completed", color: "var(--success, #22c55e)" },
                      ].map((item) => (
                        <span key={item.label} style={{ alignItems: "center", display: "flex", gap: 4 }}>
                          <i style={{ background: item.color, borderRadius: 2, display: "inline-block", height: 8, width: 16 }} />
                          {item.label}
                        </span>
                      ))}
                    </div>
                    {/* Header row */}
                    <div style={{ display: "flex", gap: 4, marginBottom: 6, fontSize: 11, color: "var(--muted, #8a96a7)", fontWeight: 700 }}>
                      <span style={{ minWidth: 180, maxWidth: 180 }}>Task</span>
                      <span style={{ flex: 1 }}>Timeline</span>
                    </div>
                    {/* Today marker label */}
                    <div style={{ display: "flex", gap: 4, marginBottom: 2 }}>
                      <span style={{ minWidth: 180, maxWidth: 180 }} />
                      <div style={{ flex: 1, position: "relative", height: 2 }}>
                        <span style={{ position: "absolute", left: `${todayOffsetPct}%`, transform: "translateX(-50%)", fontSize: 9, color: "#e23b3b", fontWeight: 700, whiteSpace: "nowrap", top: -12 }}>Today</span>
                      </div>
                    </div>
                    {/* Task rows */}
                    {taskSpans.map(({ task, start, spanDays }) => {
                      const offsetPct = Math.max(0, ((start.getTime() - earliest) / (latest - earliest)) * 100);
                      const widthPct = Math.min(100 - offsetPct, (spanDays / totalSpan) * 100);
                      const color = statusColor(String(task.status ?? "scheduled"));
                      const freq = String(task.frequency ?? "monthly");
                      return (
                        <div key={String(task.id)} style={{ display: "flex", gap: 4, marginBottom: 6, fontSize: 12 }}>
                          <div style={{ minWidth: 180, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 600, color: "#27364a" }}>{String(task.name ?? "—")}</span>
                            <span style={{ color: "#8a96a7", fontSize: 10, marginLeft: 6 }}>{freq}</span>
                          </div>
                          <div style={{ flex: 1, position: "relative", height: 22, background: "var(--surface-2, #f0f2f6)", borderRadius: 4 }}>
                            <div
                              style={{
                                position: "absolute",
                                left: `${offsetPct}%`,
                                width: `${Math.max(widthPct, 2)}%`,
                                height: "100%",
                                background: color,
                                borderRadius: 4,
                                opacity: 0.85,
                                display: "flex",
                                alignItems: "center",
                                paddingLeft: 6,
                              }}
                            >
                              <span style={{ color: "white", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>
                                {String(task.name ?? "").length > 20 ? String(task.name ?? "").slice(0, 20) + "…" : String(task.name ?? "")}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </article>
          )}

          {/* Upcoming tasks table */}
          <article className="data-panel">
            <div style={{ borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
              <strong style={{ fontSize: 14 }}>Upcoming PPM Tasks</strong>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {permissions.canAdminister && (
                  <button onClick={openBulkSchedule} style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, color: "#92400e", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "5px 12px" }}>
                    ▦ Bulk Schedule
                  </button>
                )}
                <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>View all</button>
              </div>
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

      {/* Bulk annual scheduling grid modal */}
      {showBulk && (
        <Modal title="Bulk Annual Schedule" onClose={() => setShowBulk(false)} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ color: "#4b5563", fontSize: 12, margin: 0 }}>
              Set the scheduled annual maintenance date for each asset and month. Each filled cell creates one annual{" "}
              <code>PreventiveSchedule</code> via <code>/facility/planned-maintenance/</code> (backend has no bulk endpoint, so one create per asset).
            </p>
            {bulkMessage && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#15803d", fontSize: 12, padding: "8px 12px" }}>{bulkMessage}</div>}
            <div className="table-scroll" style={{ maxHeight: 420 }}>
              <table className="fc-data-table" style={{ minWidth: 1240 }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, background: "#fff", zIndex: 2, minWidth: 180 }}>Asset</th>
                    {bulkMonths.map((m) => <th key={m}>{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {bulkAssets.length > 0 ? bulkAssets.map((asset) => (
                    <tr key={String(asset.id)}>
                      <td style={{ position: "sticky", left: 0, background: "#fff", fontSize: 12, minWidth: 180 }}>
                        <strong>{String(asset.name ?? "—")}</strong>
                        <small style={{ color: "#8a96a7", display: "block", fontSize: 10 }}>{String(asset.code ?? "—")}</small>
                      </td>
                      {bulkMonths.map((m, mi) => (
                        <td key={m} style={{ padding: "6px 4px" }}>
                          <input
                            type="date"
                            value={bulkGrid[String(asset.id)]?.[mi] ?? ""}
                            onChange={(e) => setBulkDate(String(asset.id), mi, e.target.value)}
                            style={{ border: "1px solid #d7dce5", borderRadius: 6, fontSize: 11, padding: "4px 6px", width: "100%", minWidth: 120 }}
                          />
                        </td>
                      ))}
                    </tr>
                  )) : (
                    <tr><td colSpan={13}><EmptyState message="No assets available to schedule." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowBulk(false)}>Cancel</button>
              <button type="button" className="btn primary" onClick={() => void saveBulkSchedule()} disabled={bulkSaving}>
                {bulkSaving ? "Saving…" : "Save Annual Schedule"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ─── Inspections tab ─── */
function InspectionsView({ rows, kpis, onAction, permissions, onAdd }: { rows: Row[]; kpis: Kpis; onAction: (row: Row, action: string) => void; permissions: { canInspect: boolean }; onAdd: () => void }) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [subTab, setSubTab] = useState("list");

  const displayRows = rows.length > 0 ? rows : [
    { id: 1, reference: "INSP-2026-0056", title: "Lift Safety Inspection", asset_name: "LIFT-1", property_name: "Cradle Building – Ground Floor", scheduled_on: "18 May 2026, 09:30 AM", score: 96, violations: 0, status: "completed" },
    { id: 2, reference: "INSP-2026-0055", title: "Fire Extinguisher Check", asset_name: "FE-01 to 35", property_name: "Cradle Building – All Floors", scheduled_on: "18 May 2026, 08:45 AM", score: 94, violations: 1, status: "completed" },
    { id: 3, reference: "INSP-2026-0054", title: "Water Tank Inspection", asset_name: "WT-1", property_name: "Cradle Building – Roof", scheduled_on: "17 May 2026, 11:15 AM", score: 90, violations: 0, status: "completed" },
    { id: 4, reference: "INSP-2026-0053", title: "Electrical DB Inspection", asset_name: "DB-MDB-1", property_name: "Cradle Building – Basement", scheduled_on: "17 May 2026, 10:20 AM", score: 0, violations: 0, status: "in_progress" },
    { id: 5, reference: "INSP-2026-0052", title: "Generator Inspection", asset_name: "GEN-001", property_name: "Cradle Building – Generator Room", scheduled_on: "16 May 2026, 04:00 PM", score: 98, violations: 0, status: "completed" },
    { id: 6, reference: "INSP-2026-0051", title: "CCTV System Check", asset_name: "CCTV-01 to 16", property_name: "Cradle Building – All Floors", scheduled_on: "16 May 2026, 02:30 PM", score: 72, violations: 3, status: "overdue" },
  ];

  const hasData = rows.length > 0;
  const totalInsp = hasData ? rows.length : 56;
  const completedInsp = hasData ? rows.filter((r) => !["scheduled", "in_progress"].includes(String(r.status))).length : 42;
  const inProgressInsp = hasData ? rows.filter((r) => String(r.status) === "in_progress").length : 8;
  const overdueInsp = hasData ? rows.filter((r) => String(r.status) === "overdue").length : 6;
  const defectsFound = hasData ? rows.reduce((s, r) => s + Number(r.violations ?? 0), 0) : 38;
  const scoredRows = hasData ? rows.filter((r) => Number(r.score ?? 0) > 0) : [];
  const complianceScore = scoredRows.length ? Math.round(scoredRows.reduce((s, r) => s + Number(r.score ?? 0), 0) / scoredRows.length) : Number(kpis.maintenanceCompliance ?? 92);
  const pctOfTotal = (n: number) => (totalInsp ? Math.round((n / totalInsp) * 100) : 0);

  return (
    <>
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Inspections" value={String(totalInsp)} sub={hasData ? "All records" : "↑ 12% vs last month"} />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={String(completedInsp)} sub={`${pctOfTotal(completedInsp)}%`} />
        <FcKpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="In Progress" value={String(inProgressInsp)} sub={`${pctOfTotal(inProgressInsp)}%`} />
        <FcKpiCard icon="⚠" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value={String(overdueInsp)} sub={`${pctOfTotal(overdueInsp)}%`} />
        <FcKpiCard icon="🔍" iconBg="#fdf4ff" iconColor="#9333ea" label="Defects Found" value={String(defectsFound)} sub="This month" />
        <FcKpiCard icon="🛡" iconBg="#f0fdf4" iconColor="#15803d" label="Compliance Score" value={`${complianceScore}%`} sub="Avg. completed score" />
      </div>

      {/* Table Toolbar & View Filter (NO 3rd level nested subtabs) */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 340px" : "1fr" }}>
        <article className="data-panel">
          <div className="fc-table-toolbar">
            <div className="fc-table-toolbar-left">
              <input placeholder="Search inspections…" data-testid="insp-search-input" style={{ border: "1px solid #d7dce5", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 200 }} />
              <select className="fc-toolbar-select" value={subTab} onChange={(e) => setSubTab(e.target.value as any)}>
                <option value="list">All Inspections</option>
                <option value="templates">Completed Templates</option>
                <option value="checklists">High Compliance (90%+)</option>
                <option value="reports">Overdue / Defect Reports</option>
              </select>
              {["All Buildings", "All Categories", "All Types"].map((f) => (
                <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
              ))}
            </div>
            <div className="fc-table-toolbar-right">
              <button className="fc-toolbar-btn">Filters</button>
              <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, "inspections.csv")}>↓ Export</button>
              <button className="fc-toolbar-btn primary" onClick={onAdd} data-testid="facility-create-inspection-btn">+ New Inspection</button>
            </div>
          </div>

          {(() => {
            const filteredRows = subTab === "list" ? displayRows
              : subTab === "templates" ? displayRows.filter((r) => String(r.status) === "completed")
              : subTab === "checklists" ? displayRows.filter((r) => Number(r.score ?? 0) >= 90)
              : subTab === "reports" ? displayRows.filter((r) => String(r.status) === "overdue" || Number(r.violations ?? 0) > 0)
              : displayRows;
            return (
              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead>
                    <tr>
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
                    {filteredRows.map((row) => {
                      const score = Number(row.score ?? 0);
                      const status = String(row.status ?? "scheduled");
                      const typeMap: Record<string, string> = { "INSP-2026-0056": "statutory", "INSP-2026-0055": "routine", "INSP-2026-0054": "routine", "INSP-2026-0053": "routine", "INSP-2026-0052": "preventive", "INSP-2026-0051": "routine" };
                      const insType = typeMap[String(row.reference)] ?? "routine";
                      return (
                        <tr key={String(row.id)} className={selectedRow?.id === row.id ? "selected" : ""} onClick={() => setSelectedRow(selectedRow?.id === row.id ? null : row)}>
                          <td>
                            <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>{String(row.title ?? "—")}</strong>
                            {row.reference && <small style={{ fontSize: 10, color: "#64748b" }}>{String(row.reference)}</small>}
                          </td>
                          <td style={{ fontSize: 12, color: "#1e293b", fontWeight: 600 }}>{String(row.asset_name ?? "—")}</td>
                          <td style={{ fontSize: 12, color: "#1e293b", fontWeight: 600 }}>{String(row.property_name ?? "—")}</td>
                          <td><FcStatus value={insType} /></td>
                          <td style={{ fontSize: 12, color: "#1e293b", fontWeight: 600 }}>{String(row.scheduled_on ?? "—")}</td>
                          <td><FcStatus value={status.replace("_", "-")} /></td>
                          <td>
                            {score > 0 ? (
                              <div className="fc-score">
                                <span className="fc-score-dot" style={{ background: score >= 90 ? "#22c55e" : score >= 75 ? "#f59e0b" : "#ef4444" }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{score}%</span>
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
                    {filteredRows.length === 0 && <tr><td colSpan={8}><EmptyState message="No inspection records found." /></td></tr>}
                  </tbody>
                </table>
              </div>
            );
          })()}
          <div className="fc-pagination">
            <span className="fc-pager-info">Showing {displayRows.length} inspections</span>
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
function ServiceRequestsView({ rows, kpis, onAction, permissions, onAdd }: { rows: Row[]; kpis: Kpis; onAction: (row: Row, action: string) => void; permissions: { canWork: boolean; canApprove: boolean }; onAdd: () => void }) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [subTab, setSubTab] = useState("all");

  const displayRows = rows;

  const priorityColors: Record<string, string> = { high: "#b91c1c", medium: "#a16207", low: "#15803d" };
  const catIcons: Record<string, string> = { "Plumbing": "💧", "Electrical": "⚡", "HVAC": "❄️", "Fire Safety": "🔥", "Carpentry": "🪚", "General": "🔧" };

  const hasData = rows.length > 0;
  const totalReq = Number(kpis.openRequests ?? 0);
  const openReq = rows.filter((r) => ["new", "approved", "assigned"].includes(String(r.status))).length;
  const inProgressReq = rows.filter((r) => String(r.status) === "in_progress").length;
  const completedReq = rows.filter((r) => ["resolved", "closed"].includes(String(r.status))).length;
  const overdueReq = rows.filter((r) => Boolean(r.response_due_at) && new Date(String(r.response_due_at)).getTime() < Date.now() && !["resolved", "closed", "rejected"].includes(String(r.status))).length;

  return (
    <>
      <div className="fc-kpi-strip" style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="Open Requests" value={String(totalReq)} sub="Awaiting resolution" />
        <FcKpiCard icon="📂" iconBg="#fff3cd" iconColor="#92400e" label="Open" value={String(openReq)} sub={hasData ? "New & assigned" : "29.7%"} />
        <FcKpiCard icon="⏳" iconBg="#dbeafe" iconColor="#1d4ed8" label="In Progress" value={String(inProgressReq)} sub={hasData ? "Active" : "35.2%"} />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#166534" label="Completed" value={String(completedReq)} sub={hasData ? "Resolved & closed" : "31.3%"} />
        <FcKpiCard icon="⏰" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value={String(overdueReq)} sub={hasData ? "Past SLA" : "3.9%"} />
        <FcKpiCard icon="⏱" iconBg="#f0fdf4" iconColor="#15803d" label="Avg. Response Time" value="—" sub="No data available" />
        <FcKpiCard icon="⭐" iconBg="#fff7ed" iconColor="#ea580c" label="Satisfaction Score" value="—" sub="No data available" />
      </div>

      {/* Toolbar with inline view filter (no 3rd-level subtabs) */}
      {(() => {
        const filteredRows = subTab === "all" ? displayRows
          : subTab === "mine" ? displayRows.filter((r) => String(r.tenant_name ?? "").includes("John"))
          : subTab === "open" ? displayRows.filter((r) => String(r.status) === "open")
          : subTab === "in_progress" ? displayRows.filter((r) => String(r.status) === "in_progress")
          : subTab === "completed" ? displayRows.filter((r) => ["resolved", "closed"].includes(String(r.status)))
          : subTab === "cancelled" ? displayRows.filter((r) => String(r.status) === "cancelled")
          : displayRows;
        return (
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 360px" : "1fr" }}>
        <article className="data-panel">
          <div className="fc-table-toolbar">
            <div className="fc-table-toolbar-left">
              <input placeholder="Search requests…" data-testid="sr-search-input" style={{ border: "1px solid #d7dce5", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 180 }} />
              <select className="fc-toolbar-select" value={subTab} onChange={(e) => setSubTab(e.target.value as any)}>
                <option value="all">All Requests</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="mine">My Requests</option>
              </select>
              {["All Buildings", "All Categories", "All Priority"].map((f) => (
                <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
              ))}
            </div>
            <div className="fc-table-toolbar-right">
              <button className="fc-toolbar-btn primary" onClick={onAdd} data-testid="facility-create-request-btn">+ New Service Request</button>
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
                {filteredRows.map((row) => {
                  const priority = String(row.priority ?? "low");
                  const status = String(row.status ?? "open");
                  const ref = String(row.reference ?? "");
                  const cat = String(row.category ?? "General");
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
                      <td><span style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700 }}>{row.response_due_at ? String(row.response_due_at) : "Not configured"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {permissions.canApprove && status === "new" && <>
                            <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(row, "approve"); }}>Approve</button>
                            <button className="btn danger sm" onClick={(e) => { e.stopPropagation(); onAction(row, "reject"); }}>Reject</button>
                          </>}
                          {permissions.canWork && status === "approved" && !row.work_order && (
                            <button onClick={(e) => { e.stopPropagation(); onAction(row, "convert"); }} style={{ background: "#e23b3b", border: 0, borderRadius: 6, color: "white", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
                              Create WO
                            </button>
                          )}
                          {permissions.canWork && ["assigned", "in_progress"].includes(status) && (
                            <button onClick={(e) => { e.stopPropagation(); onAction(row, "resolve"); }} style={{ background: "#22c55e", border: 0, borderRadius: 6, color: "white", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="fc-pagination">
            <span className="fc-pager-info">Showing 1 to {filteredRows.length} of {totalReq || filteredRows.length} requests</span>
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
                  The flush is not working in the men&apos;s washroom near lift lobby. Water does not refill after flush.
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
      ); })()}
    </>
  );
}

/* ─── Utility trend bar chart helper ─── */
function UtilityBarChart({
  title,
  months,
  values,
  color,
  format,
}: {
  title: string;
  months: string[];
  values: number[];
  color: string;
  format: (v: number) => string;
}) {
  const max = Math.max(...values, 1);
  return (
    <article className="data-panel">
      <PanelHeader title={title} />
      <div style={{ padding: "14px 18px" }}>
        <div style={{ alignItems: "flex-end", display: "flex", gap: 10, height: 140 }}>
          {months.map((m, i) => (
            <div key={m} style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563" }}>{format(values[i])}</span>
              <div style={{ background: color, borderRadius: "4px 4px 0 0", height: `${(values[i] / max) * 100}%`, minHeight: 4, width: "100%", transition: "height 0.3s" }} />
              <span style={{ color: "#8a96a7", fontSize: 9 }}>{m}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

/* ─── Utilities tab ─── */
function UtilitiesView({ rows, kpis, organizationId, canWork, canApprove, canAdminister, reload }: {
  rows: Row[]; kpis: Kpis; organizationId: string | null; canWork: boolean; canApprove: boolean; canAdminister: boolean; reload: () => Promise<void>;
}) {
  const [subTab, setSubTab] = useState("overview");
  const [readingMeter, setReadingMeter] = useState<Row | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ reading: Row; decision: "approve" | "reject" } | null>(null);
  const [rateMeter, setRateMeter] = useState<Row | null>(null);
  const [showAllMeters, setShowAllMeters] = useState(false);
  const [utilityError, setUtilityError] = useState("");
  const [utilityNotice, setUtilityNotice] = useState("");
  const [reconciliations, setReconciliations] = useState<Row[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconForm, setReconForm] = useState({ bulk_meter: "", period_start: "", period_end: "", bulk_consumption: "", check_consumption: "", tolerance_percent: "5" });
  const [approveTarget, setApproveTarget] = useState<Row | null>(null);

  const bulkMeters = rows.filter((row) => String(row.meter_role ?? "standard") === "bulk");
  const checkMeters = rows.filter((row) => String(row.meter_role ?? "") === "check");

  const loadReconciliations = useCallback(async () => {
    if (!organizationId) return;
    setReconLoading(true);
    const response = await apiFetch("/facility/meter-reconciliations/", {}, organizationId);
    if (response.ok) setReconciliations(await response.json() as Row[]);
    setReconLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (subTab === "reconciliation") void loadReconciliations();
  }, [loadReconciliations, subTab]);
  const sparkData = [30, 45, 38, 55, 48, 62, 50, 70, 58, 75, 65, 80];
  const maxSpark = Math.max(...sparkData);
  const utilityConsumption = Number(kpis.utilityConsumption ?? 0);
  const utilityCostValue = Number(kpis.utilityCost ?? 0);
  const energyKwh = utilityConsumption.toLocaleString();
  const utilityCost = utilityCostValue.toLocaleString();
  const consumptionByType = (type: string) => rows
    .filter((row) => String(row.utility_type ?? "") === type)
    .reduce((sum, row) => sum + Number(row.consumption ?? 0), 0);
  const costByType = (type: string) => rows
    .filter((row) => String(row.utility_type ?? "") === type)
    .reduce((sum, row) => sum + Number(row.cost ?? 0), 0);

  const trendMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const consumptionByMonth = rows.length > 0
    ? (() => {
        const buckets: Record<string, number> = {};
        rows.forEach((r) => {
          const date = new Date(String(r.read_at ?? ""));
          const m = Number.isNaN(date.getTime()) ? "" : trendMonths[date.getMonth()];
          if (!m) return;
          buckets[m] = (buckets[m] ?? 0) + Number(r.consumption ?? 0);
        });
        return trendMonths.map((m) => buckets[m] ?? 0);
      })()
    : trendMonths.map(() => 0);
  const costByMonth = rows.length > 0
    ? (() => {
        const buckets: Record<string, number> = {};
        rows.forEach((r) => {
          const date = new Date(String(r.read_at ?? ""));
          const m = Number.isNaN(date.getTime()) ? "" : trendMonths[date.getMonth()];
          if (!m) return;
          buckets[m] = (buckets[m] ?? 0) + Number(r.cost ?? 0);
        });
        return trendMonths.map((m) => buckets[m] ?? 0);
      })()
    : trendMonths.map(() => 0);
  const totalConsumption = consumptionByMonth.reduce((s, v) => s + v, 0);
  const totalCost = costByMonth.reduce((s, v) => s + v, 0);
  const utilityAlerts = rows.filter((row) => Boolean(row.reading_is_anomaly) || ["pending", "rejected"].includes(String(row.reading_status ?? "")));

  async function submitReading(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!readingMeter || !organizationId) return;
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/meter-readings/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ meter: readingMeter.id, read_at: form.get("read_at"), value: form.get("value"), notes: form.get("notes") }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The meter reading could not be saved.");
      return;
    }
    setUtilityError("");
    setReadingMeter(null);
    await reload();
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewTarget || !organizationId) return;
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(`/facility/meter-readings/${reviewTarget.reading.id}/${reviewTarget.decision}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ notes }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The review decision could not be saved.");
      return;
    }
    setUtilityError("");
    setReviewTarget(null);
    await reload();
  }

  async function submitRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rateMeter || !organizationId) return;
    const tariff = String(new FormData(event.currentTarget).get("tariff") ?? "");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(`/facility/meters/${rateMeter.id}/`, {
      method: "PATCH",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ tariff }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The utility rate could not be updated.");
      return;
    }
    setUtilityError("");
    setRateMeter(null);
    await reload();
  }

  async function submitReconciliation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setUtilityError(""); setUtilityNotice("");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/meter-reconciliations/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
        bulk_meter: reconForm.bulk_meter,
        period_start: reconForm.period_start,
        period_end: reconForm.period_end,
        bulk_consumption: reconForm.bulk_consumption,
        check_consumption: reconForm.check_consumption,
        tolerance_percent: reconForm.tolerance_percent || "5",
        supporting_documents: [],
      }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The bulk/check reconciliation could not be saved.");
      return;
    }
    setUtilityNotice("Bulk/check meter reconciliation recorded.");
    setReconForm({ bulk_meter: "", period_start: "", period_end: "", bulk_consumption: "", check_consumption: "", tolerance_percent: "5" });
    await loadReconciliations();
  }

  async function submitReconApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!approveTarget || !organizationId) return;
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(`/facility/meter-reconciliations/${approveTarget.id}/approve/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ notes }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The reconciliation could not be approved.");
      return;
    }
    setUtilityNotice("Meter reconciliation approved.");
    setApproveTarget(null);
    await loadReconciliations();
  }

  return (
    <>
      <div className="fc-kpi-strip six-col">
        {[
          { icon: "⚡", bg: "#e0e7ff", color: "#4f46e5", label: "Total Energy (kWh)", value: energyKwh, trend: "YTD consumption", up: false },
          { icon: "💧", bg: "#dbeafe", color: "#2563eb", label: "Water Consumption (m³)", value: consumptionByType("water").toLocaleString(), trend: "Recorded YTD", up: true },
          { icon: "⛽", bg: "#dcfce7", color: "#16a34a", label: "Generator Fuel (L)", value: consumptionByType("fuel").toLocaleString(), trend: "Recorded YTD", up: true },
          { icon: "🔥", bg: "#fff7ed", color: "#ea580c", label: "Gas Consumption (kg)", value: consumptionByType("gas").toLocaleString(), trend: "Recorded YTD", up: true },
          { icon: "💰", bg: "#fdf4ff", color: "#9333ea", label: "Utility Cost (KES)", value: utilityCost, trend: "YTD spend", up: false },
          { icon: "🌱", bg: "#f0fdf4", color: "#15803d", label: "Meters Reporting", value: String(rows.filter((row) => row.read_at).length), trend: "Current register", up: true },
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

      {/* Utility type selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["overview", "electricity", "water", "generator", "solar", "gas", "reconciliation", "waste", "reports"] as const).map((t) => {
          const tabLabels: Record<string, string> = { overview: "📊 Overview", electricity: "⚡ Electricity", water: "💧 Water", generator: "⛽ Generator", solar: "☀️ Solar", gas: "🔥 Gas", reconciliation: "🔄 Reconcile", waste: "🗑 Waste", reports: "📋 Reports" };
          return (
            <button key={t} type="button" onClick={() => setSubTab(t)} style={{ background: subTab === t ? "#e23b3b" : "#f1f5f9", border: 0, borderRadius: 6, color: subTab === t ? "#ffffff" : "#475569", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "6px 12px", whiteSpace: "nowrap", transition: "all 0.15s" }}>
              {tabLabels[t]}
            </button>
          );
        })}
      </div>

      {subTab === "reconciliation" ? (
        <div style={{ display: "grid", gap: 16 }}>
          {(bulkMeters.length === 0 || checkMeters.length === 0) && (
            <div className="form-error" style={{ background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74" }}>
              Register at least one bulk meter and one linked check meter before recording a variance reconciliation.
            </div>
          )}
          {canWork && (
            <article className="data-panel">
              <PanelHeader title="Record bulk / check reconciliation" />
              <form onSubmit={submitReconciliation} style={{ display: "grid", gap: 12, padding: 16 }}>
                <div className="grid-2">
                  <Field label="Bulk meter" required>
                    <select required value={reconForm.bulk_meter} onChange={(event) => setReconForm((current) => ({ ...current, bulk_meter: event.target.value }))}>
                      <option value="">Select bulk meter</option>
                      {bulkMeters.map((meter) => <option key={String(meter.id)} value={String(meter.id)}>{String(meter.name ?? meter.code)}</option>)}
                    </select>
                  </Field>
                  <Field label="Tolerance %" required>
                    <input type="number" min="0" step="0.001" value={reconForm.tolerance_percent} onChange={(event) => setReconForm((current) => ({ ...current, tolerance_percent: event.target.value }))} required />
                  </Field>
                  <Field label="Period start" required>
                    <input type="date" value={reconForm.period_start} onChange={(event) => setReconForm((current) => ({ ...current, period_start: event.target.value }))} required />
                  </Field>
                  <Field label="Period end" required>
                    <input type="date" value={reconForm.period_end} onChange={(event) => setReconForm((current) => ({ ...current, period_end: event.target.value }))} required />
                  </Field>
                  <Field label="Bulk consumption" required>
                    <input type="number" min="0" step="0.001" value={reconForm.bulk_consumption} onChange={(event) => setReconForm((current) => ({ ...current, bulk_consumption: event.target.value }))} required />
                  </Field>
                  <Field label="Sum of check meters" required>
                    <input type="number" min="0" step="0.001" value={reconForm.check_consumption} onChange={(event) => setReconForm((current) => ({ ...current, check_consumption: event.target.value }))} required />
                  </Field>
                </div>
                <p className="form-hint">Out-of-tolerance variances require an approver rationale before the period can be closed for billing.</p>
                <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn primary" type="submit">Save reconciliation</button></div>
              </form>
            </article>
          )}
          <article className="data-panel">
            <PanelHeader title="Reconciliation register" />
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Meter / property</th>
                    <th>Period</th>
                    <th>Bulk</th>
                    <th>Checks</th>
                    <th>Variance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reconLoading ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#6b7890" }}>Loading reconciliations…</td></tr>
                  ) : reconciliations.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#6b7890" }}>No bulk/check reconciliations recorded yet.</td></tr>
                  ) : reconciliations.map((row) => (
                    <tr key={String(row.id)}>
                      <td style={{ fontSize: 12 }}>{String(row.meter_name ?? "—")}<br /><span style={{ color: "#8a96a7", fontSize: 10 }}>{String(row.property_name ?? "")}</span></td>
                      <td style={{ fontSize: 12 }}>{String(row.period_start ?? "—")} → {String(row.period_end ?? "—")}</td>
                      <td style={{ fontSize: 12, fontWeight: 700 }}>{String(row.bulk_consumption ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(row.check_consumption ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(row.variance ?? "—")} ({String(row.variance_percent ?? "0")}%)</td>
                      <td><FcStatus value={String(row.status ?? "pending")} /></td>
                      <td>
                        {canApprove && row.status !== "approved" && (
                          <button type="button" className="btn primary sm" onClick={() => setApproveTarget(row)}>Approve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : (() => {
        const filteredRows = subTab === "overview" ? rows
          : subTab === "electricity" ? rows.filter((r) => String(r.utility_type ?? "") === "electricity")
          : subTab === "water" ? rows.filter((r) => String(r.utility_type ?? "") === "water")
          : subTab === "gas" ? rows.filter((r) => String(r.utility_type ?? "") === "gas")
          : subTab === "generator" ? rows.filter((r) => String(r.utility_type ?? "") === "fuel" || String(r.utility_type ?? "") === "generator")
          : rows;
        return (

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
                    <th>Rate</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length > 0
                    ? (showAllMeters ? filteredRows : filteredRows.slice(0, 5)).map((row) => (
                        <tr key={String(row.id)}>
                          <td>
                            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                              <span>{row.utility_type === "electricity" ? "⚡" : row.utility_type === "water" ? "💧" : row.utility_type === "gas" ? "🔥" : "⛽"}</span>
                              <span style={{ fontSize: 12, textTransform: "capitalize" }}>{String(row.utility_type ?? "—")} ({String(row.unit ?? "")})</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>{String(row.name ?? "—")}<br /><span style={{ color: "#8a96a7", fontSize: 10 }}>{String(row.property_name ?? "")}{row.unit_code ? ` · Unit ${String(row.unit_code)}` : ""}</span></td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{String(row.current_reading ?? "—")}</td>
                          <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.previous_reading ?? "—")}</td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{String(row.consumption ?? "—")} {String(row.unit ?? "")}</td>
                          <td style={{ fontSize: 12 }}>KES {Number(row.tariff ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td style={{ fontSize: 11, color: "#6b7890" }}>{String(row.read_at ?? "—")}</td>
                          <td><FcStatus value={String(row.reading_status ?? "not_read")} /></td>
                          <td>
                            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                              {canWork && <button className="btn ghost sm" onClick={() => setReadingMeter(row)}>Record Reading</button>}
                              {canAdminister && <button className="btn ghost sm" onClick={() => setRateMeter(row)}>Edit Rate</button>}
                              {canApprove && row.reading_status === "pending" && (() => {
                                const reading = (row.latest_reading ?? {}) as Row;
                                return <>
                                  <button className="btn primary sm" onClick={() => setReviewTarget({ reading, decision: "approve" })}>Approve</button>
                                  <button className="btn danger sm" onClick={() => setReviewTarget({ reading, decision: "reject" })}>Reject</button>
                                </>;
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))
                    : <tr><td colSpan={9} style={{ color: "#6b7890", padding: 24, textAlign: "center" }}>No utility meters or readings have been recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 18px" }}>
              {filteredRows.length > 5 && <button type="button" onClick={() => setShowAllMeters((value) => !value)} style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{showAllMeters ? "Show Recent Meters ↑" : `View All ${filteredRows.length} Meters →`}</button>}
            </div>
          </article>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
            <UtilityBarChart
              title="Utility Consumption Trend"
              months={trendMonths}
              values={consumptionByMonth}
              color="#4f46e5"
              format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
            <UtilityBarChart
              title="Utility Cost Trend (KES)"
              months={trendMonths}
              values={costByMonth}
              color="#22c55e"
              format={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
          </div>

          <article className="data-panel">
            <PanelHeader title="Monthly Summary" />
            <div style={{ padding: "14px 18px", display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <span style={{ color: "#8a96a7", display: "block", fontSize: 11 }}>Total Consumption (YTD)</span>
                <strong style={{ fontSize: 18 }}>{totalConsumption >= 1000 ? `${(totalConsumption / 1000).toFixed(1)}k` : totalConsumption}</strong>
              </div>
              <div>
                <span style={{ color: "#8a96a7", display: "block", fontSize: 11 }}>Total Cost (YTD)</span>
                <strong style={{ fontSize: 18 }}>KES {totalCost >= 1000000 ? `${(totalCost / 1000000).toFixed(2)}M` : `${(totalCost / 1000).toFixed(0)}k`}</strong>
              </div>
              <div>
                <span style={{ color: "#8a96a7", display: "block", fontSize: 11 }}>Avg. Monthly Consumption</span>
                <strong style={{ fontSize: 14 }}>{totalConsumption >= 1000 ? `${(totalConsumption / 12000).toFixed(1)}k` : Math.round(totalConsumption / 12)}</strong>
              </div>
              <div>
                <span style={{ color: "#8a96a7", display: "block", fontSize: 11 }}>Avg. Monthly Cost</span>
                <strong style={{ fontSize: 14 }}>KES {totalCost >= 1000000 ? `${(totalCost / 12000000).toFixed(2)}M` : `${(totalCost / 12000).toFixed(0)}k`}</strong>
              </div>
            </div>
          </article>
        </div>

        {/* Right rail */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <article className="data-panel">
            <PanelHeader title="Active Alerts" />
            <div className="fc-alert-list">
              {utilityAlerts.length > 0 ? utilityAlerts.map((row) => (
                <div key={String(row.id)} className="fc-alert-item">
                  <span className={`fc-alert-icon ${row.reading_status === "rejected" || row.reading_is_anomaly ? "danger" : "warning"}`}>{row.reading_is_anomaly ? "⚠" : "◷"}</span>
                  <div className="fc-alert-body">
                    <strong>{row.reading_is_anomaly ? "Consumption anomaly" : `Reading ${String(row.reading_status ?? "pending")}`}</strong>
                    <small>{String(row.name ?? row.code ?? "Utility meter")}</small>
                    <small>{String(row.property_name ?? "")}{row.unit_code ? ` · Unit ${String(row.unit_code)}` : ""}</small>
                  </div>
                  <span style={{ color: "#9aacbf", fontSize: 10 }}>{String(row.read_at ?? "")}</span>
                </div>
              )) : <div style={{ color: "#6b7890", fontSize: 12, padding: 18 }}>No utility anomalies or readings awaiting review.</div>}
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
                <strong style={{ fontSize: 22 }}>KES {utilityCost}</strong>
                <span style={{ color: "#ef4444", fontSize: 11 }}> YTD</span>
              </div>
              {[
                { icon: "⚡", label: "Electricity", value: `KES ${costByType("electricity").toLocaleString()}` },
                { icon: "💧", label: "Water", value: `KES ${costByType("water").toLocaleString()}` },
                { icon: "⛽", label: "Generator Fuel", value: `KES ${costByType("fuel").toLocaleString()}` },
                { icon: "🔥", label: "Gas", value: `KES ${costByType("gas").toLocaleString()}` },
              ].map((item) => (
                <div key={item.label} style={{ alignItems: "center", borderBottom: "1px solid #f0f2f6", display: "flex", gap: 10, padding: "9px 0" }}>
                  <span>{item.icon}</span>
                  <span style={{ color: "#4b5563", flex: 1, fontSize: 12 }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
      ); })()}
      {utilityError && <div className="form-error">{utilityError}</div>}
      {utilityNotice && <div className="form-hint" style={{ color: "#166534", background: "#f0fdf4", border: "1px solid #86efac", padding: 10, borderRadius: 8 }}>{utilityNotice}</div>}
      {approveTarget && (
        <Modal title="Approve meter reconciliation" onClose={() => setApproveTarget(null)}>
          <form onSubmit={submitReconApproval} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="form-hint">
              {String(approveTarget.meter_name ?? "Bulk meter")} · variance {String(approveTarget.variance ?? "0")}
              ({String(approveTarget.variance_percent ?? "0")}%).
              {approveTarget.status === "exception" ? " Review notes are required for out-of-tolerance exceptions." : ""}
            </p>
            <Field label={approveTarget.status === "exception" ? "Approval rationale" : "Review notes"} required={approveTarget.status === "exception"}>
              <textarea name="notes" rows={3} required={approveTarget.status === "exception"} />
            </Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setApproveTarget(null)}>Cancel</button>
              <button className="btn primary" type="submit">Approve reconciliation</button>
            </div>
          </form>
        </Modal>
      )}
      {readingMeter && (
        <Modal title={`Record Reading · ${String(readingMeter.name ?? readingMeter.code ?? "Meter")}`} onClose={() => setReadingMeter(null)}>
          <form onSubmit={submitReading} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Previous reading"><input value={String(readingMeter.current_reading ?? 0)} readOnly /></Field>
              <Field label={`Current reading (${String(readingMeter.unit ?? "units")})`} required><input name="value" type="number" min={Number(readingMeter.current_reading ?? 0)} step="0.001" required /></Field>
            </div>
            <Field label="Reading date and time" required><input name="read_at" type="datetime-local" required /></Field>
            <Field label="Caretaker notes"><textarea name="notes" rows={3} /></Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}><button type="button" className="btn ghost" onClick={() => setReadingMeter(null)}>Cancel</button><button className="btn primary">Submit for Review</button></div>
          </form>
        </Modal>
      )}
      {reviewTarget && (
        <Modal title={`${reviewTarget.decision === "approve" ? "Approve" : "Reject"} Meter Reading`} onClose={() => setReviewTarget(null)}>
          <form onSubmit={submitReview} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Previous reading"><input value={String(reviewTarget.reading.previous_value ?? "—")} readOnly /></Field>
            <Field label="Current reading"><input value={String(reviewTarget.reading.value ?? "—")} readOnly /></Field>
            <Field label={reviewTarget.decision === "reject" ? "Rejection reason" : "Review notes"} required={reviewTarget.decision === "reject"}><textarea name="notes" rows={3} required={reviewTarget.decision === "reject"} /></Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}><button type="button" className="btn ghost" onClick={() => setReviewTarget(null)}>Cancel</button><button className={`btn ${reviewTarget.decision === "approve" ? "primary" : "danger"}`}>{reviewTarget.decision === "approve" ? "Approve Reading" : "Reject Reading"}</button></div>
          </form>
        </Modal>
      )}
      {rateMeter && (
        <Modal title={`Edit Utility Rate · ${String(rateMeter.name ?? rateMeter.code ?? "Meter")}`} onClose={() => setRateMeter(null)}>
          <form onSubmit={submitRate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Utility"><input value={String(rateMeter.utility_type ?? "—")} readOnly /></Field>
              <Field label="Measurement unit"><input value={String(rateMeter.unit ?? "—")} readOnly /></Field>
            </div>
            <Field label="Rate per unit (KES)" required><input name="tariff" type="number" min="0" step="0.0001" defaultValue={String(rateMeter.tariff ?? 0)} required /></Field>
            <p className="form-hint">The new rate applies to readings recorded after this update. Existing reading costs remain unchanged.</p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}><button type="button" className="btn ghost" onClick={() => setRateMeter(null)}>Cancel</button><button className="btn primary">Save Rate</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ─── Contractors tab ─── */
function ContractorsView({ rows, kpis, onAdd, canAdminister }: { rows: Row[]; kpis: Kpis; onAdd: () => void; canAdminister: boolean }) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [subTab, setSubTab] = useState("all");

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

  const hasData = rows.length > 0;
  const totalContractors = Number(kpis.contractors ?? (hasData ? rows.length : 68));
  const activeContractors = hasData ? rows.filter((r) => String(r.status) === "active").length : 56;
  const avgRating = hasData
    ? (rows.reduce((s, r) => s + Number(r.rating ?? 0), 0) / rows.length).toFixed(1)
    : "4.3";

  const [nowMs] = useState(() => Date.now());
  const daysUntil = (value: string | number | boolean | null | undefined): number | null => {
    if (!value) return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - nowMs) / 86400000);
  };
  const isExpiringRow = (r: Row) => {
    const days = daysUntil(r.insurance_expires_on ?? r.license_expires_on);
    return days !== null && days >= 0 && days <= 30;
  };
  const expiringCount = hasData ? displayRows.filter(isExpiringRow).length : 4;

  const filteredRows = subTab === "all" ? displayRows
    : subTab === "approved" ? displayRows.filter((r) => String(r.status) === "active")
    : subTab === "blacklisted" ? displayRows.filter((r) => String(r.status) === "blacklisted")
    : subTab === "expiring" ? displayRows.filter(isExpiringRow)
    : subTab === "performance" ? displayRows.filter((r) => Number(r.rating ?? 0) >= 4.0)
    : displayRows;

  return (
    <>
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="👷" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Contractors" value={totalContractors.toLocaleString()} sub="Active across all locations" />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active Contractors" value={String(activeContractors)} sub={totalContractors ? `${Math.round((activeContractors / totalContractors) * 100)}% of total` : "0% of total"} />
        <FcKpiCard icon="⭐" iconBg="#fff7ed" iconColor="#ea580c" label="Average Rating" value={`${avgRating} / 5`} sub="Across all contractors" />
        <FcKpiCard icon="⏱" iconBg="#f0fdf4" iconColor="#15803d" label="Avg. Response Time" value="—" sub="No data available" />
        <FcKpiCard icon="📄" iconBg="#fee2e2" iconColor="#b91c1c" label="Contracts Expiring" value={String(expiringCount)} sub={expiringCount ? "Within 30 days" : "No expirations"} />
        <FcKpiCard icon="💰" iconBg="#fdf4ff" iconColor="#9333ea" label="Total Spend (YTD)" value="—" sub="No data available" />
      </div>

      {/* Tabs */}
      {/* Table Toolbar & View Filters (NO 3rd level nested subtabs) */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 360px" : "1fr" }}>
        <article className="data-panel">
          <div className="fc-table-toolbar">
            <div className="fc-table-toolbar-left">
              <input placeholder="Search contractors…" style={{ border: "1px solid #d7dce5", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 200 }} />
              <select className="fc-toolbar-select" value={subTab} onChange={(e) => setSubTab(e.target.value as any)}>
                <option value="all">All Contractors</option>
                <option value="approved">Approved / Active</option>
                <option value="blacklisted">Blacklisted</option>
                <option value="expiring">Expiring Soon ({expiringCount})</option>
                <option value="performance">Top Performers (4.0★+)</option>
              </select>
              {["All Categories", "All Risk Levels"].map((f) => (
                <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
              ))}
              <button className="fc-toolbar-btn">Filters</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, "contractors.csv")}>↓ Export</button>
              {canAdminister && <button className="fc-toolbar-btn primary" onClick={onAdd}>+ Add Contractor</button>}
            </div>
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
                {filteredRows.map((row) => {
                  const rating = Number(row.rating ?? 0);
                  const statusStr = String(row.status ?? "active");
                  const cat = String(row.specialty ?? "General");
                  const expiring = isExpiringRow(row);
                  return (
                    <tr key={String(row.id)} className={selectedRow?.id === row.id ? "selected" : ""} onClick={() => setSelectedRow(selectedRow?.id === row.id ? null : row)} data-testid={expiring ? "contractor-expiring" : undefined}>
                      <td>
                        <div style={{ display: "grid", gap: 1 }}>
                          <strong style={{ fontSize: 13 }}>{String(row.name ?? "—")}</strong>
                          <small style={{ color: "#8a96a7", fontSize: 11 }}>{String(row.contact_name ?? "—")}</small>
                          {expiring && (
                            <span style={{ alignItems: "center", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 99, color: "#b91c1c", display: "inline-flex", fontSize: 10, fontWeight: 800, gap: 4, marginTop: 4, padding: "2px 8px", width: "fit-content" }}>
                              ⚠ Expiring soon{(() => { const d = daysUntil(row.insurance_expires_on ?? row.license_expires_on); return d !== null ? ` (${d}d)` : ""; })()}
                            </span>
                          )}
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
                      <td style={{ fontSize: 12, fontWeight: 700 }}>{statusStr === "active" ? "1+" : "—"}</td>
                      <td style={{ fontSize: 12, fontWeight: 700 }}>—</td>
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
            <span className="fc-pager-info">Showing 1 to {filteredRows.length} of {totalContractors.toLocaleString()} contractors</span>
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
              <div style={{ height: 44, width: 44, fontSize: 20, borderRadius: 8, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #1e3a5f, #0f2744)", color: "#fff" }}>
                {String(selectedRow.name || "?").slice(0, 1).toUpperCase()}
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

/* ─── Expenditure Management & Landlord Floats ─── */
type LocalExpenditure = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  float_ref: string;
  status: string;
};

function ExpenditureView({ rows, organizationId }: { rows: Row[]; organizationId: string | null }) {
  const storageKey = organizationId ? `facility-expenditures-${organizationId}` : "facility-expenditures";
  const floatKey = organizationId ? `facility-float-${organizationId}` : "facility-float";
  const defaultFloat = 5000000;

  const [localExpenditures, setLocalExpenditures] = useState<LocalExpenditure[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
      return Array.isArray(parsed) ? (parsed as LocalExpenditure[]) : [];
    } catch {
      return [];
    }
  });
  const [floatAllocated, setFloatAllocated] = useState<number>(() => {
    if (typeof window === "undefined") return defaultFloat;
    try {
      const stored = Number(window.localStorage.getItem(floatKey) ?? String(defaultFloat));
      return Number.isFinite(stored) && stored > 0 ? stored : defaultFloat;
    } catch {
      return defaultFloat;
    }
  });
  const [showRecord, setShowRecord] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(localExpenditures));
    } catch {
      /* storage unavailable */
    }
  }, [localExpenditures, storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(floatKey, String(floatAllocated));
    } catch {
      /* storage unavailable */
    }
  }, [floatAllocated, floatKey]);

  const costItemsSpent = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const localSpent = localExpenditures.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const spent = costItemsSpent + localSpent;
  const remaining = floatAllocated - spent;
  const spentPct = floatAllocated > 0 ? Math.max(0, Math.min(100, Math.round((spent / floatAllocated) * 100))) : 0;

  const expenditures: Row[] = [
    ...localExpenditures.map((e) => ({ id: e.id, date: e.date, category: e.category, description: e.description, amount: e.amount, float_ref: e.float_ref, status: e.status })),
    ...rows.map((r) => ({
      id: `cost-${String(r.id)}`,
      date: String(r.created_at ?? "—"),
      category: String(r.kind ?? "other").replace(/_/g, " "),
      description: String(r.description ?? "—"),
      amount: Number(r.total ?? 0),
      float_ref: String(r.reference ?? "—"),
      status: "approved",
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  async function recordExpenditure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entry: LocalExpenditure = {
      id: `exp-${Date.now()}`,
      date: String(form.get("date") ?? new Date().toISOString().slice(0, 10)),
      category: String(form.get("category") ?? "General"),
      description: String(form.get("description") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      float_ref: String(form.get("float_ref") ?? `FLT-${new Date().getFullYear()}`),
      status: "pending",
    };
    setLocalExpenditures((prev) => [...prev, entry]);
    setShowRecord(false);
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "#000000", margin: 0, letterSpacing: "-.02em" }}>Expenditure & Landlord Floats</h2>
          <p style={{ color: "#0f172a", fontSize: 14, fontWeight: 750, margin: "4px 0 0" }}>
            Track the landlord float cash-flow advance against facilities expenditure.
          </p>
        </div>
        <button className="fc-toolbar-btn primary" onClick={() => setShowRecord(true)} style={{ fontWeight: 800 }}>+ Record Expenditure</button>
      </div>

      {/* Landlord Float balance card */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(4, minmax(0,1fr))", marginBottom: 16 }}>
        <div className="data-panel" style={{ background: "linear-gradient(135deg, #0f2744, #1e3a5f)", border: 0 }}>
          <span style={{ color: "#ffffff", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: "0.04em" }}>LANDLORD FLOAT ALLOCATED</span>
          <strong style={{ color: "#fff", display: "block", fontSize: 26, fontWeight: 900 }}>{money.format(floatAllocated)}</strong>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
            <input
              type="number"
              min={0}
              step={1000}
              defaultValue={floatAllocated}
              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) setFloatAllocated(v); }}
              style={{ width: "100%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 700, padding: "6px 10px" }}
              aria-label="Float allocation amount"
            />
          </div>
        </div>
        <div className="data-panel" style={{ padding: 18 }}>
          <span style={{ color: "#000000", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: "0.04em" }}>SPENT</span>
          <strong style={{ display: "block", fontSize: 26, color: "#b91c1c", fontWeight: 900 }}>{money.format(spent)}</strong>
          <span style={{ color: "#0f172a", fontSize: 12, fontWeight: 700 }}>{spentPct}% of allocated float</span>
        </div>
        <div className="data-panel" style={{ padding: 18 }}>
          <span style={{ color: "#000000", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: "0.04em" }}>REMAINING BALANCE</span>
          <strong style={{ display: "block", fontSize: 26, color: remaining < 0 ? "#b91c1c" : "#15803d", fontWeight: 900 }}>{money.format(Math.max(remaining, 0))}</strong>
          {remaining < 0 && <span style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>Float exceeded by {money.format(Math.abs(remaining))}</span>}
        </div>
        <div className="data-panel" style={{ padding: 18 }}>
          <span style={{ color: "#000000", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: "0.04em" }}>FLOAT UTILIZATION</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <div style={{ background: "#edf0f5", borderRadius: 99, flex: 1, height: 10, overflow: "hidden" }}>
              <i style={{ background: spentPct >= 100 ? "#ef4444" : spentPct >= 75 ? "#f59e0b" : "#22c55e", borderRadius: "inherit", display: "block", height: "100%", width: `${spentPct}%` }} />
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: "#000000" }}>{spentPct}%</strong>
          </div>
          <span style={{ color: "#0f172a", fontSize: 12, fontWeight: 700 }}>remaining = float − sum(spent)</span>
        </div>
      </div>

      {/* Note about backend */}
      <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, color: "#92400e", fontSize: 13, fontWeight: 700, marginBottom: 16, padding: "12px 16px" }}>
        The backend has no dedicated <code>/facility/expenses/</code> endpoint, so this ledger is derived from{" "}
        <code>/facility/work-order-cost-items/</code> (approved spend) plus expenditures recorded locally in this browser. When a
        backend expenses model is added, point this view at it for organization-wide tracking.
      </div>

      {/* Expenditure table */}
      <div className="data-panel">
        <div className="fc-table-toolbar">
          <div className="fc-table-toolbar-left">
            <span style={{ color: "#000000", fontWeight: 800, fontSize: 14 }}>Expenditures ({expenditures.length})</span>
          </div>
          <div className="fc-table-toolbar-right">
            <button className="fc-toolbar-btn" onClick={() => exportCsv(expenditures, "facility-expenditures.csv")} style={{ fontWeight: 800 }}>↓ Export</button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Float Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {expenditures.length > 0 ? expenditures.map((e) => (
                <tr key={String(e.id)}>
                  <td style={{ fontSize: 12, fontWeight: 750, color: "#000000" }}>{e.date && (typeof e.date === "string" || typeof e.date === "number") ? new Date(e.date).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : String(e.date ?? "—")}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: "#000000", textTransform: "capitalize" }}>{String(e.category ?? "—")}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: "#000000" }}>{String(e.description ?? "—")}</td>
                  <td style={{ fontSize: 13, fontWeight: 800, color: "#000000" }}>{money.format(Number(e.amount ?? 0))}</td>
                  <td style={{ fontSize: 12, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "#000000" }}>{String(e.float_ref ?? "—")}</td>
                  <td><FcStatus value={String(e.status ?? "pending")} /></td>
                </tr>
              )) : (
                <tr><td colSpan={6}><EmptyState message="No expenditures recorded yet." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record expenditure modal (frontend-only ledger) */}
      {showRecord && (
        <Modal title="Record Expenditure" onClose={() => setShowRecord(false)}>
          <form onSubmit={recordExpenditure} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Date" required>
                <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field label="Category" required>
                <select name="category" defaultValue="General">
                  <option value="Repairs">Repairs</option>
                  <option value="Parts">Parts / Materials</option>
                  <option value="Labor">Labor</option>
                  <option value="Utilities">Utilities</option>
                  <option value="General">General</option>
                </select>
              </Field>
            </div>
            <Field label="Description" required>
              <input name="description" required placeholder="e.g. Generator oil top-up" />
            </Field>
            <div className="grid-2">
              <Field label="Amount" required>
                <input name="amount" type="number" min={0} step={1} required placeholder="0" />
              </Field>
              <Field label="Float reference">
                <input name="float_ref" placeholder={`FLT-${new Date().getFullYear()}`} />
              </Field>
            </div>
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, color: "#92400e", fontSize: 12, padding: "8px 12px" }}>
              Recorded locally — no backend expenses endpoint exists yet.
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowRecord(false)}>Cancel</button>
              <button type="submit" className="btn primary">Record Expenditure</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ─── Generic inventory table (Spare Parts / Consumables) ─── */
function InventoryTableView({ variant, rows }: { variant: "spare-parts" | "consumables"; rows: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const isSpare = variant === "spare-parts";
  const title = isSpare ? "Spare Parts" : "Consumables";
  const matchCategories = isSpare ? ["spare", "part"] : ["consum", "general"];

  const filtered = rows.filter((r) => {
    const cat = String(r.category ?? "").toLowerCase();
    return matchCategories.some((c) => cat.includes(c));
  });
  const displayRows = filtered.length > 0 ? filtered : rows;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, margin: 0, letterSpacing: "-.02em" }}>{title}</h2>
          <p style={{ color: "#8a96a7", fontSize: 13, margin: "4px 0 0" }}>
            Derived from the asset register — the backend has no dedicated inventory model.
          </p>
        </div>
        <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, `${variant}.csv`)}>↓ Export</button>
      </div>

      <div className="data-panel">
        <div className="fc-table-toolbar">
          <div className="fc-table-toolbar-left">
            <span style={{ color: "#27364a", fontWeight: 700, fontSize: 13 }}>{title} ({displayRows.length})</span>
          </div>
          {filtered.length === 0 && (
            <span style={{ color: "#92400e", fontSize: 11, fontWeight: 600 }}>
              No assets matched the {isSpare ? "“spare” / “part”" : "“consumable” / “general”"} category — showing all assets. Categorize assets to enable the split.
            </span>
          )}
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Qty on Hand</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length > 0 ? displayRows.map((row) => {
                const qty = Number(row.quantity ?? (row.is_active === false ? 0 : 1));
                return (
                  <tr
                    key={String(row.id)}
                    className={selected?.id === row.id ? "selected" : ""}
                    onClick={() => setSelected(selected?.id === row.id ? null : row)}
                  >
                    <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>{String(row.code ?? "—")}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(row.name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(row.category ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{qty}</td>
                    <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.property_name ?? "—")}</td>
                    <td><FcStatus value={String(row.is_active === false ? "inactive" : (row.condition ?? "active"))} /></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6}><EmptyState message={`No ${title.toLowerCase()} available.`} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <DetailDrawer title={`${title} — Details`} onClose={() => setSelected(null)}>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Code"><span>{String(selected.code ?? "—")}</span></Field>
            <Field label="Name"><span>{String(selected.name ?? "—")}</span></Field>
            <Field label="Category"><span>{String(selected.category ?? "—")}</span></Field>
            <Field label="Qty on Hand"><span>{String(selected.quantity ?? "1")}</span></Field>
            <Field label="Location"><span>{String(selected.property_name ?? "—")}</span></Field>
            <Field label="Condition"><span>{String(selected.condition ?? "good")}</span></Field>
          </div>
        </DetailDrawer>
      )}
    </>
  );
}

/* ─── Generic list tab ─── */
function GenericListView({ tab, rows }: { tab: Tab; rows: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const columns: Record<string, { key: string; label: string }[]> = {
    "work-order-events": [{ key: "created_at", label: "Time" }, { key: "work_order", label: "Work Order" }, { key: "event_type", label: "Event" }, { key: "from_status", label: "From" }, { key: "to_status", label: "To" }, { key: "actor_name", label: "Actor" }, { key: "notes", label: "Notes" }],
    "work-order-cost-items": [{ key: "work_order", label: "Work Order" }, { key: "kind", label: "Type" }, { key: "description", label: "Item" }, { key: "quantity", label: "Quantity" }, { key: "unit_cost", label: "Unit Cost" }, { key: "total", label: "Total" }, { key: "supplier", label: "Supplier" }],
    "work-order-attachments": [{ key: "work_order", label: "Work Order" }, { key: "file_name", label: "File" }, { key: "media_type", label: "Type" }, { key: "caption", label: "Caption" }, { key: "uploaded_by_name", label: "Uploaded By" }, { key: "created_at", label: "Uploaded" }],
  };
  const cols = columns[tab] ?? [];
  const moneyKeys = new Set(["unit_cost", "total", "cost"]);
  const displayValue = (key: string, value: string | number | boolean | null) =>
    moneyKeys.has(key) && Number(value)
      ? money.format(Number(value))
      : String(value ?? "—");
  const titleCase = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
                <tr
                  key={String(row.id ?? i)}
                  className={selected?.id === row.id ? "selected" : ""}
                  onClick={() => setSelected(selected?.id === row.id ? null : row)}
                >
                  {cols.map((c) => (
                    <td key={c.key} style={{ fontSize: 12 }}>{displayValue(c.key, row[c.key] ?? null)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState message={`No ${labels[tab].toLowerCase()} records found.`} />}
      {selected && (
        <DetailDrawer title={`${labels[tab]} — Details`} onClose={() => setSelected(null)}>
          <div style={{ display: "grid", gap: 12 }}>
            {Object.entries(selected).map(([key, value]) => (
              <Field key={key} label={titleCase(key)}>
                <span>{displayValue(key, value)}</span>
              </Field>
            ))}
          </div>
        </DetailDrawer>
      )}
    </article>
  );
}

/* ─── Reports & BI tab ─── */
function ReportsView({ dashboard }: { dashboard: Dashboard }) {
  const kpi = dashboard.kpis;
  const openWO = Number(kpi.openWorkOrders ?? 0);
  const completedWO = Number(kpi.completedToday ?? 18);
  const overdueWO = Number(kpi.overdueWorkOrders ?? 0);
  const compliance = Number(kpi.maintenanceCompliance ?? 92);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const costData = [3.2, 3.8, 4.1, 3.6, 4.25, 3.9, 4.5];
  const maxCost = Math.max(...costData);

  const recentReports = [
    { name: "Monthly KPI Summary", date: "01 Jun 2026", generated: "Admin User", type: "KPI", status: "ready" },
    { name: "PPM Compliance Report", date: "28 May 2026", generated: "James Kariuki", type: "Compliance", status: "ready" },
    { name: "Work Order Analysis", date: "25 May 2026", generated: "Admin User", type: "Analysis", status: "ready" },
    { name: "Contractor Performance", date: "22 May 2026", generated: "Mary Wanjiku", type: "Performance", status: "ready" },
    { name: "Sustainability Report", date: "20 May 2026", generated: "Admin User", type: "Sustainability", status: "ready" },
  ];

  return (
    <>
      <div className="fc-kpi-strip">
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="PPM Compliance" value={`${compliance}%`} sub="Schedule compliance" />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="WOs Completed" value={String(completedWO)} sub="This month" />
        <FcKpiCard icon="⏱" iconBg="#dbeafe" iconColor="#2563eb" label="Avg Response" value="—" sub="No data available" />
        <FcKpiCard icon="💰" iconBg="#ffedd5" iconColor="#ea580c" label="Cost / WO" value="—" sub="No data available" />
        <FcKpiCard icon="🛡" iconBg="#f0fdf4" iconColor="#15803d" label="Compliance Score" value="—" sub="No data available" />
        <FcKpiCard icon="⚙" iconBg="#fdf4ff" iconColor="#9333ea" label="Asset Reliability" value="—" sub="No data available" />
        <FcKpiCard icon="⭐" iconBg="#fff7ed" iconColor="#ea580c" label="Satisfaction" value="—" sub="No data available" />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr 1fr" }}>
        {/* Donut: Work Orders by Status */}
        <article className="data-panel">
          <PanelHeader title="Work Order Status Breakdown" />
          <div style={{ padding: "18px" }}>
            <div className="fc-donut-lg" style={{ background: `conic-gradient(#22c55e 0% ${completedWO / Math.max(completedWO + openWO + overdueWO, 1) * 100}%, #3b82f6 ${completedWO / Math.max(completedWO + openWO + overdueWO, 1) * 100}% ${(completedWO + openWO) / Math.max(completedWO + openWO + overdueWO, 1) * 100}%, #ef4444 ${(completedWO + openWO) / Math.max(completedWO + openWO + overdueWO, 1) * 100}% 100%)`, height: 140, width: 140, margin: "0 auto 16px" }}>
              <strong>{completedWO + openWO + overdueWO}</strong>
              <small>Total</small>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { color: "#22c55e", label: "Completed", count: completedWO },
                { color: "#3b82f6", label: "Open / In Progress", count: openWO },
                { color: "#ef4444", label: "Overdue", count: overdueWO },
              ].map((item) => (
                <span key={item.label} style={{ alignItems: "center", color: "#000000", display: "flex", fontSize: 12, fontWeight: 800, gap: 8 }}>
                  <i style={{ background: item.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                  {item.label}
                  <b style={{ marginLeft: "auto", color: "#000000" }}>{item.count}</b>
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Bar chart: Monthly Maintenance Cost */}
        <article className="data-panel">
          <PanelHeader title="Maintenance Cost Trend (KES)" />
          <div style={{ padding: "18px" }}>
            <div style={{ alignItems: "flex-end", display: "flex", gap: 12, height: 140 }}>
              {months.map((m, i) => (
                <div key={m} style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#000000" }}>{costData[i]}M</span>
                  <div style={{ background: "#e23b3b", borderRadius: "4px 4px 0 0", height: `${(costData[i] / maxCost) * 100}%`, minHeight: 4, width: "100%" }} />
                  <span style={{ color: "#000000", fontSize: 11, fontWeight: 800 }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Gauge: Compliance Trend */}
        <article className="data-panel">
          <PanelHeader title="Compliance Trend" />
          <div className="fc-sla-gauge">
            <div className="donut" style={{ background: `conic-gradient(#22c55e 0% ${compliance}%, #edf0f5 ${compliance}% 100%)`, height: 120, width: 120, marginBottom: 10 }}>
              <strong style={{ fontSize: 20, fontWeight: 900, color: "#000000" }}>{compliance}%</strong>
              <small style={{ color: "#000000", fontWeight: 800 }}>On Track</small>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ background: "#edf0f5", borderRadius: 99, height: 4, marginBottom: 8, overflow: "hidden", width: 120 }}>
                <i style={{ background: "#22c55e", borderRadius: "inherit", display: "block", height: "100%", width: `${compliance}%` }} />
              </div>
              <span style={{ color: "#000000", fontSize: 12, fontWeight: 800 }}>Target: 90%</span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--line)", padding: "12px 18px" }}>
            <button style={{ background: "none", border: 0, color: "#dc2626", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>View Detailed Report →</button>
          </div>
        </article>
      </div>

      {/* Recent Reports */}
      <article className="data-panel" style={{ marginTop: 16 }}>
        <div className="fc-table-toolbar">
          <span style={{ color: "#000000", fontWeight: 800, fontSize: 14 }}>Recent Reports</span>
          <button className="fc-toolbar-btn" style={{ fontWeight: 800 }}>View All Reports</button>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Type</th>
                <th>Generated</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.map((r, i) => (
                <tr key={i}>
                  <td><strong style={{ fontSize: 13, fontWeight: 800, color: "#000000" }}>{r.name}</strong></td>
                  <td><FcStatus value={r.type.toLowerCase()} /></td>
                  <td style={{ fontSize: 12, fontWeight: 750, color: "#000000" }}>{r.generated}</td>
                  <td style={{ fontSize: 12, fontWeight: 750, color: "#000000" }}>{r.date}</td>
                  <td><FcStatus value={r.status} /></td>
                  <td>
                    <button style={{ background: "#ffffff", border: "1px solid #94a3b8", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#000000", padding: "4px 10px" }}>↓ Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}

/* ─── Main page ─── */
export function FacilityWorkspace({ defaultTab = "overview" }: { defaultTab?: Tab }) {
  const { session, can } = useAuth();
  const { activeProperty } = usePropertyContext();
  const organizationId = session?.activeOrganizationId ?? null;
  const canWork = can("facility.work") || can("facility.manage");
  const canInspect = can("facility.inspect") || can("facility.manage");
  const canAdminister = can("facility.administer") || can("facility.manage");
  const canApprove = can("facility.approve") || can("facility.manage");
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (q && labels[q]) return q;
    }
    return defaultTab;
  });

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [properties, setProperties] = useState<Row[]>([]);
  const [assets, setAssets] = useState<Row[]>([]);
  const [createModal, setCreateModal] = useState<"asset" | "contractor" | "inspection" | "service-request" | "ppm" | null>(null);
  const [actionModal, setActionModal] = useState<ActionModal>(null);


  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    const apiTab = tab === "buildings" ? "assets" : tab;
    let path: string;
    if (tab === "overview" || tab === "reports") {
      path = "/facility/dashboard/";
    } else if (tab === "spare-parts" || tab === "consumables") {
      path = `/facility/assets/?search=${encodeURIComponent(search)}`;
    } else if (tab === "expenditure") {
      path = `/facility/work-order-cost-items/?search=${encodeURIComponent(search)}`;
    } else {
      path = `/facility/${apiTab}/?search=${encodeURIComponent(search)}`;
    }
    const response = await apiFetch(path, {}, organizationId);
    if (!response.ok) {
      setError("Facility data could not be loaded. Please retry.");
      setLoading(false);
      return;
    }
    const data = await response.json();
    if (tab === "overview" || tab === "reports") setDashboard(data);
    else setRows(data);
    setLoading(false);
  }, [organizationId, activeProperty?.id, search, tab]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    if ((showCreate || createModal) && organizationId)
      apiFetch("/property/properties/", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then(setProperties);
  }, [showCreate, createModal, organizationId]);

  useEffect(() => {
    if ((createModal === "inspection" || createModal === "ppm") && organizationId)
      apiFetch("/facility/assets/", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then(setAssets);
  }, [createModal, organizationId]);

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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createModal) return;
    const form = new FormData(event.currentTarget);
    const path = {
      asset: "/facility/assets/",
      contractor: "/facility/contractors/",
      inspection: "/facility/inspections/",
      "service-request": "/facility/service-requests/",
      ppm: "/facility/planned-maintenance/",
    }[createModal];
    const raw = Object.fromEntries(form.entries());
    const payload =
      createModal === "service-request"
        ? {
            reference: String(raw.reference ?? "").trim() || `SR-${Date.now()}`,
            subject: String(raw.subject ?? "").trim(),
            description: String(raw.description ?? "").trim(),
            category: String(raw.category ?? "").trim() || "General",
            priority: String(raw.priority ?? "medium"),
            property: String(raw.property ?? properties[0]?.id ?? ""),
            submitted_at: String(raw.submitted_at ?? "").trim() || new Date().toISOString(),
          }
        : Object.fromEntries(Object.entries(raw).filter(([, value]) => String(value).trim() !== ""));
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      path,
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      organizationId
    );
    if (!response.ok) {
      setError("The record could not be created. Check required fields.");
      return;
    }
    setCreateModal(null);
    await load();
  }

  async function runAction(row: Row, action: string) {
    if (tab === "inspections" && action === "complete") {
      setActionModal({ type: "inspection", row });
      return;
    }
    if (tab === "service-requests" && action === "resolve") {
      setActionModal({ type: "resolve", row });
      return;
    }
    if (tab === "service-requests" && (action === "approve" || action === "reject")) {
      setActionModal({ type: "request-decision", row, decision: action });
      return;
    }
    await apiFetch("/auth/csrf/");
    let path = "";
    const payload: Record<string, string | number | boolean> = {};
    if (tab === "planned-maintenance") path = `/facility/planned-maintenance/${row.id}/${action}/`;
    if (tab === "service-requests") path = `/facility/service-requests/${row.id}/${action}/`;
    if (tab === "inspections") path = `/facility/inspections/${row.id}/complete/`;
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

  async function submitActionModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionModal) return;
    const { type, row } = actionModal;
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const path = type === "inspection"
      ? `/facility/inspections/${row.id}/complete/`
      : type === "request-decision"
        ? `/facility/service-requests/${row.id}/${actionModal.decision}/`
        : `/facility/service-requests/${row.id}/resolve/`;
    const payload: Record<string, string | number | boolean> =
      type === "inspection"
        ? {
            score: Number(form.get("score")),
            violations: Number(form.get("violations") ?? 0),
            findings: String(form.get("findings") ?? ""),
            create_work_order: form.get("create_work_order") === "on",
          }
        : type === "request-decision"
          ? { notes: String(form.get("notes") ?? "") }
          : { satisfaction_score: Number(form.get("satisfaction_score")) };
    const response = await apiFetch(
      path,
      { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) },
      organizationId
    );
    if (!response.ok) {
      setError("The facility workflow action could not be completed.");
      return;
    }
    setActionModal(null);
    await load();
  }

  async function runWorkTransition(row: Row, target: string, notes: string) {
    if (!organizationId || !row.id) return;
    setError("");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      `/facility/work-orders/${row.id}/transition/`,
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ status: target, notes }),
      },
      organizationId,
    );
    if (!response.ok) {
      setError("The work order transition could not be completed.");
      return;
    }
    await load();
  }

  const selectTab = (id: string) => {
    if (id === tab) return;
    setSearch("");
    setRows([]);
    setTab(id as Tab);
  };

  /**
   * SIMPLIFIED NAVIGATION:
   * - All navigation items shown as horizontal tabs (no left sidebar)
   * - `tab` drives content rendering directly
   */
  return (
    <ModuleShell
      moduleKey="facility"
      moduleName="Facility Management"
      eyebrow="Operations center"
      title="Facility Management"
      subtitle="Assets, maintenance, compliance, services and utility performance."
      accent="#e23b3b"
      activeId={tab}
      onSelect={selectTab}
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
          <BuildingsView rows={rows} kpis={dashboard?.kpis ?? {}} />
        ) : tab === "assets" ? (
          <AssetsView rows={rows} kpis={dashboard?.kpis ?? {}} onAdd={() => setCreateModal("asset")} />
        ) : tab === "work-orders" ? (
          <WorkOrdersView
            rows={rows}
            kpis={dashboard?.kpis ?? {}}
            permissions={{ canWork }}
            setShowCreate={setShowCreate}
            organizationId={organizationId}
            onTransition={(row, target, notes) => void runWorkTransition(row, target, notes)}
          />
        ) : tab === "planned-maintenance" ? (
          <PlannedMaintenanceView rows={rows} kpis={dashboard?.kpis ?? {}} onAction={runAction} permissions={{ canAdminister }} onAdd={() => setCreateModal("ppm")} organizationId={organizationId} reload={() => void load()} />
        ) : tab === "inspections" ? (
          <InspectionsView rows={rows} kpis={dashboard?.kpis ?? {}} onAction={runAction} permissions={{ canInspect }} onAdd={() => setCreateModal("inspection")} />
        ) : tab === "service-requests" ? (
          <ServiceRequestsView rows={rows} kpis={dashboard?.kpis ?? {}} onAction={runAction} permissions={{ canWork, canApprove }} onAdd={() => setCreateModal("service-request")} />
        ) : tab === "meters" ? (
          <UtilitiesView rows={rows} kpis={dashboard?.kpis ?? {}} organizationId={organizationId} canWork={canWork} canApprove={canApprove} canAdminister={canAdminister} reload={load} />
        ) : tab === "contractors" ? (
          <ContractorsView rows={rows} kpis={dashboard?.kpis ?? {}} onAdd={() => setCreateModal("contractor")} canAdminister={canAdminister} />
        ) : tab === "reports" ? (
          <ReportsView dashboard={dashboard!} />
        ) : tab === "expenditure" ? (
          <ExpenditureView rows={rows} organizationId={organizationId} />
        ) : tab === "spare-parts" ? (
          <InventoryTableView variant="spare-parts" rows={rows} />
        ) : tab === "consumables" ? (
          <InventoryTableView variant="consumables" rows={rows} />
        ) : tab === "tickets" ? (
          <ModuleTicketsView moduleName="Facility" />
        ) : tab === "calendar" ? (
          <ModuleCalendarView moduleName="Facility" />
        ) : (
          <GenericListView tab={tab} rows={rows} />
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
                    <input name="number" required placeholder="WO-2026-1790" data-testid="wo-number-input" />
                  </label>
                  <label>
                    Priority
                    <select name="priority" defaultValue="medium" data-testid="wo-priority-select">
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                </div>
                <label>
                  Issue title
                    <input name="title" required placeholder="Describe the maintenance issue" data-testid="wo-title-input" />
                </label>
                <div className="form-row">
                  <label>
                    Category
                    <input name="category" required placeholder="Mechanical" data-testid="wo-category-input" />
                  </label>
                  <label>
                    Property
                    <select name="property" required defaultValue="" data-testid="wo-property-select">
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
                  <textarea name="description" rows={4} data-testid="wo-description-input" />
                </label>
                <input type="hidden" name="status" value="open" />
                <div className="form-actions">
                  <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button className="primary-action" data-testid="wo-submit-btn">Create Work Order</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Action modal — inspections and service-request decisions */}
        {actionModal && (
          <Modal
            title={actionModal.type === "inspection"
              ? "Complete Inspection"
              : actionModal.type === "request-decision"
                ? `${actionModal.decision === "approve" ? "Approve" : "Reject"} Service Request · ${String(actionModal.row.reference ?? "")}`
                : "Resolve Service Request"}
            onClose={() => setActionModal(null)}
          >
            <form onSubmit={submitActionModal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {actionModal.type === "inspection" ? (
                <>
                  <Field label="Inspection score" required>
                    <input type="number" name="score" min={0} max={100} step={1} required placeholder="0–100" />
                  </Field>
                  <Field label="Violations">
                    <input type="number" name="violations" min={0} step={1} defaultValue={0} />
                  </Field>
                  <Field label="Findings">
                    <textarea name="findings" rows={4} placeholder="Record the inspection findings" />
                  </Field>
                  <label style={{ alignItems: "center", display: "flex", fontSize: 13, gap: 8 }}>
                    <input type="checkbox" name="create_work_order" defaultChecked />
                    Create a corrective work order when the inspection fails
                  </label>
                </>
              ) : actionModal.type === "request-decision" ? (
                <Field label={actionModal.decision === "reject" ? "Rejection reason" : "Approval notes"} required={actionModal.decision === "reject"}>
                  <textarea name="notes" rows={4} required={actionModal.decision === "reject"} placeholder={actionModal.decision === "reject" ? "Explain why this request will not proceed" : "Budget, priority or assignment instructions"} />
                </Field>
              ) : (
                <Field label="Satisfaction score" required>
                  <input type="number" name="satisfaction_score" min={1} max={5} step={1} required placeholder="1–5" />
                </Field>
              )}
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setActionModal(null)}>Cancel</button>
                <button type="submit" className={`btn ${actionModal.type === "request-decision" && actionModal.decision === "reject" ? "danger" : "primary"}`}>
                  {actionModal.type === "inspection"
                    ? "Complete Inspection"
                    : actionModal.type === "request-decision"
                      ? `${actionModal.decision === "approve" ? "Approve" : "Reject"} Request`
                      : "Resolve Request"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Create asset modal */}
        {createModal === "asset" && (
          <Modal title="Add New Asset" onClose={() => setCreateModal(null)}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Asset code" required>
                  <input name="code" required placeholder="AST-0001249" />
                </Field>
                <Field label="Category" required>
                  <input name="category" required placeholder="Lift Systems" />
                </Field>
              </div>
              <Field label="Asset name" required>
                <input name="name" required placeholder="OTIS Lift – Lift 2" />
              </Field>
              <div className="grid-2">
                <Field label="Property" required>
                  <select name="property" required defaultValue="">
                    <option value="" disabled>Select property</option>
                    {properties.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Purchase value">
                  <input name="purchase_value" type="number" min={0} step={1} defaultValue={0} />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Condition">
                  <select name="condition" defaultValue="good">
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="out_of_service">Out of service</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select name="is_active" defaultValue="true">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
                <button type="submit" className="btn primary">Add Asset</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Create contractor modal */}
        {createModal === "contractor" && (
          <Modal title="Add Contractor" onClose={() => setCreateModal(null)}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Contractor code" required>
                  <input name="code" required placeholder="C-2026-0001" />
                </Field>
                <Field label="Specialty" required>
                  <input name="specialty" required placeholder="Plumbing &amp; Drainage" />
                </Field>
              </div>
              <Field label="Company name" required>
                <input name="name" required placeholder="Acme Facilities Ltd." />
              </Field>
              <div className="grid-2">
                <Field label="Contact person">
                  <input name="contact_name" placeholder="Jane Doe" />
                </Field>
                <Field label="Phone">
                  <input name="phone" placeholder="0712 345 678" />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Email">
                  <input name="email" type="email" placeholder="contact@acme.co.ke" />
                </Field>
                <Field label="Status">
                  <select name="status" defaultValue="active">
                    <option value="active">Active</option>
                    <option value="review">Under review</option>
                    <option value="suspended">Suspended</option>
                    <option value="expired">Compliance expired</option>
                  </select>
                </Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
                <button type="submit" className="btn primary">Add Contractor</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Create inspection modal */}
        {createModal === "inspection" && (
          <Modal title="New Inspection" onClose={() => setCreateModal(null)}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Reference" required>
                  <input name="reference" required placeholder="INSP-2026-0057" data-testid="insp-ref-input" />
                </Field>
                <Field label="Type" required>
                  <select name="inspection_type" defaultValue="routine" data-testid="insp-type-select">
                    <option value="compliance">Compliance</option>
                    <option value="statutory">Statutory</option>
                    <option value="routine">Routine</option>
                    <option value="preventive">Preventive</option>
                  </select>
                </Field>
              </div>
              <Field label="Title" required>
                <input name="title" required placeholder="Fire Extinguisher Check" data-testid="insp-title-input" />
              </Field>
              <div className="grid-2">
                <Field label="Property" required>
                  <select name="property" required defaultValue="" data-testid="insp-property-select">
                    <option value="" disabled>Select property</option>
                    {properties.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Asset">
                  <select name="asset" defaultValue="" data-testid="insp-asset-select">
                    <option value="">None</option>
                    {assets.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>{String(row.code)} – {String(row.name)}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Scheduled on" required>
                <input name="scheduled_on" type="date" required data-testid="insp-date-input" />
              </Field>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
                <button type="submit" className="btn primary" data-testid="insp-submit-btn">Create Inspection</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Create service request modal */}
        {createModal === "service-request" && (
          <Modal title="New Service Request" onClose={() => setCreateModal(null)}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Subject / Title" required>
                <input name="subject" required placeholder="e.g. AC not cooling – Office 38" data-testid="sr-title-input" />
              </Field>
              <div className="grid-2">
                <Field label="Category">
                  <select name="category" defaultValue="General" data-testid="sr-category-input">
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="HVAC">HVAC</option>
                    <option value="Fire Safety">Fire Safety</option>
                    <option value="Carpentry">Carpentry</option>
                    <option value="General">General</option>
                  </select>
                </Field>
                <Field label="Priority">
                  <select name="priority" defaultValue="medium" data-testid="sr-priority-select">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Reference">
                  <input name="reference" placeholder="e.g. SR-2026-0188" />
                </Field>
                <Field label="Property">
                  <select name="property" defaultValue="">
                    <option value="" disabled>Select property</option>
                    {properties.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Reported on">
                <input name="submitted_at" type="date" />
              </Field>
              <Field label="Description">
                <textarea name="description" rows={3} placeholder="What needs attention?" />
              </Field>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
                <button type="submit" className="btn primary" data-testid="sr-submit-btn">Create Request</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Create PPM task modal */}
        {createModal === "ppm" && (
          <Modal title="Create PPM Task" onClose={() => setCreateModal(null)}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Task code" required>
                  <input name="code" required placeholder="PPM-2026-0459" />
                </Field>
                <Field label="Frequency" required>
                  <select name="frequency" defaultValue="monthly">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="biannual">Biannual</option>
                    <option value="annual">Annual</option>
                  </select>
                </Field>
              </div>
              <Field label="Task name" required>
                <input name="name" required placeholder="Lift Preventive Maintenance" />
              </Field>
              <div className="grid-2">
                <Field label="Asset" required>
                  <select name="asset" required defaultValue="">
                    <option value="" disabled>Select asset</option>
                    {assets.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>{String(row.code)} – {String(row.name)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Next due on" required>
                  <input name="next_due_on" type="date" required />
                </Field>
              </div>
              <Field label="Estimated hours">
                <input name="estimated_hours" type="number" min={0} step={0.5} defaultValue={1} />
              </Field>
              <Field label="Instructions">
                <textarea name="instructions" rows={3} />
              </Field>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setCreateModal(null)}>Cancel</button>
                <button type="submit" className="btn primary">Create Task</button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </ModuleShell>
  );
}

export default FacilityWorkspace;
