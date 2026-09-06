"use client";

import { useState } from "react";
import { Box, Button, IconButton, Menu, MenuItem, Paper, Step, StepLabel, Stepper, Tooltip, Typography } from "@mui/material";
import { FilePlus2, MoreHorizontal, RotateCcw, Send } from "lucide-react";
import { CHARGE_TYPE_LABEL, InvoiceChargeType } from "./types";

export function BillingActionBanner({
  hasRun, isPreparing, isReview, formattedMonth, ready, selectedCount,
  chargeTypeFilter = "all", billingTarget = "tenant", blockingOpen, busy,
  canFinance, onInitialize, onRecheck, onGenerate, onSingleInvoice,
}: {
  hasRun: boolean; isPreparing: boolean; isReview: boolean; isApproved: boolean;
  formattedMonth: string; ready: number; issues: number; selectedCount: number;
  chargeTypeFilter?: InvoiceChargeType | "all"; billingTarget?: "tenant" | "landlord";
  typeCounts?: Record<string, number>; onChargeTypeFilter?: (t: InvoiceChargeType | "all") => void;
  blockingOpen: boolean; busy: string; canFinance: boolean; canApprove: boolean;
  onInitialize: () => void; onRecheck: () => void; onApprove: () => void;
  onGenerate: () => void; onSingleInvoice: () => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const typeLabel = chargeTypeFilter === "all" ? "" : CHARGE_TYPE_LABEL[chargeTypeFilter];
  const activeStep = !hasRun || isPreparing ? 0 : isReview ? 1 : 2;
  const generateLabel = busy === "generate"
    ? "Generating…"
    : selectedCount > 0
      ? `Generate ${selectedCount} ${billingTarget === "landlord" ? "landlord " : ""}${typeLabel ? `${typeLabel.toLowerCase()} ` : ""}invoice${selectedCount === 1 ? "" : "s"}`
      : "Select ready invoices";

  return (
    <Paper className="billing-workflow" elevation={0}>
      <Box className="billing-workflow-heading">
        <div>
          <Typography component="h3" variant="subtitle2">Billing workflow</Typography>
          <Typography variant="caption">Complete each checkpoint before invoices are dispatched.</Typography>
        </div>
        <Typography className="billing-period-caption" variant="caption">{formattedMonth}</Typography>
      </Box>

      <Stepper className="billing-stepper" activeStep={activeStep} alternativeLabel={false}>
        <Step completed={hasRun && !isPreparing}><StepLabel>Prepare</StepLabel></Step>
        <Step completed={activeStep > 1}><StepLabel>Review {ready > 0 ? `(${ready} ready)` : ""}</StepLabel></Step>
        <Step><StepLabel>Generate</StepLabel></Step>
      </Stepper>

      <Box className="billing-workflow-actions">
        {!hasRun ? (
          <Button variant="contained" onClick={onInitialize} disabled={Boolean(busy) || !canFinance}>Scan billing schedule</Button>
        ) : (
          <Button variant="outlined" startIcon={<RotateCcw size={16} />} onClick={onRecheck} disabled={Boolean(busy)}>
            {busy === "prepare" ? "Checking…" : "Refresh readiness"}
          </Button>
        )}
        <Button
          variant="contained"
          color="success"
          startIcon={<Send size={16} />}
          disabled={!canFinance || selectedCount === 0 || Boolean(busy) || blockingOpen}
          onClick={onGenerate}
        >{generateLabel}</Button>
        <Tooltip title="More billing actions">
          <IconButton aria-label="More billing actions" onClick={(event) => setMenuAnchor(event.currentTarget)}><MoreHorizontal size={20} /></IconButton>
        </Tooltip>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={() => { setMenuAnchor(null); onSingleInvoice(); }}><FilePlus2 size={16} /> Create one-off invoice</MenuItem>
        </Menu>
      </Box>
    </Paper>
  );
}
