"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import { Download, Plus } from "lucide-react";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus, HealthBar } from "../FacilityToolbar";

function FcKpiCard({
  icon, iconBg, iconColor, label, value, sub,
}: {
  icon: string; iconBg: string; iconColor: string; label: string; value: string; sub?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 0.5, borderRadius: 2, flex: 1, minWidth: 140 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          {icon}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 900 }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
}

export function InspectionsView({
  rows,
  kpis,
  onAction,
  permissions,
  onAdd,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
  onAction: (row: Row, action: string) => void;
  permissions: { canInspect: boolean };
  onAdd: () => void;
}) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const displayRows = rows;

  const hasData = rows.length > 0;
  const totalInsp = rows.length;
  const completedInsp = rows.filter((r) => !["scheduled", "in_progress"].includes(String(r.status))).length;
  const inProgressInsp = rows.filter((r) => String(r.status) === "in_progress").length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueInsp = rows.filter((row) => ["scheduled", "in_progress"].includes(String(row.status)) && String(row.scheduled_on ?? "") < today).length;
  const defectsFound = rows.reduce((s, r) => s + Number(r.violations ?? 0), 0);
  const scoredRows = rows.filter((r) => Number(r.score ?? 0) > 0);
  const complianceScore = scoredRows.length ? Math.round(scoredRows.reduce((s, r) => s + Number(r.score ?? 0), 0) / scoredRows.length) : Number(kpis?.maintenanceCompliance ?? 0);
  const pctOfTotal = (n: number) => (totalInsp ? Math.round((n / totalInsp) * 100) : 0);

  const term = search.trim().toLowerCase();
  const completedStatuses = new Set(["passed", "failed"]);
  const filteredRows = displayRows.filter((row) => {
    const status = String(row.status ?? "");
    const statusMatches = statusFilter === "all" || statusFilter === "list"
      || (statusFilter === "completed" ? completedStatuses.has(status) : status === statusFilter);
    const searchMatches = !term || [row.title, row.reference, row.asset_name, row.property_name, row.inspection_type]
      .some((value) => String(value ?? "").toLowerCase().includes(term));
    return statusMatches && searchMatches;
  });

  return (
    <>
      {/* KPI Strip */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <FcKpiCard icon="📋" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Total Inspections" value={String(totalInsp)} sub={hasData ? "All records" : "0"} />
        <FcKpiCard icon="✓" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Completed" value={String(completedInsp)} sub={`${pctOfTotal(completedInsp)}%`} />
        <FcKpiCard icon="⏳" iconBg="var(--color-amber-bg)" iconColor="var(--color-amber-strong)" label="In Progress" value={String(inProgressInsp)} sub={`${pctOfTotal(inProgressInsp)}%`} />
        <FcKpiCard icon="⚠" iconBg="var(--color-red-bg)" iconColor="var(--color-danger-strong)" label="Overdue" value={String(overdueInsp)} sub={`${pctOfTotal(overdueInsp)}%`} />
        <FcKpiCard icon="🔍" iconBg="#fdf4ff" iconColor="var(--color-purple)" label="Defects Found" value={String(defectsFound)} sub="All items" />
        <FcKpiCard icon="🛡" iconBg="var(--color-green-soft)" iconColor="var(--color-success-strong)" label="Compliance Score" value={`${complianceScore}%`} sub="Avg. completed score" />
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: selectedRow ? "minmax(0,1fr) 340px" : "1fr" }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          {/* Toolbar */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <TextField
                size="small"
                placeholder="Search inspections…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                slotProps={{ htmlInput: { "data-testid": "insp-search-input" } }}
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All Inspections</MenuItem>
                  <MenuItem value="scheduled">Scheduled</MenuItem>
                  <MenuItem value="in_progress">In progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="follow_up">Follow-up required</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={() => exportCsv(displayRows, "inspections.csv")}>
                Export
              </Button>
              <Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={onAdd} data-testid="facility-create-inspection-btn">
                New Inspection
              </Button>
            </Box>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Inspection Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Asset / System</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Building / Location</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Score</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No inspections recorded. Click &quot;+ New Inspection&quot; to create an inspection.
                    </TableCell>
                  </TableRow>
                ) : filteredRows.map((row) => {
                  const score = Number(row.score ?? 0);
                  const status = String(row.status ?? "scheduled");
                  const insType = String(row.inspection_type ?? "routine");
                  return (
                    <TableRow
                      key={String(row.id)}
                      hover
                      selected={selectedRow?.id === row.id}
                      onClick={() => setSelectedRow(selectedRow?.id === row.id ? null : row)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(row.title ?? "—")}</Typography>
                        {Boolean(row.reference) && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "ui-monospace, monospace" }}>
                            {String(row.reference)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{String(row.asset_name ?? "—")}</Typography></TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{String(row.property_name ?? "—")}</Typography></TableCell>
                      <TableCell><FcStatus value={insType} /></TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{String(row.scheduled_on ?? "—")}</Typography></TableCell>
                      <TableCell><FcStatus value={status.replace("_", "-")} /></TableCell>
                      <TableCell>
                        {score > 0 ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Box
                              sx={{
                                width: 8, height: 8, borderRadius: "50%",
                                bgcolor: score >= 90 ? "success.main" : score >= 75 ? "warning.main" : "error.main",
                              }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{score}%</Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.75 }}>
                          {permissions.canInspect && ["scheduled", "in_progress"].includes(status) && (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={(e) => { e.stopPropagation(); onAction(row, "complete"); }}
                              sx={{ fontSize: 11, fontWeight: 700, py: 0.25 }}
                            >
                              Complete
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => { e.stopPropagation(); setSelectedRow(row); }}
                            sx={{ fontSize: 11 }}
                          >
                            View details
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary">Showing {displayRows.length} inspections</Typography>
          </Box>
        </Paper>

        {/* Inspection detail panel */}
        {selectedRow && (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontFamily: "ui-monospace, monospace", color: "text.secondary" }}>
                    {String(selectedRow.reference ?? "")}
                  </Typography>
                  <FcStatus value={String(selectedRow.status ?? "completed").replace("_", "-")} />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{String(selectedRow.title ?? "—")}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {String(selectedRow.asset_name ?? "—")} • {String(selectedRow.property_name ?? "—")}
                </Typography>
              </Box>
              <Button size="small" onClick={() => setSelectedRow(null)} sx={{ minWidth: 0, color: "text.secondary", fontSize: 18 }}>×</Button>
            </Box>
            <Box sx={{ p: 2.5 }}>
              {[
                { label: "Inspection Type", value: String(selectedRow.inspection_type ?? "—") },
                { label: "Inspection Date", value: String(selectedRow.scheduled_on ?? "—") },
                { label: "Completed", value: selectedRow.completed_on ? String(selectedRow.completed_on) : "Not yet" },
                { label: "Inspector", value: String(selectedRow.inspector_name ?? "—") },
                { label: "Property", value: String(selectedRow.property_name ?? "—") },
                { label: "Violations", value: String(selectedRow.violations ?? "0") },
              ].map((f) => (
                <Box key={f.label} sx={{ borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", py: 1.25 }}>
                  <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{f.value}</Typography>
                </Box>
              ))}

              {Number(selectedRow.score ?? 0) > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>Overall Score</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>{String(selectedRow.score ?? 0)}%</Typography>
                  <HealthBar pct={Number(selectedRow.score ?? 0)} />
                </Box>
              )}

              {Boolean(selectedRow.findings) && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} gutterBottom>Findings</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {String(selectedRow.findings)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        )}
      </Box>
    </>
  );
}
