"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Chip, IconButton, Menu, MenuItem, Paper, Step, StepLabel, Stepper, Tooltip, Typography } from "@mui/material";
import { BookOpen, ExternalLink, FilePlus2, Gauge, HandCoins, HelpCircle, MoreHorizontal, RotateCcw, Send, ShieldAlert, Zap } from "lucide-react";
import { CHARGE_TYPE_LABEL, InvoiceChargeType } from "./types";
import { BillingGuidelinesModal } from "./BillingGuidelinesModal";

export function BillingActionBanner({
  hasRun, isPreparing, isReview, formattedMonth, ready, selectedCount,
  chargeTypeFilter = "all", billingTarget = "tenant", blockingOpen, busy,
  pendingWaterCount = 0, pendingUtilityCount = 0, onLogMeters, onBatchReadings,
  canFinance, onInitialize, onRecheck, onGenerate, onSingleInvoice, onLettingFeeInvoice,
}: {
  hasRun: boolean; isPreparing: boolean; isReview: boolean; isApproved: boolean;
  formattedMonth: string; ready: number; issues: number; selectedCount: number;
  chargeTypeFilter?: InvoiceChargeType | "all"; billingTarget?: "tenant" | "landlord";
  typeCounts?: Record<string, number>; onChargeTypeFilter?: (t: InvoiceChargeType | "all") => void;
  blockingOpen: boolean; busy: string; canFinance: boolean; canApprove: boolean;
  pendingWaterCount?: number; pendingUtilityCount?: number; onLogMeters?: () => void; onBatchReadings?: () => void;
  onInitialize: () => void; onRecheck: () => void; onApprove: () => void;
  onGenerate: () => void; onSingleInvoice: () => void;
  onLettingFeeInvoice?: () => void;
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

  const handleOpenFacilityMeters = () => {
    if (onLogMeters) {
      try {
        onLogMeters();
      } catch {
        router.push("/facility?tab=meters");
      }
    } else {
      router.push("/facility?tab=meters");
    }
  };

  return (
    <>
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
          </Menu>
        </Box>

        {totalHoldCount > 0 && (
          <Box
            sx={{
              mt: 2,
              p: { xs: 1.8, sm: 2.2 },
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(254, 243, 199, 0.45) 0%, rgba(254, 249, 195, 0.25) 100%)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.08)",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", maxWidth: 780 }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: "10px",
                    bgcolor: "rgba(245, 158, 11, 0.18)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#d97706",
                    flexShrink: 0,
                    mt: 0.2,
                  }}
                >
                  <Zap size={20} />
                </Box>
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.6 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#92400e", fontSize: 13.5 }}>
                      Consolidated Billing Hold: Electricity Readings Required ({totalHoldCount} Units)
                    </Typography>
                    <Chip label="Tariff: Ksh 35.00/kWh" size="small" sx={{ height: 21, fontSize: 10.5, fontWeight: 700, bgcolor: "rgba(245,158,11,0.22)", color: "#92400e", border: "1px solid rgba(245,158,11,0.3)" }} />
                    <Chip label="Water Covered in Service Charge" size="small" sx={{ height: 21, fontSize: 10.5, fontWeight: 700, bgcolor: "rgba(37,99,235,0.1)", color: "#1d4ed8", border: "1px solid rgba(37,99,235,0.2)" }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontSize: 12.5, color: "#78350f", lineHeight: 1.5 }}>
                    Under the <strong>Consolidated Invoicing Policy</strong>, monthly rent and electricity consumption must be dispatched together on a single invoice. Invoices are currently held until {formattedMonth} meter readings are recorded.
                  </Typography>
                </Box>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", alignSelf: { xs: "stretch", sm: "center" } }}>
                {onBatchReadings && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Zap size={14} />}
                    onClick={onBatchReadings}
                    sx={{
                      background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 11.5,
                      px: 2,
                      py: 0.6,
                      textTransform: "none",
                      boxShadow: "0 2px 4px rgba(245,158,11,0.25)",
                      "&:hover": { background: "#d97706" },
                    }}
                  >
                    Record Electricity Readings
                  </Button>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ExternalLink size={14} />}
                  onClick={handleOpenFacilityMeters}
                  sx={{
                    color: "#92400e",
                    borderColor: "rgba(245,158,11,0.45)",
                    fontWeight: 700,
                    fontSize: 11.5,
                    px: 1.8,
                    py: 0.55,
                    textTransform: "none",
                    bgcolor: "rgba(255,255,255,0.85)",
                    "&:hover": { bgcolor: "#fff", borderColor: "#d97706" },
                  }}
                >
                  Facility Management: Meters →
                </Button>

                <Button
                  variant="text"
                  size="small"
                  startIcon={<HelpCircle size={14} />}
                  onClick={() => setGuidelinesOpen(true)}
                  sx={{
                    color: "#b45309",
                    fontWeight: 700,
                    fontSize: 11.5,
                    textTransform: "none",
                    "&:hover": { bgcolor: "rgba(245,158,11,0.12)" },
                  }}
                >
                  Policy Guidelines
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

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
