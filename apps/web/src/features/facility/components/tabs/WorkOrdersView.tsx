"use client";

import { useState } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";
import { WorkOrderDetail } from "./WorkOrderDetail";

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
      {message}
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <header className="panel-title">
      <h2 style={{ fontSize: 14, margin: 0 }}>{title}</h2>
    </header>
  );
}

function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="fc-kpi-card" style={{ textAlign: "left" }}>
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub && <span className="fc-kpi-sub">{sub}</span>}
    </div>
  );
}

export function WorkOrdersView({
  rows,
  kpis,
  permissions,
  setShowCreate,
  organizationId,
  onTransition,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
  permissions: { canWork: boolean };
  setShowCreate: (b: boolean) => void;
  organizationId: string | null;
  onTransition: (row: Row, target: string, notes: string) => void;
}) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const priorityColors: Record<string, string> = {
    critical: "#b91c1c", high: "#c2410c", medium: "#a16207", low: "#15803d",
  };
  const displayRows = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [row.number, row.title, row.category, row.property_name]
      .some((value) => String(value ?? "").toLowerCase().includes(term));
    return matchesSearch
      && (statusFilter === "all" || row.status === statusFilter)
      && (priorityFilter === "all" || row.priority === priorityFilter);
  });
  const breachedCount = rows.filter((row) => Boolean(row.sla_breached)).length;
  const atRiskCount = rows.filter((row) => {
    const dueIn = new Date(String(row.resolution_due_at ?? "")).getTime() - Date.now();
    return !row.sla_breached && ["open", "assigned", "in_progress"].includes(String(row.status)) && dueIn >= 0 && dueIn < 86400000;
  }).length;
  const withinSlaCount = Math.max(0, rows.length - breachedCount - atRiskCount);
  const slaPercent = rows.length ? Math.round((withinSlaCount / rows.length) * 100) : 100;
  const prioritySummary = ["critical", "high", "medium", "low"].map((priority) => ({
    label: priority[0].toUpperCase() + priority.slice(1),
    count: rows.filter((row) => row.priority === priority).length,
    color: priorityColors[priority],
  }));
  const maxPriority = Math.max(1, ...prioritySummary.map((item) => item.count));
  const categoryCosts = Object.values(rows.reduce<Record<string, { label: string; amount: number }>>((summary, row) => {
    const label = String(row.category ?? "Other");
    const amount = Number(row.total_cost ?? 0) || Number(row.labor_cost ?? 0) + Number(row.parts_cost ?? 0) + Number(row.other_cost ?? 0);
    const item = summary[label] ?? { label, amount: 0 };
    item.amount += amount;
    summary[label] = item;
    return summary;
  }, {})).sort((a, b) => b.amount - a.amount);
  const totalMaintenanceCost = categoryCosts.reduce((total, item) => total + item.amount, 0);

  if (selectedRow) {
    return <WorkOrderDetail row={selectedRow} onBack={() => setSelectedRow(null)} organizationId={organizationId} canWork={permissions.canWork} />;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, margin: "0 0 4px", letterSpacing: "-.02em" }}>Maintenance Overview</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>Monitor maintenance performance, compliance and asset reliability in real time.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {permissions.canWork && (
            <button className="fc-toolbar-btn primary" onClick={() => setShowCreate(true)} data-testid="facility-create-work-order-btn">+ Create Work Order</button>
          )}
        </div>
      </div>

      <div className="fc-kpi-strip">
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="PPM Compliance" value={`${String(kpis?.maintenanceCompliance ?? 0)}%`} sub="Schedule compliance" />
        <FcKpiCard icon="📂" iconBg="#dcfce7" iconColor="#16a34a" label="Open Work Orders" value={String(kpis?.openWorkOrders ?? 0)} sub="Active across all buildings" />
        <FcKpiCard icon="⏰" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue Work Orders" value={String(kpis?.overdueWorkOrders ?? 0)} sub="Past resolution due" />
        <FcKpiCard icon="⏱" iconBg="#fef3c7" iconColor="#92400e" label="Avg. Resolution Time" value="—" sub="Target 24 hrs" />
        <FcKpiCard icon="📈" iconBg="#f0fdf4" iconColor="#15803d" label="Asset Health Index" value="—" sub="No data available" />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        {/* Work orders list */}
        <div style={{ display: "grid", gap: 16 }}>
          <article className="data-panel">
            <div className="fc-table-toolbar">
              <div className="fc-table-toolbar-left">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search work orders…" data-testid="wo-register-search" style={{ border: "1px solid var(--border-color)", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 220 }} />
                <select aria-label="Work order priority" className="fc-toolbar-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                  <option value="all">All priorities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
                <select aria-label="Work order status" className="fc-toolbar-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option><option value="open">Open</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="on_hold">On hold</option><option value="completed">Completed</option>
                </select>
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
                        <td><span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--text-secondary)" }}>{String(row.number ?? "—")}</span></td>
                        <td><strong style={{ fontSize: 12 }}>{String(row.title ?? "—")}</strong></td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{String(row.property_name ?? "—")}</td>
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
              <span className="fc-pager-info">Showing 1 to {displayRows.length} of {String(kpis?.openWorkOrders ?? displayRows.length)} work orders</span>
            </div>
          </article>
        </div>

        {/* SLA + Priority bars */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <article className="data-panel">
            <PanelHeader title="SLA Performance (This Month)" />
            <div className="fc-sla-gauge">
              <div className="donut" style={{ background: `conic-gradient(#22c55e 0% ${slaPercent}%, #ef4444 ${slaPercent}% 100%)`, height: 130, width: 130, marginBottom: 12 }}>
                <strong style={{ fontSize: 22 }}>{slaPercent}%</strong>
                <small>Within SLA</small>
              </div>
              <div style={{ display: "grid", gap: 8, width: "100%" }}>
                {[
                  { label: "Within SLA", pct: slaPercent, count: withinSlaCount, color: "#22c55e" },
                  { label: "At Risk", pct: rows.length ? Math.round(atRiskCount / rows.length * 100) : 0, count: atRiskCount, color: "#f59e0b" },
                  { label: "Breached", pct: rows.length ? Math.round(breachedCount / rows.length * 100) : 0, count: breachedCount, color: "#ef4444" },
                ].map((item) => (
                  <div key={item.label} style={{ alignItems: "center", display: "flex", fontSize: 12, gap: 8 }}>
                    <i style={{ background: item.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                    <span style={{ color: "var(--text-secondary)", flex: 1 }}>{item.label}</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{item.pct}%</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({item.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="data-panel">
            <PanelHeader title="Work Orders by Priority" />
            <div className="fc-priority-bars">
              {prioritySummary.map((item) => (
                <div key={item.label} className="fc-priority-row">
                  <i className="fc-priority-dot" style={{ background: item.color }} />
                  <span className="fc-priority-label">{item.label}</span>
                  <div className="fc-priority-bar">
                    <i style={{ background: item.color, width: `${(item.count / maxPriority) * 100}%` }} />
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
                <span style={{ color: "var(--text-secondary)", display: "block", fontSize: 11 }}>Total Cost</span>
                <strong style={{ fontSize: 22 }}>{money.format(totalMaintenanceCost)}</strong>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase" }}>Top Cost by Category</p>
              {categoryCosts.slice(0, 5).map((item, i) => {
                const colors = ["#4f46e5", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];
                const pct = totalMaintenanceCost ? Math.round(item.amount / totalMaintenanceCost * 100) : 0;
                return (
                  <div key={item.label} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: "#4b5563" }}>{item.label}</span>
                      <span style={{ fontWeight: 700 }}>{money.format(item.amount)}</span>
                    </div>
                    <div style={{ background: "#edf0f5", borderRadius: 99, height: 5, overflow: "hidden" }}>
                      <i style={{ background: colors[i], borderRadius: "inherit", display: "block", height: "100%", width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {categoryCosts.length === 0 && <EmptyState message="No work-order costs recorded this month." />}
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
