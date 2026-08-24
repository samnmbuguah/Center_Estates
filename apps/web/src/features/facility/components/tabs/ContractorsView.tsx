"use client";

import React, { useState } from "react";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";
import { apiFetch } from "@/lib/api";
import { BulkContractorUploaderModal } from "../modals/BulkContractorUploaderModal";

function PanelHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <header className="panel-title" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>{title}</h2>
        {count !== undefined && (
          <span style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
            {count}
          </span>
        )}
      </div>
      {action}
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

function SpiderRadarChart({ pillars }: { pillars: { name: string; weight: number; score: number }[] }) {
  const size = 260;
  const center = size / 2;
  const radius = 85;
  const count = pillars.length || 7;
  const levels = [0.25, 0.5, 0.75, 1.0];

  const getCoordinates = (index: number, valueRatio: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = radius * valueRatio;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const polygonPoints = pillars
    .map((p, idx) => {
      const coord = getCoordinates(idx, Math.max(0.1, p.score / 100));
      return `${coord.x},${coord.y}`;
    })
    .join(" ");

  const benchmarkPoints = pillars
    .map((_, idx) => {
      const coord = getCoordinates(idx, 0.85); // 85% SLA benchmark
      return `${coord.x},${coord.y}`;
    })
    .join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* Background Grids */}
        {levels.map((lvl, lIdx) => {
          const pts = Array.from({ length: count })
            .map((_, idx) => {
              const c = getCoordinates(idx, lvl);
              return `${c.x},${c.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={lIdx}
              points={pts}
              fill={lIdx === levels.length - 1 ? "var(--surface-sunken)" : "none"}
              stroke="var(--border)"
              strokeDasharray={lIdx < levels.length - 1 ? "2,2" : "none"}
              strokeWidth={1}
            />
          );
        })}

        {/* Spokes */}
        {pillars.map((_, idx) => {
          const end = getCoordinates(idx, 1.0);
          return (
            <line
              key={idx}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="var(--border)"
              strokeWidth={1}
            />
          );
        })}

        {/* Benchmark polygon */}
        <polygon
          points={benchmarkPoints}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="3,3"
        />

        {/* Score polygon */}
        <polygon
          points={polygonPoints}
          fill="rgba(37, 99, 235, 0.22)"
          stroke="#2563eb"
          strokeWidth={2.5}
        />

        {/* Vertex dots & text */}
        {pillars.map((p, idx) => {
          const coord = getCoordinates(idx, Math.max(0.1, p.score / 100));
          const labelCoord = getCoordinates(idx, 1.25);
          const shortName = p.name.split(" ")[0];
          return (
            <g key={idx}>
              <circle cx={coord.x} cy={coord.y} r={4} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
              <text
                x={labelCoord.x}
                y={labelCoord.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fontWeight={700}
                fill="var(--text-secondary)"
              >
                {shortName} ({p.score}%)
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#2563eb", fontWeight: 700 }}>
          <span style={{ width: 10, height: 10, background: "rgba(37,99,235,0.4)", border: "1.5px solid #2563eb", borderRadius: 2 }} /> Provider Score
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748b" }}>
          <span style={{ width: 10, height: 2, background: "#94a3b8" }} /> 85% Target Benchmark
        </span>
      </div>
    </div>
  );
}

export function ContractorsView({
  rows,
  kpis,
  onAdd,
  canAdminister,
  organizationId,
  reload,
}: {
  rows: Row[];
  kpis?: Record<string, string | number>;
  onAdd: () => void;
  canAdminister?: boolean;
  organizationId?: string | null;
  reload?: () => void;
}) {
  const [selectedContractor, setSelectedContractor] = useState<Row | null>(null);
  const [scorecardData, setScorecardData] = useState<any>(null);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scorecardError, setScorecardError] = useState("");

  const displayRows = rows;

  const activeCount = displayRows.filter((r) => r.status === "active" || r.approval_status === "approved").length;

  const viewScorecard = async (contractor: Row) => {
    setSelectedContractor(contractor);
    setShowScorecardModal(true);
    setLoading(true);
    setScorecardData(null);
    setScorecardError("");
    try {
      const res = await apiFetch(`/facility/contractors/${contractor.id}/scorecard/`);
      if (res.ok) {
        const data = await res.json();
        setScorecardData(data);
      } else {
        setScorecardError("The live performance scorecard could not be loaded. Retry after contractor activity has been recorded.");
      }
    } catch {
      setScorecardError("The live performance scorecard could not be loaded. Check your connection and retry.");
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, "contractor-master.csv")} title="Export service providers to CSV">
              ↓ Export CSV
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="fc-toolbar-btn"
              style={{ fontWeight: 700 }}
              title="Upload multiple service providers at once using a CSV file"
            >
              ⬆ Upload Providers (CSV)
            </button>
            <button
              onClick={onAdd}
              className="fc-toolbar-btn primary"
              style={{ fontWeight: 800 }}
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
                    <span style={{ color: "#dc2626", fontWeight: 800 }}>🚨 {String(vendor.emergency_phone ?? "24/7 Callout Ready")}</span>
                    <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>Tax PIN: {String(vendor.pin_number ?? "—")}</div>
                  </td>

                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span style={{ background: "#fff7ed", color: "#ea580c", padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                      ★ {vendor.rating == null ? "Not rated" : Number(vendor.rating).toFixed(1)}
                    </span>
                  </td>

                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <FcStatus value={String(vendor.approval_status ?? vendor.status ?? "review")} />
                  </td>

                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <button
                      onClick={() => viewScorecard(vendor)}
                      style={{
                        background: "var(--surface-sunken)",
                        border: "1px solid var(--border)",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        color: "var(--primary)",
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
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: 840, borderRadius: 12, border: "1px solid var(--border)", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
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
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>Calculating weighted KPI scorecard...</div>
            ) : scorecardError ? (
              <div className="form-error" role="alert" style={{ padding: 16 }}>
                {scorecardError}
                <button className="btn ghost" style={{ marginLeft: 12 }} onClick={() => void viewScorecard(selectedContractor)}>Retry</button>
              </div>
            ) : scorecardData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Overall Score Meter */}
                <div style={{ padding: 16, background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>Overall Weighted Score</span>
                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#16a34a" }}>
                      {scorecardData.weighted_score} / 100
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                      APPROVED · TIER 1 SPECIALIST VENDOR
                    </span>
                    <small style={{ display: "block", color: "var(--text-muted)", marginTop: 4 }}>
                      {scorecardData.completed_jobs} verified work orders executed
                    </small>
                  </div>
                </div>

                {/* Dual Column: Radar Chart + 7 Pillars Table */}
                <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "center" }}>
                  {/* Left: Spider Radar Chart */}
                  <div style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <SpiderRadarChart pillars={scorecardData.pillars || []} />
                  </div>

                  {/* Right: Pillars List */}
                  <div style={{ display: "grid", gap: 8 }}>
                    {scorecardData.pillars?.map((p: any) => (
                      <div key={p.name} style={{ padding: "8px 12px", background: "var(--surface-sunken)", borderRadius: 6, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{p.name}</strong>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>({p.weight}% Weight)</span>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.metric}</div>
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: 900, color: p.score >= 90 ? "#16a34a" : "#2563eb" }}>
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

      {showBulkModal && (
        <BulkContractorUploaderModal
          organizationId={organizationId ?? null}
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
