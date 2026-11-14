"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, CircularProgress, IconButton, Menu, MenuItem, Paper, Step, StepLabel, Stepper, Tooltip, Typography } from "@mui/material";
import { Car, FilePlus2, HandCoins, MoreHorizontal, RotateCcw, Send, Settings2, Zap } from "lucide-react";
import { CHARGE_TYPE_LABEL, InvoiceChargeType } from "./types";
import { BillingGuidelinesModal } from "./BillingGuidelinesModal";

export function BillingActionBanner({
  hasRun, isPreparing, isReview, formattedMonth, ready, selectedCount,
  chargeTypeFilter = "all", billingTarget = "tenant", blockingOpen, busy,
  pendingWaterCount = 0, pendingUtilityCount = 0, onLogMeters, onBatchReadings, onConfigureParking,
  canFinance, onInitialize, onRecheck, onGenerate, onSingleInvoice, onLettingFeeInvoice,
  requireUtilityReadings = true, onOpenPolicyModal, onTogglePolicy, policyToggling = false, propertyName,
}: {
  hasRun: boolean; isPreparing: boolean; isReview: boolean; isApproved: boolean;
  formattedMonth: string; ready: number; issues: number; selectedCount: number;
  chargeTypeFilter?: InvoiceChargeType | "all"; billingTarget?: "tenant" | "landlord";
  typeCounts?: Record<string, number>; onChargeTypeFilter?: (t: InvoiceChargeType | "all") => void;
  blockingOpen: boolean; busy: string; canFinance: boolean; canApprove: boolean;
  pendingWaterCount?: number; pendingUtilityCount?: number; onLogMeters?: () => void; onBatchReadings?: () => void; onConfigureParking?: () => void;
  onInitialize: () => void; onRecheck: () => void; onApprove: () => void;
  onGenerate: () => void; onSingleInvoice: () => void;
  onLettingFeeInvoice?: () => void;
  requireUtilityReadings?: boolean;
  onOpenPolicyModal?: () => void;
  onTogglePolicy?: () => void;
  policyToggling?: boolean;
  propertyName?: string;
}) {
  const router = useRouter();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);

  const typeLabel = chargeTypeFilter === "all" ? "" : CHARGE_TYPE_LABEL[chargeTypeFilter];
  const activeStep = !hasRun || isPreparing ? 0 : isReview ? 1 : 2;
  const generateLabel = busy === "generate"
    ? "Generating…"
    : selectedCount > 0
      ? `Generate ${selectedCount} ${billingTarget === "landlord" ? "landlord " : ""}${typeLabel ? `${typeLabel.toLowerCase()} ` : ""}invoice${selectedCount === 1 ? "" : "s"}`
      : "Select ready invoices";

  const totalHoldCount = Math.max(pendingWaterCount, pendingUtilityCount);

  return (
    <>
      <Paper className="billing-workflow" elevation={0}>
        <Box className="billing-workflow-heading">
          <div>
            <Typography component="h3" variant="subtitle2">Billing workflow</Typography>
            <Typography variant="caption">Review candidates and issue invoices.</Typography>
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
          {onConfigureParking && canFinance && billingTarget === "tenant" && hasRun && (
            <Button
              variant="outlined"
              startIcon={<Car size={16} />}
              onClick={onConfigureParking}
              sx={{
                borderColor: "rgba(124, 58, 237, 0.45)",
                color: "#6d28d9",
                fontWeight: 700,
                "&:hover": { borderColor: "#6d28d9", bgcolor: "rgba(124, 58, 237, 0.06)" },
              }}
            >
              Configure Parking
            </Button>
          )}
          {onLettingFeeInvoice && canFinance && billingTarget === "landlord" && (
            <Button variant="outlined" startIcon={<HandCoins size={17} />} onClick={onLettingFeeInvoice}>
              Issue letting-fee invoice
            </Button>
          )}
          <Tooltip title="More billing actions">
            <IconButton aria-label="More billing actions" onClick={(event) => setMenuAnchor(event.currentTarget)}><MoreHorizontal size={20} /></IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <MenuItem onClick={() => { setMenuAnchor(null); onSingleInvoice(); }}><FilePlus2 size={16} /> Create one-off invoice</MenuItem>
            {onConfigureParking && billingTarget === "tenant" && (
              <MenuItem onClick={() => { setMenuAnchor(null); onConfigureParking(); }}>
                <Car size={16} /> Configure Parking Schedule
              </MenuItem>
            )}
            {onOpenPolicyModal && (
              <MenuItem onClick={() => { setMenuAnchor(null); onOpenPolicyModal(); }}>
                <Settings2 size={16} /> Invoicing Policy ({requireUtilityReadings ? "Gate ON" : "Gate OFF"})
              </MenuItem>
            )}
          </Menu>
        </Box>
      </Paper>

      {totalHoldCount > 0 && (
        <Paper
          elevation={0}
          sx={{
            mt: 1.5,
            p: 1.5,
            px: 2,
            borderRadius: "10px",
            background: requireUtilityReadings
              ? "rgba(254, 243, 199, 0.5)"
              : "rgba(236, 253, 245, 0.65)",
            border: requireUtilityReadings ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(16, 185, 129, 0.35)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "6px",
                bgcolor: requireUtilityReadings ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: requireUtilityReadings ? "#d97706" : "#059669",
                flexShrink: 0,
              }}
            >
              <Zap size={16} />
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 800,
                  color: requireUtilityReadings ? "#92400e" : "#065f46",
                  fontSize: 13.5,
                  lineHeight: 1.2,
                }}
              >
                {requireUtilityReadings
                  ? `Electricity readings pending (${totalHoldCount} units)`
                  : `Meter readings pending (${totalHoldCount} units)`}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: requireUtilityReadings ? "#78350f" : "#064e3b",
                  fontSize: 12,
                }}
              >
                {requireUtilityReadings
                  ? "Rent invoicing is held until meter readings are entered."
                  : "Rent and service charge are ready to invoice. Utilities are billed separately."}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {onBatchReadings && (
              <Button
                variant="contained"
                size="small"
                startIcon={<Zap size={14} />}
                onClick={onBatchReadings}
                sx={{
                  background: requireUtilityReadings ? "#d97706" : "#059669",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: "6px",
                  textTransform: "none",
                  boxShadow: "none",
                  "&:hover": { background: requireUtilityReadings ? "#b45309" : "#047857" },
                }}
              >
                Record Readings
              </Button>
            )}

            {onTogglePolicy && (
              <Button
                variant="outlined"
                size="small"
                disabled={policyToggling}
                startIcon={policyToggling ? <CircularProgress size={12} color="inherit" /> : undefined}
                onClick={onTogglePolicy}
                sx={{
                  color: requireUtilityReadings ? "#b45309" : "#047857",
                  borderColor: requireUtilityReadings ? "rgba(245, 158, 11, 0.4)" : "rgba(16, 185, 129, 0.4)",
                  fontWeight: 700,
                  fontSize: 12,
                  px: 1.2,
                  py: 0.5,
                  borderRadius: "6px",
                  textTransform: "none",
                  bgcolor: "rgba(255, 255, 255, 0.8)",
                  "&:hover": { bgcolor: "#fff" },
                }}
              >
                {policyToggling
                  ? "Saving…"
                  : requireUtilityReadings
                    ? "Meter Gate: ON"
                    : "Meter Gate: OFF"}
              </Button>
            )}

            {onOpenPolicyModal && (
              <Button
                variant="text"
                size="small"
                startIcon={<Settings2 size={13} />}
                onClick={onOpenPolicyModal}
                sx={{
                  color: "var(--text-secondary)",
                  fontWeight: 700,
                  fontSize: 12,
                  px: 1,
                  py: 0.5,
                  textTransform: "none",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
                }}
              >
                Policy
              </Button>
            )}
          </Box>
        </Paper>
      )}

      <BillingGuidelinesModal
        open={guidelinesOpen}
        onClose={() => setGuidelinesOpen(false)}
        onOpenBatchWizard={onBatchReadings}
        propertyTitle="KASNEB Towers"
        tariffRate={35}
      />
    </>
  );
}
