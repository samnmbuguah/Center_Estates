"use client";

import React, { useState } from "react";
import Link from "next/link";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import { BarChart3, ClipboardCheck, Download, Plus, Printer, QrCode, Upload } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
        <Button variant="text" size="small" onClick={action}>
          {actionText}
        </Button>
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
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [assetError, setAssetError] = useState("");

  const displayRows = rows;

  const totalValue = displayRows.reduce((sum, r) => sum + Number(r.purchase_value || 0), 0);
  const criticalCount = displayRows.filter((r) => r.criticality === "critical").length;

  const openLifecycle = async (asset: Row) => {
    setSelectedAsset(asset);
    setShowLifecycleModal(true);
    setLoading(true);
    setAssetError("");
    try {
      const res = await apiFetch(`/facility/assets/${asset.id}/lifecycle_analysis/`);
      if (res.ok) {
        const data = await res.json();
        setLifecycleData(data);
      } else {
        setLifecycleData(null);
        setAssetError("Lifecycle analysis could not be loaded. Please retry.");
      }
    } catch {
      setLifecycleData(null);
      setAssetError("Lifecycle analysis could not be loaded. Check your connection and retry.");
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
      setNotice("Condition assessment recorded successfully.");
      reload?.();
    } else {
      setAssetError("The condition assessment could not be saved. Review the details and retry.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {notice && <div className="form-success" role="status">{notice}</div>}
      {assetError && <div className="form-error" role="alert">{assetError}</div>}
      {/* Top KPI Cards */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="📦" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Registered Assets" value={String(displayRows.length)} sub="Unique tagged assets" />
        <FcKpiCard icon="💰" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Asset Portfolio Value" value={money.format(totalValue)} sub="Cumulative purchase value" />
        <FcKpiCard icon="🚨" iconBg="var(--color-red-bg)" iconColor="var(--color-danger)" label="Critical Life Safety/M&E" value={String(criticalCount)} sub="Highest priority assets" />
        <FcKpiCard icon="📅" iconBg="var(--color-orange-soft)" iconColor="var(--color-orange)" label="Warranty Expiring" value={String(displayRows.filter(a => { const d = a.warranty_expires_on ? new Date(String(a.warranty_expires_on)) : null; return d && d.getTime() - Date.now() < 90 * 86400000 && d.getTime() > Date.now(); }).length)} sub="Within 90 days" />
        <FcKpiCard icon="⭐" iconBg="#fdf4ff" iconColor="var(--color-purple)" label="Active Assets" value={String(displayRows.filter(a => a.is_active !== false).length)} sub="Currently in service" />
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
          <div className="panel-actions">
            <Button variant="outlined" size="small" startIcon={<Download size={15} />} onClick={() => exportCsv(displayRows, "asset-register.csv")}>
              Export CSV
            </Button>
            <Button
              onClick={() => setShowBulkModal(true)}
              variant="outlined"
              size="small"
              startIcon={<Upload size={15} />}
              title="Upload multiple assets at once using a CSV file"
            >
              Upload Assets (CSV)
            </Button>
            <Button
              onClick={onAdd}
              variant="contained"
              size="small"
              startIcon={<Plus size={15} />}
            >
              Add Asset
            </Button>
          </div>
        </header>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", width: 36, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === displayRows.length && displayRows.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(displayRows.map((r) => String(r.id))));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  />
                </th>
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
                const isChecked = selectedIds.has(String(asset.id));
                const critColor: Record<string, string> = {
                  critical: "var(--color-danger)",
                  high: "var(--color-orange)",
                  medium: "var(--color-info)",
                  low: "var(--color-success)",
                };
                return (
                  <tr key={String(asset.id)} style={{ borderBottom: "1px solid var(--border)", background: isChecked ? "rgba(37,99,235,0.06)" : "transparent" }}>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(String(asset.id));
                          else next.delete(String(asset.id));
                          setSelectedIds(next);
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
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
                          background: `${critColor[String(asset.criticality)] ?? "var(--color-info)"}15`,
                          color: critColor[String(asset.criticality)] ?? "var(--color-info)",
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
                      <div className="table-primary-actions">
                        <Button
                          component={Link}
                          href={`/facility/assets/${asset.id}`}
                          variant="outlined"
                          size="small"
                          title="Open digital asset passport"
                        >
                          Passport
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setShowAssessmentModal(true);
                          }}
                          variant="outlined"
                          size="small"
                          startIcon={<ClipboardCheck size={13} />}
                          title="Log Condition Assessment"
                        >
                          Assess
                        </Button>
                        <Button
                          onClick={() => openLifecycle(asset)}
                          variant="outlined"
                          size="small"
                          startIcon={<BarChart3 size={13} />}
                          title="View 5-Year Capital Renewal Plan"
                        >
                          Lifecycle & CAPEX
                        </Button>
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
              <IconButton aria-label="Close lifecycle details" size="small" onClick={() => setShowLifecycleModal(false)}>
                ✕
              </IconButton>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>Calculating lifecycle parameters...</div>
            ) : lifecycleData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Repair vs Replace Card */}
                <div style={{ padding: 16, background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>Repair vs Replace Ratio</strong>
                    <span style={{ background: "var(--color-green-bg)", color: "var(--color-green-text)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
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
                      <strong style={{ display: "block", color: "var(--color-info)" }}>{lifecycleData.repair_to_replacement_ratio_percent}%</strong>
                    </div>
                  </div>
                </div>

                {/* 5-Year Capital Renewal Projections */}
                <div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)" }}>
                    5-Year Capital Renewal & Degradation Forecast Chart
                  </h3>

                  {/* SVG Bar & Line Chart */}
                  <div style={{ padding: "14px 16px", background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 12 }}>
                    <svg width="100%" height={140} viewBox="0 0 540 140" style={{ overflow: "visible" }}>
                      {/* Grid Lines */}
                      <line x1={40} y1={20} x2={500} y2={20} stroke="#cbd5e1" strokeDasharray="3,3" />
                      <line x1={40} y1={65} x2={500} y2={65} stroke="#cbd5e1" strokeDasharray="3,3" />
                      <line x1={40} y1={110} x2={500} y2={110} stroke="#cbd5e1" />

                      {/* Y-Axis Labels */}
                      <text x={32} y={24} textAnchor="end" fontSize={9} fill="#64748b">Grade 5</text>
                      <text x={32} y={69} textAnchor="end" fontSize={9} fill="#64748b">Grade 3</text>
                      <text x={32} y={114} textAnchor="end" fontSize={9} fill="#64748b">Grade 1</text>

                      {/* Bars & Condition Trend Line */}
                      {(() => {
                        const projs = lifecycleData.capex_5_year_projections || [];
                        const maxCapex = Math.max(...projs.map((p: any) => p.planned_capex || 0), 1);
                        const points = projs.map((p: any, idx: number) => {
                          const x = 70 + idx * 95;
                          const cond = Math.max(1, Math.min(5, p.projected_condition_score || 3));
                          const y = 110 - ((cond - 1) / 4) * 90;
                          return { x, y, capex: p.planned_capex, year: p.year, cond };
                        });

                        const linePath = points.map((pt: any, i: number) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");

                        return (
                          <>
                            {/* Bars */}
                            {points.map((pt: any, idx: number) => {
                              const barHeight = pt.capex > 0 ? ((pt.capex / maxCapex) * 75) : 4;
                              const barY = 110 - barHeight;
                              return (
                                <g key={idx}>
                                  <rect
                                    x={pt.x - 22}
                                    y={barY}
                                    width={44}
                                    height={barHeight}
                                    rx={3}
                                    fill={pt.capex > 0 ? "rgba(226, 59, 59, 0.4)" : "rgba(100, 116, 139, 0.15)"}
                                    stroke={pt.capex > 0 ? "var(--primary)" : "none"}
                                    strokeWidth={1}
                                  />
                                  <text x={pt.x} y={124} textAnchor="middle" fontSize={10} fontWeight={700} fill="#000000">
                                    {pt.year}
                                  </text>
                                  {pt.capex > 0 && (
                                    <text x={pt.x} y={barY - 5} textAnchor="middle" fontSize={9} fontWeight={800} fill="#2563eb">
                                      {money.format(pt.capex)}
                                    </text>
                                  )}
                                </g>
                              );
                            })}

                            {/* Condition Trend Line */}
                            <path d={linePath} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinecap="round" />
                            {points.map((pt: any, idx: number) => (
                              <circle key={idx} cx={pt.x} cy={pt.y} r={4} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 10, height: 10, background: "rgba(226, 59, 59, 0.4)", border: "1px solid var(--primary)", borderRadius: 2 }} />
                        Planned Capital Renewal Outlay
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 12, height: 2.5, background: "var(--color-info)" }} />
                        Projected Asset Health Score (1–5)
                      </span>
                    </div>
                  </div>

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
                            <span style={{ background: proj.planned_capex > 0 ? "var(--color-red-bg)" : "var(--surface-sunken)", color: proj.planned_capex > 0 ? "var(--color-danger-deep)" : "inherit", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                              {proj.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button variant="outlined" onClick={() => setShowLifecycleModal(false)}>
                    Close
                  </Button>
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
                <Button type="button" variant="outlined" onClick={() => setShowAssessmentModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained">
                  Save Assessment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--color-slate-900)",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
            zIndex: 900,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            🏷️ <strong>{selectedIds.size}</strong> assets selected
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<QrCode size={14} />}
              onClick={() => setShowQrModal(true)}
              sx={{ minHeight: 32 }}
            >
              Print Batch QR Labels ({selectedIds.size})
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={14} />}
              onClick={() => {
                const sel = displayRows.filter((r) => selectedIds.has(String(r.id)));
                exportCsv(sel, "selected-assets.csv");
              }}
              sx={{ minHeight: 32, color: "#fff", borderColor: "rgba(255,255,255,.55)", "&:hover": { borderColor: "#fff", backgroundColor: "rgba(255,255,255,.1)" } }}
            >
              Export Selected CSV
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => setSelectedIds(new Set())}
              sx={{ minHeight: 32, color: "rgba(255,255,255,.82)", "&:hover": { backgroundColor: "rgba(255,255,255,.1)" } }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Batch QR Code Printable Sheet Modal */}
      {showQrModal && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border-color)", width: "100%", maxWidth: 840, borderRadius: 12, padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, borderBottom: "1px solid var(--color-slate-200)", paddingBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900, color: "var(--text-primary)" }}>
                  🖨️ Batch Asset QR Code Tag Sheet (Avery / Label Print Ready)
                </h2>
                <small style={{ color: "var(--text-faint)", fontSize: "0.8rem" }}>
                  Generating {selectedIds.size} tags · Formatted with high-contrast QR scan targets for mobile maintenance
                </small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => window.print()}
                  startIcon={<Printer size={14} />}
                >
                  Print Labels Now
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowQrModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Sticker Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
              {displayRows
                .filter((r) => selectedIds.has(String(r.id)))
                .map((asset) => (
                  <div
                    key={String(asset.id)}
                    style={{
                      border: "2px dashed var(--color-slate-400)",
                      borderRadius: 8,
                      padding: 12,
                      background: "var(--color-slate-50)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)" }}>
                        CENTER ESTATES FM
                      </span>
                      <span style={{ background: "var(--color-slate-900)", color: "#fff", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>
                        {String(asset.code)}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ width: 68, height: 68, background: "#fff", padding: 3, borderRadius: 4, flexShrink: 0 }}>
                        <QRCodeSVG value={`https://centerestates.com/facility/assets/${asset.id}`} size={62} level="M" />
                      </div>

                      <div style={{ fontSize: 11 }}>
                        <strong style={{ display: "block", color: "var(--text-primary)", fontSize: 12, lineHeight: 1.2 }}>
                          {String(asset.name)}
                        </strong>
                        <div style={{ color: "var(--text-faint)", marginTop: 2 }}>{String(asset.building_name ?? "Tower A")}</div>
                        <small style={{ color: "var(--color-info)", fontWeight: 700 }}>Scan for Ticket / SOP</small>
                      </div>
                    </div>

                    <div style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", borderTop: "1px solid var(--color-slate-200)", paddingTop: 4 }}>
                      Serial: {String(asset.serial_number ?? "AST-KE-2026")}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <BulkAssetUploaderModal
          organizationId={organizationId}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            setShowBulkModal(false);
            if (reload) reload();
          }}
        />
      )}
    </div>
  );
}
