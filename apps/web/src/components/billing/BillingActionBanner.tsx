"use client";

import { useState } from "react";
import { Box, Button, Paper, Stack, Typography, Chip, Checkbox, FormControlLabel } from "@mui/material";
import { FilePlus2, RotateCcw, Send, Zap, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export function BillingActionBanner({
  hasRun,
  isReview,
  isApproved,
  formattedMonth,
  ready,
  issues,
  selectedCount,
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
  isReview: boolean;
  isApproved: boolean;
  formattedMonth: string;
  ready: number;
  issues: number;
  selectedCount: number;
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
  const [includeRent, setIncludeRent] = useState(true);
  const [includeServiceCharge, setIncludeServiceCharge] = useState(true);
  const [includeUtilities, setIncludeUtilities] = useState(true);

  // Stepper Header
  const stepIndex = !hasRun ? 1 : isReview ? 2 : isApproved ? 3 : 3;

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

            {/* Combined Invoicing 3-Way Selector */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mt: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                Include in this run:
              </Typography>
              <FormControlLabel
                control={<Checkbox size="small" checked={includeRent} onChange={(e) => setIncludeRent(e.target.checked)} />}
                label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Rent & Escalation</Typography>}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={includeServiceCharge} onChange={(e) => setIncludeServiceCharge(e.target.checked)} />}
                label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Service Charge</Typography>}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={includeUtilities} onChange={(e) => setIncludeUtilities(e.target.checked)} />}
                label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Metered Utilities</Typography>}
              />
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
                <Chip size="small" label="Ready for Approval" color="success" sx={{ fontWeight: 700 }} />
              )}
            </Box>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5 }}>
              Review the candidate invoice list below. If everything is correct, click <strong>"Approve Billing Run"</strong> to enable final invoice generation.
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
                Approve Billing Run
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {/* Action Banner State 3: Approved & Ready to Generate */}
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
                Step 3: Approved · {selectedCount} Invoice(s) Selected
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5 }}>
              Click below to generate official invoices. Invoices will be numbered, generated into PDF statements, and synchronized with tenant portals.
            </Typography>
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
            {busy === "generate" ? "Generating Invoices…" : `Generate & Issue ${selectedCount} Invoices`}
          </Button>
        </Paper>
      )}
    </Box>
  );
}
