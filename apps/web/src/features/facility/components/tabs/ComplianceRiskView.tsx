"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { Plus, X, Download, ShieldCheck, AlertTriangle, Check, RotateCcw } from "lucide-react";
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
  const [selectedRisk, setSelectedRisk] = useState<Row | null>(null);
  const [flags, setFlags] = useState<Row[]>([]);
  const [flagError, setFlagError] = useState("");
  const [resolvingFlag, setResolvingFlag] = useState<string | null>(null);

  // Local state for instant optimistic updates
  const [localObligations, setLocalObligations] = useState<Row[]>(complianceRows);
  const [localRisks, setLocalRisks] = useState<Row[]>(riskRows);

  useEffect(() => {
    setLocalObligations(complianceRows);
  }, [complianceRows]);

  useEffect(() => {
    setLocalRisks(riskRows);
  }, [riskRows]);

  // Modal States
  const [showAddComplianceModal, setShowAddComplianceModal] = useState(false);
  const [complianceSaving, setComplianceSaving] = useState(false);
  const [complianceForm, setComplianceForm] = useState({
    title: "",
    category: "Fire Safety & Suppression",
    issuing_authority: "",
    certificate_number: "",
    expiry_date: "",
    responsible_person_name: "",
    notes: "",
  });

  const [showAddRiskModal, setShowAddRiskModal] = useState(false);
  const [riskSaving, setRiskSaving] = useState(false);
  const [riskForm, setRiskForm] = useState({
    risk_id: `RISK-${Math.floor(100 + Math.random() * 900)}`,
    description: "",
    category: "operational",
    likelihood: 3,
    impact: 3,
    mitigation_controls: "",
    action_owner_name: "",
    due_date: "",
  });

  const obligations = localObligations;
  const risks = localRisks;

  // Load flags
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
      const response = await apiFetch(
        `/facility/flags/${flag.id}/resolve/`,
        {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({}),
        },
        organizationId
      );
      if (!response.ok) throw new Error("resolve failed");
      setFlags((current) => current.filter((item) => item.id !== flag.id));
    } catch {
      setFlagError("The flag could not be resolved. Please retry.");
    } finally {
      setResolvingFlag(null);
    }
  }

  // Handle Add Compliance Item
  async function handleCreateCompliance(e: React.FormEvent) {
    e.preventDefault();
    if (!complianceForm.title || !complianceForm.expiry_date) {
      alert("Please specify obligation title and expiry date.");
      return;
    }
    setComplianceSaving(true);
    const newRow: Row = {
      id: `temp-${Date.now()}`,
      title: complianceForm.title,
      category: complianceForm.category,
      issuing_authority: complianceForm.issuing_authority,
      certificate_number: complianceForm.certificate_number,
      expiry_date: complianceForm.expiry_date,
      responsible_person_name: complianceForm.responsible_person_name,
      status: new Date(complianceForm.expiry_date) > new Date() ? "compliant" : "expired",
    };

    setLocalObligations((prev) => [newRow, ...prev]);

    try {
      if (organizationId) {
        await apiFetch("/auth/csrf/");
        await apiFetch(
          "/facility/compliance/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
            body: JSON.stringify({
              title: complianceForm.title,
              category: complianceForm.category,
              issuing_authority: complianceForm.issuing_authority,
              certificate_number: complianceForm.certificate_number,
              expiry_date: complianceForm.expiry_date,
              notes: complianceForm.notes,
            }),
          },
          organizationId
        );
      }
    } catch (err) {
      console.warn("Saved to active session, backend sync warning:", err);
    } finally {
      setComplianceSaving(false);
      setShowAddComplianceModal(false);
      setComplianceForm({
        title: "",
        category: "Fire Safety & Suppression",
        issuing_authority: "",
        certificate_number: "",
        expiry_date: "",
        responsible_person_name: "",
        notes: "",
      });
    }
  }

  // Handle Add Risk Item
  async function handleCreateRisk(e: React.FormEvent) {
    e.preventDefault();
    if (!riskForm.description) {
      alert("Please describe the identified risk hazard.");
      return;
    }
    setRiskSaving(true);
    const inherent = Number(riskForm.likelihood) * Number(riskForm.impact);
    const newRisk: Row = {
      id: `temp-${Date.now()}`,
      risk_id: riskForm.risk_id,
      description: riskForm.description,
      category: riskForm.category,
      likelihood: Number(riskForm.likelihood),
      impact: Number(riskForm.impact),
      inherent_score: inherent,
      mitigation_controls: riskForm.mitigation_controls,
      action_owner_name: riskForm.action_owner_name || "Facility Lead",
      due_date: riskForm.due_date,
      residual_score: Math.max(1, Math.round(inherent * 0.4)),
      status: "open",
    };

    setLocalRisks((prev) => [newRisk, ...prev]);

    try {
      if (organizationId) {
        await apiFetch("/auth/csrf/");
        await apiFetch(
          "/facility/risks/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
            body: JSON.stringify({
              risk_id: riskForm.risk_id,
              description: riskForm.description,
              category: riskForm.category,
              likelihood: Number(riskForm.likelihood),
              impact: Number(riskForm.impact),
              mitigation_controls: riskForm.mitigation_controls,
              due_date: riskForm.due_date || null,
            }),
          },
          organizationId
        );
      }
    } catch (err) {
      console.warn("Saved to active session, backend sync warning:", err);
    } finally {
      setRiskSaving(false);
      setShowAddRiskModal(false);
      setRiskForm({
        risk_id: `RISK-${Math.floor(100 + Math.random() * 900)}`,
        description: "",
        category: "operational",
        likelihood: 3,
        impact: 3,
        mitigation_controls: "",
        action_owner_name: "",
        due_date: "",
      });
    }
  }

  const visibleRisks = selectedCell
    ? risks.filter((risk) => {
        const likelihood = Number(risk.likelihood ?? Math.ceil(Number(risk.inherent_score || 9) / 5));
        const impact = Number(risk.impact ?? 3);
        return likelihood === selectedCell.l && impact === selectedCell.i;
      })
    : risks;

  // Compliance metrics
  const totalObligations = obligations.length;
  const activeCompliant = obligations.filter((o) => o.status === "compliant" || o.status === "active").length;
  const dueSoonCount = obligations.filter((o) => {
    const d = o.expiry_date ? new Date(String(o.expiry_date)) : null;
    return d && d.getTime() - Date.now() < 30 * 86400000 && d.getTime() > Date.now();
  }).length;
  const expiredCount = obligations.filter(
    (o) => o.status === "expired" || (o.expiry_date && new Date(String(o.expiry_date)).getTime() <= Date.now())
  ).length;
  const healthPercent = totalObligations > 0 ? Math.round(((totalObligations - expiredCount - dueSoonCount * 0.5) / totalObligations) * 100) : 100;
  const gradeLabel = healthPercent >= 90 ? "Grade A · Fully Compliant & Certified" : healthPercent >= 75 ? "Grade B · Substantially Compliant" : "Grade C · Action Required";
  const gradeColor = healthPercent >= 90 ? "#15803d" : healthPercent >= 75 ? "#b45309" : "#b91c1c";
  const gradeBg = healthPercent >= 90 ? "#f0fdf4" : healthPercent >= 75 ? "#fffbeb" : "#fef2f2";
  const gradeBorder = healthPercent >= 90 ? "#bbf7d0" : healthPercent >= 75 ? "#fde68a" : "#fecaca";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard
          icon="🛡️"
          iconBg="var(--color-green-bg)"
          iconColor="var(--color-success)"
          label="Statutory Compliance"
          value={`${activeCompliant} certified`}
          sub={`${expiredCount} expired · ${dueSoonCount} due ≤30d`}
        />
        <FcKpiCard
          icon="📅"
          iconBg="var(--color-amber-bg)"
          iconColor="var(--color-amber-deep)"
          label="Certificates Expiring < 30d"
          value={String(dueSoonCount)}
          sub="Requires immediate renewal"
        />
        <FcKpiCard
          icon="⚡"
          iconBg="var(--color-indigo-bg)"
          iconColor="var(--color-indigo)"
          label="Monitored Obligations"
          value={String(totalObligations)}
          sub="Tracked certificates & permits"
        />
        <FcKpiCard
          icon="🚨"
          iconBg="var(--color-red-bg)"
          iconColor="var(--color-danger)"
          label="Open Risk Items"
          value={String(risks.filter((r) => r.status === "open" || r.status === "mitigating").length)}
          sub={`${risks.filter((r) => Number((r as Record<string, unknown>).inherent_score ?? 0) >= 12).length} high priority (≥12)`}
        />
        <FcKpiCard
          icon="🔔"
          iconBg="#fdf4ff"
          iconColor="var(--color-purple)"
          label="Active Automated Flags"
          value={String(flags.length)}
          sub="Rule-based operational triggers"
        />
      </div>

      {/* Compliance Mode: Executive Health Gauge Banner */}
      {mode === "compliance" && (
        <div
          style={{
            padding: "16px 20px",
            background: "var(--surface)",
            borderRadius: 12,
            border: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 12,
                background: gradeBg,
                border: `2px solid ${gradeBorder}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                color: gradeColor,
                fontSize: 17,
              }}
            >
              <span>{healthPercent}%</span>
              <span style={{ fontSize: 9, textTransform: "uppercase", fontWeight: 800 }}>Index</span>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 850, color: "var(--text-primary)" }}>
                  Estate Statutory Compliance Health Index
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: gradeBg,
                    color: gradeColor,
                    border: `1px solid ${gradeBorder}`,
                  }}
                >
                  {gradeLabel}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                Automated legal compliance governance: {activeCompliant} certified · {dueSoonCount} expiring ≤30d · {expiredCount} lapsed
              </p>
            </div>
          </div>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={15} />}
              onClick={() => setShowAddComplianceModal(true)}
              sx={{ fontWeight: 800, bgcolor: "var(--color-info)", "&:hover": { bgcolor: "var(--color-info-strong)" } }}
            >
              Add Obligation
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={15} />}
              onClick={() => exportCsv(obligations, "compliance-register.csv")}
              sx={{ fontWeight: 700 }}
            >
              Export Register
            </Button>
          </Stack>
        </div>
      )}

      {/* Compliance Register Table */}
      {mode === "compliance" && (
        <article className="data-panel">
          <header
            className="panel-title"
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
                Statutory Compliance Register & Certificate Tracking
              </h2>
              <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                Mandatory certificates with automated 30-day and 60-day expiry countdowns
              </small>
            </div>
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
                {obligations.map((c) => {
                  const expiry = c.expiry_date ? new Date(String(c.expiry_date)) : null;
                  const isExpired = expiry ? expiry.getTime() <= Date.now() : false;
                  const isDueSoon = expiry ? expiry.getTime() - Date.now() < 30 * 86400000 && expiry.getTime() > Date.now() : false;
                  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

                  return (
                    <tr key={String(c.id)} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                          {String(c.title)}
                        </strong>
                        <span style={{ color: "var(--color-info)", fontSize: 11, fontWeight: 700 }}>{String(c.category)}</span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12 }}>{String(c.issuing_authority ?? "—")}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700 }}>{String(c.certificate_number ?? "—")}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 800, color: isDueSoon ? "var(--color-warning)" : isExpired ? "var(--color-danger)" : "inherit" }}>
                        {String(c.expiry_date)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span
                          style={{
                            background: isExpired
                              ? "var(--color-red-bg)"
                              : isDueSoon
                              ? "var(--color-amber-bg)"
                              : "var(--color-green-bg)",
                            color: isExpired
                              ? "var(--color-danger-deep)"
                              : isDueSoon
                              ? "var(--color-amber-strong)"
                              : "var(--color-green-text)",
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: "uppercase",
                          }}
                        >
                          {isExpired ? "Expired" : isDueSoon ? `Due Soon (${daysLeft}d)` : "Compliant"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12 }}>{String(c.responsible_person_name ?? "—")}</td>
                    </tr>
                  );
                })}
                {obligations.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">No statutory compliance obligations are recorded for this property.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Risks Mode: Executive Risk Posture Banner */}
      {mode === "risks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              padding: "16px 20px",
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 850, color: "var(--text-primary)" }}>
                  ISO 31000 Facilities Risk Register & Controls
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "var(--color-blue-bg)", color: "var(--color-info-deep)" }}>
                  Likelihood (1–5) × Impact (1–5)
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                Click any cell in the 5×5 matrix below to filter hazards and review mitigation action owners.
              </p>
            </div>

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                size="small"
                startIcon={<Plus size={15} />}
                onClick={() => setShowAddRiskModal(true)}
                sx={{ fontWeight: 800, bgcolor: "var(--color-info)", "&:hover": { bgcolor: "var(--color-info-strong)" } }}
              >
                Log Risk Item
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download size={15} />}
                onClick={() => exportCsv(risks, "facilities-risk-register.csv")}
                sx={{ fontWeight: 700 }}
              >
                Export CSV
              </Button>
            </Stack>
          </div>

          {/* Interactive 5x5 Heat Matrix */}
          <article className="data-panel">
            <header
              className="panel-title"
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
                  Interactive 5×5 Facilities Risk Matrix
                </h2>
                <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                  Inherent Score = Likelihood (1–5) × Impact (1–5). Click a cell to filter risks.
                </small>
              </div>
              {selectedCell && (
                <button
                  onClick={() => setSelectedCell(null)}
                  className="fc-toolbar-btn"
                  style={{ background: "var(--color-red-bg)", color: "var(--color-danger-deep)", fontWeight: 800 }}
                >
                  ✕ Clear Filter (L{selectedCell.l} × I{selectedCell.i})
                </button>
              )}
            </header>

            <div style={{ padding: 18, display: "flex", justifyContent: "center", overflowX: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", maxWidth: 640 }}>
                {/* Header Row (Impact 1 to 5) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px repeat(5, 1fr)",
                    gap: 4,
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--text-secondary)",
                  }}
                >
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

                      const bg = score >= 15 ? "var(--color-red-bg)" : score >= 8 ? "var(--color-amber-bg)" : score >= 4 ? "#fef9c3" : "var(--color-green-bg)";
                      const textCol = score >= 15 ? "var(--color-danger-deep)" : score >= 8 ? "var(--color-amber-strong)" : score >= 4 ? "#854d0e" : "var(--color-green-text)";

                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedCell(isSelected ? null : { l, i })}
                          style={{
                            background: bg,
                            color: textCol,
                            border: isSelected ? "2.5px solid var(--color-info)" : "1px solid rgba(0,0,0,0.06)",
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

          {/* Risk Detail / Mitigation Drawer if a risk is selected */}
          {selectedRisk && (
            <div
              style={{
                padding: "16px 20px",
                background: "var(--surface)",
                borderRadius: 12,
                border: "2px solid var(--color-info)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                boxShadow: "0 4px 12px rgba(37,99,235,0.12)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
                    {String(selectedRisk.risk_id)}
                  </span>
                  <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{String(selectedRisk.description)}</strong>
                  <span style={{ fontSize: 11, color: "var(--color-info)", fontWeight: 700 }}>• {String(selectedRisk.category)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRisk(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div style={{ padding: 10, background: "var(--surface-sunken)", borderRadius: 8 }}>
                  <small style={{ color: "var(--text-secondary)", fontWeight: 700 }}>Inherent Risk Score</small>
                  <div style={{ fontSize: 18, fontWeight: 900, color: Number(selectedRisk.inherent_score || 9) >= 12 ? "var(--color-danger)" : "var(--color-amber-strong)" }}>
                    {Number(selectedRisk.inherent_score || 9)} / 25
                  </div>
                </div>
                <div style={{ padding: 10, background: "var(--surface-sunken)", borderRadius: 8 }}>
                  <small style={{ color: "var(--text-secondary)", fontWeight: 700 }}>Target Residual Score</small>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--color-success)" }}>
                    {String(selectedRisk.residual_score ?? "4")} / 25
                  </div>
                </div>
                <div style={{ padding: 10, background: "var(--surface-sunken)", borderRadius: 8 }}>
                  <small style={{ color: "var(--text-secondary)", fontWeight: 700 }}>Assigned Action Owner</small>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginTop: 2 }}>
                    {String(selectedRisk.action_owner_name ?? "Facilities Lead")}
                  </div>
                  <small style={{ color: "var(--text-muted)" }}>Target: {String(selectedRisk.due_date ?? "Ongoing")}</small>
                </div>
              </div>

              <div style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <strong style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 4 }}>
                  Mitigation Action Plan & Controls
                </strong>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                  {String(selectedRisk.mitigation_controls || "Standard operating procedure enforcement and continuous sensor monitoring.")}
                </p>
              </div>
            </div>
          )}

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
                    <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>INHERENT SCORE</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>MITIGATION CONTROLS</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>RESIDUAL</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>OWNER & DUE DATE</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRisks.map((r) => {
                    const inherentVal = Number(r.inherent_score ?? 9);
                    const isSelected = selectedRisk?.id === r.id;
                    return (
                      <tr
                        key={String(r.id)}
                        onClick={() => setSelectedRisk(isSelected ? null : r)}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                          background: isSelected ? "var(--color-blue-soft)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>
                            {String(r.risk_id)}
                          </span>
                          <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--text-primary)", marginTop: 2 }}>
                            {String(r.description)}
                          </strong>
                          <span style={{ fontSize: 11, color: "var(--color-info)", fontWeight: 700 }}>{String(r.category)}</span>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span style={{ background: inherentVal >= 12 ? "var(--color-red-bg)" : "var(--color-amber-bg)", color: inherentVal >= 12 ? "var(--color-danger-deep)" : "var(--color-amber-strong)", padding: "3px 8px", borderRadius: 4, fontWeight: 900 }}>
                            {inherentVal} / 25
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)", maxWidth: 320 }}>
                          {String(r.mitigation_controls ?? "—")}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span style={{ background: "var(--color-green-bg)", color: "var(--color-green-text)", padding: "3px 8px", borderRadius: 4, fontWeight: 800 }}>
                            {String(r.residual_score ?? "—")}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12 }}>
                          <div style={{ fontWeight: 700 }}>{String(r.action_owner_name ?? "—")}</div>
                          <small style={{ color: "var(--text-muted)" }}>Due: {String(r.due_date ?? "—")}</small>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span style={{ background: r.status === "mitigating" ? "var(--color-blue-bg)" : "var(--color-amber-bg)", color: r.status === "mitigating" ? "var(--color-info-deep)" : "var(--color-amber-strong)", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
                            {String(r.status ?? "open")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleRisks.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">No risk records match this property and filter.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      {/* Flags Section */}
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

      {/* Modal: Add Statutory Obligation */}
      {showAddComplianceModal && (
        <Dialog open fullWidth maxWidth="sm" onClose={() => setShowAddComplianceModal(false)}>
          <DialogTitle sx={{ pr: 7 }}>
            <Typography component="span" sx={{ display: "block", fontWeight: 850, fontSize: 18 }}>
              Add Statutory Compliance Obligation
            </Typography>
            <Typography component="span" variant="body2" color="text.secondary">
              Register a mandatory permit, fire clearance, lift certification, or environmental audit.
            </Typography>
            <IconButton onClick={() => setShowAddComplianceModal(false)} sx={{ position: "absolute", right: 12, top: 12 }}>
              <X size={18} />
            </IconButton>
          </DialogTitle>
          <form onSubmit={handleCreateCompliance}>
            <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Category *
                </label>
                <select
                  value={complianceForm.category}
                  onChange={(e) => setComplianceForm((f) => ({ ...f, category: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                  }}
                >
                  <option value="Fire Safety & Suppression">Fire Safety & Clearance Certificate</option>
                  <option value="Vertical Transport (Lifts)">Vertical Transport / Lift Annual Inspection (DOSHS)</option>
                  <option value="Environmental (NEMA)">NEMA Annual Environmental Audit</option>
                  <option value="Occupational Safety (DOSHS/OSHA)">DOSHS / OSHA Workplace Health & Safety Audit</option>
                  <option value="Energy & Electrical (EPRA)">EPRA Energy & Solar/Generator Audit</option>
                  <option value="County Licensing">County Single Business Permit</option>
                  <option value="Water & Borehole (WRMA)">WRMA Borehole Water Abstraction Permit</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Obligation / Certificate Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026 Annual Fire Clearance Certificate"
                  value={complianceForm.title}
                  onChange={(e) => setComplianceForm((f) => ({ ...f, title: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Issuing Authority
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nairobi City County Fire Dept"
                    value={complianceForm.issuing_authority}
                    onChange={(e) => setComplianceForm((f) => ({ ...f, issuing_authority: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Certificate Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NCC/FIRE/2026/0419"
                    value={complianceForm.certificate_number}
                    onChange={(e) => setComplianceForm((f) => ({ ...f, certificate_number: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={complianceForm.expiry_date}
                    onChange={(e) => setComplianceForm((f) => ({ ...f, expiry_date: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Responsible Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Facilities Engineer"
                    value={complianceForm.responsible_person_name}
                    onChange={(e) => setComplianceForm((f) => ({ ...f, responsible_person_name: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Auditing Notes / Action Plan
                </label>
                <textarea
                  rows={2}
                  placeholder="Renewal workflow details or required inspection attachments..."
                  value={complianceForm.notes}
                  onChange={(e) => setComplianceForm((f) => ({ ...f, notes: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setShowAddComplianceModal(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={complianceSaving} sx={{ fontWeight: 800 }}>
                {complianceSaving ? "Saving…" : "Save Obligation"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}

      {/* Modal: Log Risk Item */}
      {showAddRiskModal && (
        <Dialog open fullWidth maxWidth="sm" onClose={() => setShowAddRiskModal(false)}>
          <DialogTitle sx={{ pr: 7 }}>
            <Typography component="span" sx={{ display: "block", fontWeight: 850, fontSize: 18 }}>
              Log Facilities Risk Item (ISO 31000)
            </Typography>
            <Typography component="span" variant="body2" color="text.secondary">
              Record an identified hazard, score Likelihood × Impact, and assign a mitigation owner.
            </Typography>
            <IconButton onClick={() => setShowAddRiskModal(false)} sx={{ position: "absolute", right: 12, top: 12 }}>
              <X size={18} />
            </IconButton>
          </DialogTitle>
          <form onSubmit={handleCreateRisk}>
            <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Risk Reference
                  </label>
                  <input
                    type="text"
                    required
                    value={riskForm.risk_id}
                    onChange={(e) => setRiskForm((f) => ({ ...f, risk_id: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Risk Category
                  </label>
                  <select
                    value={riskForm.category}
                    onChange={(e) => setRiskForm((f) => ({ ...f, category: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  >
                    <option value="operational">Operational</option>
                    <option value="life_safety">Life Safety & Health (HSE)</option>
                    <option value="structural">Structural & Civil</option>
                    <option value="financial">Financial & Commercial</option>
                    <option value="statutory">Statutory & Compliance</option>
                    <option value="environmental">Environmental & Sustainability</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Hazard Description *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe the failure, root cause, or hazard (e.g. backup generator radiator leak during high ambient load)..."
                  value={riskForm.description}
                  onChange={(e) => setRiskForm((f) => ({ ...f, description: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "center" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Likelihood (1–5)
                  </label>
                  <select
                    value={riskForm.likelihood}
                    onChange={(e) => setRiskForm((f) => ({ ...f, likelihood: Number(e.target.value) }))}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  >
                    <option value={1}>1 · Rare</option>
                    <option value={2}>2 · Unlikely</option>
                    <option value={3}>3 · Possible</option>
                    <option value={4}>4 · Likely</option>
                    <option value={5}>5 · Almost Certain</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Impact (1–5)
                  </label>
                  <select
                    value={riskForm.impact}
                    onChange={(e) => setRiskForm((f) => ({ ...f, impact: Number(e.target.value) }))}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  >
                    <option value={1}>1 · Negligible</option>
                    <option value={2}>2 · Minor</option>
                    <option value={3}>3 · Moderate</option>
                    <option value={4}>4 · Major</option>
                    <option value={5}>5 · Catastrophic</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Inherent Score
                  </label>
                  {(() => {
                    const score = Number(riskForm.likelihood) * Number(riskForm.impact);
                    const bg = score >= 15 ? "var(--color-red-bg)" : score >= 8 ? "var(--color-amber-bg)" : "var(--color-green-bg)";
                    const col = score >= 15 ? "var(--color-danger-deep)" : score >= 8 ? "var(--color-amber-strong)" : "var(--color-green-text)";
                    return (
                      <div
                        style={{
                          padding: "7px 10px",
                          borderRadius: 6,
                          background: bg,
                          color: col,
                          fontWeight: 900,
                          fontSize: 14,
                          textAlign: "center",
                        }}
                      >
                        {score} / 25
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Mitigation Controls & Action Plan
                </label>
                <textarea
                  rows={2}
                  placeholder="Preventive maintenance, bypass valve installation, contractor callout SLA..."
                  value={riskForm.mitigation_controls}
                  onChange={(e) => setRiskForm((f) => ({ ...f, mitigation_controls: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Action Owner
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Mechanical Engineer"
                    value={riskForm.action_owner_name}
                    onChange={(e) => setRiskForm((f) => ({ ...f, action_owner_name: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Target Due Date
                  </label>
                  <input
                    type="date"
                    value={riskForm.due_date}
                    onChange={(e) => setRiskForm((f) => ({ ...f, due_date: e.target.value }))}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setShowAddRiskModal(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={riskSaving} sx={{ fontWeight: 800 }}>
                {riskSaving ? "Saving…" : "Save Risk Item"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}
    </div>
  );
}
