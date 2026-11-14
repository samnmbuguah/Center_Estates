"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  Paper,
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
import { Car, CheckCircle2, Search, Sparkles, X } from "lucide-react";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { money } from "@/components/module-ui";
import type { Candidate } from "./types";

type ParkingRowDraft = {
  candidateId: string;
  leaseId: string;
  unitCode: string;
  tenantName: string;
  leaseReference: string;
  originalFee: number;
  originalBay: string;
  parkingFee: string;
  parkingBay: string;
};

export function BatchParkingModal({
  open,
  onClose,
  candidates,
  propertyName,
  rentFrequency = "monthly",
  formattedPeriod,
  focusCandidateId,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  candidates: Candidate[];
  propertyName?: string;
  rentFrequency?: string;
  formattedPeriod?: string;
  focusCandidateId?: string | null;
  onComplete: () => Promise<void> | void;
}) {
  const { session } = useAuth();
  const [rows, setRows] = useState<ParkingRowDraft[]>([]);
  const [search, setSearch] = useState("");
  const [quickFee, setQuickFee] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const multiplier = useMemo(() => {
    const f = String(rentFrequency || "monthly").toLowerCase();
    if (f === "quarterly") return 3;
    if (f === "semi_annual" || f === "semi-annual") return 6;
    if (f === "annual") return 12;
    return 1;
  }, [rentFrequency]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSearch("");
    const initial: ParkingRowDraft[] = candidates
      .filter((c) => Boolean(c.lease_id))
      .map((c) => {
        const parkItem = (c.billing_items || []).find((it) =>
          String(it.code || "").toUpperCase().includes("PARK")
        );
        const rawFee = Number(c.parking_fee ?? 0);
        const derivedMonthly =
          rawFee > 0
            ? rawFee
            : parkItem
            ? Number(parkItem.unit_rate || parkItem.subtotal || parkItem.amount || 0)
            : 0;
        const bayFromDesc =
          c.parking_bay ||
          (parkItem?.description?.includes("— Bay ")
            ? parkItem.description.split("— Bay ")[1]?.trim() || ""
            : "");
        return {
          candidateId: String(c.id),
          leaseId: String(c.lease_id),
          unitCode: String(c.unit_code || "—"),
          tenantName: String(c.tenant_name || "—"),
          leaseReference: String(c.lease_reference || "—"),
          originalFee: derivedMonthly,
          originalBay: bayFromDesc,
          parkingFee: derivedMonthly > 0 ? String(derivedMonthly) : "",
          parkingBay: bayFromDesc,
        };
      });
    setRows(initial);
  }, [open, candidates]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.unitCode.toLowerCase().includes(q) ||
        r.tenantName.toLowerCase().includes(q) ||
        r.leaseReference.toLowerCase().includes(q) ||
        r.parkingBay.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const modifiedRows = useMemo(() => {
    return rows.filter((r) => {
      const feeNum = r.parkingFee.trim() === "" ? 0 : Number(r.parkingFee);
      const bayClean = r.parkingBay.trim();
      return feeNum !== r.originalFee || bayClean !== r.originalBay;
    });
  }, [rows]);

  const summary = useMemo(() => {
    let activeCount = 0;
    let monthlyTotal = 0;
    for (const r of rows) {
      const fee = Number(r.parkingFee || 0);
      if (Number.isFinite(fee) && fee > 0) {
        activeCount += 1;
        monthlyTotal += fee;
      }
    }
    return {
      activeCount,
      monthlyTotal,
      periodTotal: monthlyTotal * multiplier,
    };
  }, [rows, multiplier]);

  const handleUpdateRow = (leaseId: string, field: "parkingFee" | "parkingBay", value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.leaseId === leaseId ? { ...r, [field]: value } : r))
    );
  };

  const handleQuickApply = (onlyEmpty: boolean) => {
    const num = Number(quickFee);
    if (!Number.isFinite(num) || num < 0) return;
    setRows((prev) =>
      prev.map((r) => {
        if (onlyEmpty && Number(r.parkingFee || 0) > 0) return r;
        return { ...r, parkingFee: num === 0 ? "" : String(num) };
      })
    );
  };

  const handleSave = async () => {
    if (modifiedRows.length === 0) {
      onClose();
      return;
    }
    for (const r of modifiedRows) {
      const feeNum = r.parkingFee.trim() === "" ? 0 : Number(r.parkingFee);
      if (!Number.isFinite(feeNum) || feeNum < 0) {
        setError(`Invalid parking fee for ${r.tenantName} (${r.unitCode}).`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const csrf = csrfFromCookie();
      await Promise.all(
        modifiedRows.map(async (r) => {
          const feeNum = r.parkingFee.trim() === "" ? 0 : Number(r.parkingFee);
          const res = await apiFetch(
            `/property/leases/${r.leaseId}/`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                ...(csrf ? { "X-CSRFToken": csrf } : {}),
              },
              body: JSON.stringify({
                parking_fee: feeNum.toFixed(2),
                parking_bay: r.parkingBay.trim(),
              }),
            },
            session?.activeOrganizationId
          );
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(
              errData?.detail || `Failed to save parking for ${r.tenantName} (${r.unitCode}).`
            );
          }
        })
      );
      await onComplete();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save parking charges.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <Box
        sx={{
          background: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)",
          color: "#fff",
          px: 3,
          py: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "10px",
              bgcolor: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Car size={20} />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Lease Parking Schedule {propertyName ? `— ${propertyName}` : ""}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
              Connected directly to each tenant&apos;s Lease — saving here permanently updates the Lease so{" "}
              {multiplier > 1
                ? `parking is billed ×${multiplier} months on consolidated ${rentFrequency} invoices automatically.`
                : "parking is included on recurring lease invoices automatically."}{" "}
              <strong>Parking Bay is optional</strong>; only Monthly Fee (KES) is required.
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} disabled={saving} sx={{ color: "#fff" }} size="small">
          <X size={18} />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 2.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Top Quick-Fill & Search Bar */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            bgcolor: "rgba(124, 58, 237, 0.04)",
            borderColor: "rgba(124, 58, 237, 0.2)",
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <TextField
              size="small"
              placeholder="Search unit, tenant or bay…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={14} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ width: 230, bgcolor: "#fff" }}
            />
            <Chip
              size="small"
              label={`${summary.activeCount} of ${rows.length} with parking`}
              sx={{
                fontWeight: 700,
                bgcolor: "rgba(124, 58, 237, 0.12)",
                color: "#6d28d9",
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
              Quick Fill Rate:
            </Typography>
            <TextField
              size="small"
              type="number"
              placeholder="e.g. 5000"
              value={quickFee}
              onChange={(e) => setQuickFee(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">KES</InputAdornment>,
                },
              }}
              sx={{ width: 145, bgcolor: "#fff" }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<Sparkles size={13} />}
              disabled={!quickFee}
              onClick={() => handleQuickApply(true)}
              sx={{ textTransform: "none", fontWeight: 700, borderColor: "#7c3aed", color: "#6d28d9" }}
            >
              Fill Empty
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!quickFee}
              onClick={() => handleQuickApply(false)}
              sx={{ textTransform: "none", fontWeight: 700, borderColor: "#7c3aed", color: "#6d28d9" }}
            >
              Apply to All
            </Button>
          </Stack>
        </Paper>

        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ maxHeight: 420, borderRadius: 2 }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>
                  Unit
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>
                  Tenant & Lease
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", width: 175 }}>
                  Monthly Fee (KES)
                </TableCell>
                <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", width: 195 }}>
                  Parking Bay / Notes (Optional)
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", width: 155 }}
                >
                  {multiplier > 1 ? `Period Total (×${multiplier} mos)` : "Invoice Line Total"}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => {
                const feeVal = Number(row.parkingFee || 0);
                const periodLineTotal = Number.isFinite(feeVal) && feeVal > 0 ? feeVal * multiplier : 0;
                const isEdited =
                  (row.parkingFee.trim() === "" ? 0 : Number(row.parkingFee)) !== row.originalFee ||
                  row.parkingBay.trim() !== row.originalBay;
                const isFocused = focusCandidateId && row.candidateId === focusCandidateId;

                return (
                  <TableRow
                    key={row.leaseId}
                    hover
                    sx={{
                      bgcolor: isFocused
                        ? "rgba(124, 58, 237, 0.08)"
                        : isEdited
                        ? "rgba(16, 185, 129, 0.05)"
                        : undefined,
                    }}
                  >
                    <TableCell sx={{ fontWeight: 800, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                      {row.unitCode}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12.5 }}>
                        {row.tenantName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "ui-monospace, monospace" }}>
                        {row.leaseReference}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        fullWidth
                        placeholder="0.00"
                        value={row.parkingFee}
                        autoFocus={ Boolean(isFocused) }
                        onChange={(e) => handleUpdateRow(row.leaseId, "parkingFee", e.target.value)}
                        slotProps={{
                          htmlInput: { min: 0, step: "0.01" },
                        }}
                        sx={{ "& .MuiInputBase-input": { fontSize: 12.5, fontWeight: 700, py: 0.65 } }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Optional (e.g. BAY-01)"
                        value={row.parkingBay}
                        onChange={(e) => handleUpdateRow(row.leaseId, "parkingBay", e.target.value)}
                        sx={{ "& .MuiInputBase-input": { fontSize: 12, py: 0.65 } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {periodLineTotal > 0 ? (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: "#6d28d9", fontSize: 12.5 }}>
                            {money.format(periodLineTotal)}
                          </Typography>
                          {multiplier > 1 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                              {money.format(feeVal)}/mo × {multiplier}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: "1px solid var(--border, #e2e8f0)",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Monthly Parking:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{money.format(summary.monthlyTotal)}</strong>
          </Typography>
          {multiplier > 1 && (
            <Typography variant="body2" color="text.secondary">
              {formattedPeriod || "Quarterly"} Invoice Total:{" "}
              <strong style={{ color: "#6d28d9" }}>{money.format(summary.periodTotal)}</strong>
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} disabled={saving} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <CheckCircle2 size={16} />}
            sx={{
              bgcolor: "#6d28d9",
              fontWeight: 700,
              textTransform: "none",
              "&:hover": { bgcolor: "#5b21b6" },
            }}
          >
            {saving
              ? "Saving & Refreshing…"
              : modifiedRows.length > 0
              ? `Save Parking (${modifiedRows.length} changed) & Update Invoices`
              : "Done"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
