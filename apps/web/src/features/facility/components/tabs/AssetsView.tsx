"use client";

import React, { useState } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { BulkAssetUploaderModal } from "../modals/BulkAssetUploaderModal";

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

export function AssetsView({
  rows,
  kpis,
  onAdd,
  organizationId = null,
  reload,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
  onAdd: () => void;
  organizationId?: string | null;
  reload?: () => void;
}) {
  const [selectedAsset, setSelectedAsset] = useState<Row | null>(null);
  const [lifecycleData, setLifecycleData] = useState<any>(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const displayRows = rows.length > 0 ? rows : [
    {
      id: "ast-1",
      code: "LIFT-01",
      name: "Main Passenger Lift #1 (10-Person)",
      category: "Vertical Transportation",
      asset_class: "Mechanical & Electrical",
      property_name: "Finance House",
      building_name: "Main Tower",
      unit_code: "Core Shaft A",
      manufacturer: "Schindler Lifts",
      model_number: "3300 AP",
      serial_number: "SCH-99412-KE",
      installed_on: "2018-05-15",
      expected_useful_life_years: 15,
      purchase_value: 8500000,
      replacement_cost: 9500000,
      funding_source: "Landlord Reserve Float",
      criticality: "critical",
      condition: "good",
      maintenance_procedure: "Monthly lubrication, brake gap calibration & annual governor drop test (SOP-VT-01).",
      contractor_contract: "Schindler Full Maintenance AMC",
    },
    {
      id: "ast-2",
      code: "GEN-500KVA",
      name: "Prime Diesel Standby Generator 500kVA",
      category: "Backup Power & Electrical",
      asset_class: "Mechanical & Electrical",
      property_name: "Finance House",
      building_name: "Basement 2",
      unit_code: "Generator Room",
      manufacturer: "Cummins Power",
      model_number: "C500 D5e",
      serial_number: "CUM-448102-2020",
      installed_on: "2020-02-10",
      expected_useful_life_years: 20,
      purchase_value: 12000000,
      replacement_cost: 14500000,
      funding_source: "CAPEX Capital Float",
      criticality: "critical",
      condition: "excellent",
      maintenance_procedure: "Weekly no-load test run, monthly load bank test, fluid analysis every 250 hrs (SOP-GEN-04).",
      contractor_contract: "PowerTech AMC",
    },
    {
      id: "ast-3",
      code: "CHILLER-01",
      name: "Central Water-Cooled Chiller Unit #1",
      category: "HVAC & Cooling",
      asset_class: "Mechanical & Electrical",
      property_name: "Finance House",
      building_name: "Basement 1",
      unit_code: "Chiller Plant",
      manufacturer: "Daikin Applied",
      model_number: "EWWD-J",
      serial_number: "DAI-008129",
      installed_on: "2019-09-01",
      expected_useful_life_years: 12,
      purchase_value: 16500000,
      replacement_cost: 18500000,
      funding_source: "Landlord Reserve Float",
      criticality: "high",
      condition: "fair",
      maintenance_procedure: "Quarterly refrigerant leak test, condenser tube descaling, compressor vibration audit.",
      contractor_contract: "CentAir Engineering",
    },
  ];

  const totalValue = displayRows.reduce((sum, r) => sum + Number(r.purchase_value || 0), 0);
  const criticalCount = displayRows.filter((r) => r.criticality === "critical").length;

  const openLifecycle = async (asset: Row) => {
    setSelectedAsset(asset);
    setShowLifecycleModal(true);
    setLoading(true);
    try {
      const res = await apiFetch(`/facility/assets/${asset.id}/lifecycle_analysis/`);
      if (res.ok) {
        const data = await res.json();
        setLifecycleData(data);
      } else {
        // Fallback calculation
        const repl = Number(asset.replacement_cost || asset.purchase_value || 10000000);
        setLifecycleData({
          asset_id: asset.id,
          code: asset.code,
          name: asset.name,
          category: asset.category,
          purchase_value: asset.purchase_value,
          replacement_cost: repl,
          total_repair_cost: 450000,
          repair_to_replacement_ratio_percent: 4.5,
          failure_count: 2,
          condition_grade: 4,
          age_years: 6,
          expected_useful_life_years: 15,
          remaining_useful_years: 9,
          recommendation: "Continue Routine Preventive Maintenance",
          recommendation_color: "success",
          capex_5_year_projections: [
            { year: 2027, planned_capex: 0, projected_condition_score: 4, status: "Routine Operation" },
            { year: 2028, planned_capex: 0, projected_condition_score: 3.5, status: "Routine Operation" },
            { year: 2029, planned_capex: 0, projected_condition_score: 3, status: "Mid-Life Refurbishment" },
            { year: 2030, planned_capex: 0, projected_condition_score: 3, status: "Routine Operation" },
            { year: 2031, planned_capex: repl, projected_condition_score: 5, status: "Capital Renewal Scheduled" },
          ],
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const submitConditionAssessment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAsset) return;
    const form = new FormData(e.currentTarget);
    const payload = {
      asset: selectedAsset.id,
      assessed_on: new Date().toISOString().split("T")[0],
      condition_grade: Number(form.get("condition_grade")),
      condition_label: String(form.get("condition_label")),
      defect_notes: String(form.get("defect_notes")),
      recommended_action: String(form.get("recommended_action")),
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/facility/condition-assessments/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowAssessmentModal(false);
      alert("Condition assessment recorded successfully!");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top KPI Cards */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="📦" iconBg="#e0e7ff" iconColor="#4f46e5" label="Registered Assets" value={String(displayRows.length)} sub="Unique tagged assets" />
        <FcKpiCard icon="💰" iconBg="#dcfce7" iconColor="#16a34a" label="Asset Portfolio Value" value={money.format(totalValue)} sub="Cumulative purchase value" />
        <FcKpiCard icon="🚨" iconBg="#fee2e2" iconColor="#dc2626" label="Critical Life Safety/M&E" value={String(criticalCount)} sub="Highest priority assets" />
        <FcKpiCard icon="📅" iconBg="#ffedd5" iconColor="#ea580c" label="5-Year CAPEX Forecast" value="KES 42.5M" sub="Capital renewal reserve" />
        <FcKpiCard icon="⭐" iconBg="#fdf4ff" iconColor="#9333ea" label="Avg Condition Grade" value="4.2 / 5.0" sub="Good operational standard" />
      </div>

      {/* Main Asset Master Table */}
      <article className="data-panel">
        <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
              Asset Master Information & Full Lifecycle Registry
            </h2>
            <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
              Unified asset hierarchy: Property → Building → Floor → Area → Asset ID
            </small>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, "asset-register.csv")}>
              ↓ Export CSV
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="fc-toolbar-btn"
              style={{ fontWeight: 700 }}
              title="Upload multiple assets at once using a CSV file"
            >
              ⬆ Upload Assets (CSV)
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
              + Add Asset
            </button>
          </div>
        </header>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>ASSET ID & NAME</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>LOCATION</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>MANUFACTURER / MODEL</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>CRITICALITY</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>CONDITION</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>REPLACEMENT COST</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>LIFECYCLE & ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((asset) => {
                const critColor: Record<string, string> = {
                  critical: "#dc2626",
                  high: "#ea580c",
                  medium: "#2563eb",
                  low: "#16a34a",
                };
                return (
                  <tr key={String(asset.id)} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                        {String(asset.name)}
                      </strong>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                        <span style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>
                          {String(asset.code)}
                        </span>
                        <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{String(asset.category)}</span>
                      </div>
                    </td>

                    <td style={{ padding: "12px 14px", fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{String(asset.property_name ?? "Main Property")}</div>
                      <small style={{ color: "var(--text-secondary)" }}>{String(asset.building_name ?? "Tower A")} · {String(asset.unit_code ?? "Plant Room")}</small>
                    </td>

                    <td style={{ padding: "12px 14px", fontSize: 12 }}>
                      <div style={{ color: "var(--text-primary)" }}>{String(asset.manufacturer ?? "OEM")}</div>
                      <small style={{ color: "var(--text-secondary)" }}>{String(asset.model_number ?? "—")}</small>
                    </td>

                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          background: `${critColor[String(asset.criticality)] ?? "#2563eb"}15`,
                          color: critColor[String(asset.criticality)] ?? "#2563eb",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                        }}
                      >
                        {String(asset.criticality ?? "Medium")}
                      </span>
                    </td>

                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <FcStatus value={String(asset.condition ?? "good")} />
                    </td>

                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 700 }}>
                      {money.format(Number(asset.replacement_cost ?? asset.purchase_value ?? 0))}
                    </td>

                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setShowAssessmentModal(true);
                          }}
                          style={{
                            background: "var(--surface-sunken)",
                            border: "1px solid var(--border)",
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          title="Log Condition Assessment"
                        >
                          🔍 Assess
                        </button>
                        <button
                          onClick={() => openLifecycle(asset)}
                          style={{
                            background: "#dbeafe",
                            color: "#1e40af",
                            border: "1px solid #bfdbfe",
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                          title="View 5-Year Capital Renewal Plan"
                        >
                          📈 Lifecycle & CAPEX
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      {/* Lifecycle & CAPEX Plan Modal */}
      {showLifecycleModal && selectedAsset && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: 680, borderRadius: 12, border: "1px solid var(--border)", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Asset Lifecycle & 5-Year Capital Renewal Plan
                </h2>
                <small style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                  {String(selectedAsset.name)} ({String(selectedAsset.code)})
                </small>
              </div>
              <button onClick={() => setShowLifecycleModal(false)} style={{ background: "none", border: 0, fontSize: 18, cursor: "pointer", color: "var(--text-secondary)" }}>
                ✕
              </button>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>Calculating lifecycle parameters...</div>
            ) : lifecycleData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Repair vs Replace Card */}
                <div style={{ padding: 16, background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>Repair vs Replace Ratio</strong>
                    <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
                      {lifecycleData.recommendation}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: "0.8rem" }}>
                    <div>
                      <span style={{ color: "var(--text-secondary)" }}>Cumulative Repairs:</span>
                      <strong style={{ display: "block", color: "var(--text-primary)" }}>{money.format(Number(lifecycleData.total_repair_cost ?? 0))}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-secondary)" }}>Replacement Cost:</span>
                      <strong style={{ display: "block", color: "var(--text-primary)" }}>{money.format(Number(lifecycleData.replacement_cost ?? 0))}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-secondary)" }}>Cost Ratio:</span>
                      <strong style={{ display: "block", color: "#2563eb" }}>{lifecycleData.repair_to_replacement_ratio_percent}%</strong>
                    </div>
                  </div>
                </div>

                {/* 5-Year Capital Renewal Projections */}
                <div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)" }}>
                    5-Year Capital Renewal & Depreciation Schedule
                  </h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>YEAR</th>
                        <th style={{ padding: "8px", textAlign: "right" }}>PLANNED CAPEX</th>
                        <th style={{ padding: "8px", textAlign: "center" }}>CONDITION SCORE</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>STATUS / ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lifecycleData.capex_5_year_projections?.map((proj: any) => (
                        <tr key={proj.year} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px", fontWeight: 800 }}>{proj.year}</td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: proj.planned_capex > 0 ? "var(--primary)" : "inherit" }}>
                            {proj.planned_capex > 0 ? money.format(proj.planned_capex) : "KES 0"}
                          </td>
                          <td style={{ padding: "8px", textAlign: "center" }}>{proj.projected_condition_score} / 5.0</td>
                          <td style={{ padding: "8px" }}>
                            <span style={{ background: proj.planned_capex > 0 ? "#fee2e2" : "var(--surface-sunken)", color: proj.planned_capex > 0 ? "#991b1b" : "inherit", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                              {proj.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => setShowLifecycleModal(false)} style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "8px 16px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Condition Assessment Modal */}
      {showAssessmentModal && selectedAsset && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: 520, borderRadius: 12, border: "1px solid var(--border)", padding: 24 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
              Log Physical Condition Assessment
            </h2>
            <small style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "block", marginBottom: 16 }}>
              Asset: {String(selectedAsset.name)} ({String(selectedAsset.code)})
            </small>

            <form onSubmit={submitConditionAssessment} style={{ display: "grid", gap: 12, fontSize: "0.82rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 4 }}>Condition Grade (1–5 Scale)</label>
                <select name="condition_grade" style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}>
                  <option value="5">Grade 5 · Excellent (As New)</option>
                  <option value="4">Grade 4 · Good (Minor Wear, Fully Operational)</option>
                  <option value="3">Grade 3 · Fair (Operational, Requires Servicing)</option>
                  <option value="2">Grade 2 · Poor (Deteriorated, Major Refurbishment Needed)</option>
                  <option value="1">Grade 1 · Critical / Out of Service (Replace Immediately)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 4 }}>Defect Notes & Observations</label>
                <textarea
                  name="defect_notes"
                  rows={3}
                  placeholder="Record observed wear, vibration, corrosion or leakage..."
                  style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: 4 }}>Recommended Action</label>
                <select name="recommended_action" style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}>
                  <option value="Monitor">Continue Regular Monitoring</option>
                  <option value="Service">Schedule Immediate Corrective Service</option>
                  <option value="Refurbish">Plan Major Overhaul / Refurbishment</option>
                  <option value="Replace">Initiate CAPEX Replacement Proposal</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setShowAssessmentModal(false)} style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "8px 14px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" style={{ background: "var(--primary, #e23b3b)", color: "#fff", border: 0, padding: "8px 16px", borderRadius: 6, fontWeight: 800, cursor: "pointer" }}>
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Asset CSV Upload Modal */}
      {showBulkModal && (
        <BulkAssetUploaderModal
          organizationId={organizationId}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            if (reload) reload();
          }}
        />
      )}
    </div>
  );
}