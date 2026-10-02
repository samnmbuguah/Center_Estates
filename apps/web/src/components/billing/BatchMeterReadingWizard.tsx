"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
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
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Flame,
  Gauge,
  LayoutGrid,
  ListOrdered,
  Save,
  Sparkles,
  Zap,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { money } from "@/components/module-ui";

export type MeterEntry = {
  meterId: string;
  meterCode: string;
  meterName: string;
  unitCode: string;
  utilityType: "water" | "electricity" | "gas";
  previousReading: number;
  tariff: number;
  unit: string;
};

const UTILITY_META: Record<
  string,
  {
    icon: React.ReactNode;
    emoji: string;
    label: string;
    defaultUnit: string;
    gradient: string;
    color: string;
    bgLight: string;
  }
> = {
  water: {
    icon: <Droplets size={18} />,
    emoji: "💧",
    label: "Water",
    defaultUnit: "m³",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
    color: "#2563eb",
    bgLight: "rgba(37,99,235,0.08)",
  },
  electricity: {
    icon: <Zap size={18} />,
    emoji: "⚡",
    label: "Electricity",
    defaultUnit: "kWh",
    gradient: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
    color: "#d97706",
    bgLight: "rgba(217,119,6,0.08)",
  },
  gas: {
    icon: <Flame size={18} />,
    emoji: "🔥",
    label: "Gas",
    defaultUnit: "m³",
    gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)",
    color: "#ea580c",
    bgLight: "rgba(234,88,12,0.08)",
  },
};

export function BatchMeterReadingWizard({
  open,
  onClose,
  onComplete,
  periodStart,
  periodEnd,
  propertyId,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => Promise<void> | void;
  periodStart?: string;
  periodEnd?: string;
  propertyId?: string;
}) {
  const { session } = useAuth();
  const orgId = session?.activeOrganizationId ?? undefined;

  const [loading, setLoading] = useState(true);
  const [meters, setMeters] = useState<MeterEntry[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "wizard">("grid");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load all meters that need readings for this billing period
  const loadMeters = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set("property", propertyId);
      const res = await apiFetch(`/facility/meters/?${params.toString()}`, {}, orgId);
      if (!res.ok) throw new Error("Failed to load meters");
      const data = await res.json();
      const allMeters: any[] = Array.isArray(data) ? data : data.results || [];

      const needsReading: MeterEntry[] = [];
      for (const m of allMeters) {
        if (!m.is_active) continue;
        const readingParams = new URLSearchParams({
          meter: m.id,
          ...(periodStart ? { read_at_after: periodStart } : {}),
          ...(periodEnd ? { read_at_before: periodEnd } : {}),
        });
        const readingRes = await apiFetch(`/facility/meter-readings/?${readingParams.toString()}`, {}, orgId);
        const readings = readingRes.ok ? await readingRes.json() : [];
        const readingList = Array.isArray(readings) ? readings : readings.results || [];
        const hasApprovedReading = readingList.some((r: any) => r.status === "approved");

        if (!hasApprovedReading) {
          const uType = (m.utility_type || "water").toLowerCase() as "water" | "electricity" | "gas";
          needsReading.push({
            meterId: m.id,
            meterCode: m.code || m.number || "",
            meterName: m.name || m.code || "",
            unitCode: m.unit_code || m.property_unit_code || "",
            utilityType: uType,
            previousReading: Number(m.previous_reading ?? m.last_reading_value ?? 0),
            tariff: Number(m.tariff ?? 0),
            unit: m.unit || (uType === "electricity" ? "kWh" : "m³"),
          });
        }
      }

      // Sort: electricity first for billing hold, then water, then gas; within each group sort by unit code
      needsReading.sort((a, b) => {
        const order = { electricity: 0, water: 1, gas: 2 };
        const diff = (order[a.utilityType] ?? 3) - (order[b.utilityType] ?? 3);
        return diff !== 0 ? diff : a.unitCode.localeCompare(b.unitCode, undefined, { numeric: true });
      });

      setMeters(needsReading);
      setCurrentIdx(0);
      setValues({});
      setCompleted(new Set());
      setSkipped(new Set());
    } catch (err: any) {
      setError(err.message || "Failed to load meters");
    } finally {
      setLoading(false);
    }
  }, [orgId, propertyId, periodStart, periodEnd]);

  useEffect(() => {
    if (open) void loadMeters();
  }, [open, loadMeters]);

  const totalMeters = meters.length;
  const completedCount = completed.size;
  const skippedCount = skipped.size;

  // Aggregate stats across all entered values
  const { totalEnteredKwh, totalEstimatedCost, readyToSaveCount } = useMemo(() => {
    let kwhSum = 0;
    let costSum = 0;
    let readyCount = 0;

    for (const m of meters) {
      if (completed.has(m.meterId)) continue;
      const rawVal = values[m.meterId];
      if (rawVal !== undefined && rawVal !== "") {
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val >= m.previousReading) {
          const cons = Math.max(0, val - m.previousReading);
          kwhSum += cons;
          costSum += cons * (m.tariff > 0 ? m.tariff : 35);
          readyCount++;
        }
      }
    }
    return {
      totalEnteredKwh: kwhSum,
      totalEstimatedCost: costSum,
      readyToSaveCount: readyCount,
    };
  }, [meters, values, completed]);

  const currentMeter = meters[currentIdx] ?? null;
  const currentMeta = currentMeter ? UTILITY_META[currentMeter.utilityType] || UTILITY_META.water : UTILITY_META.water;
  const currentValue = currentMeter ? values[currentMeter.meterId] || "" : "";
  const enteredReading = parseFloat(currentValue) || 0;
  const currentConsumption = currentMeter ? Math.max(0, enteredReading - currentMeter.previousReading) : 0;
  const currentEstimatedCost = currentMeter ? currentConsumption * (currentMeter.tariff > 0 ? currentMeter.tariff : 35) : 0;

  // Single meter save
  const saveReadingForMeter = async (meter: MeterEntry, readingValue: number): Promise<boolean> => {
    if (!orgId) return false;
    await apiFetch("/auth/csrf/");
    const readAt = periodEnd || new Date().toISOString().slice(0, 10);
    const payload = {
      meter: meter.meterId,
      read_at: new Date(readAt).toISOString(),
      value: readingValue,
      notes: `Monthly billing run batch reading for ${meter.unitCode}`,
    };

    const res = await apiFetch(
      "/facility/meter-readings/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      orgId
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(Object.values(data).flat().join(" ") || `Failed to save meter ${meter.unitCode}`);
    }

    const reading = await res.json();
    if (reading?.id && reading.status === "pending") {
      await apiFetch(
        `/facility/meter-readings/${reading.id}/approve/`,
        {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
        },
        orgId
      ).catch(() => null);
    }
    return true;
  };

  // Handle single save in wizard mode
  const handleSaveAndNext = async () => {
    if (!currentMeter || !orgId) return;
    if (enteredReading < currentMeter.previousReading) {
      setError(`Current reading must be equal to or higher than previous reading (${currentMeter.previousReading})`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveReadingForMeter(currentMeter, enteredReading);
      setCompleted((prev) => new Set(prev).add(currentMeter.meterId));
      setNotice(`✓ ${currentMeter.unitCode} reading recorded (${currentConsumption} ${currentMeter.unit} = ${money.format(currentEstimatedCost)})`);
      if (currentIdx < totalMeters - 1) {
        setCurrentIdx((i) => i + 1);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save reading");
    } finally {
      setSaving(false);
    }
  };

  // Save all entered readings in bulk
  const handleSaveAllBatch = async () => {
    if (!orgId) return;
    const toSave: { meter: MeterEntry; value: number }[] = [];

    for (const m of meters) {
      if (completed.has(m.meterId)) continue;
      const rawVal = values[m.meterId];
      if (rawVal !== undefined && rawVal !== "") {
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val >= m.previousReading) {
          toSave.push({ meter: m, value: val });
        }
      }
    }

    if (toSave.length === 0) {
      setError("Please enter current dial readings for at least one meter before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveProgress({ current: 0, total: toSave.length });

    const newCompleted = new Set(completed);
    const failedUnits: string[] = [];

    for (let i = 0; i < toSave.length; i++) {
      const item = toSave[i];
      setSaveProgress({ current: i + 1, total: toSave.length });
      try {
        await saveReadingForMeter(item.meter, item.value);
        newCompleted.add(item.meter.meterId);
      } catch (err: any) {
        failedUnits.push(`${item.meter.unitCode} (${err.message})`);
      }
    }

    setCompleted(newCompleted);
    setSaving(false);
    setSaveProgress(null);

    if (failedUnits.length > 0) {
      setError(`Some readings could not be recorded: ${failedUnits.join("; ")}`);
    } else {
      setNotice(`✓ Successfully recorded and approved ${toSave.length} meter readings!`);
      // If all are recorded, auto-finish
      if (newCompleted.size >= totalMeters) {
        setTimeout(async () => {
          await onComplete();
          onClose();
        }, 1200);
      }
    }
  };

  // Fill unchanged previous values (e.g. for vacant units)
  const handleFillUnchanged = () => {
    const nextValues = { ...values };
    for (const m of meters) {
      if (!completed.has(m.meterId) && (!nextValues[m.meterId] || nextValues[m.meterId] === "")) {
        nextValues[m.meterId] = String(m.previousReading);
      }
    }
    setValues(nextValues);
    setNotice("Populated previous readings for vacant/unchanged units (0 consumption). Review and click Save.");
  };

  const handleFinish = async () => {
    await onComplete();
    onClose();
  };

  const allDone = totalMeters > 0 && completedCount >= totalMeters;
  const progressPercent = totalMeters > 0 ? (completedCount / totalMeters) * 100 : 0;

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.35)",
            overflow: "hidden",
            maxHeight: "92vh",
            maxWidth: { xs: "96vw", md: "900px" },
            width: "100%",
            m: { xs: 1, sm: 2 },
          },
        },
      }}
    >
      {/* Premium Header */}
      <Box
        sx={{
          background: allDone
            ? "linear-gradient(135deg, #065f46 0%, #059669 100%)"
            : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          color: "#fff",
          px: { xs: 2, sm: 3 },
          py: 2.2,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "10px",
                background: "rgba(245, 158, 11, 0.2)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f59e0b",
              }}
            >
              {allDone ? <CheckCircle size={22} color="#10b981" /> : <Gauge size={22} />}
            </Box>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: 15, sm: 16 }, lineHeight: 1.2 }}>
                  {allDone ? "All Meter Readings Recorded!" : "Batch Meter Readings Entry"}
                </Typography>
                <Chip
                  label={allDone ? "Ready for Billing" : `${completedCount}/${totalMeters} Recorded`}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    fontWeight: 700,
                    bgcolor: allDone ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.25)",
                    color: allDone ? "#34d399" : "#fbbf24",
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: 11.5 }}>
                Enter current kWh dial readings to unlock consolidated invoices
              </Typography>
            </Box>
          </Box>

          {/* Mode Switcher */}
          {!allDone && totalMeters > 0 && (
            <ButtonGroup size="small" sx={{ bgcolor: "rgba(255,255,255,0.08)", borderRadius: "8px", p: 0.3 }}>
              <Button
                variant={viewMode === "grid" ? "contained" : "text"}
                onClick={() => setViewMode("grid")}
                startIcon={<LayoutGrid size={14} />}
                sx={{
                  color: "#fff",
                  fontSize: 11.5,
                  fontWeight: 700,
                  bgcolor: viewMode === "grid" ? "#d97706" : "transparent",
                  "&:hover": { bgcolor: viewMode === "grid" ? "#b45309" : "rgba(255,255,255,0.12)" },
                  py: 0.4,
                  px: 1.2,
                }}
              >
                Fast Grid
              </Button>
              <Button
                variant={viewMode === "wizard" ? "contained" : "text"}
                onClick={() => setViewMode("wizard")}
                startIcon={<ListOrdered size={14} />}
                sx={{
                  color: "#fff",
                  fontSize: 11.5,
                  fontWeight: 700,
                  bgcolor: viewMode === "wizard" ? "#d97706" : "transparent",
                  "&:hover": { bgcolor: viewMode === "wizard" ? "#b45309" : "rgba(255,255,255,0.12)" },
                  py: 0.4,
                  px: 1.2,
                }}
              >
                Focus Mode
              </Button>
            </ButtonGroup>
          )}
        </Box>

        {/* Live Progress Bar */}
        {totalMeters > 0 && (
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              mt: 1.8,
              height: 5,
              borderRadius: 3,
              bgcolor: "rgba(255,255,255,0.15)",
              "& .MuiLinearProgress-bar": {
                bgcolor: allDone ? "#10b981" : "#f59e0b",
                borderRadius: 3,
              },
            }}
          />
        )}
      </Box>

      {/* Main Content Area */}
      <DialogContent sx={{ p: 0, bgcolor: "#fafafa" }}>
        {loading ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <CircularProgress size={36} sx={{ color: "#d97706" }} />
            <Typography variant="caption" sx={{ display: "block", mt: 1.5, color: "text.secondary", fontWeight: 600 }}>
              Loading active meters for this property…
            </Typography>
          </Box>
        ) : totalMeters === 0 ? (
          <Box sx={{ py: 8, textAlign: "center", px: 3 }}>
            <CheckCircle size={44} color="#10b981" style={{ margin: "0 auto" }} />
            <Typography variant="h6" sx={{ mt: 1.5, fontWeight: 800, fontSize: 16 }}>
              All Meters Up to Date!
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              Every active meter has an approved reading for this billing period.
            </Typography>
          </Box>
        ) : allDone ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                bgcolor: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2,
              }}
            >
              <CheckCircle size={32} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#065f46", fontSize: 18 }}>
              All {totalMeters} Units Recorded Successfully!
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.8, maxWidth: 460, mx: "auto" }}>
              Electricity meter readings have been approved. Candidate consolidated invoices are now unlocked for review and dispatch.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: "10px", fontSize: 12.5 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {notice && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: "10px", fontSize: 12.5 }} onClose={() => setNotice(null)}>
                {notice}
              </Alert>
            )}

            {/* Quick Action Toolbar for Grid */}
            {viewMode === "grid" && (
              <Box
                sx={{
                  mb: 1.8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 1,
                  bgcolor: "#fff",
                  p: 1.5,
                  borderRadius: "10px",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                    Quick Tools:
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RotateCcw size={13} />}
                    onClick={handleFillUnchanged}
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "none",
                      borderColor: "rgba(0,0,0,0.15)",
                      color: "#475569",
                      "&:hover": { borderColor: "#d97706", bgcolor: "rgba(217, 119, 6, 0.04)" },
                    }}
                  >
                    Copy Previous for Vacant Units (0 kWh)
                  </Button>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#92400e" }}>
                    Tariff: Ksh 35.00/kWh
                  </Typography>
                </Box>
              </Box>
            )}

            {/* VIEW MODE 1: FAST BATCH GRID */}
            {viewMode === "grid" && (
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  maxHeight: "52vh",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "12px",
                  overflowY: "auto",
                  bgcolor: "#fff",
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ "& th": { bgcolor: "#f1f5f9", fontWeight: 800, fontSize: 11.5, color: "#334155" } }}>
                      <TableCell sx={{ width: 140 }}>Unit & Meter</TableCell>
                      <TableCell sx={{ width: 110, textAlign: "right" }}>Previous Reading</TableCell>
                      <TableCell sx={{ width: 180 }}>Current Dial Reading</TableCell>
                      <TableCell sx={{ width: 110, textAlign: "right" }}>Consumption</TableCell>
                      <TableCell sx={{ width: 130, textAlign: "right" }}>Est. Charge</TableCell>
                      <TableCell sx={{ width: 100, textAlign: "center" }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {meters.map((m, idx) => {
                      const isDone = completed.has(m.meterId);
                      const rawVal = values[m.meterId] ?? "";
                      const numVal = parseFloat(rawVal);
                      const hasVal = rawVal !== "" && !isNaN(numVal);
                      const isInvalid = hasVal && numVal < m.previousReading;
                      const cons = hasVal && !isInvalid ? Math.max(0, numVal - m.previousReading) : 0;
                      const cost = cons * (m.tariff > 0 ? m.tariff : 35);

                      return (
                        <TableRow
                          key={m.meterId}
                          hover
                          sx={{
                            bgcolor: isDone ? "rgba(16, 185, 129, 0.04)" : isInvalid ? "rgba(239, 68, 68, 0.04)" : "#fff",
                            "&:last-child td, &:last-child th": { border: 0 },
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Box sx={{ color: "#d97706" }}><Zap size={15} /></Box>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 13, color: "#1e293b" }}>
                                  {m.unitCode}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10.5 }}>
                                  {m.meterCode}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell sx={{ textAlign: "right" }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12.5, color: "#475569" }}>
                              {m.previousReading.toLocaleString()} {m.unit}
                            </Typography>
                          </TableCell>

                          <TableCell>
                            {isDone ? (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: "#065f46" }}>
                                  {values[m.meterId] || m.previousReading} {m.unit}
                                </Typography>
                                <Chip label="Recorded" size="small" sx={{ height: 18, fontSize: 9.5, bgcolor: "#d1fae5", color: "#065f46", fontWeight: 700 }} />
                              </Box>
                            ) : (
                              <TextField
                                size="small"
                                type="number"
                                inputRef={(el) => { inputRefs.current[m.meterId] = el; }}
                                value={rawVal}
                                placeholder={`e.g. ${m.previousReading + 50}`}
                                onChange={(e) => {
                                  setValues((prev) => ({ ...prev, [m.meterId]: e.target.value }));
                                  setError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "ArrowDown") {
                                    e.preventDefault();
                                    const nextMeter = meters[idx + 1];
                                    if (nextMeter) inputRefs.current[nextMeter.meterId]?.focus();
                                  } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    const prevMeter = meters[idx - 1];
                                    if (prevMeter) inputRefs.current[prevMeter.meterId]?.focus();
                                  }
                                }}
                                error={isInvalid}
                                slotProps={{
                                  input: {
                                    endAdornment: (
                                      <InputAdornment position="end">
                                        <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, color: "text.secondary" }}>
                                          {m.unit}
                                        </Typography>
                                      </InputAdornment>
                                    ),
                                    sx: { height: 32, fontSize: 12.5, fontWeight: 700 },
                                  },
                                }}
                                sx={{ width: 140 }}
                              />
                            )}
                          </TableCell>

                          <TableCell sx={{ textAlign: "right" }}>
                            {isInvalid ? (
                              <Typography variant="caption" sx={{ color: "#dc2626", fontWeight: 700 }}>
                                &lt; Previous!
                              </Typography>
                            ) : hasVal ? (
                              <Typography variant="body2" sx={{ fontWeight: 800, color: cons > 0 ? "#059669" : "#64748b" }}>
                                {cons.toLocaleString()} {m.unit}
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: "text.disabled" }}>—</Typography>
                            )}
                          </TableCell>

                          <TableCell sx={{ textAlign: "right" }}>
                            {hasVal && !isInvalid ? (
                              <Typography variant="body2" sx={{ fontWeight: 800, color: cost > 0 ? "#0f172a" : "#64748b" }}>
                                {money.format(cost)}
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: "text.disabled" }}>—</Typography>
                            )}
                          </TableCell>

                          <TableCell sx={{ textAlign: "center" }}>
                            {isDone ? (
                              <Chip label="✓ Saved" size="small" sx={{ height: 20, fontSize: 10, bgcolor: "#dcfce7", color: "#166534", fontWeight: 800 }} />
                            ) : hasVal && !isInvalid ? (
                              <Chip label="Ready" size="small" sx={{ height: 20, fontSize: 10, bgcolor: "#fef3c7", color: "#92400e", fontWeight: 800 }} />
                            ) : (
                              <Chip label="Pending" size="small" sx={{ height: 20, fontSize: 10, bgcolor: "#f1f5f9", color: "#64748b" }} />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* VIEW MODE 2: STEP-BY-STEP FOCUS MODE */}
            {viewMode === "wizard" && currentMeter && (
              <Box
                sx={{
                  maxWidth: 520,
                  mx: "auto",
                  bgcolor: "#fff",
                  borderRadius: "14px",
                  p: { xs: 2, sm: 3 },
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                }}
              >
                {/* Meter Card Header */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: "10px",
                    bgcolor: currentMeta.bgLight,
                    border: `1.5px solid ${currentMeta.color}35`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                    <Box sx={{ color: currentMeta.color }}>{currentMeta.icon}</Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: currentMeta.color, fontSize: 14 }}>
                        {currentMeter.unitCode} — {currentMeta.label} Sub-meter
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 11 }}>
                        {currentMeter.meterCode}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
                      Previous Reading
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: currentMeta.color, fontSize: 15 }}>
                      {currentMeter.previousReading.toLocaleString()} {currentMeter.unit}
                    </Typography>
                  </Box>
                </Box>

                {/* Input Field */}
                <Stack spacing={2}>
                  <TextField
                    label="Current Meter Reading"
                    type="number"
                    size="medium"
                    autoFocus
                    fullWidth
                    value={currentValue}
                    onChange={(e) => {
                      setValues((prev) => ({ ...prev, [currentMeter.meterId]: e.target.value }));
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && enteredReading >= currentMeter.previousReading) {
                        e.preventDefault();
                        void handleSaveAndNext();
                      }
                    }}
                    placeholder={`e.g. ${currentMeter.previousReading + 100}`}
                    slotProps={{
                      input: {
                        startAdornment: <Gauge size={18} style={{ marginRight: 8, color: currentMeta.color }} />,
                        endAdornment: (
                          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                            {currentMeter.unit}
                          </Typography>
                        ),
                      },
                    }}
                    helperText={
                      enteredReading >= currentMeter.previousReading
                        ? `Consumption: ${currentConsumption.toLocaleString()} ${currentMeter.unit}`
                        : `Current reading must be >= ${currentMeter.previousReading}`
                    }
                  />

                  {/* Real-time Calculation Box */}
                  {enteredReading >= currentMeter.previousReading && (
                    <Box
                      sx={{
                        p: 1.8,
                        borderRadius: "10px",
                        bgcolor: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ color: "#065f46", fontWeight: 800, fontSize: 10 }}>
                          CONSUMPTION
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          {currentConsumption.toLocaleString()} {currentMeter.unit} × {money.format(currentMeter.tariff > 0 ? currentMeter.tariff : 35)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography variant="caption" sx={{ color: "#065f46", fontWeight: 800, fontSize: 10 }}>
                          ESTIMATED INVOICE CHARGE
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: "#065f46", fontSize: 17 }}>
                          {money.format(currentEstimatedCost)}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <Divider />

      {/* Action Footer */}
      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.8,
          bgcolor: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        {allDone || totalMeters === 0 ? (
          <>
            <div />
            <Button
              variant="contained"
              onClick={handleFinish}
              sx={{
                fontWeight: 800,
                px: 3.5,
                py: 1,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)",
                "&:hover": { background: "#059669" },
              }}
            >
              Finish & Refresh Billing
            </Button>
          </>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={onClose}
                disabled={saving}
                sx={{
                  color: "#64748b",
                  borderColor: "rgba(0,0,0,0.15)",
                  textTransform: "none",
                  fontWeight: 600,
                }}
              >
                Close
              </Button>

              {viewMode === "wizard" && (
                <Box sx={{ display: "flex", gap: 0.5, ml: 1 }}>
                  <Button
                    size="small"
                    disabled={currentIdx === 0 || saving}
                    startIcon={<ChevronLeft size={14} />}
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    sx={{ color: "text.secondary" }}
                  >
                    Prev
                  </Button>
                  <Button
                    size="small"
                    disabled={currentIdx >= totalMeters - 1 || saving}
                    endIcon={<ChevronRight size={14} />}
                    onClick={() => setCurrentIdx((i) => Math.min(totalMeters - 1, i + 1))}
                    sx={{ color: "text.secondary" }}
                  >
                    Next
                  </Button>
                </Box>
              )}
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {viewMode === "grid" ? (
                <>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                    {readyToSaveCount} of {totalMeters} units entered ({totalEnteredKwh.toLocaleString()} kWh)
                  </Typography>
                  <Button
                    variant="contained"
                    size="medium"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save size={16} />}
                    disabled={saving || readyToSaveCount === 0}
                    onClick={handleSaveAllBatch}
                    sx={{
                      fontWeight: 800,
                      px: 2.8,
                      py: 0.9,
                      borderRadius: "10px",
                      textTransform: "none",
                      background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                      boxShadow: "0 4px 12px rgba(217, 119, 6, 0.3)",
                      "&:hover": { background: "#92400e" },
                    }}
                  >
                    {saving
                      ? `Saving (${saveProgress?.current ?? 0}/${saveProgress?.total ?? readyToSaveCount})…`
                      : `Save All Recorded (${readyToSaveCount} Ready)`}
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  size="medium"
                  disabled={
                    saving ||
                    !currentMeter ||
                    enteredReading < (currentMeter?.previousReading ?? 0) ||
                    completed.has(currentMeter?.meterId ?? "")
                  }
                  onClick={handleSaveAndNext}
                  sx={{
                    fontWeight: 800,
                    px: 3,
                    borderRadius: "10px",
                    textTransform: "none",
                    background: currentMeta.gradient,
                  }}
                >
                  {saving
                    ? "Saving…"
                    : currentIdx >= totalMeters - 1
                    ? "Save & Finish"
                    : "Save & Next Unit →"}
                </Button>
              )}
            </Box>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
