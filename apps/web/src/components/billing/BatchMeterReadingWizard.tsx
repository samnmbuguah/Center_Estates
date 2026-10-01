"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CheckCircle, ChevronLeft, ChevronRight, Droplets, Gauge, Sparkles, Zap, Flame } from "lucide-react";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { money } from "@/components/module-ui";

type MeterEntry = {
  meterId: string;
  meterCode: string;
  meterName: string;
  unitCode: string;
  utilityType: "water" | "electricity" | "gas";
  previousReading: number;
  tariff: number;
  unit: string; // measurement unit (m³, kWh)
};

const UTILITY_META: Record<string, { icon: React.ReactNode; emoji: string; label: string; defaultUnit: string; gradient: string; color: string; bgLight: string }> = {
  water: { icon: <Droplets size={20} />, emoji: "💧", label: "Water", defaultUnit: "m³", gradient: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", color: "#2563eb", bgLight: "rgba(37,99,235,0.08)" },
  electricity: { icon: <Zap size={20} />, emoji: "⚡", label: "Electricity", defaultUnit: "kWh", gradient: "linear-gradient(135deg, #78350f 0%, #d97706 100%)", color: "#d97706", bgLight: "rgba(217,119,6,0.08)" },
  gas: { icon: <Flame size={20} />, emoji: "🔥", label: "Gas", defaultUnit: "m³", gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)", color: "#ea580c", bgLight: "rgba(234,88,12,0.08)" },
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
  const [currentIdx, setCurrentIdx] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Load all meters that need readings for this billing period
  const loadMeters = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch all meters
      const params = new URLSearchParams();
      if (propertyId) params.set("property", propertyId);
      const res = await apiFetch(`/facility/meters/?${params.toString()}`, {}, orgId);
      if (!res.ok) throw new Error("Failed to load meters");
      const data = await res.json();
      const allMeters: any[] = Array.isArray(data) ? data : data.results || [];

      // Filter to active meters and check which need readings
      const needsReading: MeterEntry[] = [];
      for (const m of allMeters) {
        if (!m.is_active) continue;
        // Check if this meter has a reading for the current period
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

      // Sort: water first, then electricity, then gas; within each group sort by unit code
      needsReading.sort((a, b) => {
        const order = { water: 0, electricity: 1, gas: 2 };
        const diff = (order[a.utilityType] ?? 3) - (order[b.utilityType] ?? 3);
        return diff !== 0 ? diff : a.unitCode.localeCompare(b.unitCode);
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

  const currentMeter = meters[currentIdx] ?? null;
  const meta = currentMeter ? UTILITY_META[currentMeter.utilityType] || UTILITY_META.water : UTILITY_META.water;
  const currentValue = currentMeter ? values[currentMeter.meterId] || "" : "";
  const enteredReading = parseFloat(currentValue) || 0;
  const consumption = currentMeter ? Math.max(0, enteredReading - currentMeter.previousReading) : 0;
  const estimatedCost = currentMeter ? consumption * currentMeter.tariff : 0;
  const totalMeters = meters.length;
  const completedCount = completed.size;
  const skippedCount = skipped.size;
  const progress = totalMeters > 0 ? ((completedCount + skippedCount) / totalMeters) * 100 : 0;

  // Group meters by utility type for summary
  const metersByType = useMemo(() => {
    const groups: Record<string, MeterEntry[]> = {};
    for (const m of meters) {
      (groups[m.utilityType] ??= []).push(m);
    }
    return groups;
  }, [meters]);

  const handleSaveAndNext = async () => {
    if (!currentMeter || !orgId) return;
    if (enteredReading <= currentMeter.previousReading) {
      setError(`Current reading must be higher than previous reading (${currentMeter.previousReading})`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/auth/csrf/");
      const readAt = periodEnd || new Date().toISOString().slice(0, 10);
      const payload = {
        meter: currentMeter.meterId,
        read_at: new Date(readAt).toISOString(),
        value: enteredReading,
        notes: `Monthly billing run batch reading`,
      };
      const res = await apiFetch("/facility/meter-readings/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      }, orgId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(Object.values(data).flat().join(" ") || "Failed to save reading");
      }

      const reading = await res.json();

      // Auto-approve
      if (reading?.id && reading.status === "pending") {
        await apiFetch(`/facility/meter-readings/${reading.id}/approve/`, {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
        }, orgId).catch(() => null);
      }

      setCompleted((prev) => new Set(prev).add(currentMeter.meterId));
      setNotice(`✓ ${meta.emoji} ${currentMeter.unitCode} — ${consumption} ${currentMeter.unit} = ${money.format(estimatedCost)}`);

      // Auto-advance
      if (currentIdx < totalMeters - 1) {
        setCurrentIdx((i) => i + 1);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save reading");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (!currentMeter) return;
    setSkipped((prev) => new Set(prev).add(currentMeter.meterId));
    if (currentIdx < totalMeters - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleFinish = async () => {
    await onComplete();
    onClose();
  };

  const allDone = totalMeters > 0 && completedCount + skippedCount >= totalMeters;

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            boxShadow: "0 25px 50px -15px rgba(0,0,0,0.2)",
            overflow: "hidden",
            maxHeight: "90vh",
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: allDone ? "linear-gradient(135deg, #065f46 0%, #10b981 100%)" : "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          color: "#fff",
          px: 3,
          py: 2,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {allDone ? <CheckCircle size={20} /> : <Gauge size={20} />}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>
                {allDone ? "All Meter Readings Complete!" : "Monthly Meter Reading Wizard"}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>
                {allDone
                  ? `${completedCount} recorded, ${skippedCount} skipped`
                  : `Step ${currentIdx + 1} of ${totalMeters} • ${completedCount} done`}
              </Typography>
            </Box>
          </Box>
          {!allDone && totalMeters > 0 && (
            <Box sx={{ display: "flex", gap: 1 }}>
              {Object.entries(metersByType).map(([type, ms]) => {
                const m = UTILITY_META[type] || UTILITY_META.water;
                const done = ms.filter((x) => completed.has(x.meterId)).length;
                return (
                  <Box
                    key={type}
                    sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: 1,
                      background: "rgba(255,255,255,0.12)",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    {m.emoji} {done}/{ms.length}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
        {totalMeters > 0 && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              mt: 1.5,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.15)",
              "& .MuiLinearProgress-bar": {
                background: allDone ? "#34d399" : "#60a5fa",
                borderRadius: 2,
              },
            }}
          />
        )}
      </Box>

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <CircularProgress size={32} />
            <Typography variant="caption" sx={{ display: "block", mt: 1.5, color: "var(--text-secondary)" }}>
              Loading meters for this billing period…
            </Typography>
          </Box>
        ) : totalMeters === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <CheckCircle size={40} color="#10b981" />
            <Typography variant="h6" sx={{ mt: 1.5, fontWeight: 800, fontSize: 16 }}>
              All Meters Up to Date!
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5 }}>
              Every meter has an approved reading for this billing period.
            </Typography>
          </Box>
        ) : allDone ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <CheckCircle size={48} color="#10b981" />
            <Typography variant="h6" sx={{ mt: 1.5, fontWeight: 800, fontSize: 16 }}>
              Meter Reading Session Complete
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5, mb: 2 }}>
              {completedCount} reading{completedCount !== 1 ? "s" : ""} saved & approved
              {skippedCount > 0 ? `, ${skippedCount} skipped` : ""}. 
              Billing candidates will be refreshed.
            </Typography>

            {/* Summary by type */}
            <Stack spacing={1} sx={{ textAlign: "left", maxWidth: 360, mx: "auto" }}>
              {Object.entries(metersByType).map(([type, ms]) => {
                const m = UTILITY_META[type] || UTILITY_META.water;
                const done = ms.filter((x) => completed.has(x.meterId));
                const skip = ms.filter((x) => skipped.has(x.meterId));
                return (
                  <Box
                    key={type}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: m.bgLight,
                      border: `1px solid ${m.color}25`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700, fontSize: 13 }}>
                      <span>{m.emoji}</span> {m.label}
                    </Box>
                    <Box sx={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {done.length} recorded{skip.length > 0 ? `, ${skip.length} skipped` : ""}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        ) : currentMeter ? (
          <Box>
            {/* Current meter header */}
            <Box
              sx={{
                px: 3,
                py: 1.5,
                background: meta.bgLight,
                borderBottom: `2px solid ${meta.color}30`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 13, color: meta.color }}>
                    {currentMeter.unitCode} — {meta.label} Meter
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontSize: 11 }}>
                    {currentMeter.meterCode} • {currentMeter.meterName}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontSize: 10 }}>
                  Previous Reading
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 15, color: meta.color }}>
                  {currentMeter.previousReading.toLocaleString()} {currentMeter.unit}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ p: 3 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5, fontSize: 12 }}>
                  {error}
                </Alert>
              )}
              {notice && (
                <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5, fontSize: 12 }} onClose={() => setNotice(null)}>
                  {notice}
                </Alert>
              )}

              {completed.has(currentMeter.meterId) ? (
                <Alert severity="success" sx={{ borderRadius: 2, fontSize: 13 }}>
                  ✓ Reading already recorded for this meter. Use the arrows to navigate.
                </Alert>
              ) : (
                <Stack spacing={2.5}>
                  <TextField
                    label="Current Meter Reading"
                    type="number"
                    size="small"
                    autoFocus
                    fullWidth
                    value={currentValue}
                    onChange={(e) => {
                      setValues((prev) => ({ ...prev, [currentMeter.meterId]: e.target.value }));
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && enteredReading > currentMeter.previousReading) {
                        e.preventDefault();
                        void handleSaveAndNext();
                      }
                    }}
                    placeholder={`e.g. ${currentMeter.previousReading + (currentMeter.utilityType === "electricity" ? 100 : 25)}`}
                    slotProps={{
                      input: {
                        startAdornment: <Gauge size={16} style={{ marginRight: 8, color: meta.color }} />,
                        endAdornment: (
                          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 700 }}>
                            {currentMeter.unit}
                          </Typography>
                        ),
                      },
                    }}
                    helperText={
                      enteredReading > currentMeter.previousReading
                        ? `Consumption: ${consumption.toLocaleString()} ${currentMeter.unit}`
                        : `Enter the current dial reading (must be > ${currentMeter.previousReading})`
                    }
                  />

                  {/* Live cost preview */}
                  {enteredReading > currentMeter.previousReading && currentMeter.tariff > 0 && (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ color: "#065f46", fontWeight: 700, fontSize: 10 }}>
                          CONSUMPTION
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: 12 }}>
                          {consumption.toLocaleString()} {currentMeter.unit} × {money.format(currentMeter.tariff)}/{currentMeter.unit}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography variant="caption" sx={{ color: "#065f46", fontWeight: 700, fontSize: 10 }}>
                          ESTIMATED CHARGE
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 800, color: "#065f46", fontSize: 16 }}>
                          {money.format(estimatedCost)}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          </Box>
        ) : null}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: "space-between" }}>
        {allDone || totalMeters === 0 ? (
          <>
            <div />
            <Button
              variant="contained"
              onClick={handleFinish}
              sx={{
                fontWeight: 700,
                px: 3,
                background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)",
                "&:hover": { background: "#059669" },
              }}
            >
              Finish & Refresh Billing
            </Button>
          </>
        ) : (
          <>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                disabled={currentIdx === 0 || saving}
                startIcon={<ChevronLeft size={14} />}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                sx={{ color: "var(--text-secondary)" }}
              >
                Prev
              </Button>
              <Button
                size="small"
                disabled={currentIdx >= totalMeters - 1 || saving}
                endIcon={<ChevronRight size={14} />}
                onClick={() => setCurrentIdx((i) => Math.min(totalMeters - 1, i + 1))}
                sx={{ color: "var(--text-secondary)" }}
              >
                Next
              </Button>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                onClick={handleSkip}
                disabled={saving || completed.has(currentMeter?.meterId ?? "")}
                sx={{ color: "var(--text-secondary)", fontSize: 12 }}
              >
                Skip
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={saving || !currentMeter || enteredReading <= (currentMeter?.previousReading ?? 0) || completed.has(currentMeter?.meterId ?? "")}
                onClick={handleSaveAndNext}
                sx={{
                  fontWeight: 700,
                  px: 2,
                  background: meta.gradient,
                  "&:hover": { opacity: 0.9 },
                }}
              >
                {saving ? "Saving…" : completedCount + skippedCount >= totalMeters - 1 ? "Save & Finish" : "Save & Next →"}
              </Button>
            </Box>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
