"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Chip, IconButton, Menu, MenuItem, Paper, Step, StepLabel, Stepper, Tooltip, Typography } from "@mui/material";
import { BookOpen, ExternalLink, FilePlus2, Gauge, HandCoins, HelpCircle, MoreHorizontal, RotateCcw, Send, Settings2, ShieldAlert, Sliders, Zap } from "lucide-react";
import { CHARGE_TYPE_LABEL, InvoiceChargeType } from "./types";
import { BillingGuidelinesModal } from "./BillingGuidelinesModal";

export function BillingActionBanner({
  hasRun, isPreparing, isReview, formattedMonth, ready, selectedCount,
  chargeTypeFilter = "all", billingTarget = "tenant", blockingOpen, busy,
  pendingWaterCount = 0, pendingUtilityCount = 0, onLogMeters, onBatchReadings,
  canFinance, onInitialize, onRecheck, onGenerate, onSingleInvoice, onLettingFeeInvoice,
  requireUtilityReadings = true, onOpenPolicyModal, propertyName,
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
  requireUtilityReadings?: boolean;
  onOpenPolicyModal?: () => void;
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
            mt: 2,
            p: { xs: 2.2, sm: 2.8 },
            borderRadius: "14px",
            background: requireUtilityReadings
              ? "linear-gradient(135deg, rgba(254, 243, 199, 0.45) 0%, rgba(255, 251, 235, 0.95) 50%, rgba(254, 249, 195, 0.35) 100%)"
              : "linear-gradient(135deg, rgba(236, 253, 245, 0.7) 0%, rgba(240, 253, 250, 0.95) 50%, rgba(240, 249, 255, 0.6) 100%)",
            border: requireUtilityReadings ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(16, 185, 129, 0.35)",
            borderLeft: requireUtilityReadings ? "6px solid #d97706" : "6px solid #059669",
            boxShadow: requireUtilityReadings
              ? "0 4px 16px -2px rgba(217, 119, 6, 0.08)"
              : "0 4px 16px -2px rgba(5, 150, 105, 0.08)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2.5 }}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flex: 1, minWidth: 320 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  bgcolor: requireUtilityReadings ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                  border: requireUtilityReadings ? "1.5px solid rgba(245, 158, 11, 0.4)" : "1.5px solid rgba(16, 185, 129, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: requireUtilityReadings ? "#d97706" : "#059669",
                  flexShrink: 0,
                  boxShadow: requireUtilityReadings ? "0 2px 6px rgba(217,119,6,0.15)" : "0 2px 6px rgba(5,150,105,0.15)",
                }}
              >
                <Zap size={24} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap", mb: 0.8 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 800,
                      color: requireUtilityReadings ? "#92400e" : "#065f46",
                      fontSize: 15,
                      lineHeight: 1.3,
                    }}
                  >
                    {requireUtilityReadings
                      ? `Consolidated Billing Hold: Electricity Readings Required (${totalHoldCount} Units)`
                      : `Independent Rent Invoicing Active: Meter Gate is OFF (${totalHoldCount} Units Pending Readings)`}
                  </Typography>
                  <Chip
                    label="Tariff: Ksh 35.00/kWh"
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      fontWeight: 700,
                      bgcolor: requireUtilityReadings ? "rgba(245, 158, 11, 0.22)" : "rgba(16, 185, 129, 0.15)",
                      color: requireUtilityReadings ? "#92400e" : "#065f46",
                      border: requireUtilityReadings ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                  />
                  <Chip
                    label="Water Covered in Service Charge"
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      fontWeight: 700,
                      bgcolor: "rgba(37, 99, 235, 0.1)",
                      color: "#1d4ed8",
                      border: "1px solid rgba(37, 99, 235, 0.2)",
                    }}
                  />
                  <Chip
                    label={requireUtilityReadings ? "Consolidated Invoicing Policy" : "Independent Invoicing Policy"}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      fontWeight: 700,
                      bgcolor: requireUtilityReadings ? "rgba(16, 185, 129, 0.1)" : "rgba(5, 150, 105, 0.2)",
                      color: "#047857",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                    }}
                  />
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: 13,
                    color: requireUtilityReadings ? "#78350f" : "#064e3b",
                    lineHeight: 1.6,
                    maxWidth: 880,
                  }}
                >
                  {requireUtilityReadings
                    ? "Under commercial property regulations, monthly rent, fixed service charge, and variable electricity consumption are consolidated on a single invoice. Invoices are held on checkpoint until current meter readings are entered to prevent dual billing."
                    : "For this property, rent and service charge invoices can be generated immediately without waiting for electricity readings. Meters can be entered and billed at your convenience without blocking rent collection."}
                </Typography>
              </Box>
            </Box>

            {/* Action Buttons in a clean flex group */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.2,
                flexWrap: "wrap",
                alignSelf: { xs: "stretch", md: "center" },
                justifyContent: { xs: "flex-start", sm: "flex-end" },
              }}
            >
              {onBatchReadings && (
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={<Zap size={16} />}
                  onClick={onBatchReadings}
                  sx={{
                    background: requireUtilityReadings
                      ? "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
                      : "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12.5,
                    px: 2.2,
                    py: 0.8,
                    borderRadius: "8px",
                    textTransform: "none",
                    boxShadow: requireUtilityReadings
                      ? "0 3px 8px rgba(245,158,11,0.3)"
                      : "0 3px 8px rgba(16,185,129,0.3)",
                    "&:hover": {
                      background: requireUtilityReadings ? "#d97706" : "#047857",
                      boxShadow: requireUtilityReadings
                        ? "0 4px 12px rgba(245,158,11,0.4)"
                        : "0 4px 12px rgba(16,185,129,0.4)",
                    },
                  }}
                >
                  Record Electricity Readings
                </Button>
              )}

              <Button
                variant="outlined"
                size="medium"
                startIcon={<ExternalLink size={15} />}
                onClick={handleOpenFacilityMeters}
                sx={{
                  color: requireUtilityReadings ? "#92400e" : "#065f46",
                  borderColor: requireUtilityReadings ? "rgba(245, 158, 11, 0.5)" : "rgba(16, 185, 129, 0.5)",
                  fontWeight: 700,
                  fontSize: 12.5,
                  px: 2,
                  py: 0.75,
                  borderRadius: "8px",
                  textTransform: "none",
                  bgcolor: "rgba(255, 255, 255, 0.9)",
                  "&:hover": {
                    bgcolor: "#fff",
                    borderColor: requireUtilityReadings ? "#d97706" : "#059669",
                  },
                }}
              >
                Facility Management: Meters →
              </Button>

              {onOpenPolicyModal && (
                <Button
                  variant="outlined"
                  size="medium"
                  startIcon={<Settings2 size={15} />}
                  onClick={onOpenPolicyModal}
                  sx={{
                    color: requireUtilityReadings ? "#b45309" : "#047857",
                    borderColor: requireUtilityReadings ? "rgba(245, 158, 11, 0.4)" : "rgba(16, 185, 129, 0.4)",
                    fontWeight: 700,
                    fontSize: 12.5,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: "8px",
                    textTransform: "none",
                    bgcolor: "rgba(255, 255, 255, 0.8)",
                    "&:hover": { bgcolor: "#fff" },
                  }}
                >
                  Invoicing Policy
                </Button>
              )}

              <Button
                variant="text"
                size="medium"
                startIcon={<HelpCircle size={15} />}
                onClick={() => setGuidelinesOpen(true)}
                sx={{
                  color: requireUtilityReadings ? "#b45309" : "#065f46",
                  fontWeight: 700,
                  fontSize: 12.5,
                  px: 1.5,
                  py: 0.75,
                  textTransform: "none",
                  "&:hover": {
                    bgcolor: requireUtilityReadings ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                  },
                }}
              >
                Policy Guidelines
              </Button>
            </Box>
          </Box>

          {/* Quick Resolution Workflow Strip */}
          <Box
            sx={{
              mt: 2,
              pt: 1.8,
              borderTop: "1px dashed rgba(245, 158, 11, 0.35)",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
              gap: 1.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "rgba(245,158,11,0.25)", color: "#92400e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>1</Box>
              <Typography variant="caption" sx={{ color: "#78350f", fontSize: 12 }}>
                <strong>Step 1:</strong> Record kWh readings via Wizard or Facility CSV.
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "rgba(245,158,11,0.25)", color: "#92400e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>2</Box>
              <Typography variant="caption" sx={{ color: "#78350f", fontSize: 12 }}>
                <strong>Step 2:</strong> System calculates <code>(Current - Previous) × Ksh 35</code>.
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "rgba(245,158,11,0.25)", color: "#92400e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>3</Box>
              <Typography variant="caption" sx={{ color: "#78350f", fontSize: 12 }}>
                <strong>Step 3:</strong> Click <strong>Refresh readiness</strong> & dispatch bills.
              </Typography>
            </Box>
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
