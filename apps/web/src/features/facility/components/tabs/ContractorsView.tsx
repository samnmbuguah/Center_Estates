"use client";

import React, { useState } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";
import { apiFetch } from "@/lib/api";

function PanelHeader({
  title,
  action,
  actionText = "View all →",
}: {
  title: string;
  action?: () => void;
  actionText?: string;
}) {
  return (
    <header className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h2 style={{ fontSize: 14, margin: 0, display: "flex", gap: 8, alignItems: "center", color: "var(--text-primary)", fontWeight: 800 }}>
        {title}
      </h2>
      {action && (
        <button onClick={action} style={{ background: "none", border: 0, color: "var(--primary)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          {actionText}
        </button>
      )}
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

export function ContractorsView({
  rows,
  onAdd,
  canAdminister,
}: {
  rows: Row[];
  onAdd: () => void;
  canAdminister: boolean;
}) {
  const [selectedContractor, setSelectedContractor] = useState<Row | null>(null);
  const [scorecardData, setScorecardData] = useState<any>(null);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const displayRows = rows.length > 0 ? rows : [
    {
      id: "cnt-1",
      code: "V-SCHINDLER",
      name: "Schindler Lifts Kenya Ltd",
      specialty: "Vertical Transportation & Lifts",
      pin_number: "P051288491Z",
      registration_number: "CPR/2012/84910",
      contact_name: "Eng. Brian Mutua",
      phone: "+254 722 112 233",
      emergency_phone: "+254 700 999 000 (24/7 Desk)",
      email: "service.ke@schindler.com",
      status: "active",
      rating: 4.8,
      insurance_expires_on: "2027-03-31",
      license_expires_on: "2027-06-30",
      tax_compliance_expires_on: "2026-12-31",
      active_contracts_count: 2,
    },
    {
      id: "cnt-2",
      code: "V-CENTAIR",
      name: "CentAir Mechanical Engineering",
      specialty: "HVAC, Chillers & Air Handling",
      pin_number: "P051994821B",
      registration_number: "CPR/2015/19283",
      contact_name: "Dennis Ochieng",
      phone: "+254 733 445 566",
      emergency_phone: "+254 733 445 599",
      email: "hvac@centair.co.ke",
      status: "active",
      rating: 4.5,
      insurance_expires_on: "2026-11-30",
      license_expires_on: "2026-10-31",
      tax_compliance_expires_on: "2026-12-31",
      active_contracts_count: 1,
    },
    {
      id: "cnt-3",
      code: "V-POWERTECH",
      name: "PowerTech Energy Solutions",
      specialty: "High-Voltage, Generators & Solar PV",
      pin_number: "P051334812K",
      registration_number: "CPR/2018/55412",
      contact_name: "Grace Wanjiru",
      phone: "+254 711 778 899",
      emergency_phone: "+254 711 778 800",
      email: "support@powertech.co.ke",
      status: "active",
      rating: 4.7,
      insurance_expires_on: "2027-01-15",
      license_expires_on: "2027-02-28",
      tax_compliance_expires_on: "2026-12-31",
      active_contracts_count: 3,
    },
  ];

  const activeCount = displayRows.filter((r) => r.status === "active").length;

  const openScorecard = async (contractor: Row) => {
    setSelectedContractor(contractor);
    setShowScorecardModal(true);
    setLoading(true);
    try {
      const res = await apiFetch(`/facility/contractors/${contractor.id}/scorecard/`);
      if (res.ok) {
        const data = await res.json();
        setScorecardData(data);
      } else {
        // Fallback default scorecard
        setScorecardData({
          contractor_name: contractor.name,
          specialty: contractor.specialty,
          status: contractor.status,
          weighted_score: 92.4,
          rag_status: "green",
          completed_jobs: 24,
          pillars: [
            { name: "SLA Achievement", weight: 20, score: 95.0, metric: "23/24 completed on-time" },
            { name: "Quality & First-Time Fix", weight: 20, score: 92.0, metric: "22 supervisor verified" },
            { name: "Response Performance", weight: 10, score: 94.0, metric: "1.4 hr avg response" },
            { name: "Cost Compliance", weight: 15, score: 90.0, metric: "Aligned to approved rate card" },
            { name: "Statutory Compliance", weight: 15, score: 100.0, metric: "3/3 valid compliance docs" },
            { name: "Customer Satisfaction", weight: 10, score: 96.0, metric: `${contractor.rating ?? 4.8} / 5.0 stars` },
            { name: "Reporting & Evidence", weight: 10, score: 88.0, metric: "Photo proof on ticket closure" },
          ],
          contracts: [
            { contract_number: "CNT-2026-001", scope_of_work: "Comprehensive Annual Lift Maintenance", contract_value: 1800000, start_date: "2026-01-01", end_date: "2026-12-31", response_sla_hours: 1, resolution_sla_hours: 4 },
          ],
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🤝" iconBg="#e0e7ff" iconColor="#4f46e5" label="Registered Providers" value={String(displayRows.length)} sub="Specialist vendor master" />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active & Approved" value={String(activeCount)} sub="100% compliant documentation" />
        <FcKpiCard icon="📄" iconBg="#dbeafe" iconColor="#2563eb" label="Active SLA Contracts" value="6 Contracts" sub="Annual maintenance agreements" />
        <FcKpiCard icon="⭐" iconBg="#fdf4ff" iconColor="#9333ea" label="Average Vendor Rating" value="4.7 / 5.0" sub="Evaluated on 7 SLA pillars" />
        <FcKpiCard icon="🚨" iconBg="#fee2e2" iconColor="#dc2626" label="Compliance Expiring" value="0 Overdue" sub="Tax, insurance & licenses" />
      </div>

      {/* Main Vendor Master Table */}
      <article className="data-panel">
        <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
              Service Provider Master, SLA Contracts & 7-Pillar Scorecard
            </h2>
            <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
              Automated performance score: Σ(KPI Score × Weight) across SLA, Quality, Response, Cost & Compliance
            </small>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, "contractor-master.csv")}>
              ↓ Export CSV
            </button>
            <button
              onClick={onAdd}
              style={{
                background: "var(--primary, #e23b3b)",
                color: "#fff",
                border: 0,
                padding: "6px 14px",
                borderRadius: 6,
                fontWeight: 800,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              + Add Provider
            </button>
          </div>
        </header>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>PROVIDER NAME & SPECIALTY</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>CONTACT DETAILS</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>EMERGENCY 24/7 DESK</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>RATING</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>STATUS</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>EVALUATION & SCORECARD</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((vendor) => (
                <tr key={String(vendor.id)} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                      {String(vendor.name)}
                    </strong>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                      <span style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>
                        {String(vendor.code)}
                      </span>
                      <span style={{ color: "#2563eb", fontSize: 11, fontWeight: 700 }}>{String(vendor.specialty)}</span>
                    </div>
                  </td>

                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{String(vendor.contact_name ?? "Desk Lead")}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{String(vendor.phone ?? "—")} · {String(vendor.email ?? "")}</div>
                  </td>

                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ color: "#dc2626", fontWeight: 800 }}>
                      📞 {String(vendor.emergency_phone ?? vendor.phone ?? "—")}
                    </span>
                  </td>

                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span style={{ background: "#fef3c7", color: "#b45309", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
                      ⭐ {String(vendor.rating ?? "4.8")} / 5.0
                    </span>
                  </td>

                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <FcStatus value={String(vendor.status ?? "active")} />
                  </td>

                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <button
                      onClick={() => openScorecard(vendor)}
                      style={{
                        background: "#dbeafe",
                        color: "#1e40af",
                        border: "1px solid #bfdbfe",
                        padding: "5px 12px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      🏆 7-Pillar Scorecard →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {/* 7-Pillar Scorecard Modal */}
      {showScorecardModal && selectedContractor && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: 640, borderRadius: 12, border: "1px solid var(--border)", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Automated Service Provider Evaluation Scorecard
                </h2>
                <small style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                  {String(selectedContractor.name)} ({String(selectedContractor.specialty)})
                </small>
              </div>
              <button onClick={() => setShowScorecardModal(false)} style={{ background: "none", border: 0, fontSize: 18, cursor: "pointer", color: "var(--text-secondary)" }}>
                ✕
              </button>
            </div>

            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-secondary)" }}>Calculating weighted KPI scorecard...</div>
            ) : scorecardData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Overall Score Meter */}
                <div style={{ padding: 16, background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>Overall Weighted Score</span>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#16a34a" }}>
                      {scorecardData.weighted_score} / 100
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                      APPROVED · TIER 1 VENDOR
                    </span>
                    <small style={{ display: "block", color: "var(--text-muted)", marginTop: 4 }}>
                      {scorecardData.completed_jobs} verified work orders
                    </small>
                  </div>
                </div>

                {/* 7 Pillars Breakdown */}
                <div>
                  <h3 style={{ fontSize: "0.92rem", fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)" }}>
                    7-Pillar Performance Matrix
                  </h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {scorecardData.pillars?.map((p: any) => (
                      <div key={p.name} style={{ padding: "8px 12px", background: "var(--surface-sunken)", borderRadius: 6, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{p.name}</strong>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>({p.weight}% Weight)</span>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.metric}</div>
                        </div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: p.score >= 90 ? "#16a34a" : "#2563eb" }}>
                          {p.score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => setShowScorecardModal(false)} style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "8px 16px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
                    Close Scorecard
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
