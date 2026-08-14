"use client";

import { useState } from "react";
import { Row } from "../../types/facility.types";
import { FcStatus } from "../FacilityToolbar";

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

export function ServiceRequestsView({
  rows,
  kpis,
  onAction,
  permissions,
  onAdd,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
  onAction: (row: Row, action: string) => void;
  permissions: { canWork: boolean; canApprove: boolean };
  onAdd: () => void;
}) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [subTab, setSubTab] = useState("all");

  const displayRows = rows.length > 0 ? rows : [
    { id: 1, reference: "SR-2026-0188", subject: "AC not cooling in meeting room", property_name: "Finance House", category: "HVAC", priority: "high", status: "in_progress", tenant_name: "TechNova Ltd", submitted_at: "18 May 2026", response_due_at: "18 May 2026" },
    { id: 2, reference: "SR-2026-0187", subject: "Water leak in washroom 3rd floor", property_name: "Uchumi House", category: "Plumbing", priority: "critical", status: "open", tenant_name: "Alpha Corp", submitted_at: "18 May 2026", response_due_at: "18 May 2026" },
    { id: 3, reference: "SR-2026-0186", subject: "Flickering lights in reception", property_name: "Utalii House", category: "Electrical", priority: "medium", status: "new", tenant_name: "Beta Ltd", submitted_at: "17 May 2026", response_due_at: "19 May 2026" },
    { id: 4, reference: "SR-2026-0185", subject: "Door handle broken in office 402", property_name: "Finance House", category: "Carpentry", priority: "low", status: "resolved", tenant_name: "Gamma Inc", submitted_at: "16 May 2026", response_due_at: "18 May 2026" },
  ];

  const priorityColors: Record<string, string> = { high: "#b91c1c", medium: "#a16207", low: "#15803d" };
  const catIcons: Record<string, string> = { "Plumbing": "💧", "Electrical": "⚡", "HVAC": "❄️", "Fire Safety": "🔥", "Carpentry": "🪚", "General": "🔧" };

  const hasData = rows.length > 0;
  const totalReq = Number(kpis?.openRequests ?? 0);
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
              <select className="fc-toolbar-select" value={subTab} onChange={(e) => setSubTab(e.target.value)}>
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
