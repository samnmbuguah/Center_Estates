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
  chargeTypeFilter,
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
  chargeTypeFilter: InvoiceChargeType | "all";
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
  const typeLabel = chargeTypeFilter === "all" ? "" : CHARGE_TYPE_LABEL[chargeTypeFilter];
  const generateLabel = busy === "generate"
    ? "Generating Invoices…"
    : chargeTypeFilter === "all"
      ? `Generate & Issue ${selectedCount} Invoices`
      : `Generate ${selectedCount} ${typeLabel} Invoice${selectedCount === 1 ? "" : "s"}`;

  // Stepper Header
  const stepIndex = !hasRun || isPreparing ? 1 : isReview ? 2 : isApproved ? 3 : 3;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* 3-Step Visual Progress Stepper */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 1.5,
          borderRadius: 2.5,
          bgcolor: "background.paper",
          border: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        <Chip
          size="small"
          label="1. Scan & Prepare Batch"
          color={stepIndex === 1 ? "primary" : "default"}
          variant={stepIndex === 1 ? "filled" : "outlined"}
          sx={{ fontWeight: stepIndex === 1 ? 800 : 500 }}
        />
        <ArrowRight size={14} style={{ color: "var(--muted)" }} />
        <Chip
          size="small"
          label={`2. Review Candidates (${ready} ready)`}
          color={stepIndex === 2 ? "warning" : "default"}
          variant={stepIndex === 2 ? "filled" : "outlined"}
          sx={{ fontWeight: stepIndex === 2 ? 800 : 500 }}
        />
        <ArrowRight size={14} style={{ color: "var(--muted)" }} />
        <Chip
          size="small"
          label="3. Generate & Dispatch Invoices"
          color={stepIndex === 3 ? "success" : "default"}
          variant={stepIndex === 3 ? "filled" : "outlined"}
          sx={{ fontWeight: stepIndex === 3 ? 800 : 500 }}
        />
      </Box>

      {/* Action Banner State 1: Ready to Run */}
      {!hasRun && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(14, 165, 233, 0.06) 100%)",
            border: "1.5px solid rgba(2, 132, 199, 0.2)",
            display: "flex",
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "info.main" }}>
                ⚡ Bulk Invoicing Queue for {formattedMonth}
              </Typography>
              <Chip size="small" label="Ready to Scan" color="info" sx={{ fontWeight: 700, height: 20, fontSize: "0.72rem" }} />
            </Box>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", lineHeight: 1.5, mb: 1 }}>
              Scans all active leases for this property, applies base rent + escalation, calculates monthly service charges, and incorporates latest unbilled utility meter readings into a unified invoice draft.
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mt: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  bgcolor: "var(--surface-2, #f1f5f9)",
                  border: "1px solid var(--border)",
                  borderRadius: 99,
                  px: 1.25,
                  py: 0.35,
                }}
              >
                Prepares rent, service charge & utility drafts in one scan — choose what to bill at the review step below.
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" sx={{ gap: 1, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Zap size={18} />}
              disabled={!canFinance || Boolean(busy)}
              onClick={onInitialize}
              sx={{
                bgcolor: "#0284c7",
                "&:hover": { bgcolor: "#0369a1" },
                fontWeight: 800,
                px: 3,
                py: 1.25,
                borderRadius: 2,
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
              }}
            >
              {busy === "create" ? "Scanning Leases…" : `Start Bulk Invoicing for ${formattedMonth}`}
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<FilePlus2 size={18} />}
              onClick={onSingleInvoice}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Single Invoice
            </Button>
          </Stack>
        </Paper>
      )}

      {/* A durable run may already exist if the browser closed between queue
          creation and readiness scanning. Keep that workflow recoverable. */}
      {hasRun && isPreparing && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(14, 165, 233, 0.06) 100%)",
            border: "1.5px solid rgba(2, 132, 199, 0.2)",
            display: "flex",
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "info.main" }}>
              Complete the readiness scan for {formattedMonth}
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5 }}>
              The queue is saved. Scan the active leases now to calculate rent and recurring charges and identify anything that needs attention.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<Zap size={18} />}
            disabled={!canFinance || Boolean(busy)}
            onClick={onRecheck}
            sx={{ fontWeight: 800, px: 3, flexShrink: 0 }}
          >
            {busy === "prepare" ? "Scanning leases…" : "Scan leases & prepare invoices"}
          </Button>
        </Paper>
      )}

      {/* Action Banner State 2: Review Phase */}
      {isReview && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)",
            border: "1.5px solid rgba(234, 179, 8, 0.3)",
            display: "flex",
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "warning.dark" }}>
                Step 2: Candidate Review · {ready} Ready to Bill · {issues} Exceptions
              </Typography>
              {blockingOpen ? (
                <Chip size="small" label="Blocking Issues Open" color="error" sx={{ fontWeight: 700 }} />
              ) : (
                <Chip size="small" label="Ready to Confirm" color="success" sx={{ fontWeight: 700 }} />
              )}
            </Box>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5 }}>
              Review the candidate invoice list below. If everything is correct, click <strong>&quot;Confirm Billing Run&quot;</strong> to enable final invoice generation.
            </Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1, flexShrink: 0, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<RotateCcw size={16} />}
              disabled={Boolean(busy)}
              onClick={onRecheck}
            >
              {busy === "prepare" ? "Re-checking…" : "Re-check Queue"}
            </Button>
            {canApprove && (
              <Button
                variant="contained"
                color="warning"
                disabled={blockingOpen || Boolean(busy)}
                onClick={onApprove}
                sx={{
                  fontWeight: 800,
                  px: 3,
                  bgcolor: "#d97706",
                  "&:hover": { bgcolor: "#b45309" },
                }}
              >
                Confirm Billing Run
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {/* Action Banner State 3: Confirmed & Ready to Generate */}
      {isApproved && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)",
            border: "1.5px solid rgba(34, 197, 94, 0.3)",
            display: "flex",
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircle2 size={20} style={{ color: "var(--success, #16a34a)" }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "success.dark" }}>
                Step 3: Confirmed · {selectedCount} Invoice(s) Selected
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5 }}>
              {chargeTypeFilter === "all"
                ? "Click below to generate official invoices. Invoices will be numbered, generated into PDF statements, and synchronized with tenant portals."
                : `Only ${typeLabel.toLowerCase()} invoices will be generated for the selected candidates. Other charges stay pending and can be billed separately. Already-billed types are automatically skipped — no duplicates.`}
            </Typography>
            {chargeTypeFilter !== "all" && (
              <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block", mt: 0.5 }}>
                Tip: Generate rent first, then service charge — each type is tracked separately per tenancy and period.
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<Send size={18} />}
            disabled={!canFinance || selectedCount === 0 || Boolean(busy)}
            onClick={onGenerate}
            sx={{
              fontWeight: 800,
              px: 3.5,
              py: 1.25,
              borderRadius: 2,
              flexShrink: 0,
              bgcolor: "#16a34a",
              "&:hover": { bgcolor: "#15803d" },
              boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)",
            }}
          >
            {generateLabel}
          </Button>
        </Paper>
      )}
    </Box>
  );
}
