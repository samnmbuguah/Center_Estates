"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { CheckCircle2, Info, Settings2, ShieldAlert, Zap } from "lucide-react";

export function BillingPolicyModal({
  open,
  onClose,
  propertyId,
  propertyName = "Current Property",
  requireUtilityReadings,
  onPolicyChange,
}: {
  open: boolean;
  onClose: () => void;
  propertyId?: string;
  propertyName?: string;
  requireUtilityReadings: boolean;
  onPolicyChange: (enabled: boolean) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(requireUtilityReadings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setEnabled(requireUtilityReadings);
      setError("");
      setSuccess(false);
    }
  }, [open, requireUtilityReadings]);

  const handleToggle = async (forceVal?: boolean) => {
    if (saving) return;
    const nextVal = forceVal !== undefined ? forceVal : !enabled;
    setEnabled(nextVal);
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await onPolicyChange(nextVal);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Failed to update billing policy");
      setEnabled(!nextVal);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          p: 2.5,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            bgcolor: "rgba(255, 255, 255, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Settings2 size={20} color="#38bdf8" />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
            Property Invoicing Policy
          </Typography>
          <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.7)", fontSize: 12 }}>
            {propertyName}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Policy updated! {enabled ? "Utility readings are now required before rent (Gate ON)." : "Independent rent invoicing enabled (Meter gate OFF)."}
          </Alert>
        )}

        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            onClick={() => void handleToggle()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void handleToggle();
              }
            }}
            sx={{
              p: 2,
              borderRadius: "12px",
              cursor: saving ? "wait" : "pointer",
              userSelect: "none",
              border: enabled ? "2px solid #d97706" : "2px solid #10b981",
              bgcolor: enabled ? "rgba(254, 243, 199, 0.35)" : "rgba(209, 250, 229, 0.4)",
              transition: "all 0.2s ease",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              "&:hover": {
                bgcolor: enabled ? "rgba(254, 243, 199, 0.55)" : "rgba(209, 250, 229, 0.6)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                transform: "translateY(-1px)",
              },
            }}
          >
            <Box sx={{ pr: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 14.5, color: enabled ? "#92400e" : "#065f46" }}>
                  Require Utility Readings Before Rent
                </Typography>
                <Box
                  sx={{
                    px: 1,
                    py: 0.2,
                    borderRadius: "6px",
                    fontSize: 11,
                    fontWeight: 800,
                    bgcolor: enabled ? "#fef3c7" : "#d1fae5",
                    color: enabled ? "#b45309" : "#047857",
                    border: `1px solid ${enabled ? "#f59e0b" : "#10b981"}`,
                  }}
                >
                  {saving ? "SAVING…" : enabled ? "GATE ON" : "GATE OFF"}
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Controls whether pending electricity/water meter readings block rent invoicing
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {saving && <CircularProgress size={18} sx={{ color: enabled ? "#d97706" : "#059669" }} />}
              <Switch
                checked={enabled}
                disabled={saving}
                color="warning"
                aria-label="Require Utility Readings Before Rent"
              />
            </Box>
          </Paper>

          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            {enabled ? (
              <ShieldAlert size={20} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={20} color="#059669" style={{ marginTop: 2, flexShrink: 0 }} />
            )}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5, color: enabled ? "#92400e" : "#047857" }}>
                {enabled
                  ? "Consolidated Mode (Gate ON)"
                  : "Independent Rent Invoicing (Gate OFF - Recommended for KASNEB)"}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5 }}>
                {enabled
                  ? "Rent, service charge, and utility consumption are bundled into a single invoice. Rent invoicing remains blocked for a tenant until caretaker logs current electricity and water meter readings."
                  : "Rent and service charge invoices can be generated and sent immediately on the 1st of the month. Electricity and water meter readings can be recorded and billed independently when readings arrive."}
              </Typography>
            </Box>
          </Box>

          <Divider />

          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Info size={16} color="var(--text-secondary)" />
            <Typography variant="caption" color="text.secondary">
              Clicking the card above instantly toggles and saves the policy for this property.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, px: 3, bgcolor: "var(--color-slate-50)", justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary">
          Current status: <strong>{enabled ? "Gate ON" : "Gate OFF"}</strong>
        </Typography>
        <Button
          onClick={onClose}
          disabled={saving}
          variant="contained"
          sx={{
            background: "#1e293b",
            "&:hover": { background: "#0f172a" },
            fontWeight: 800,
            px: 3,
          }}
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
