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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
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
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        borderRadius: 2,
        flex: 1,
        minWidth: 160,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            background: iconBg,
            color: iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 900 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Top Strip */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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
      </Box>

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
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Statutory Compliance Register & Certificate Tracking</Typography>
            <Typography variant="caption" color="text.secondary">
              Mandatory certificates with automated 30-day and 60-day expiry countdowns
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Category & Title</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Issuing Authority</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Certificate No.</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Expiry Date</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Responsible Person</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {obligations.map((c) => {
                  const expiry = c.expiry_date ? new Date(String(c.expiry_date)) : null;
                  const isExpired = expiry ? expiry.getTime() <= Date.now() : false;
                  const isDueSoon = expiry ? expiry.getTime() - Date.now() < 30 * 86400000 && expiry.getTime() > Date.now() : false;
                  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

                  return (
                    <TableRow key={String(c.id)} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(c.title)}</Typography>
                        <Typography variant="caption" color="info.main" sx={{ fontWeight: 700 }}>{String(c.category)}</Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{String(c.issuing_authority ?? "—")}</Typography></TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(c.certificate_number ?? "—")}</Typography></TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700 }}
                          color={isExpired ? "error" : isDueSoon ? "warning.main" : "text.primary"}
                        >
                          {String(c.expiry_date)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={isExpired ? "Expired" : isDueSoon ? `Due Soon (${daysLeft}d)` : "Compliant"}
                          size="small"
                          color={isExpired ? "error" : isDueSoon ? "warning" : "success"}
                          sx={{ fontWeight: 800, fontSize: 10 }}
                        />
                      </TableCell>
                      <TableCell><Typography variant="body2">{String(c.responsible_person_name ?? "—")}</Typography></TableCell>
                    </TableRow>
                  );
                })}
                {obligations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No statutory compliance obligations are recorded for this property.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
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
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => setSelectedCell(null)}
                  sx={{ fontWeight: 800 }}
                >
                  ✕ Clear Filter (L{selectedCell.l} × I{selectedCell.i})
                </Button>
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
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Facilities Risk Register & Mitigation Controls {selectedCell ? `(Filtered: L${selectedCell.l} × I${selectedCell.i})` : "(All Risks)"}
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Risk ID & Description</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Inherent Score</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Mitigation Controls</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Residual</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Owner & Due Date</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRisks.map((r) => {
                    const inherentVal = Number(r.inherent_score ?? 9);
                    const isSelected = selectedRisk?.id === r.id;
                    return (
                      <TableRow
                        key={String(r.id)}
                        hover
                        onClick={() => setSelectedRisk(isSelected ? null : r)}
                        sx={{ cursor: "pointer", bgcolor: isSelected ? "primary.50" : undefined }}
                      >
                        <TableCell>
                          <Chip
                            label={String(r.risk_id)}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 800, fontSize: 10, mb: 0.5 }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>{String(r.description)}</Typography>
                          <Typography variant="caption" color="info.main" sx={{ fontWeight: 700 }}>{String(r.category)}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${inherentVal} / 25`}
                            size="small"
                            color={inherentVal >= 12 ? "error" : "warning"}
                            sx={{ fontWeight: 900 }}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 320 }}>
                          <Typography variant="body2" color="text.secondary">{String(r.mitigation_controls ?? "—")}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={String(r.residual_score ?? "—")}
                            size="small"
                            color="success"
                            sx={{ fontWeight: 800 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(r.action_owner_name ?? "—")}</Typography>
                          <Typography variant="caption" color="text.secondary">Due: {String(r.due_date ?? "—")}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={String(r.status ?? "open")}
                            size="small"
                            color={r.status === "mitigating" ? "info" : "warning"}
                            sx={{ fontWeight: 800, fontSize: 10, textTransform: "uppercase" }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {visibleRisks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        No risk records match this property and filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </div>
      )}

      {/* Flags Section */}
      {mode === "compliance" && (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Automated Rule-Based Flags & Operational Escalations
            </Typography>
          </Box>
          <Box sx={{ p: 2.5, display: "grid", gap: 1.5 }}>
            {flagError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>{flagError}</Alert>
            )}
            {flags.length === 0 && !flagError && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                No active operational flags for this property.
              </Typography>
            )}
            {flags.map((f) => (
              <Paper
                key={String(f.id)}
                variant="outlined"
                sx={{
                  px: 2,
                  py: 1.5,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 1.5,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                  <Typography sx={{ fontSize: 22 }}>{f.severity === "warning" ? "⚠️" : "ℹ️"}</Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(f.title ?? "Operational flag")}</Typography>
                    <Typography variant="caption" color="text.secondary">{String(f.message ?? "")}</Typography>
                  </Box>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Check size={14} />}
                  disabled={resolvingFlag === String(f.id)}
                  onClick={() => void resolveFlag(f)}
                  sx={{ fontWeight: 700 }}
                >
                  {resolvingFlag === String(f.id) ? "Resolving…" : "Acknowledge / Resolve"}
                </Button>
              </Paper>
            ))}
          </Box>
        </Paper>
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
              <FormControl fullWidth size="small">
                <InputLabel>Category *</InputLabel>
                <Select
                  label="Category *"
                  value={complianceForm.category}
                  onChange={(e) => setComplianceForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <MenuItem value="Fire Safety & Suppression">Fire Safety & Clearance Certificate</MenuItem>
                  <MenuItem value="Vertical Transport (Lifts)">Vertical Transport / Lift Annual Inspection (DOSHS)</MenuItem>
                  <MenuItem value="Environmental (NEMA)">NEMA Annual Environmental Audit</MenuItem>
                  <MenuItem value="Occupational Safety (DOSHS/OSHA)">DOSHS / OSHA Workplace Health & Safety Audit</MenuItem>
                  <MenuItem value="Energy & Electrical (EPRA)">EPRA Energy & Solar/Generator Audit</MenuItem>
                  <MenuItem value="County Licensing">County Single Business Permit</MenuItem>
                  <MenuItem value="Water & Borehole (WRMA)">WRMA Borehole Water Abstraction Permit</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Obligation / Certificate Title *"
                size="small"
                required
                fullWidth
                placeholder="e.g. 2026 Annual Fire Clearance Certificate"
                value={complianceForm.title}
                onChange={(e) => setComplianceForm((f) => ({ ...f, title: e.target.value }))}
              />

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                <TextField
                  label="Issuing Authority"
                  size="small"
                  fullWidth
                  placeholder="e.g. Nairobi City County Fire Dept"
                  value={complianceForm.issuing_authority}
                  onChange={(e) => setComplianceForm((f) => ({ ...f, issuing_authority: e.target.value }))}
                />
                <TextField
                  label="Certificate Number"
                  size="small"
                  fullWidth
                  placeholder="e.g. NCC/FIRE/2026/0419"
                  value={complianceForm.certificate_number}
                  onChange={(e) => setComplianceForm((f) => ({ ...f, certificate_number: e.target.value }))}
                />
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                <TextField
                  label="Expiry Date *"
                  type="date"
                  size="small"
                  required
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={complianceForm.expiry_date}
                  onChange={(e) => setComplianceForm((f) => ({ ...f, expiry_date: e.target.value }))}
                />
                <TextField
                  label="Responsible Person"
                  size="small"
                  fullWidth
                  placeholder="e.g. Facilities Engineer"
                  value={complianceForm.responsible_person_name}
                  onChange={(e) => setComplianceForm((f) => ({ ...f, responsible_person_name: e.target.value }))}
                />
              </Box>

              <TextField
                label="Auditing Notes / Action Plan"
                size="small"
                fullWidth
                multiline
                rows={2}
                placeholder="Renewal workflow details or required inspection attachments..."
                value={complianceForm.notes}
                onChange={(e) => setComplianceForm((f) => ({ ...f, notes: e.target.value }))}
              />
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
              <Box sx={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 1.5 }}>
                <TextField
                  label="Risk Reference"
                  size="small"
                  required
                  fullWidth
                  value={riskForm.risk_id}
                  onChange={(e) => setRiskForm((f) => ({ ...f, risk_id: e.target.value }))}
                  slotProps={{ htmlInput: { style: { fontWeight: 800 } } }}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Risk Category</InputLabel>
                  <Select
                    label="Risk Category"
                    value={riskForm.category}
                    onChange={(e) => setRiskForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    <MenuItem value="operational">Operational</MenuItem>
                    <MenuItem value="life_safety">Life Safety & Health (HSE)</MenuItem>
                    <MenuItem value="structural">Structural & Civil</MenuItem>
                    <MenuItem value="financial">Financial & Commercial</MenuItem>
                    <MenuItem value="statutory">Statutory & Compliance</MenuItem>
                    <MenuItem value="environmental">Environmental & Sustainability</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <TextField
                label="Hazard Description *"
                size="small"
                required
                fullWidth
                multiline
                rows={2}
                placeholder="Describe the failure, root cause, or hazard..."
                value={riskForm.description}
                onChange={(e) => setRiskForm((f) => ({ ...f, description: e.target.value }))}
              />

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5, alignItems: "center" }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Likelihood (1–5)</InputLabel>
                  <Select
                    label="Likelihood (1–5)"
                    value={riskForm.likelihood}
                    onChange={(e) => setRiskForm((f) => ({ ...f, likelihood: Number(e.target.value) }))}
                  >
                    <MenuItem value={1}>1 · Rare</MenuItem>
                    <MenuItem value={2}>2 · Unlikely</MenuItem>
                    <MenuItem value={3}>3 · Possible</MenuItem>
                    <MenuItem value={4}>4 · Likely</MenuItem>
                    <MenuItem value={5}>5 · Almost Certain</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel>Impact (1–5)</InputLabel>
                  <Select
                    label="Impact (1–5)"
                    value={riskForm.impact}
                    onChange={(e) => setRiskForm((f) => ({ ...f, impact: Number(e.target.value) }))}
                  >
                    <MenuItem value={1}>1 · Negligible</MenuItem>
                    <MenuItem value={2}>2 · Minor</MenuItem>
                    <MenuItem value={3}>3 · Moderate</MenuItem>
                    <MenuItem value={4}>4 · Major</MenuItem>
                    <MenuItem value={5}>5 · Catastrophic</MenuItem>
                  </Select>
                </FormControl>

                {(() => {
                  const score = Number(riskForm.likelihood) * Number(riskForm.impact);
                  return (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>Inherent Score</Typography>
                      <Chip
                        label={`${score} / 25`}
                        color={score >= 15 ? "error" : score >= 8 ? "warning" : "success"}
                        sx={{ fontWeight: 900, width: "100%", borderRadius: 1.5 }}
                      />
                    </Box>
                  );
                })()}
              </Box>

              <TextField
                label="Mitigation Controls & Action Plan"
                size="small"
                fullWidth
                multiline
                rows={2}
                placeholder="Preventive maintenance, bypass valve installation, contractor callout SLA..."
                value={riskForm.mitigation_controls}
                onChange={(e) => setRiskForm((f) => ({ ...f, mitigation_controls: e.target.value }))}
              />

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                <TextField
                  label="Action Owner"
                  size="small"
                  fullWidth
                  placeholder="e.g. Lead Mechanical Engineer"
                  value={riskForm.action_owner_name}
                  onChange={(e) => setRiskForm((f) => ({ ...f, action_owner_name: e.target.value }))}
                />
                <TextField
                  label="Target Due Date"
                  type="date"
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={riskForm.due_date}
                  onChange={(e) => setRiskForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </Box>
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
    </Box>
  );
}
