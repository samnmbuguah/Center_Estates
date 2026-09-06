"use client";

import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Droplets, Gauge, Sparkles } from "lucide-react";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { money } from "@/components/module-ui";
import { Candidate } from "./types";

interface MeterOption {
  id: string;
  name: string;
  code: string;
  utility_type: string;
  property_unit?: string;
  unit_code?: string;
  tariff: number | string;
  unit: string;
  current_reading?: number | null;
  previous_reading?: number | null;
}

export function QuickRecordMeterModal({
  candidate,
  periodEnd,
  open,
  onClose,
  onSuccess,
}: {
  candidate: Candidate | null;
  periodEnd?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}) {
  const { session } = useAuth();
  const orgId = session?.activeOrganizationId ?? undefined;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meters, setMeters] = useState<MeterOption[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>("");
  const [currentValue, setCurrentValue] = useState<string>("");
  const [readAt, setReadAt] = useState<string>(() => {
    return periodEnd || new Date().toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState<string>("Monthly billing run meter reading");

  // Load meters matching candidate unit or property
  useEffect(() => {
    if (!open || !candidate || !orgId) return;
    let cancelled = false;

    async function loadMeters() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/facility/meters/`, {}, orgId);
        if (!res.ok) throw new Error("Could not load utility meters");
        const data = (await res.json()) as any;
        const list: MeterOption[] = Array.isArray(data) ? data : data.results || [];
        
        const candidateUnit = candidate?.unit_code ? String(candidate.unit_code).toLowerCase() : "";
        // Filter meters for this candidate's unit or property (water meters prioritized)
        const unitMeters = list.filter((m) => {
          const matchesUnit =
            (m.unit_code && m.unit_code.toLowerCase() === candidateUnit) ||
            (m.property_unit && String(m.property_unit).toLowerCase() === candidateUnit);
          const isWater = (m.utility_type || "").toLowerCase() === "water";
          return matchesUnit && isWater;
        });

        // Fallback: all water meters in property, or any meters matching unit
        const candidatesMeters = unitMeters.length > 0 
          ? unitMeters 
          : list.filter(m => (m.utility_type || "").toLowerCase() === "water");

        if (!cancelled) {
          setMeters(candidatesMeters);
          if (candidatesMeters.length > 0) {
            setSelectedMeterId(candidatesMeters[0].id);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load meters for this unit.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMeters();
    return () => {
      cancelled = true;
    };
  }, [open, candidate, orgId]);

  const selectedMeter = meters.find((m) => m.id === selectedMeterId) || meters[0];
  const previousReading = Number(selectedMeter?.current_reading ?? selectedMeter?.previous_reading ?? 0);
  const enteredReading = Number(currentValue || 0);
  const consumption = enteredReading > previousReading ? enteredReading - previousReading : 0;
  const tariff = Number(selectedMeter?.tariff ?? 150);
  const estimatedCost = consumption * tariff;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate || !orgId) return;

    if (!selectedMeterId && meters.length === 0) {
      setError("No registered water meter found. Please configure a water meter in Facility > Meters first.");
      return;
    }

    if (!currentValue || isNaN(enteredReading)) {
      setError("Please enter a valid numeric meter reading.");
      return;
    }

    if (enteredReading < previousReading) {
      setError(`Current reading (${enteredReading}) cannot be less than previous reading (${previousReading}).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiFetch("/auth/csrf/");
      const payload = {
        meter: selectedMeterId,
        read_at: new Date(readAt).toISOString(),
        value: enteredReading,
        notes: notes.trim(),
      };

      const res = await apiFetch(
        "/facility/meter-readings/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfFromCookie(),
          },
          body: JSON.stringify(payload),
        },
        orgId
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = Object.values(data).flat().join(" ") || "Failed to save meter reading.";
        throw new Error(msg);
      }

      const reading = await res.json();

      // Automatically approve reading if still pending to immediately unlock billing
      if (reading?.id && reading.status === "pending") {
        await apiFetch(
          `/facility/meter-readings/${reading.id}/approve/`,
          {
            method: "POST",
            headers: { "X-CSRFToken": csrfFromCookie() },
          },
          orgId
        ).catch(() => {
          // If approval fails due to permission, reading is pending review
        });
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while saving the reading.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!candidate) return null;

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2.5,
            boxShadow: "0 20px 40px -15px rgba(0,0,0,0.15)",
            overflow: "hidden",
          },
        },
      }}
    >
      <Box
        sx={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
          color: "#fff",
          p: 2.5,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "center" }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Droplets size={22} color="#93c5fd" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
              Record Water Meter Reading
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", fontSize: 11.5 }}>
              Required for {candidate.tenant_name} · Unit {candidate.unit_code}
            </Typography>
          </Box>
        </Box>
      </Box>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5, fontSize: 12 }}>
              {error}
            </Alert>
          )}

          <Alert
            severity="info"
            icon={<Sparkles size={16} />}
            sx={{
              mb: 2.5,
              borderRadius: 1.5,
              background: "rgba(37,99,235,0.06)",
              color: "#1e40af",
              borderColor: "rgba(37,99,235,0.2)",
              fontSize: 12,
            }}
          >
            <strong>Consolidated Billing Rule:</strong> Saving and approving this meter reading will
            automatically compute the water charges and unlock the consolidated invoice (Rent + Water)
            for this tenancy.
          </Alert>

          {loading ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <CircularProgress size={32} />
              <Typography variant="caption" sx={{ display: "block", mt: 1, color: "var(--text-secondary)" }}>
                Loading meters for {candidate.unit_code}…
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2.5}>
              {meters.length > 1 && (
                <TextField
                  select
                  label="Select Meter"
                  size="small"
                  value={selectedMeterId}
                  onChange={(e) => setSelectedMeterId(e.target.value)}
                  fullWidth
                >
                  {meters.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name} ({m.code}) — {m.utility_type}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {selectedMeter && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontSize: 11 }}>
                        Assigned Meter
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>
                        {selectedMeter.name} ({selectedMeter.code})
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontSize: 11 }}>
                        Previous Reading
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 14, color: "var(--primary)" }}>
                        {previousReading.toLocaleString()} {selectedMeter.unit || "m³"}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Current Meter Reading"
                  type="number"
                  size="small"
                  required
                  fullWidth
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  placeholder={`e.g. ${previousReading + 25}`}
                  slotProps={{
                    input: {
                      startAdornment: <Gauge size={16} style={{ marginRight: 8, color: "#2563eb" }} />,
                      endAdornment: (
                        <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 700 }}>
                          {selectedMeter?.unit || "m³"}
                        </Typography>
                      ),
                    },
                  }}
                  helperText={
                    enteredReading > previousReading
                      ? `Consumption: ${consumption} ${selectedMeter?.unit || "m³"}`
                      : "Enter current index on the meter dial"
                  }
                />

                <TextField
                  label="Reading Date"
                  type="date"
                  size="small"
                  required
                  fullWidth
                  value={readAt}
                  onChange={(e) => setReadAt(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Stack>

              {/* Live Consumption & Cost Preview Card */}
              {enteredReading > previousReading && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#065f46", fontWeight: 700 }}>
                        CONSUMPTION PREVIEW
                      </Typography>
                      <Typography variant="body2" sx={{ color: "var(--text)", fontSize: 12.5 }}>
                        {consumption} {selectedMeter?.unit || "m³"} × {money.format(tariff)}/unit
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="caption" sx={{ color: "#065f46", fontWeight: 700 }}>
                        ESTIMATED WATER CHARGE
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: "#047857", fontSize: 16 }}>
                        {money.format(estimatedCost)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              <TextField
                label="Notes / Caretaker remarks"
                size="small"
                multiline
                rows={2}
                fullWidth
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes regarding physical meter condition or dial verification…"
              />
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={submitting} sx={{ color: "var(--text-secondary)" }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || loading || enteredReading <= previousReading}
            sx={{
              background: "var(--brand-primary, #2563eb)",
              fontWeight: 700,
              px: 3,
              "&:hover": { background: "#1d4ed8" },
            }}
          >
            {submitting ? "Saving & Approving…" : "Save & Unlock Billing"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
