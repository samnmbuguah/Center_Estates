"use client";

import { useState } from "react";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="fc-stars">
      {"★".repeat(full)}
      <span className="fc-stars-grey">{"★".repeat(5 - full)}</span>
    </span>
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

export function ContractorsView({ rows, kpis, onAdd, canAdminister }: { rows: Row[]; kpis: Record<string, string | number>; onAdd: () => void; canAdminister: boolean }) {
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
  const totalContractors = Number(kpis?.contractors ?? (hasData ? rows.length : 68));
  const activeContractors = hasData ? rows.filter((r) => String(r.status) === "active").length : 56;
  const avgRating = hasData
    ? (rows.reduce((s, r) => s + Number(r.rating ?? 0), 0) / rows.length).toFixed(1)
    : "4.3";

  const [nowMs] = useState(() => Date.now());
  const daysUntil = (value: string | number | boolean | null | undefined | unknown): number | null => {
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

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 360px" : "1fr" }}>
        <article className="data-panel">
          <div className="fc-table-toolbar">
            <div className="fc-table-toolbar-left">
              <input placeholder="Search contractors…" style={{ border: "1px solid #d7dce5", borderRadius: 8, fontSize: 12, padding: "8px 12px", minWidth: 200 }} />
              <select className="fc-toolbar-select" value={subTab} onChange={(e) => setSubTab(e.target.value)}>
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
