"use client";

import { useState } from "react";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus, HealthBar } from "../FacilityToolbar";

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

export function InspectionsView({
  rows,
  kpis,
  onAction,
  permissions,
  onAdd,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
  onAction: (row: Row, action: string) => void;
  permissions: { canInspect: boolean };
  onAdd: () => void;
}) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [subTab, setSubTab] = useState("list");

  const displayRows = rows;

  const hasData = rows.length > 0;
  const totalInsp = rows.length;
  const completedInsp = rows.filter((r) => !["scheduled", "in_progress"].includes(String(r.status))).length;
  const inProgressInsp = rows.filter((r) => String(r.status) === "in_progress").length;
  const overdueInsp = rows.filter((r) => String(r.status) === "overdue").length;
  const defectsFound = rows.reduce((s, r) => s + Number(r.violations ?? 0), 0);
  const scoredRows = rows.filter((r) => Number(r.score ?? 0) > 0);
  const complianceScore = scoredRows.length ? Math.round(scoredRows.reduce((s, r) => s + Number(r.score ?? 0), 0) / scoredRows.length) : Number(kpis?.maintenanceCompliance ?? 0);
  const pctOfTotal = (n: number) => (totalInsp ? Math.round((n / totalInsp) * 100) : 0);

  return (
    <>
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Inspections" value={String(totalInsp)} sub={hasData ? "All records" : "0"} />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={String(completedInsp)} sub={`${pctOfTotal(completedInsp)}%`} />
        <FcKpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="In Progress" value={String(inProgressInsp)} sub={`${pctOfTotal(inProgressInsp)}%`} />
        <FcKpiCard icon="⚠" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value={String(overdueInsp)} sub={`${pctOfTotal(overdueInsp)}%`} />
        <FcKpiCard icon="🔍" iconBg="#fdf4ff" iconColor="#9333ea" label="Defects Found" value={String(defectsFound)} sub="All items" />
        <FcKpiCard icon="🛡" iconBg="#f0fdf4" iconColor="#15803d" label="Compliance Score" value={`${complianceScore}%`} sub="Avg. completed score" />
      </div>

      {/* Table Toolbar & View Filter */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 340px" : "1fr" }}>
        <article className="data-panel">
          <div className="fc-table-toolbar">
            <div className="fc-table-toolbar-left">
              <input placeholder="Search inspections…" data-testid="insp-search-input" style={{ border: "1px solid var(--border-color)", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 200 }} />
              <select className="fc-toolbar-select" value={subTab} onChange={(e) => setSubTab(e.target.value)}>
                <option value="list">All Inspections</option>
                <option value="templates">Completed Templates</option>
                <option value="checklists">High Compliance (90%+)</option>
                <option value="reports">Overdue / Defect Reports</option>
              </select>
            </div>
            <div className="fc-table-toolbar-right">
              <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, "inspections.csv")}>↓ Export</button>
              <button className="fc-toolbar-btn primary" onClick={onAdd} data-testid="facility-create-inspection-btn">New Inspection</button>
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
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-secondary)" }}>
                          No inspections recorded. Click &quot;+ New Inspection&quot; to create an inspection.
                        </td>
                      </tr>
                    ) : filteredRows.map((row) => {
                      const score = Number(row.score ?? 0);
                      const status = String(row.status ?? "scheduled");
                      const typeMap: Record<string, string> = { "INSP-2026-0056": "statutory", "INSP-2026-0055": "routine", "INSP-2026-0054": "routine", "INSP-2026-0053": "routine", "INSP-2026-0052": "preventive", "INSP-2026-0051": "routine" };
                      const insType = typeMap[String(row.reference)] ?? "routine";
                      return (
                        <tr key={String(row.id)} className={selectedRow?.id === row.id ? "selected" : ""} onClick={() => setSelectedRow(selectedRow?.id === row.id ? null : row)}>
                          <td>
                            <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>{String(row.title ?? "—")}</strong>
                            {Boolean(row.reference) && <small style={{ fontSize: 10, color: "#64748b" }}>{String(row.reference)}</small>}
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
              <button className="fc-detail-cta">Create Work Order</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
