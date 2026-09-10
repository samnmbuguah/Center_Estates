"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import PendingActionsRounded from "@mui/icons-material/PendingActionsRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ViewListRounded from "@mui/icons-material/ViewListRounded";
import ViewModuleRounded from "@mui/icons-material/ViewModuleRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";

import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { usePropertyContext } from "@/lib/property-context";
import { useToast } from "@/components/monitoring/hooks/useToast";

export type MeterRow = {
  id: string;
  name: string;
  code?: string;
  utility_type?: string;
  unit?: string;
  property_name?: string;
  unit_code?: string;
  tariff?: number | string;
  current_reading?: number | null;
  previous_reading?: number | null;
  consumption?: number | null;
  cost?: number | null;
  read_at?: string | null;
  reading_status?: string | null;
  reading_is_anomaly?: boolean;
  latest_reading?: {
    id: string;
    value: number;
    read_at: string;
    status: string;
    notes?: string;
  } | null;
};

export function MeterReadingsView({
  rows = [],
  loading = false,
  onRefresh,
  fieldMode = false,
}: {
  rows: MeterRow[];
  loading?: boolean;
  onRefresh?: () => void;
  /** Shows the exact field-user surface when a manager previews the caretaker portal. */
  fieldMode?: boolean;
}) {
  const { session, can } = useAuth();
  const { activeProperty } = usePropertyContext();
  const { toast } = useToast();
  const organizationId = session?.activeOrganizationId ?? null;
  const isManager = !fieldMode && Boolean(
    session?.user?.isSuperuser ||
      session?.roles?.includes("admin") ||
      session?.roles?.includes("facility_manager") ||
      session?.roles?.includes("property_manager") ||
      can("facility.approve")
  );

  const storageKey = `ce_meter_drafts_${activeProperty?.id || "default"}`;

  // Walkthrough input states keyed by meter.id with LocalStorage persistence
  const [draftReadings, setDraftReadings] = useState<Record<string, { value: string; notes: string }>>({});
  const [readDate, setReadDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [utilityFilter, setUtilityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<"table" | "cards">("table");

  // Auto-load draft readings from localStorage on mount/property switch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setDraftReadings(parsed);
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [storageKey]);

  // Persist draft readings to localStorage on change
  const saveDraftsToStorage = (newDrafts: Record<string, { value: string; notes: string }>) => {
    try {
      const hasAny = Object.values(newDrafts).some((d) => d.value.trim() !== "" || d.notes.trim() !== "");
      if (hasAny) {
        localStorage.setItem(storageKey, JSON.stringify(newDrafts));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore storage errors
    }
  };

  // Single inspect modal
  const [inspectMeter, setInspectMeter] = useState<MeterRow | null>(null);

  const meters = rows;

  const filteredMeters = useMemo(() => {
    return meters.filter((m) => {
      const matchesSearch =
        !searchQuery ||
        m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.unit_code?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesUtility = utilityFilter === "all" || m.utility_type?.toLowerCase() === utilityFilter.toLowerCase();

      const currentStatus = m.reading_status || (m.current_reading !== null ? "approved" : "unrecorded");
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && m.reading_status === "pending") ||
        (statusFilter === "approved" && m.reading_status === "approved") ||
        (statusFilter === "anomaly" && m.reading_is_anomaly) ||
        (statusFilter === "due" && (!m.current_reading || m.reading_status !== "approved"));

      return matchesSearch && matchesUtility && matchesStatus;
    });
  }, [meters, searchQuery, utilityFilter, statusFilter]);

  // Summary counts
  const totalMeters = meters.length;
  const pendingCount = meters.filter((m) => m.reading_status === "pending").length;
  const approvedCount = meters.filter((m) => m.reading_status === "approved").length;
  const anomalyCount = meters.filter((m) => m.reading_is_anomaly).length;
  const filledDraftCount = Object.keys(draftReadings).filter((k) => draftReadings[k]?.value?.trim() !== "").length;

  const updateDraft = (meterId: string, field: "value" | "notes", val: string) => {
    setDraftReadings((prev) => {
      const updated = {
        ...prev,
        [meterId]: {
          value: field === "value" ? val : prev[meterId]?.value ?? "",
          notes: field === "notes" ? val : prev[meterId]?.notes ?? "",
        },
      };
      saveDraftsToStorage(updated);
      return updated;
    });
  };

  const handleClearDrafts = () => {
    setDraftReadings({});
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    toast.info("Cleared all unsaved draft meter readings.");
  };

  // Submit all drafted readings in batch
  const handleSubmitBatch = async () => {
    const toSubmit = Object.entries(draftReadings).filter(([_, d]) => d.value.trim() !== "" && !isNaN(Number(d.value)));
    if (toSubmit.length === 0) {
      toast.error("Please enter at least one new meter reading value.");
      return;
    }

    setSubmittingBatch(true);
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    try {
      await apiFetch("/auth/csrf/");
      for (const [meterId, data] of toSubmit) {
        const payload = {
          meter: meterId,
          read_at: `${readDate}T12:00:00Z`,
          value: Number(data.value),
          notes: data.notes || "Recorded via Caretaker Field Walk-Through Sheet",
        };

        const res = await apiFetch(
          "/facility/meter-readings/",
          {
            method: "POST",
            headers: { "X-CSRFToken": csrfFromCookie() },
            body: JSON.stringify(payload),
          },
          organizationId
        );

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
          const errData = await res.json().catch(() => ({}));
          const errMsg = Object.values(errData).flat().join(" ") || `Error on meter ${meterId}`;
          errors.push(errMsg);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully submitted ${successCount} meter reading(s) for admin verification!`);
        // Clear submitted drafts
        setDraftReadings({});
        if (onRefresh) onRefresh();
      }

      if (failCount > 0) {
        toast.error(`Failed to submit ${failCount} reading(s): ${errors.slice(0, 2).join("; ")}`);
      }
    } catch (e) {
      toast.error("Network error during bulk submission.");
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Admin: Quick verify reading
  const handleApproveReading = async (readingId: string) => {
    setApprovingId(readingId);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/facility/meter-readings/${readingId}/approve/`,
        {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({ notes: "Approved by Property Admin" }),
        },
        organizationId
      );

      if (res.ok) {
        toast.success("Meter reading approved and locked for billing run.");
        if (onRefresh) onRefresh();
      } else {
        toast.error("Failed to approve meter reading.");
      }
    } catch {
      toast.error("Network error approving meter reading.");
    } finally {
      setApprovingId(null);
    }
  };

  // Admin: Batch approve all pending
  const handleBatchApprovePending = async () => {
    const pendingReadings = meters.filter((m) => m.reading_status === "pending" && m.latest_reading?.id);
    if (pendingReadings.length === 0) {
      toast.error("No pending readings to approve.");
      return;
    }

    setSubmittingBatch(true);
    let count = 0;
    try {
      await apiFetch("/auth/csrf/");
      for (const m of pendingReadings) {
        if (!m.latest_reading?.id) continue;
        const res = await apiFetch(
          `/facility/meter-readings/${m.latest_reading.id}/approve/`,
          {
            method: "POST",
            headers: { "X-CSRFToken": csrfFromCookie() },
            body: JSON.stringify({ notes: "Batch approved by Property Admin" }),
          },
          organizationId
        );
        if (res.ok) count++;
      }
      toast.success(`Verified and approved ${count} meter readings for billing!`);
      if (onRefresh) onRefresh();
    } catch {
      toast.error("Failed during batch approval.");
    } finally {
      setSubmittingBatch(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* 1. EXECUTIVE HEADER & KPI STRIP */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 3,
          background: "var(--surface, #ffffff)",
          borderColor: "var(--border, var(--color-slate-200))",
          color: "text.primary",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <span style={{ fontSize: 24 }}>⚡</span>
            <Typography variant="h5" sx={{ fontWeight: 900, color: "text.primary" }}>
              Caretaker Field Meter Reading Hub
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            {activeProperty?.name ?? "Select Property"} · Fast bulk walk-through capture, instant consumption deltas & admin verification queue
          </Typography>
        </Box>

        <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          {onRefresh && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshRounded />}
              onClick={onRefresh}
              sx={{ color: "var(--color-slate-300)", borderColor: "rgba(255,255,255,0.2)" }}
            >
              Refresh
            </Button>
          )}

          {isManager && pendingCount > 0 && (
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckCircleRounded />}
              onClick={handleBatchApprovePending}
              disabled={submittingBatch}
              sx={{ bgcolor: "var(--color-success)", "&:hover": { bgcolor: "var(--color-success-strong)" }, fontWeight: 800 }}
            >
              Verify & Approve All ({pendingCount})
            </Button>
          )}
        </Stack>
      </Paper>

      {/* 2. KPI METRIC CARDS */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, background: "var(--surface)" }}>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>
            Total Meters
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5, color: "var(--text)" }}>
            {totalMeters}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
            Water & Electricity
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, background: "var(--surface)", borderLeft: "4px solid var(--color-amber)" }}>
          <Typography variant="caption" sx={{ color: "var(--color-warning)", fontWeight: 700, textTransform: "uppercase" }}>
            Pending Verification
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5, color: "var(--color-warning)" }}>
            {pendingCount}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
            Awaiting Admin Review
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, background: "var(--surface)", borderLeft: "4px solid var(--color-success)" }}>
          <Typography variant="caption" sx={{ color: "var(--color-success)", fontWeight: 700, textTransform: "uppercase" }}>
            Approved for Billing
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5, color: "var(--color-success)" }}>
            {approvedCount}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
            Ready for Monthly Invoices
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, background: "var(--surface)", borderLeft: "4px solid var(--color-danger)" }}>
          <Typography variant="caption" sx={{ color: "var(--color-danger)", fontWeight: 700, textTransform: "uppercase" }}>
            Anomalies Detected
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5, color: "var(--color-danger)" }}>
            {anomalyCount}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
            Surges & Reverse Readings
          </Typography>
        </Paper>
      </Box>

      {/* 3. WALKTHROUGH CONTROLS & BATCH ACTION BAR */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, background: "var(--surface)" }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "space-between", alignItems: "center" }}>
          <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
            <TextField
              size="small"
              placeholder="Search unit code or meter…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: 220 }}
            />

            <TextField
              select
              size="small"
              label="Utility Type"
              value={utilityFilter}
              onChange={(e) => setUtilityFilter(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="all">All Utilities</MenuItem>
              <MenuItem value="water">💧 Water Meters</MenuItem>
              <MenuItem value="electricity">⚡ Electricity</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="due">⚪ Due for Reading</MenuItem>
              <MenuItem value="pending">🟡 Pending Approval</MenuItem>
              <MenuItem value="approved">🟢 Approved</MenuItem>
              <MenuItem value="anomaly">🔴 Anomaly / Flagged</MenuItem>
            </TextField>

            <TextField
              type="date"
              size="small"
              label="Reading Date"
              value={readDate}
              onChange={(e) => setReadDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>

          <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            {filledDraftCount > 0 && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteOutlineRounded />}
                onClick={handleClearDrafts}
                sx={{ fontSize: 12, fontWeight: 700 }}
              >
                Clear Drafts ({filledDraftCount})
              </Button>
            )}

            <ToggleButtonGroup
              size="small"
              value={layoutMode}
              exclusive
              onChange={(_, val) => val && setLayoutMode(val)}
              sx={{ bgcolor: "var(--surface-sunken)" }}
            >
              <ToggleButton value="table" title="Table View">
                <ViewListRounded fontSize="small" sx={{ mr: 0.5 }} /> Table
              </ToggleButton>
              <ToggleButton value="cards" title="Mobile Cards View">
                <ViewModuleRounded fontSize="small" sx={{ mr: 0.5 }} /> Cards
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="contained"
              startIcon={<SendRounded />}
              disabled={filledDraftCount === 0 || submittingBatch}
              onClick={handleSubmitBatch}
              sx={{
                bgcolor: "var(--color-info)",
                "&:hover": { bgcolor: "var(--color-info-strong)" },
                fontWeight: 800,
                px: 3,
                py: 1,
              }}
            >
              {submittingBatch
                ? "Submitting Batch…"
                : `Submit ${filledDraftCount > 0 ? `(${filledDraftCount})` : ""} for Admin Verification`}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* 4. CARETAKER BULK WALK-THROUGH: CARDS VIEW */}
      {layoutMode === "cards" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2 }}>
          {loading ? (
            <Paper variant="outlined" sx={{ p: 5, textAlign: "center", gridColumn: "1 / -1", borderRadius: 3 }}>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
                Loading meter registers…
              </Typography>
            </Paper>
          ) : filteredMeters.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 5, textAlign: "center", gridColumn: "1 / -1", borderRadius: 3 }}>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
                No matching meters found for the selected filter.
              </Typography>
            </Paper>
          ) : (
            filteredMeters.map((meter) => {
              const prevVal = Number(meter.current_reading ?? 0);
              const draft = draftReadings[meter.id] || { value: "", notes: "" };
              const currentEntered = draft.value !== "" ? Number(draft.value) : null;
              const delta = currentEntered !== null && !isNaN(currentEntered) ? currentEntered - prevVal : null;
              const isSurge = delta !== null && prevVal > 0 && delta > prevVal * 1.5;
              const isReverse = delta !== null && delta < 0;
              const isPending = meter.reading_status === "pending";
              const isApproved = meter.reading_status === "approved";

              return (
                <Paper
                  key={meter.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    background: isSurge || isReverse ? "rgba(239, 68, 68, 0.03)" : "var(--surface)",
                    borderColor: isReverse ? "var(--color-danger)" : isSurge ? "var(--color-amber)" : draft.value ? "var(--color-blue)" : "var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    position: "relative",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <span style={{ fontSize: 20 }}>{meter.utility_type === "electricity" ? "⚡" : "💧"}</span>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          Unit {meter.unit_code || "Main"} · {meter.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                          {meter.code || meter.id.slice(0, 8)} · {meter.property_name || activeProperty?.name}
                        </Typography>
                      </Box>
                    </Box>

                    {isPending ? (
                      <Chip label="Pending" size="small" sx={{ bgcolor: "var(--color-amber-bg)", color: "var(--color-amber-deep)", fontWeight: 700, fontSize: 10 }} />
                    ) : isApproved ? (
                      <Chip label="Verified" size="small" sx={{ bgcolor: "var(--color-green-bg)", color: "var(--color-success-strong)", fontWeight: 700, fontSize: 10 }} />
                    ) : (
                      <Chip label="Due" size="small" sx={{ bgcolor: "var(--surface-sunken)", color: "var(--text-secondary)", fontWeight: 600, fontSize: 10 }} />
                    )}
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, p: 1.25, borderRadius: 2, bgcolor: "var(--surface-sunken)" }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                        Previous Reading
                      </Typography>
                      <strong className="mono" style={{ fontSize: 14 }}>
                        {prevVal ? prevVal.toLocaleString() : "0.00"} {meter.unit}
                      </strong>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                        Consumption Delta
                      </Typography>
                      {delta !== null ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <span
                            className="mono"
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              color: isReverse ? "var(--color-danger)" : isSurge ? "var(--color-warning)" : "var(--color-success)",
                            }}
                          >
                            {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)} {meter.unit}
                          </span>
                        </Box>
                      ) : (
                        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>—</span>
                      )}
                    </Box>
                  </Box>

                  {isReverse && (
                    <Alert severity="error" sx={{ py: 0, px: 1, fontSize: 11 }}>
                      Reverse reading detected! Check meter dial.
                    </Alert>
                  )}
                  {isSurge && (
                    <Alert severity="warning" sx={{ py: 0, px: 1, fontSize: 11 }}>
                      High surge consumption (&gt;150% prior cycle).
                    </Alert>
                  )}

                  <TextField
                    size="small"
                    type="number"
                    label="Enter New Reading"
                    placeholder={`e.g. ${(prevVal + 5).toFixed(0)}`}
                    value={draft.value}
                    onChange={(e) => updateDraft(meter.id, "value", e.target.value)}
                    fullWidth
                    slotProps={{
                      input: {
                        sx: {
                          fontWeight: 800,
                          fontSize: 15,
                          fontFamily: "'IBM Plex Mono', monospace",
                          bgcolor: draft.value ? "rgba(37, 99, 235, 0.05)" : "inherit",
                        },
                      },
                    }}
                  />

                  <TextField
                    size="small"
                    label="Observations / Field Notes"
                    placeholder="e.g. Normal flow, dial clean"
                    value={draft.notes}
                    onChange={(e) => updateDraft(meter.id, "notes", e.target.value)}
                    fullWidth
                  />

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 0.5 }}>
                    <Button size="small" variant="text" onClick={() => setInspectMeter(meter)} sx={{ fontSize: 11 }}>
                      View History
                    </Button>

                    {isManager && isPending && meter.latest_reading?.id && (
                      <Button
                        size="small"
                        variant="contained"
                        disabled={approvingId === meter.latest_reading.id}
                        onClick={() => handleApproveReading(meter.latest_reading!.id)}
                        sx={{ bgcolor: "var(--color-success)", "&:hover": { bgcolor: "var(--color-success-strong)" }, fontSize: 11 }}
                      >
                        ✓ Approve
                      </Button>
                    )}
                  </Box>
                </Paper>
              );
            })
          )}
        </Box>
      ) : (
        /* 4. CARETAKER BULK WALK-THROUGH SHEET: TABLE VIEW */
        <Paper variant="outlined" sx={{ borderRadius: 3, background: "var(--surface)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "12px 16px" }}>Unit & Location</th>
                <th style={{ padding: "12px 16px" }}>Meter Code & Type</th>
                <th style={{ padding: "12px 16px" }}>Last Approved Value</th>
                <th style={{ padding: "12px 16px", minWidth: 170 }}>New Reading Input</th>
                <th style={{ padding: "12px 16px" }}>Calculated Delta</th>
                <th style={{ padding: "12px 16px" }}>Notes / Observation</th>
                <th style={{ padding: "12px 16px" }}>Verification Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center" }}>
                    <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
                      Loading meter registers…
                    </Typography>
                  </td>
                </tr>
              ) : filteredMeters.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center" }}>
                    <Typography variant="body2" sx={{ color: "var(--text-secondary)" }}>
                      No matching meters found for the selected filter.
                    </Typography>
                  </td>
                </tr>
              ) : (
                filteredMeters.map((meter) => {
                  const prevVal = Number(meter.current_reading ?? 0);
                  const draft = draftReadings[meter.id] || { value: "", notes: "" };
                  const currentEntered = draft.value !== "" ? Number(draft.value) : null;
                  const delta = currentEntered !== null && !isNaN(currentEntered) ? currentEntered - prevVal : null;
                  const isSurge = delta !== null && prevVal > 0 && delta > prevVal * 1.5;
                  const isReverse = delta !== null && delta < 0;

                  const isPending = meter.reading_status === "pending";
                  const isApproved = meter.reading_status === "approved";

                  return (
                    <tr
                      key={meter.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: isSurge || isReverse ? "rgba(239, 68, 68, 0.04)" : "transparent",
                      }}
                    >
                      {/* Unit & Location */}
                      <td style={{ padding: "12px 16px" }}>
                        <strong style={{ fontSize: 13 }}>Unit {meter.unit_code || "Main"}</strong>
                        <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                          {meter.property_name || activeProperty?.name}
                        </Typography>
                      </td>

                      {/* Meter Code & Type */}
                      <td style={{ padding: "12px 16px" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <span style={{ fontSize: 16 }}>{meter.utility_type === "electricity" ? "⚡" : "💧"}</span>
                          <div>
                            <strong style={{ fontSize: 12 }}>{meter.name}</strong>
                            <div className="mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                              {meter.code || meter.id.slice(0, 8)} · {meter.unit || "units"}
                            </div>
                          </div>
                        </Box>
                      </td>

                      {/* Last Approved Value */}
                      <td style={{ padding: "12px 16px" }}>
                        <strong className="mono" style={{ fontSize: 13 }}>
                          {prevVal ? prevVal.toLocaleString() : "0.00"} {meter.unit}
                        </strong>
                        <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block", fontSize: 11 }}>
                          {meter.read_at ? new Date(meter.read_at).toLocaleDateString("en-KE") : "No prior reading"}
                        </Typography>
                      </td>

                      {/* New Reading Input */}
                      <td style={{ padding: "8px 16px" }}>
                        <TextField
                          size="small"
                          type="number"
                          placeholder={`e.g. ${(prevVal + 5).toFixed(0)}`}
                          value={draft.value}
                          onChange={(e) => updateDraft(meter.id, "value", e.target.value)}
                          sx={{
                            width: 150,
                            "& .MuiInputBase-root": {
                              fontWeight: 800,
                              fontFamily: "'IBM Plex Mono', monospace",
                              bgcolor: draft.value ? "rgba(37, 99, 235, 0.05)" : "inherit",
                            },
                          }}
                        />
                      </td>

                      {/* Calculated Delta */}
                      <td style={{ padding: "12px 16px" }}>
                        {delta !== null ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <span
                              className="mono"
                              style={{
                                fontWeight: 800,
                                fontSize: 13,
                                color: isReverse ? "var(--color-danger)" : isSurge ? "var(--color-warning)" : "var(--color-success)",
                              }}
                            >
                              {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)} {meter.unit}
                            </span>
                            {isReverse && (
                              <Tooltip title="Reverse reading detected! Authorize a reset or check dial.">
                                <ErrorOutlineRounded sx={{ color: "var(--color-danger)", fontSize: 16 }} />
                              </Tooltip>
                            )}
                            {isSurge && (
                              <Tooltip title="Consumption is over 150% higher than last cycle!">
                                <ErrorOutlineRounded sx={{ color: "var(--color-warning)", fontSize: 16 }} />
                              </Tooltip>
                            )}
                          </Box>
                        ) : (
                          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td style={{ padding: "8px 16px" }}>
                        <TextField
                          size="small"
                          placeholder="e.g. Normal flow"
                          value={draft.notes}
                          onChange={(e) => updateDraft(meter.id, "notes", e.target.value)}
                          sx={{ width: 140 }}
                        />
                      </td>

                      {/* Verification Status */}
                      <td style={{ padding: "12px 16px" }}>
                        {isPending ? (
                          <Chip
                            icon={<PendingActionsRounded sx={{ fontSize: "14px !important" }} />}
                            label="Pending Admin"
                            size="small"
                            sx={{ bgcolor: "var(--color-amber-bg)", color: "var(--color-amber-deep)", fontWeight: 700, fontSize: 11 }}
                          />
                        ) : isApproved ? (
                          <Chip
                            icon={<CheckCircleRounded sx={{ fontSize: "14px !important" }} />}
                            label="Verified"
                            size="small"
                            sx={{ bgcolor: "var(--color-green-bg)", color: "var(--color-success-strong)", fontWeight: 700, fontSize: 11 }}
                          />
                        ) : (
                          <Chip
                            label="Due for Read"
                            size="small"
                            sx={{ bgcolor: "var(--surface-sunken)", color: "var(--text-secondary)", fontWeight: 600, fontSize: 11 }}
                          />
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <Stack direction="row" sx={{ gap: 1, justifyContent: "flex-end" }}>
                          {isManager && isPending && meter.latest_reading?.id && (
                            <Button
                              size="small"
                              variant="contained"
                              disabled={approvingId === meter.latest_reading.id}
                              onClick={() => handleApproveReading(meter.latest_reading!.id)}
                              sx={{ bgcolor: "var(--color-success)", "&:hover": { bgcolor: "var(--color-success-strong)" }, fontSize: 11, py: 0.5 }}
                            >
                              ✓ Approve
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setInspectMeter(meter)}
                            sx={{ fontSize: 11, py: 0.5 }}
                          >
                            History
                          </Button>
                        </Stack>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Paper>
      )}

      {/* 5. HISTORY & INSPECTION MODAL */}
      {inspectMeter && (
        <Dialog open onClose={() => setInspectMeter(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {inspectMeter.name} (Unit {inspectMeter.unit_code || "Main"})
              </Typography>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                Meter Code: {inspectMeter.code || inspectMeter.id}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setInspectMeter(null)}>
              <CloseRounded />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Utility Type
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, textTransform: "capitalize" }}>
                    {inspectMeter.utility_type}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Tariff Rate
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    KES {Number(inspectMeter.tariff || 0).toFixed(2)} / {inspectMeter.unit}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Current Reading
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {inspectMeter.current_reading?.toLocaleString() ?? "0"} {inspectMeter.unit}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, textTransform: "capitalize" }}>
                    {inspectMeter.reading_status || "Unverified"}
                  </Typography>
                </Paper>
              </Box>

              {inspectMeter.latest_reading?.notes && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  <strong>Caretaker Note:</strong> {inspectMeter.latest_reading.notes}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setInspectMeter(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
