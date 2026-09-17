"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Typography,
} from "@mui/material";
import { CheckCircle2, Clock, AlertTriangle, Check, X, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Row } from "../../types/facility.types";

interface CorrectiveActionsViewProps {
  organizationId: string | null;
  canAdminister?: boolean;
}

export function CorrectiveActionsView({ organizationId, canAdminister = true }: CorrectiveActionsViewProps) {
  const [actions, setActions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Status update modal
  const [selectedAction, setSelectedAction] = useState<Row | null>(null);
  const [updateStatus, setUpdateStatus] = useState("closed");
  const [updateCorrection, setUpdateCorrection] = useState("corrected");
  const [managerComment, setManagerComment] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchActions = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/facility/corrective-actions/", {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        setActions(Array.isArray(data) ? data : []);
      } else {
        setError("Failed to load corrective actions.");
      }
    } catch {
      setError("Network error loading corrective actions.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleOpenUpdate = (action: Row) => {
    setSelectedAction(action);
    setUpdateStatus(action.status === "closed" ? "closed" : "closed");
    setUpdateCorrection(action.correction_status === "corrected" ? "corrected" : "corrected");
    setManagerComment((action.manager_comment as string) || "");
  };

  const handleSaveUpdate = async () => {
    if (!selectedAction || !organizationId) return;
    setUpdating(true);
    try {
      const res = await apiFetch(`/facility/corrective-actions/${selectedAction.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          status: updateStatus,
          correction_status: updateCorrection,
          manager_comment: managerComment.trim(),
        }),
      }, organizationId);
      if (res.ok) {
        setSuccessMsg("Corrective action updated successfully.");
        setSelectedAction(null);
        fetchActions();
      } else {
        setError("Failed to update corrective action.");
      }
    } catch {
      setError("Network error updating corrective action.");
    } finally {
      setUpdating(false);
    }
  };

  const filtered = actions.filter((a) => {
    if (filterStatus === "all") return true;
    return a.status === filterStatus;
  });

  const totalCount = actions.length;
  const openCount = actions.filter((a) => a.status === "open").length;
  const inProgressCount = actions.filter((a) => a.status === "in_progress").length;
  const closedCount = actions.filter((a) => a.status === "closed").length;
  const closureRate = totalCount ? Math.round((closedCount / totalCount) * 100) : 100;

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a" }}>
            Service Provider Corrective Action Tracker
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b" }}>
            Track resolution of audit findings and ensure contractor improvements carry forward across periods.
          </Typography>
        </div>

        <FormControl size="small" sx={{ width: 180 }}>
          <InputLabel>Status Filter</InputLabel>
          <Select
            value={filterStatus}
            label="Status Filter"
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <MenuItem value="all">All Actions ({totalCount})</MenuItem>
            <MenuItem value="open">Open ({openCount})</MenuItem>
            <MenuItem value="in_progress">In Progress ({inProgressCount})</MenuItem>
            <MenuItem value="closed">Closed ({closedCount})</MenuItem>
          </Select>
        </FormControl>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b" }}>TOTAL ACTIONS</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#1e293b", mt: 0.5 }}>{totalCount}</Typography>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#b91c1c" }}>OPEN / OVERDUE</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#b91c1c", mt: 0.5 }}>{openCount}</Typography>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#b45309" }}>IN PROGRESS</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#b45309", mt: 0.5 }}>{inProgressCount}</Typography>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#15803d" }}>CLOSURE RATE</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#15803d", mt: 0.5 }}>{closureRate}%</Typography>
        </div>
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

      {/* Table */}
      <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: "10px", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ background: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Appraisal Period</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Issue Observed</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Required Action</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Responsible Party</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Target Date</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "#475569" }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: "#64748b" }}>
                    Loading corrective actions...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={32} color="#15803d" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>No actions matching filter</Typography>
                      <Typography variant="body2" sx={{ color: "#64748b" }}>
                        All vendor improvement actions are resolved.
                      </Typography>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((act) => {
                  const isClosed = act.status === "closed";
                  const isCarried = Boolean(act.carried_forward_from);
                  return (
                    <TableRow key={act.id as string} hover>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {String(act.appraisal_id || "Appraisal")}
                        {isCarried && (
                          <Chip size="small" label="Carried Forward" sx={{ ml: 1, fontSize: "10px", bgcolor: "#fffbeb", color: "#b45309" }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: "#1e293b" }}>{act.issue as string}</TableCell>
                      <TableCell>{act.required_action as string}</TableCell>
                      <TableCell>{(act.responsible_party as string) || "Service Provider"}</TableCell>
                      <TableCell>{(act.target_date as string) || "—"}</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={String(act.status).toUpperCase()}
                          sx={{
                            fontWeight: 700,
                            fontSize: "11px",
                            bgcolor: isClosed ? "#f0fdf4" : act.status === "in_progress" ? "#eff6ff" : "#fef2f2",
                            color: isClosed ? "#15803d" : act.status === "in_progress" ? "#1e40af" : "#b91c1c",
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleOpenUpdate(act)}
                          sx={{ textTransform: "none", fontWeight: 600 }}
                        >
                          Review / Close
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modal: Review & Close Action */}
      <Dialog open={Boolean(selectedAction)} onClose={() => setSelectedAction(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Review Corrective Action</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <div>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b" }}>ISSUE</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedAction?.issue as string}</Typography>
          </div>

          <div>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b" }}>REQUIRED ACTION</Typography>
            <Typography variant="body2">{selectedAction?.required_action as string}</Typography>
          </div>

          <FormControl fullWidth>
            <InputLabel>Workflow Status</InputLabel>
            <Select
              value={updateStatus}
              label="Workflow Status"
              onChange={(e) => setUpdateStatus(e.target.value)}
            >
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="closed">Closed / Resolved</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Correction Status</InputLabel>
            <Select
              value={updateCorrection}
              label="Correction Status"
              onChange={(e) => setUpdateCorrection(e.target.value)}
            >
              <MenuItem value="not_corrected">Not Corrected</MenuItem>
              <MenuItem value="partially_corrected">Partially Corrected</MenuItem>
              <MenuItem value="corrected">Corrected</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Manager Verification Comments"
            value={managerComment}
            onChange={(e) => setManagerComment(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSelectedAction(null)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveUpdate}
            disabled={updating}
            sx={{
              background: "var(--color-brand-red, #dc2626)",
              textTransform: "none",
              fontWeight: 700,
              "&:hover": { background: "#b91c1c" },
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default CorrectiveActionsView;
