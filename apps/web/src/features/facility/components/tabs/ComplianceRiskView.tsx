"use client";

import React, { useState } from "react";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";
import { apiFetch, csrfFromCookie } from "@/lib/api";

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

export function ComplianceRiskView({
  complianceRows = [],
  riskRows = [],
  organizationId,
}: {
  complianceRows?: Row[];
  riskRows?: Row[];
  organizationId: string | null;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"compliance" | "risks" | "flags">("compliance");

  const obligations = complianceRows.length > 0 ? complianceRows : [
    { id: "c1", category: "Fire Safety", title: "Nairobi County Fire Safety Compliance Certificate", authority: "Nairobi City County Fire Dept", cert_no: "NCC/FIRE/2026/0991", expiry_date: "2027-02-28", status: "compliant", responsible: "Facilities Manager" },
    { id: "c2", category: "Lifts / Elevators", title: "DOSH Annual Passenger Lift Inspection Certificate", authority: "Directorate of Occupational Safety & Health", cert_no: "DOSH/LIFT/8412", expiry_date: "2026-09-15", status: "due_soon", responsible: "Schindler Lead" },
    { id: "c3", category: "Electrical & Energy", title: "EPRA Standby Generator License & Safety Audit", authority: "Energy & Petroleum Regulatory Authority", cert_no: "EPRA/GEN/500/2025", expiry_date: "2027-05-30", status: "compliant", responsible: "PowerTech Eng" },
    { id: "c4", category: "Building Insurance", title: "Comprehensive All-Risk & Public Liability Policy", authority: "Jubilee Insurance Kenya", cert_no: "POL/PL/2026/884", expiry_date: "2027-01-31", status: "compliant", responsible: "Property Director" },
    { id: "c5", category: "Occupational Health", title: "OSHA Workplace Safety & First Aid Registration", authority: "Ministry of Labour / DOSH", cert_no: "OSHA/NRB/9921", expiry_date: "2026-11-20", status: "compliant", responsible: "OHS Officer" },
  ];

  const risks = riskRows.length > 0 ? riskRows : [
    { id: "r1", risk_id: "RSK-LIFT-01", category: "Operational", description: "Passenger Lift #2 intermittent door interlock tripping during peak morning hours.", likelihood: 3, impact: 4, inherent: 12, controls: "Replace door roller guide & sensor array under AMC.", owner: "Schindler Lifts", due_date: "2026-08-25", residual: 4, status: "mitigating" },
    { id: "r2", risk_id: "RSK-GEN-02", category: "Life Safety / Critical", description: "Diesel fuel sediment buildup in standby generator day tank.", likelihood: 2, impact: 5, inherent: 10, controls: "Fuel polishing & filter flush scheduled on Saturday.", owner: "PowerTech Energy", due_date: "2026-08-23", residual: 2, status: "open" },
    { id: "r3", risk_id: "RSK-WATER-03", category: "Financial / Utility", description: "Water consumption discrepancy between bulk supply and sub-meter total (6.8% variance).", likelihood: 4, impact: 2, inherent: 8, controls: "Install ultrasonic check meters on commercial riser.", owner: "HydroFlow Services", due_date: "2026-09-01", residual: 2, status: "open" },
  ];

  const flags = [
    { id: "f1", severity: "warning", title: "Lift Inspection Certificate Due in 27 Days", message: "DOSH annual inspection due on 2026-09-15 for Finance House.", ref: "DOSH/LIFT/8412", date: "2026-08-19" },
    { id: "f2", severity: "info", title: "HVAC Quarterly PM Schedule Due this Week", message: "Chiller #1 quarterly refrigerant audit assigned to CentAir Engineering.", ref: "PM-CHILLER-Q3", date: "2026-08-19" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🛡️" iconBg="#dcfce7" iconColor="#16a34a" label="Statutory Compliance" value="100%" sub="0 overdue certificates" />
        <FcKpiCard icon="📅" iconBg="#fef3c7" iconColor="#b45309" label="Certificates Expiring < 30d" value="1 Due Soon" sub="DOSH Lift renewal" />
        <FcKpiCard icon="⚡" iconBg="#e0e7ff" iconColor="#4f46e5" label="Monitored Obligations" value={String(obligations.length)} sub="Fire, Lifts, OHS, Insurance" />
        <FcKpiCard icon="🚨" iconBg="#fee2e2" iconColor="#dc2626" label="Open Risk Items" value={String(risks.length)} sub="1 High Priority mitigating" />
        <FcKpiCard icon="🔔" iconBg="#fdf4ff" iconColor="#9333ea" label="Active Automated Flags" value={String(flags.length)} sub="Rule-based operational triggers" />
      </div>

      {/* Sub-tab Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "10px 16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setActiveSubTab("compliance")}
            style={{
              border: 0,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              background: activeSubTab === "compliance" ? "var(--surface-sunken)" : "transparent",
              color: activeSubTab === "compliance" ? "var(--primary)" : "var(--text-secondary)",
            }}
          >
            📋 Statutory Compliance Register ({obligations.length})
          </button>
          <button
            onClick={() => setActiveSubTab("risks")}
            style={{
              border: 0,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              background: activeSubTab === "risks" ? "var(--surface-sunken)" : "transparent",
              color: activeSubTab === "risks" ? "var(--primary)" : "var(--text-secondary)",
            }}
          >
            🚨 Risk Register & 5×5 Matrix ({risks.length})
          </button>
          <button
            onClick={() => setActiveSubTab("flags")}
            style={{
              border: 0,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              background: activeSubTab === "flags" ? "var(--surface-sunken)" : "transparent",
              color: activeSubTab === "flags" ? "var(--primary)" : "var(--text-secondary)",
            }}
          >
            🔔 Automated Rule Flags ({flags.length})
          </button>
        </div>
      </div>

      {activeSubTab === "compliance" && (
        <article className="data-panel">
          <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
                Statutory Compliance Register & Certificate Tracking
              </h2>
              <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                Mandatory certificates with automated 30-day and 60-day expiry notifications
              </small>
            </div>
            <button className="fc-toolbar-btn" onClick={() => exportCsv(obligations, "compliance-register.csv")}>
              ↓ Export Register
            </button>
          </header>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>CATEGORY & TITLE</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>ISSUING AUTHORITY</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>CERTIFICATE NO.</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>EXPIRY DATE</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>STATUS</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>RESPONSIBLE PERSON</th>
                </tr>
              </thead>
              <tbody>
                {obligations.map((c) => (
                  <tr key={String(c.id)} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                        {String(c.title)}
                      </strong>
                      <span style={{ color: "#2563eb", fontSize: 11, fontWeight: 700 }}>{String(c.category)}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{String(c.authority)}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700 }}>{String(c.cert_no)}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 800, color: c.status === "due_soon" ? "#d97706" : "inherit" }}>
                      {String(c.expiry_date)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          background: c.status === "compliant" ? "#dcfce7" : c.status === "due_soon" ? "#fef3c7" : "#fee2e2",
                          color: c.status === "compliant" ? "#166534" : c.status === "due_soon" ? "#92400e" : "#991b1b",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                        }}
                      >
                        {c.status === "due_soon" ? "⚠️ Due Soon (27d)" : String(c.status ?? "")}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{String(c.responsible ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {activeSubTab === "risks" && (
        <article className="data-panel">
          <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
              Facilities Risk Register & Mitigation Controls (Inherent vs Residual)
            </h2>
          </header>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>RISK ID & DESCRIPTION</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>INHERENT SCORE (L×I)</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>MITIGATION CONTROLS</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>RESIDUAL SCORE</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>OWNER & DUE DATE</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((r) => {
                  const inherentVal = Number(r.inherent ?? 9);
                  return (
                    <tr key={String(r.id)} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>
                          {String(r.risk_id)}
                        </span>
                        <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--text-primary)", marginTop: 2 }}>
                          {String(r.description)}
                        </strong>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span style={{ background: inherentVal >= 12 ? "#fee2e2" : "#fef3c7", color: inherentVal >= 12 ? "#991b1b" : "#92400e", padding: "3px 8px", borderRadius: 4, fontWeight: 900 }}>
                          {inherentVal} / 25
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)" }}>
                        {String(r.controls ?? "—")}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span style={{ background: "#dcfce7", color: "#166534", padding: "3px 8px", borderRadius: 4, fontWeight: 800 }}>
                          {String(r.residual ?? "—")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12 }}>
                        <div style={{ fontWeight: 700 }}>{String(r.owner ?? "—")}</div>
                        <small style={{ color: "var(--text-muted)" }}>Due: {String(r.due_date ?? "—")}</small>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span style={{ background: r.status === "mitigating" ? "#dbeafe" : "#fef3c7", color: r.status === "mitigating" ? "#1e40af" : "#92400e", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
                          {String(r.status ?? "open")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {activeSubTab === "flags" && (
        <article className="data-panel">
          <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
              Automated Rule-Based Flags & Operational Escalations
            </h2>
          </header>
          <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
            {flags.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: "14px 18px",
                  background: "var(--surface-sunken)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: "1.4rem" }}>{f.severity === "warning" ? "⚠️" : "ℹ️"}</span>
                  <div>
                    <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{f.title}</strong>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>{f.message}</div>
                  </div>
                </div>
                <button
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() => alert(`Operational Flag ${f.ref} marked as acknowledged.`)}
                >
                  ✓ Acknowledge / Resolve
                </button>
              </div>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}
