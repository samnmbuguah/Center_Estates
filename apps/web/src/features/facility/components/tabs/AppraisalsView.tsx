"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
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
  Tooltip,
  Typography,
} from "@mui/material";
import { Plus, Download, FileSpreadsheet, CheckCircle, AlertTriangle, X, ShieldCheck, ExternalLink, Sparkles, RotateCcw, CheckCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Row } from "../../types/facility.types";

interface AppraisalsViewProps {
  organizationId: string | null;
  canAdminister?: boolean;
}

export function AppraisalsView({ organizationId, canAdminister = true }: AppraisalsViewProps) {
  const [appraisals, setAppraisals] = useState<Row[]>([]);
  const [properties, setProperties] = useState<Row[]>([]);
  const [contractors, setContractors] = useState<Row[]>([]);
  const [serviceLines, setServiceLines] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create Appraisal Dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [newPropertyId, setNewPropertyId] = useState("");
  const [newContractorId, setNewContractorId] = useState("");
  const [newServiceLineId, setNewServiceLineId] = useState("");
  const [newPeriodName, setNewPeriodName] = useState("November 2025");
  const [newStartDate, setNewStartDate] = useState("2025-11-01");
  const [newEndDate, setNewEndDate] = useState("2025-11-30");

  // Evaluation Detail Modal
  const [evaluatingAppraisal, setEvaluatingAppraisal] = useState<Row | null>(null);
  const [evalResults, setEvalResults] = useState<Row[]>([]);
  const [evalActions, setEvalActions] = useState<Row[]>([]);
  const [evalRemarks, setEvalRemarks] = useState("");
  const [evalPmSignatory, setEvalPmSignatory] = useState("");
  const [evalSupSignatory, setEvalSupSignatory] = useState("");
  const [savingEvaluation, setSavingEvaluation] = useState(false);

  // Search params deep linking
  const searchParams = useSearchParams();
  const contractorParam = searchParams.get("contractor");
  const propertyParam = searchParams.get("property");
  const serviceLineParam = searchParams.get("service_line");

  useEffect(() => {
    if (contractorParam || serviceLineParam || propertyParam) {
      if (contractorParam) setNewContractorId(contractorParam);
      if (propertyParam) setNewPropertyId(propertyParam);
      if (serviceLineParam) setNewServiceLineId(serviceLineParam);
      setOpenCreate(true);
    }
  }, [contractorParam, propertyParam, serviceLineParam]);

  // New action line inside evaluation
  const [newIssue, setNewIssue] = useState("");
  const [newActionReq, setNewActionReq] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");

  const fetchAppraisals = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/facility/appraisals/", {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        setAppraisals(Array.isArray(data) ? data : []);
      } else {
        setError("Failed to load appraisals.");
      }
    } catch {
      setError("Network error loading appraisals.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const fetchMetadata = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [propRes, vndRes, slRes] = await Promise.all([
        apiFetch("/property/properties/", {}, organizationId),
        apiFetch("/facility/contractors/", {}, organizationId),
        apiFetch("/facility/service-lines/", {}, organizationId),
      ]);
      if (propRes.ok) setProperties(await propRes.json());
      if (vndRes.ok) setContractors(await vndRes.json());
      if (slRes.ok) setServiceLines(await slRes.json());
    } catch {
      // Ignore
    }
  }, [organizationId]);

  useEffect(() => {
    fetchAppraisals();
    fetchMetadata();
  }, [fetchAppraisals, fetchMetadata]);

  const handleCreateAppraisal = async () => {
    if (!newPropertyId || !newContractorId || !newServiceLineId || !newPeriodName) {
      setError("Please fill all required fields to initiate appraisal.");
      return;
    }
    setError("");
    try {
      const res = await apiFetch("/facility/appraisals/", {
        method: "POST",
        body: JSON.stringify({
          property: newPropertyId,
          contractor: newContractorId,
          service_line: newServiceLineId,
          period_name: newPeriodName.trim(),
          period_start: newStartDate || undefined,
          period_end: newEndDate || undefined,
          status: "draft",
        }),
      }, organizationId);
      if (res.ok) {
        const created = await res.json();
        setOpenCreate(false);
        setSuccessMsg(`Appraisal created for ${newPeriodName}! Now evaluate the metrics.`);
        fetchAppraisals();
        openEvaluationModal(created);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(JSON.stringify(err) || "Failed to create appraisal.");
      }
    } catch {
      setError("Network error creating appraisal.");
    }
  };

  const openEvaluationModal = (appraisal: Row) => {
    setEvaluatingAppraisal(appraisal);
    setEvalResults((appraisal.results as Row[]) || []);
    setEvalActions((appraisal.improvement_actions as Row[]) || []);
    setEvalRemarks((appraisal.remarks as string) || "");
    setEvalPmSignatory((appraisal.property_manager_signatory as string) || "Authorized Property Manager");
    setEvalSupSignatory((appraisal.provider_supervisor_signatory as string) || "Supervisor Service Provider");
  };

  const handleScoreChange = (idx: number, newScore: number) => {
    setEvalResults((prev) => {
      const next = [...prev];
      const maxW = Number(next[idx].max_weight || 5);
      const clampedScore = Math.max(0, Math.min(newScore, maxW));
      next[idx] = {
        ...next[idx],
        score: clampedScore,
        weighted_score: clampedScore,
      };
      return next;
    });
  };

  const handleCommentChange = (idx: number, comment: string) => {
    setEvalResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], comment };
      return next;
    });
  };

  const handleActionStatusChange = (actIdx: number, newStatus: string, correctionStatus: string) => {
    setEvalActions((prev) => {
      const next = [...prev];
      next[actIdx] = {
        ...next[actIdx],
        status: newStatus,
        correction_status: correctionStatus,
      };
      return next;
    });
  };

  const handleAddAction = () => {
    if (!newIssue.trim()) return;
    setEvalActions((prev) => [
      ...prev,
      {
        id: undefined,
        issue: newIssue.trim(),
        required_action: newActionReq.trim(),
        responsible_party: "Service Provider",
        target_date: newTargetDate || null,
        status: "open",
        correction_status: "not_corrected",
      },
    ]);
    setNewIssue("");
    setNewActionReq("");
    setNewTargetDate("");
  };

  const handleAwardFullScores = () => {
    setEvalResults((prev) =>
      prev.map((r) => {
        const maxW = Number(r.max_weight || 5);
        return {
          ...r,
          score: maxW,
          weighted_score: maxW,
        };
      })
    );
  };

  const handleResetScoresZero = () => {
    setEvalResults((prev) =>
      prev.map((r) => ({
        ...r,
        score: 0,
        weighted_score: 0,
      }))
    );
  };

  const currentTotalScore = evalResults.reduce((acc, r) => acc + (Number(r.score) || 0), 0);

  const getTierInfo = (score: number) => {
    if (score >= 85) return { label: "Tier 1 · Approved", color: "#15803d", bg: "#f0fdf4" };
    if (score >= 70) return { label: "Tier 2 · Monitored", color: "#b45309", bg: "#fffbeb" };
    return { label: "High Risk · Review", color: "#b91c1c", bg: "#fef2f2" };
  };

  const handleSaveEvaluation = async (post = false) => {
    if (!evaluatingAppraisal || !organizationId) return;
    setSavingEvaluation(true);
    setError("");
    try {
      const res = await apiFetch(`/facility/appraisals/${evaluatingAppraisal.id}/save_results/`, {
        method: "POST",
        body: JSON.stringify({
          results: evalResults,
          actions: evalActions,
          remarks: evalRemarks,
          property_manager_signatory: evalPmSignatory,
          provider_supervisor_signatory: evalSupSignatory,
          post,
        }),
      }, organizationId);
      if (res.ok) {
        setSuccessMsg(post ? "Appraisal POSTED and locked. Supplier invoice validation approved." : "Evaluation draft saved successfully.");
        fetchAppraisals();
        if (post) setEvaluatingAppraisal(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Failed to save appraisal evaluation.");
      }
    } catch {
      setError("Network error saving appraisal evaluation.");
    } finally {
      setSavingEvaluation(false);
    }
  };

  const handleExportExcel = (appraisalId: string) => {
    window.open(`/api/v1/facility/appraisals/${appraisalId}/export_excel/`, "_blank");
  };

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a" }}>
            Service Provider Performance Appraisals
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b" }}>
            Conduct structured periodic appraisals, track corrective actions, and export verified appraisal sheets.
          </Typography>
        </div>

        <Stack direction="row" spacing={1.5}>
          {canAdminister && (
            <Button
              variant="contained"
              onClick={() => setOpenCreate(true)}
              startIcon={<Plus size={16} />}
              sx={{
                background: "var(--color-brand-red, #dc2626)",
                color: "#ffffff",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: "8px",
                "&:hover": { background: "#b91c1c" },
              }}
            >
              New Evaluation
            </Button>
          )}
        </Stack>
      </div>

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: "8px" }}>
          {error}
        </Alert>
      )}

      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg("")} sx={{ borderRadius: "8px" }}>
          {successMsg}
        </Alert>
      )}

      {/* Appraisals Table */}
      <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: "10px", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ background: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Period</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Property</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Service Provider</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Service Line</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>Total Score</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>Tier Rating</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "#475569" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: "#64748b" }}>
                    Loading appraisals...
                  </TableCell>
                </TableRow>
              ) : appraisals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 32 }}>📝</span>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>No Appraisals recorded yet</Typography>
                      <Typography variant="body2" sx={{ color: "#64748b", maxWidth: 420 }}>
                        Click &quot;New Evaluation&quot; to conduct a monthly or quarterly performance scorecard for cleaning, security, or maintenance vendors.
                      </Typography>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                appraisals.map((app) => {
                  const score = Number(app.total_score || 0);
                  const tier = getTierInfo(score);
                  const isPosted = app.status === "posted";
                  return (
                    <TableRow key={app.id as string} hover>
                      <TableCell sx={{ fontWeight: 700, color: "#1e293b" }}>
                        {app.period_name as string}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{(app.property_name as string) || "—"}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: "#2563eb" }}>
                        {(app.contractor_name as string) || "—"}
                      </TableCell>
                      <TableCell>{(app.service_line_name as string) || "—"}</TableCell>
                      <TableCell align="center">
                        <span style={{ fontWeight: 800, fontSize: "15px", color: tier.color }}>
                          {score.toFixed(1)} / 100
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={tier.label}
                          sx={{ fontWeight: 700, fontSize: "11px", bgcolor: tier.bg, color: tier.color }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={isPosted ? "POSTED" : "DRAFT"}
                          sx={{
                            fontWeight: 700,
                            fontSize: "11px",
                            bgcolor: isPosted ? "#f0fdf4" : "#fffbeb",
                            color: isPosted ? "#15803d" : "#b45309",
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openEvaluationModal(app)}
                            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "6px" }}
                          >
                            {isPosted ? "View Appraisal" : "Evaluate"}
                          </Button>
                          <Tooltip title="Export client Excel workbook">
                            <IconButton
                              size="small"
                              onClick={() => handleExportExcel(app.id as string)}
                              sx={{ color: "#16a34a" }}
                            >
                              <FileSpreadsheet size={18} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog: Create New Appraisal */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Initiate New Performance Appraisal</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <FormControl fullWidth required>
            <InputLabel>Building / Property</InputLabel>
            <Select
              value={newPropertyId}
              label="Building / Property"
              onChange={(e) => setNewPropertyId(e.target.value)}
            >
              {properties.map((p) => (
                <MenuItem key={p.id as string} value={p.id as string}>
                  {p.name as string}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Service Provider</InputLabel>
            <Select
              value={newContractorId}
              label="Service Provider"
              onChange={(e) => setNewContractorId(e.target.value)}
            >
              {contractors.map((c) => (
                <MenuItem key={c.id as string} value={c.id as string}>
                  {c.name as string} ({c.specialty as string || "Contractor"})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Service Line & Scorecard</InputLabel>
            <Select
              value={newServiceLineId}
              label="Service Line & Scorecard"
              onChange={(e) => setNewServiceLineId(e.target.value)}
            >
              {serviceLines.map((sl) => (
                <MenuItem key={sl.id as string} value={sl.id as string}>
                  {sl.name as string} ({String(sl.appraisal_frequency).toUpperCase()})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Period / Month (e.g. November 2025)"
            value={newPeriodName}
            onChange={(e) => setNewPeriodName(e.target.value)}
            fullWidth
            required
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End Date"
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenCreate(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateAppraisal}
            sx={{
              background: "var(--color-brand-red, #dc2626)",
              textTransform: "none",
              fontWeight: 700,
              "&:hover": { background: "#b91c1c" },
            }}
          >
            Start Appraisal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Appraisal Evaluation Drawer / Sheet */}
      <Dialog
        open={Boolean(evaluatingAppraisal)}
        onClose={() => setEvaluatingAppraisal(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <div>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {evaluatingAppraisal?.service_line_name as string || "Service"} Appraisal — {evaluatingAppraisal?.period_name as string}
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              Property: {evaluatingAppraisal?.property_name as string} · Vendor: {evaluatingAppraisal?.contractor_name as string} · Status: {String(evaluatingAppraisal?.status).toUpperCase()}
            </Typography>
          </div>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {evaluatingAppraisal && (
              <Button
                size="small"
                variant="outlined"
                color="success"
                onClick={() => handleExportExcel(evaluatingAppraisal.id as string)}
                startIcon={<FileSpreadsheet size={15} />}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Export Excel
              </Button>
            )}
            <IconButton onClick={() => setEvaluatingAppraisal(null)}>
              <X size={20} />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Summary Score Bar & Actions */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            padding: "14px 18px",
            borderRadius: "10px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}>
            <div>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Total Weighted Score
              </Typography>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: "28px", fontWeight: 900, color: getTierInfo(currentTotalScore).color }}>
                  {currentTotalScore.toFixed(1)}
                </span>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "#64748b" }}>/ 100.0</span>
              </div>
            </div>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Chip
                label={getTierInfo(currentTotalScore).label}
                sx={{
                  fontWeight: 800,
                  fontSize: "13px",
                  px: 1,
                  bgcolor: getTierInfo(currentTotalScore).bg,
                  color: getTierInfo(currentTotalScore).color,
                  border: `1px solid ${getTierInfo(currentTotalScore).color}`,
                }}
              />
              <Button
                size="small"
                variant="outlined"
                color="success"
                onClick={handleAwardFullScores}
                startIcon={<CheckCheck size={14} />}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px", bgcolor: "#f0fdf4" }}
              >
                Set All to 100%
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={handleResetScoresZero}
                startIcon={<RotateCcw size={14} />}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: "6px", color: "#64748b" }}
              >
                Reset to 0%
              </Button>
            </Stack>
          </div>

          {/* Progress Tracker Bar */}
          {(() => {
            const evaluatedCount = evalResults.filter((r) => Number(r.score) > 0 || Boolean(r.comment)).length;
            const totalCount = evalResults.length;
            const pct = totalCount ? Math.round((evaluatedCount / totalCount) * 100) : 0;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                  <span>AUDIT COMPLETION</span>
                  <span>{evaluatedCount} of {totalCount} metrics evaluated ({pct}%)</span>
                </div>
                <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#16a34a" : "#2563eb", transition: "width 0.3s ease" }} />
                </div>
              </div>
            );
          })()}

          {/* Carried Forward Previous Period Actions */}
          {evalActions.filter((a) => Boolean(a.carried_forward_from)).length > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: "8px", background: "#fffbeb", border: "1px solid #fde68a" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#b45309", mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                <AlertTriangle size={16} /> Carried Forward Open Issues From Previous Period
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Unresolved Issue</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Required Action</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Correction Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {evalActions.filter((a) => Boolean(a.carried_forward_from)).map((act, actIdx) => (
                    <TableRow key={act.id as string || actIdx}>
                      <TableCell sx={{ fontWeight: 600 }}>{act.issue as string}</TableCell>
                      <TableCell>{act.required_action as string}</TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={act.correction_status as string || "not_corrected"}
                          onChange={(e) => {
                            const val = e.target.value;
                            const st = val === "corrected" ? "closed" : "open";
                            handleActionStatusChange(actIdx, st, val);
                          }}
                        >
                          <MenuItem value="not_corrected">Not Corrected</MenuItem>
                          <MenuItem value="partially_corrected">Partially Corrected</MenuItem>
                          <MenuItem value="corrected">Corrected / Closed</MenuItem>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Evaluation Metrics Table (Exact match to Nov 2025 Excel Rubric) */}
          <div>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Responsibilities &amp; Metric Ratings
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #e2e8f0" }}>
              <Table size="small">
                <TableHead sx={{ background: "#1e3a8a" }}>
                  <TableRow>
                    <TableCell sx={{ color: "#ffffff", fontWeight: 700, width: 40 }}>No</TableCell>
                    <TableCell sx={{ color: "#ffffff", fontWeight: 700, width: 300 }}>Responsibilities / Description</TableCell>
                    <TableCell sx={{ color: "#ffffff", fontWeight: 700, width: 220 }}>Target Standard</TableCell>
                    <TableCell align="center" sx={{ color: "#ffffff", fontWeight: 700, width: 100 }}>Score Rating</TableCell>
                    <TableCell align="center" sx={{ color: "#ffffff", fontWeight: 700, width: 85 }}>Max Pts</TableCell>
                    <TableCell sx={{ color: "#ffffff", fontWeight: 700 }}>Observation / Comment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {evalResults.map((r, idx) => (
                    <TableRow key={r.id as string || idx} hover>
                      <TableCell sx={{ fontWeight: 700, color: "#64748b" }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.measure as string}</TableCell>
                      <TableCell sx={{ color: "#475569", fontSize: "12px" }}>
                        {(r.target_standard as string) || "Agreed standard"}
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          size="small"
                          type="number"
                          value={Number(r.score)}
                          onChange={(e) => handleScoreChange(idx, parseFloat(e.target.value) || 0)}
                          slotProps={{ htmlInput: { min: 0, max: Number(r.max_weight || 10), step: 0.5 } }}
                          sx={{ width: 75, input: { textAlign: "center", fontWeight: 800 } }}
                        />
                        <Stack direction="row" spacing={0.4} sx={{ mt: 0.5, justifyContent: "center" }}>
                          <Chip
                            size="small"
                            label="100%"
                            onClick={() => handleScoreChange(idx, Number(r.max_weight || 5))}
                            sx={{ height: 17, fontSize: 9, cursor: "pointer", fontWeight: 700, bgcolor: "#f0fdf4", color: "#166534" }}
                          />
                          <Chip
                            size="small"
                            label="75%"
                            onClick={() => handleScoreChange(idx, Math.round(Number(r.max_weight || 5) * 0.75 * 10) / 10)}
                            sx={{ height: 17, fontSize: 9, cursor: "pointer", fontWeight: 700, bgcolor: "#eff6ff", color: "#1e40af" }}
                          />
                          <Chip
                            size="small"
                            label="50%"
                            onClick={() => handleScoreChange(idx, Math.round(Number(r.max_weight || 5) * 0.5 * 10) / 10)}
                            sx={{ height: 17, fontSize: 9, cursor: "pointer", fontWeight: 700, bgcolor: "#fffbeb", color: "#92400e" }}
                          />
                          <Chip
                            size="small"
                            label="0"
                            onClick={() => handleScoreChange(idx, 0)}
                            sx={{ height: 17, fontSize: 9, cursor: "pointer", fontWeight: 700, bgcolor: "#fef2f2", color: "#991b1b" }}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: "#1e3a8a" }}>
                        {Number(r.max_weight || 5).toFixed(1)}
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Record inspection notes or defects observed..."
                          value={(r.comment as string) || (r.actual_observation as string) || ""}
                          onChange={(e) => handleCommentChange(idx, e.target.value)}
                        />
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                          <Chip
                            size="small"
                            label="✓ Full Compliance"
                            onClick={() => handleCommentChange(idx, "Satisfactory: Fully compliant with agreed SLA standard.")}
                            sx={{ height: 18, fontSize: 10, cursor: "pointer", bgcolor: "#f8fafc" }}
                          />
                          <Chip
                            size="small"
                            label="⚠ Minor Defect"
                            onClick={() => handleCommentChange(idx, "Minor defect observed during inspection walkthrough. Rectification advised.")}
                            sx={{ height: 18, fontSize: 10, cursor: "pointer", bgcolor: "#f8fafc" }}
                          />
                          <Chip
                            size="small"
                            label="🚨 Non-Compliance"
                            onClick={() => handleCommentChange(idx, "Non-compliant with contract standard. Corrective action logged.")}
                            sx={{ height: 18, fontSize: 10, cursor: "pointer", bgcolor: "#fef2f2", color: "#b91c1c" }}
                          />
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {/* New Corrective Action Items */}
          <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Record New Improvement / Corrective Action
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <TextField
                size="small"
                placeholder="Identified issue / defect"
                value={newIssue}
                onChange={(e) => setNewIssue(e.target.value)}
                sx={{ flex: 2 }}
              />
              <TextField
                size="small"
                placeholder="Required corrective action"
                value={newActionReq}
                onChange={(e) => setNewActionReq(e.target.value)}
                sx={{ flex: 2 }}
              />
              <TextField
                size="small"
                type="date"
                label="Target Date"
                slotProps={{ inputLabel: { shrink: true } }}
                value={newTargetDate}
                onChange={(e) => setNewTargetDate(e.target.value)}
                sx={{ width: 160 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddAction}
                sx={{ textTransform: "none", fontWeight: 700, height: 40 }}
              >
                Add Action
              </Button>
            </Stack>
          </div>

          {/* Signatories & Manager Remarks */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <TextField
              label="Property Manager Signatory"
              value={evalPmSignatory}
              onChange={(e) => setEvalPmSignatory(e.target.value)}
              fullWidth
            />
            <TextField
              label="Supervisor Service Provider Signatory"
              value={evalSupSignatory}
              onChange={(e) => setEvalSupSignatory(e.target.value)}
              fullWidth
            />
            <TextField
              label="Property Manager Remarks"
              value={evalRemarks}
              onChange={(e) => setEvalRemarks(e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={{ gridColumn: "1 / -1" }}
            />
          </div>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
          <Button onClick={() => setEvaluatingAppraisal(null)} sx={{ textTransform: "none" }}>
            Close
          </Button>

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              onClick={() => handleSaveEvaluation(false)}
              disabled={savingEvaluation}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Save Draft
            </Button>
            <Button
              variant="contained"
              onClick={() => handleSaveEvaluation(true)}
              disabled={savingEvaluation}
              sx={{
                background: "var(--color-brand-red, #dc2626)",
                textTransform: "none",
                fontWeight: 700,
                "&:hover": { background: "#b91c1c" },
              }}
            >
              Post Appraisal &amp; Validate Invoicing
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default AppraisalsView;
