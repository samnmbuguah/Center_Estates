"use client";

import { useState } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus, HealthBar } from "../FacilityToolbar";

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

export function AssetsView({
  rows,
  kpis,
  onAdd,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
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

  const displayRows = rows;

  const totalAssets = Number(kpis?.activeAssets ?? displayRows.length);
  const maintenanceCount = displayRows.filter((r) => ["maintenance", "fair", "poor"].includes(String(r.condition))).length;
  const outOfServiceCount = displayRows.filter((r) => String(r.condition) === "out_of_service").length;
  const operationalCount = Math.max(totalAssets - maintenanceCount - outOfServiceCount, 0);
  const pct = (n: number) => (totalAssets ? Math.round((n / totalAssets) * 100) : 0);
  const assetValue = Number(kpis?.assetValue ?? 0);
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
        {/* Main content */}
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 320px" : "1fr", width: "100%" }}>
          <article className="data-panel" style={{ width: "100%" }}>
            <div className="fc-table-toolbar">
              <div className="fc-table-toolbar-left">
                <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 13 }}>Assets ({displayRows.length})</span>
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
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-secondary)" }}>
                        No assets registered yet. Click &quot;+ Add New Asset&quot; to register equipment or fixtures.
                      </td>
                    </tr>
                  ) : displayRows.map((row) => {
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
                            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                              {String(row.code ?? "—")}
                            </span>
                          </div>
                        </td>
                        <td><strong style={{ fontSize: 12 }}>{String(row.name ?? "—")}</strong></td>
                        <td style={{ fontSize: 12 }}>{cat}</td>
                        <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{String(row.property_name ?? "—")}</td>
                        <td><FcStatus value={cond.replace("_", " ")} /></td>
                        <td><FcStatus value={health >= 75 ? "good" : health >= 50 ? "fair" : "poor"} /></td>
                        <td><HealthBar pct={health} /></td>
                        <td>
                          <button style={{ background: "none", border: "1px solid var(--border-color)", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button>
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
