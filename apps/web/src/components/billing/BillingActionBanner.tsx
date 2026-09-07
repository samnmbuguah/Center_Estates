"use client";

import { useState } from "react";
import { Box, Button, IconButton, Menu, MenuItem, Paper, Step, StepLabel, Stepper, Tooltip, Typography } from "@mui/material";
import { Droplets, FilePlus2, HandCoins, MoreHorizontal, RotateCcw, Send } from "lucide-react";
import { CHARGE_TYPE_LABEL, InvoiceChargeType } from "./types";

export function BillingActionBanner({
  hasRun, isPreparing, isReview, formattedMonth, ready, selectedCount,
  chargeTypeFilter = "all", billingTarget = "tenant", blockingOpen, busy,
  pendingWaterCount = 0, onLogMeters,
  canFinance, onInitialize, onRecheck, onGenerate, onSingleInvoice, onLettingFeeInvoice,
}: {
  hasRun: boolean; isPreparing: boolean; isReview: boolean; isApproved: boolean;
  formattedMonth: string; ready: number; issues: number; selectedCount: number;
  chargeTypeFilter?: InvoiceChargeType | "all"; billingTarget?: "tenant" | "landlord";
  typeCounts?: Record<string, number>; onChargeTypeFilter?: (t: InvoiceChargeType | "all") => void;
  blockingOpen: boolean; busy: string; canFinance: boolean; canApprove: boolean;
  pendingWaterCount?: number; onLogMeters?: () => void;
  onInitialize: () => void; onRecheck: () => void; onApprove: () => void;
  onGenerate: () => void; onSingleInvoice: () => void;
  onLettingFeeInvoice?: () => void;
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
        {onLettingFeeInvoice && canFinance && (
          <Button variant="outlined" startIcon={<HandCoins size={17} />} onClick={onLettingFeeInvoice}>
            Letting fee
          </Button>
        )}
        <Tooltip title="More billing actions">
          <IconButton aria-label="More billing actions" onClick={(event) => setMenuAnchor(event.currentTarget)}><MoreHorizontal size={20} /></IconButton>
        </Tooltip>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={() => { setMenuAnchor(null); onSingleInvoice(); }}><FilePlus2 size={16} /> Create one-off invoice</MenuItem>
        </Menu>
      </Box>

      {pendingWaterCount > 0 && (
        <Box
          sx={{
            mt: 1.5,
            p: "8px 14px",
            borderRadius: 1.5,
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
            fontSize: 12,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#b45309" }}>
            <Droplets size={15} color="#d97706" />
            <span>
              <strong>{pendingWaterCount} candidate{pendingWaterCount === 1 ? "" : "s"} on hold:</strong> Water meter readings must be recorded before rent or utilities can be billed (Consolidated Invoicing Policy).
            </span>
          </Box>
          {onLogMeters && (
            <Button size="small" onClick={onLogMeters} sx={{ fontSize: 11, py: 0.2, fontWeight: 700, color: "#b45309", textTransform: "none" }}>
              Log in Facility →
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
}
