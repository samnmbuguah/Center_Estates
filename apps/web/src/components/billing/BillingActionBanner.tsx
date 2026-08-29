"use client";

import { Box, Button, Paper, Stack, Typography, Chip } from "@mui/material";
import { FilePlus2, RotateCcw, Send, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { CHARGE_TYPE_LABEL, InvoiceChargeType } from "./types";

export function BillingActionBanner({
  hasRun,
  isPreparing,
  isReview,
  isApproved,
  formattedMonth,
  ready,
  issues,
  selectedCount,
  chargeTypeFilter = "all",
  billingTarget = "tenant",
  typeCounts = {},
  onChargeTypeFilter,
  blockingOpen,
  busy,
  canFinance,
  canApprove,
  onInitialize,
  onRecheck,
  onApprove,
  onGenerate,
  onSingleInvoice,
}: {
  hasRun: boolean;
  isPreparing: boolean;
  isReview: boolean;
  isApproved: boolean;
  formattedMonth: string;
  ready: number;
  issues: number;
  selectedCount: number;
  chargeTypeFilter?: InvoiceChargeType | "all";
  billingTarget?: "tenant" | "landlord";
  typeCounts?: Record<string, number>;
  onChargeTypeFilter?: (t: InvoiceChargeType | "all") => void;
  blockingOpen: boolean;
  busy: string;
  canFinance: boolean;
  canApprove: boolean;
  onInitialize: () => void;
  onRecheck: () => void;
  onApprove: () => void;
  onGenerate: () => void;
  onSingleInvoice: () => void;
}) {
  const typeLabel = !chargeTypeFilter || chargeTypeFilter === "all" ? "" : CHARGE_TYPE_LABEL[chargeTypeFilter];
  const generateLabel = busy === "generate"
    ? "Generating Invoices…"
    : billingTarget === "landlord"
      ? `Generate ${selectedCount} Landlord Invoice${selectedCount === 1 ? "" : "s"}`
      : chargeTypeFilter === "all"
        ? `Generate ${selectedCount} Invoices`
        : `Generate ${selectedCount} ${typeLabel} Invoice${selectedCount === 1 ? "" : "s"}`;

  const stepIndex = !hasRun || isPreparing ? 1 : isReview ? 2 : 3;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* Compact Stepper & Action Controls Combined */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        {/* Left: 3-Step Visual Progress Stepper */}
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Chip
            size="small"
            label="1. Scan & Prepare"
            color={stepIndex === 1 ? "primary" : "default"}
            variant={stepIndex === 1 ? "filled" : "outlined"}
            sx={{ fontWeight: 700, fontSize: 11, height: 24 }}
          />
          <ArrowRight size={12} style={{ color: "var(--muted)" }} />
          <Chip
            size="small"
            label={`2. Candidates (${ready} ready)`}
            color={stepIndex === 2 ? "warning" : "default"}
            variant={stepIndex === 2 ? "filled" : "outlined"}
            sx={{ fontWeight: 700, fontSize: 11, height: 24 }}
          />
          <ArrowRight size={12} style={{ color: "var(--muted)" }} />
          <Chip
            size="small"
            label="3. Generate & Dispatch"
            color={stepIndex === 3 ? "success" : "default"}
            variant={stepIndex === 3 ? "filled" : "outlined"}
            sx={{ fontWeight: 700, fontSize: 11, height: 24 }}
          />
        </Stack>

        {/* Right: Quick Action Buttons */}
        <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          {busy === "create" || busy === "prepare" ? (
            <Chip
              size="small"
              icon={<RotateCcw size={12} className="animate-spin" />}
              label="Scanning queue in background…"
              sx={{ fontWeight: 600, fontSize: 11, bgcolor: "rgba(2, 132, 199, 0.1)", color: "#0284c7" }}
            />
          ) : (
            <Button
              variant="outlined"
              size="small"
              startIcon={<RotateCcw size={13} />}
              disabled={Boolean(busy)}
              onClick={onRecheck}
              sx={{ fontSize: 11, fontWeight: 600, height: 28 }}
              title="Force re-scan of active leases and meters"
            >
              🔄 Refresh
            </Button>
          )}

          {ready > 0 && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<Send size={14} />}
              disabled={!canFinance || selectedCount === 0 || Boolean(busy)}
              onClick={onGenerate}
              sx={{ bgcolor: "#16a34a", "&:hover": { bgcolor: "#15803d" }, fontWeight: 700, fontSize: 11, height: 28 }}
            >
              {generateLabel}
            </Button>
          )}

          <Button
            variant="outlined"
            size="small"
            startIcon={<FilePlus2 size={13} />}
            onClick={onSingleInvoice}
            sx={{ fontSize: 11, fontWeight: 600, height: 28 }}
          >
            + Single Invoice
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
