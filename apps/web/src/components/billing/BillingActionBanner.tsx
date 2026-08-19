"use client";

import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { FilePlus2, RotateCcw, Send, Sparkles } from "lucide-react";

export function BillingActionBanner({ hasRun, isReview, isApproved, formattedMonth, ready, issues, selectedCount, blockingOpen, busy, canFinance, canApprove, onInitialize, onRecheck, onApprove, onGenerate, onSingleInvoice }: {
  hasRun: boolean; isReview: boolean; isApproved: boolean;
  formattedMonth: string; ready: number; issues: number; selectedCount: number;
  blockingOpen: boolean; busy: string; canFinance: boolean; canApprove: boolean;
  onInitialize: () => void; onRecheck: () => void; onApprove: () => void; onGenerate: () => void; onSingleInvoice: () => void;
}) {
  if (!hasRun) {
    return (
      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, background: "linear-gradient(135deg, rgba(226,59,59,0.06) 0%, rgba(249,115,22,0.06) 100%)", border: "1.5px solid rgba(226,59,59,0.15)", display: "flex", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>No billing run for {formattedMonth}</Typography>
          <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.25 }}>Initialize the queue to scan active leases, apply rent & service charges, and calculate utility consumption.</Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1, flexShrink: 0, flexWrap: "wrap" }}>
          <Button variant="contained" size="large" startIcon={<Sparkles size={18} />} disabled={!canFinance || Boolean(busy)} onClick={onInitialize} sx={{ bgcolor: "#e23b3b", "&:hover": { bgcolor: "#cc2b2b" }, fontWeight: 800, px: 3, borderRadius: 2 }}>
            {busy === "create" ? "Initializing…" : `Initialize ${formattedMonth}`}
          </Button>
          <Button variant="outlined" size="large" startIcon={<FilePlus2 size={18} />} onClick={onSingleInvoice} sx={{ fontWeight: 700, borderRadius: 2 }}>Single Invoice</Button>
        </Stack>
      </Paper>
    );
  }

  if (isReview) {
    return (
      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, background: "linear-gradient(135deg, rgba(234,179,8,0.06) 0%, rgba(245,158,11,0.06) 100%)", border: "1.5px solid rgba(234,179,8,0.2)", display: "flex", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#854d0e" }}>Ready: {ready} · Exceptions: {issues}</Typography>
          <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.25 }}>Review candidates below. Resolve issues or approve to proceed.</Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1, flexShrink: 0, flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<RotateCcw size={16} />} disabled={Boolean(busy)} onClick={onRecheck}>{busy === "prepare" ? "Checking…" : "Re-check"}</Button>
          {canApprove && <Button variant="contained" color="warning" disabled={blockingOpen || Boolean(busy)} onClick={onApprove} sx={{ fontWeight: 800 }}>Approve Run</Button>}
        </Stack>
      </Paper>
    );
  }

  if (isApproved) {
    return (
      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, background: "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(16,185,129,0.06) 100%)", border: "1.5px solid rgba(34,197,94,0.2)", display: "flex", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#15803d" }}>Approved — {selectedCount} invoice(s) selected</Typography>
          <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.25 }}>Select candidates below and generate. Invoices are sent to tenant portals automatically.</Typography>
        </Box>
        <Button variant="contained" color="success" size="large" startIcon={<Send size={18} />} disabled={!canFinance || selectedCount === 0 || Boolean(busy)} onClick={onGenerate} sx={{ fontWeight: 800, px: 3, borderRadius: 2, flexShrink: 0 }}>
          {busy === "generate" ? "Generating…" : `Generate ${selectedCount} Invoices`}
        </Button>
      </Paper>
    );
  }

  return null;
}
