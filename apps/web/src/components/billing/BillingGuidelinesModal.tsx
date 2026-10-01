"use client";

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  Droplets,
  ExternalLink,
  FileText,
  Gauge,
  HelpCircle,
  Info,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function BillingGuidelinesModal({
  open,
  onClose,
  onOpenBatchWizard,
  propertyTitle = "KASNEB Towers",
  tariffRate = 35,
}: {
  open: boolean;
  onClose: () => void;
  onOpenBatchWizard?: () => void;
  propertyTitle?: string;
  tariffRate?: number;
}) {
  const router = useRouter();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          },
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          p: "20px 24px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#fff",
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
              background: "rgba(245, 158, 11, 0.2)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f59e0b",
            }}
          >
            <BookOpen size={20} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
              Consolidated Invoicing & Utility Guidelines
            </Typography>
            <Typography variant="caption" sx={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: 1 }}>
              <span>Commercial Scheme Operations</span>
              <span>•</span>
              <span>{propertyTitle}</span>
            </Typography>
          </Box>
        </Box>
        <Button
          onClick={onClose}
          size="small"
          sx={{ minWidth: 32, width: 32, height: 32, p: 0, borderRadius: "50%", color: "#94a3b8", "&:hover": { color: "#fff", background: "rgba(255,255,255,0.1)" } }}
        >
          <X size={18} />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ p: 3, background: "#f8fafc" }}>
        <Stack spacing={2.5}>
          {/* Top highlight banner */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(217,119,6,0.04) 100%)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
            }}
          >
            <ShieldCheck size={22} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#92400e", mb: 0.5 }}>
                Consolidated Invoicing Policy in Effect
              </Typography>
              <Typography variant="body2" sx={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>
                To avoid tenant payment confusion and duplicate bank/MPESA references, monthly rent, fixed service charge, and variable electricity consumption are strictly consolidated into a single monthly invoice. Candidate invoices are held on checkpoint until meter readings are recorded.
              </Typography>
            </Box>
          </Paper>

          {/* Grid of Key Policies */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            {/* Card 1: Electricity Tariff & Calculation */}
            <Paper elevation={0} sx={{ p: 2.2, borderRadius: "12px", border: "1px solid var(--border)", background: "#fff" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Box sx={{ p: 0.8, borderRadius: "8px", background: "rgba(245, 158, 11, 0.12)", color: "#d97706" }}>
                  <Zap size={18} />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Electricity Sub-metering</Typography>
                <Chip label={`Ksh ${tariffRate}.00 / kWh`} size="small" sx={{ ml: "auto", fontWeight: 700, bgcolor: "rgba(245,158,11,0.15)", color: "#b45309", height: 22 }} />
              </Box>
              <Typography variant="body2" sx={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, mb: 1.5 }}>
                Commercial tenants are metered individually per unit. Monthly charges are computed directly from physical or digital check meters:
              </Typography>
              <Box sx={{ p: 1.5, borderRadius: "8px", bgcolor: "#f1f5f9", border: "1px dashed #cbd5e1", fontSize: 12, fontFamily: "monospace", color: "#334155" }}>
                <strong>Billable Due</strong> = (Current Reading - Previous Reading) × Ksh {tariffRate}.00
              </Box>
              <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#64748b" }}>
                * Unread meters evaluate to Ksh 0 consumption, preventing dispatch until actual readings are logged.
              </Typography>
            </Paper>

            {/* Card 2: Water Policy */}
            <Paper elevation={0} sx={{ p: 2.2, borderRadius: "12px", border: "1px solid var(--border)", background: "#fff" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Box sx={{ p: 0.8, borderRadius: "8px", background: "rgba(37, 99, 235, 0.12)", color: "#2563eb" }}>
                  <Droplets size={18} />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Water Service Policy</Typography>
                <Chip label="Service Charge Covered" size="small" sx={{ ml: "auto", fontWeight: 700, bgcolor: "rgba(37,99,235,0.12)", color: "#1d4ed8", height: 22 }} />
              </Box>
              <Typography variant="body2" sx={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, mb: 1.5 }}>
                For {propertyTitle}, water supply is maintained centrally by the property management.
              </Typography>
              <Box sx={{ p: 1.5, borderRadius: "8px", bgcolor: "#eff6ff", border: "1px dashed #bfdbfe", fontSize: 12, color: "#1e40af" }}>
                ✓ Water costs are included in the <strong>Service Charge</strong> (paid by owner/landlord).
                <br />
                ✓ No water meter readings are required for tenants.
              </Box>
              <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#64748b" }}>
                * No individual water sub-meter invoices are generated for KASNEB units.
              </Typography>
            </Paper>
          </Box>

          {/* Resolution Pathways */}
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: "12px", border: "1px solid var(--border)", background: "#fff" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircle2 size={18} color="#16a34a" />
              How to Resolve Pending Utility Meter Readings
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              {/* Option A: Quick Wizard */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: "10px",
                  bgcolor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, bgcolor: "#dbeafe", color: "#1e40af", px: 1, py: 0.2, borderRadius: "4px" }}>
                      METHOD 1 (FASTEST)
                    </Typography>
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    In-Dashboard Batch Wizard
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: 12, color: "var(--text-secondary)", mb: 2 }}>
                    Enter current kWh readings for all units directly on this screen. Previous readings and units consumed calculate automatically.
                  </Typography>
                </Box>
                {onOpenBatchWizard && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Zap size={14} />}
                    onClick={() => {
                      onClose();
                      onOpenBatchWizard();
                    }}
                    sx={{
                      background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
                      fontWeight: 700,
                      textTransform: "none",
                    }}
                  >
                    Open Batch Wizard
                  </Button>
                )}
              </Box>

              {/* Option B: Facility Management Module */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: "10px",
                  bgcolor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, bgcolor: "#f3e8ff", color: "#6b21a8", px: 1, py: 0.2, borderRadius: "4px" }}>
                      METHOD 2 (OPERATIONS)
                    </Typography>
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Facility Management: Meters
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: 12, color: "var(--text-secondary)", mb: 2 }}>
                    Open the Energy & Utilities module to upload monthly meter readings via CSV spreadsheet, manage meter serial numbers, or view historical logs.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ExternalLink size={14} />}
                  onClick={() => {
                    onClose();
                    router.push("/facility?tab=meters");
                  }}
                  sx={{
                    fontWeight: 700,
                    textTransform: "none",
                    borderColor: "#64748b",
                    color: "#334155",
                  }}
                >
                  Go to Facility Meters
                </Button>
              </Box>
            </Box>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: "16px 24px", background: "#fff", borderTop: "1px solid var(--border)", justifyContent: "space-between" }}>
        <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
          Need assistance? Check with the property operations engineer or estate manager.
        </Typography>
        <Button variant="outlined" onClick={onClose} sx={{ textTransform: "none", fontWeight: 600 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
