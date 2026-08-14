"use client";

import { useState } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";
import { WorkOrderDetail } from "./WorkOrderDetail";

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "#8a96a7" }}>
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
          {permissions.canWork && (
            <button className="fc-toolbar-btn primary" onClick={() => setShowCreate(true)} data-testid="facility-create-work-order-btn">+ Create Work Order</button>
          )}
        </div>
      </div>

      <div className="fc-kpi-strip">
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="PPM Compliance" value={`${String(kpis?.maintenanceCompliance ?? 92)}%`} sub="Schedule compliance" />
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
              <span className="fc-pager-info">Showing 1 to {displayRows.length} of {String(kpis?.openWorkOrders ?? displayRows.length)} work orders</span>
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
