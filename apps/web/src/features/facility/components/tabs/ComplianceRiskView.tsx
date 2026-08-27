"use client";

import React, { useEffect, useState } from "react";
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
  mode,
}: {
  complianceRows?: Row[];
  riskRows?: Row[];
  organizationId: string | null;
  mode: "compliance" | "risks";
}) {
  const [selectedCell, setSelectedCell] = useState<{ l: number; i: number } | null>(null);
  const [flags, setFlags] = useState<Row[]>([]);
  const [flagError, setFlagError] = useState("");
  const [resolvingFlag, setResolvingFlag] = useState<string | null>(null);

  const obligations = complianceRows;
  const risks = riskRows;

  useEffect(() => {
    if (mode !== "compliance" || !organizationId) return;
    apiFetch("/facility/flags/", {}, organizationId)
      .then(async (response) => {
        if (!response.ok) throw new Error("flags unavailable");
        const data = await response.json();
        setFlags(Array.isArray(data) ? data.filter((flag) => !flag.is_resolved) : []);
        setFlagError("");
      })
      .catch(() => setFlagError("Operational flags could not be loaded."));
  }, [mode, organizationId]);

  async function resolveFlag(flag: Row) {
    if (!organizationId || !flag.id) return;
    setResolvingFlag(String(flag.id));
    setFlagError("");
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch(`/facility/flags/${flag.id}/resolve/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({}),
      }, organizationId);
      if (!response.ok) throw new Error("resolve failed");
      setFlags((current) => current.filter((item) => item.id !== flag.id));
    } catch {
      setFlagError("The flag could not be resolved. Please retry.");
    } finally {
      setResolvingFlag(null);
    }
  }

  const visibleRisks = selectedCell
    ? risks.filter((risk) => {
        const likelihood = Number(risk.likelihood ?? Math.ceil(Number(risk.inherent_score || 9) / 5));
        const impact = Number(risk.impact ?? 3);
        return likelihood === selectedCell.l && impact === selectedCell.i;
      })
    : risks;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🛡️" iconBg="#dcfce7" iconColor="#16a34a" label="Statutory Compliance" value={`${obligations.filter(o => o.status === 'active').length} active`} sub={`${obligations.filter(o => o.status === 'expired').length} expired`} />
        <FcKpiCard icon="📅" iconBg="#fef3c7" iconColor="#b45309" label="Certificates Expiring < 30d" value={String(obligations.filter(o => { const d = o.expiry_date ? new Date(String(o.expiry_date)) : null; return d && d.getTime() - Date.now() < 30 * 86400000 && d.getTime() > Date.now(); }).length)} sub="Within 30 days" />
        <FcKpiCard icon="⚡" iconBg="#e0e7ff" iconColor="#4f46e5" label="Monitored Obligations" value={String(obligations.length)} sub="All tracked certificates" />
        <FcKpiCard icon="🚨" iconBg="#fee2e2" iconColor="#dc2626" label="Open Risk Items" value={String(risks.filter(r => r.status === 'open' || r.status === 'mitigating').length)} sub={`${risks.filter(r => Number((r as Record<string, unknown>).inherent_score ?? 0) >= 12).length} high priority`} />
        <FcKpiCard icon="🔔" iconBg="#fdf4ff" iconColor="#9333ea" label="Active Automated Flags" value={String(flags.length)} sub="Rule-based operational triggers" />
      </div>

      {mode === "compliance" && (
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
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{String(c.issuing_authority ?? "—")}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700 }}>{String(c.certificate_number ?? "—")}</td>
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
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{String(c.responsible_person_name ?? "—")}</td>
                  </tr>
                ))}
                {obligations.length === 0 && <tr><td colSpan={6}><div className="empty-state">No statutory compliance obligations are recorded for this property.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {mode === "risks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Interactive 5x5 Heat Matrix */}
          <article className="data-panel">
            <header className="panel-title" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
                  Interactive 5×5 Facilities Risk Matrix (Click any cell to filter risks)
                </h2>
                <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                  Inherent Risk Score = Likelihood (1–5) × Impact (1–5). Color coded by ISO 31000 threshold.
                </small>
              </div>
              {selectedCell && (
                <button
                  onClick={() => setSelectedCell(null)}
                  className="fc-toolbar-btn"
                  style={{ background: "#fee2e2", color: "#991b1b", fontWeight: 800 }}
                >
                  ✕ Clear Filter (L{selectedCell.l} × I{selectedCell.i})
                </button>
              )}
            </header>

            <div style={{ padding: 18, display: "flex", justifyContent: "center", overflowX: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", maxWidth: 640 }}>
                {/* Header Row (Impact 1 to 5) */}
                <div style={{ display: "grid", gridTemplateColumns: "100px repeat(5, 1fr)", gap: 4, textAlign: "center", fontSize: 11, fontWeight: 800, color: "var(--text-secondary)" }}>
                  <div style={{ textAlign: "left", alignSelf: "center" }}>Likelihood ↓ \ Impact →</div>
                  <div>1 · Negl</div>
                  <div>2 · Minor</div>
                  <div>3 · Mod</div>
                  <div>4 · Major</div>
                  <div>5 · Crit</div>
                </div>

                {/* 5 Rows (Likelihood 5 down to 1) */}
                {[5, 4, 3, 2, 1].map((l) => (
                  <div key={l} style={{ display: "grid", gridTemplateColumns: "100px repeat(5, 1fr)", gap: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, alignSelf: "center", color: "var(--text-secondary)" }}>
                      {l === 5 ? "5 · Almost Certain" : l === 4 ? "4 · Likely" : l === 3 ? "3 · Possible" : l === 2 ? "2 · Unlikely" : "1 · Rare"}
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => {
                      const score = l * i;
                      const isSelected = selectedCell?.l === l && selectedCell?.i === i;
                      const cellRisks = risks.filter((r) => {
                        const rL = Number(r.likelihood ?? Math.ceil(Number(r.inherent_score || 9) / 5));
                        const rI = Number(r.impact ?? 3);
                        return rL === l && rI === i;
                      });
                      const count = cellRisks.length;

                      const bg = score >= 15 ? "#fee2e2" : score >= 8 ? "#fef3c7" : score >= 4 ? "#fef9c3" : "#dcfce7";
                      const textCol = score >= 15 ? "#991b1b" : score >= 8 ? "#92400e" : score >= 4 ? "#854d0e" : "#166534";

                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedCell(isSelected ? null : { l, i })}
                          style={{
                            background: bg,
                            color: textCol,
                            border: isSelected ? "2.5px solid #2563eb" : "1px solid rgba(0,0,0,0.06)",
                            borderRadius: 6,
                            padding: "10px 4px",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 2,
                            transform: isSelected ? "scale(1.05)" : "none",
                            transition: "all 0.15s ease",
                            boxShadow: isSelected ? "0 4px 10px rgba(37,99,235,0.25)" : "none",
                          }}
                        >
                          <strong style={{ fontSize: 12 }}>{score}</strong>
                          {count > 0 && (
                            <span style={{ background: textCol, color: "#fff", padding: "1px 5px", borderRadius: 8, fontSize: 9, fontWeight: 900 }}>
                              {count} {count === 1 ? "risk" : "risks"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* Risk Table */}
          <article className="data-panel">
            <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
                Facilities Risk Register & Mitigation Controls {selectedCell ? `(Filtered: L${selectedCell.l} × I${selectedCell.i})` : "(All Risks)"}
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
                  {visibleRisks.map((r) => {
                    const inherentVal = Number(r.inherent_score ?? 9);
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
                          {String(r.mitigation_controls ?? "—")}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span style={{ background: "#dcfce7", color: "#166534", padding: "3px 8px", borderRadius: 4, fontWeight: 800 }}>
                            {String(r.residual_score ?? "—")}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12 }}>
                          <div style={{ fontWeight: 700 }}>{String(r.action_owner_name ?? "—")}</div>
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
                  {visibleRisks.length === 0 && <tr><td colSpan={6}><div className="empty-state">No risk records match this property and filter.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {mode === "compliance" && (
        <article className="data-panel">
          <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
              Automated Rule-Based Flags & Operational Escalations
            </h2>
          </header>
          <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
            {flagError && <div className="form-error" role="alert">{flagError}</div>}
            {flags.length === 0 && !flagError && <div className="empty-state">No active operational flags for this property.</div>}
            {flags.map((f) => (
              <div
                key={String(f.id)}
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
                    <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{String(f.title ?? "Operational flag")}</strong>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>{String(f.message ?? "")}</div>
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
                  disabled={resolvingFlag === String(f.id)}
                  onClick={() => void resolveFlag(f)}
                >
                  {resolvingFlag === String(f.id) ? "Resolving…" : "✓ Acknowledge / Resolve"}
                </button>
              </div>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}
