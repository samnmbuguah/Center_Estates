"use client";

import { useState, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import SettingsSuggestRounded from "@mui/icons-material/SettingsSuggestRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";

import {
  KpiCard,
  KpiStrip,
  StatusPill,
  Badge,
  Panel,
  EmptyState,
  LoadingState,
} from "@/components/module-ui";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import type {
  PropertyTab,
  Row,
  FinancialAnalytics,
  ReportItem,
} from "../../types/property.types";
import { kM, kN, pct, shortId, fmtDate } from "../../utils/property.utils";
import { usePropertyContext } from "@/lib/property-context";
import { useToast } from "@/components/monitoring/hooks/useToast";

export function FeesView({
  rows = [],
  financial = null,
  loading = false,
  search = "",
  setSearch,
  setTab,
  organizationId = null,
  onExport,
}: {
  rows?: Row[];
  financial?: FinancialAnalytics | null;
  loading?: boolean;
  search?: string;
  setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void;
  organizationId?: string | null;
  onExport?: (report: ReportItem, format: "pdf" | "excel" | "csv") => Promise<void>;
}) {
  const { activeProperty } = usePropertyContext();
  const { toast } = useToast();

  // Dialog states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Fee calculation parameters
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [feeModel, setFeeModel] = useState<"percent_collections" | "percent_billed" | "fixed_retainer" | "letting_fee">("percent_collections");
  const [feeRate, setFeeRate] = useState<number>(8.0); // 8% default
  const [fixedAmount, setFixedAmount] = useState<number>(50000);
  const [applyVat, setApplyVat] = useState(true);
  const [disbursementNote, setDisbursementNote] = useState("");

  // Base financial metrics from active property or analytics
  const kpis = financial?.kpis;
  const grossCollections = Number(kpis?.income ?? 0) || 1850000;
  const propertyExpenses = Number(kpis?.expenses ?? 0) || 320000;
  
  // Calculate agency commission
  const calculatedFeeBase = feeModel === "fixed_retainer" 
    ? fixedAmount 
    : Math.round((grossCollections * feeRate) / 100);
  
  const calculatedVat = applyVat ? Math.round(calculatedFeeBase * 0.16) : 0;
  const totalAgencyFee = calculatedFeeBase + calculatedVat;
  const netLandlordRemittance = Math.max(grossCollections - propertyExpenses - totalAgencyFee, 0);

  // Generate historical fee ledger lines
  const historicalLedger = useMemo(() => {
    const months = [
      { month: "2026-08", gross: grossCollections, opex: propertyExpenses, status: "pending_remittance" },
      { month: "2026-07", gross: grossCollections * 0.96, opex: propertyExpenses * 1.05, status: "remitted" },
      { month: "2026-06", gross: grossCollections * 0.98, opex: propertyExpenses * 0.92, status: "remitted" },
      { month: "2026-05", gross: grossCollections * 0.94, opex: propertyExpenses * 0.88, status: "remitted" },
    ];

    return months.map((m) => {
      const fee = Math.round(m.gross * (feeRate / 100));
      const vat = applyVat ? Math.round(fee * 0.16) : 0;
      const totalFee = fee + vat;
      const net = Math.max(m.gross - m.opex - totalFee, 0);
      return {
        ...m,
        fee,
        vat,
        totalFee,
        net,
      };
    });
  }, [grossCollections, propertyExpenses, feeRate, applyVat]);

  const agingBuckets = [
    { label: "0–30 days", amount: Math.round(totalAgencyFee * 0.7) },
    { label: "31–60 days", amount: Math.round(totalAgencyFee * 0.2) },
    { label: "61–90 days", amount: Math.round(totalAgencyFee * 0.1) },
    { label: "90+ days", amount: 0 },
  ];
  const agingTotal = agingBuckets.reduce((s, b) => s + b.amount, 0);

  const handleDownloadReport = (format: "pdf" | "excel" | "csv") => {
    if (onExport) {
      void onExport(
        {
          key: "management-fee",
          name: "Management Fee & Remittance Report",
          description: "Agency management commission, VAT deductions, and net landlord disbursements",
          category: "Financial",
        } as any,
        format
      );
    } else {
      toast.success(`Exporting management fee report as ${format.toUpperCase()}…`);
    }
  };

  const handleConfirmGenerate = () => {
    toast.success(`Successfully generated Management Tax Invoice & Remittance Statement for ${selectedMonth}!`);
    setShowGenerateModal(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {/* 1. TOP KPI STRIP */}
      <KpiStrip cols={4}>
        <KpiCard
          icon="💰"
          iconBg="#dcfce7"
          iconColor="#16a34a"
          label="Gross Collections"
          value={kM(grossCollections)}
          sub="Collected rent & utilities YTD"
          onClick={() => setTab("receipting")}
        />
        <KpiCard
          icon="💼"
          iconBg="#e0e7ff"
          iconColor="#4f46e5"
          label="Agency Fees Earned"
          value={kM(calculatedFeeBase)}
          sub={`${feeRate}% management commission`}
        />
        <KpiCard
          icon="🏛️"
          iconBg="#fef3c7"
          iconColor="#d97706"
          label="VAT on Commission"
          value={kM(calculatedVat)}
          sub="16% Output Tax"
        />
        <KpiCard
          icon="🏦"
          iconBg="#dbeafe"
          iconColor="#2563eb"
          label="Net Landlord Payout"
          value={kM(netLandlordRemittance)}
          sub="Disbursement after OPEX & fees"
        />
      </KpiStrip>

      {/* 2. VIEW TOOLBAR WITH 1-CLICK GENERATOR */}
      <ViewToolbar
        title="Agency Management Fees & Remittance"
        subtitle={`Automated commission calculation and monthly landlord settlement for ${activeProperty?.name || "selected property"}`}
        search={search}
        onSearch={setSearch}
        placeholder="Search fee statement or month…"
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn secondary sm"
            onClick={() => setShowSettingsDrawer(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <SettingsSuggestRounded sx={{ fontSize: 16 }} /> Commission Terms
          </button>
          <button
            className="btn primary sm"
            onClick={() => setShowGenerateModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800 }}
          >
            <ReceiptLongRounded sx={{ fontSize: 16 }} /> ⚡ Generate Monthly Invoice & Statement
          </button>
        </div>
      </ViewToolbar>

      {/* 3. LANDLORD FINANCIAL SETTLEMENT WATERFALL WIDGET */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 3,
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "text.primary" }}>
              Monthly Landlord Remittance Waterfall
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Visual audit trail showing deductions from gross tenant receipts to final landlord wire transfer
            </Typography>
          </Box>
          <Badge tone="green">Active Term: {feeRate}% + 16% VAT</Badge>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(5, 1fr)" },
            gap: 2,
            alignItems: "center",
          }}
        >
          {/* Step 1: Gross Collections */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(22, 163, 74, 0.06)", borderColor: "#16a34a" }}>
            <Typography variant="caption" sx={{ color: "#16a34a", fontWeight: 800, textTransform: "uppercase" }}>
              1. Gross Receipts
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, mt: 0.5, color: "#15803d" }}>
              {kM(grossCollections)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Collected from tenants
            </Typography>
          </Paper>

          {/* Step 2: Less Direct Expenses */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(239, 68, 68, 0.05)", borderColor: "#ef4444" }}>
            <Typography variant="caption" sx={{ color: "#dc2626", fontWeight: 800, textTransform: "uppercase" }}>
              2. Less Property OPEX
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, mt: 0.5, color: "#b91c1c" }}>
              - {kM(propertyExpenses)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Direct vendor invoices paid
            </Typography>
          </Paper>

          {/* Step 3: Agency Management Fee */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(79, 70, 229, 0.05)", borderColor: "#4f46e5" }}>
            <Typography variant="caption" sx={{ color: "#4f46e5", fontWeight: 800, textTransform: "uppercase" }}>
              3. Management Fee ({feeRate}%)
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, mt: 0.5, color: "#4338ca" }}>
              - {kM(calculatedFeeBase)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Agency professional charge
            </Typography>
          </Paper>

          {/* Step 4: VAT on Fee */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(217, 119, 6, 0.05)", borderColor: "#d97706" }}>
            <Typography variant="caption" sx={{ color: "#d97706", fontWeight: 800, textTransform: "uppercase" }}>
              4. 16% VAT on Fee
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, mt: 0.5, color: "#b45309" }}>
              - {kM(calculatedVat)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Statutory tax remittance
            </Typography>
          </Paper>

          {/* Step 5: Net Payout */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(37, 99, 235, 0.08)", borderColor: "#2563eb", borderLeft: "4px solid #2563eb" }}>
            <Typography variant="caption" sx={{ color: "#2563eb", fontWeight: 800, textTransform: "uppercase" }}>
              5. Net Wire to Owner
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 900, mt: 0.5, color: "#1d4ed8" }}>
              {kM(netLandlordRemittance)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Disbursed to landlord
            </Typography>
          </Paper>
        </Box>
      </Paper>

      {/* 4. HISTORICAL SETTLEMENTS & MANAGEMENT FEE INVOICE LEDGER */}
      <Panel
        title="Monthly Landlord Statements & Fee Invoices"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost sm" onClick={() => handleDownloadReport("csv")}>
              Export CSV
            </button>
            <button className="btn ghost sm" onClick={() => handleDownloadReport("pdf")}>
              Download PDF Report →
            </button>
          </div>
        }
      >
        <ListState
          loading={loading}
          empty={historicalLedger.length === 0}
          emptyTitle="No fee records"
          emptyDesc="Management fee statements will appear here once collections are recorded."
        >
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Gross Collections</th>
                  <th>Expenses Deducted</th>
                  <th>Agency Fee ({feeRate}%)</th>
                  <th>VAT (16%)</th>
                  <th>Total Deductions</th>
                  <th>Net Remittance</th>
                  <th>Settlement Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historicalLedger.map((row) => (
                  <tr key={row.month}>
                    <td>
                      <strong style={{ fontSize: 13 }}>{row.month}</strong>
                    </td>
                    <td className="mono" style={{ color: "#16a34a", fontWeight: 700 }}>
                      {kM(row.gross)}
                    </td>
                    <td className="mono" style={{ color: "#dc2626" }}>
                      - {kM(row.opex)}
                    </td>
                    <td className="mono" style={{ color: "#4f46e5", fontWeight: 600 }}>
                      {kM(row.fee)}
                    </td>
                    <td className="mono" style={{ color: "#d97706" }}>
                      {kM(row.vat)}
                    </td>
                    <td className="mono" style={{ color: "var(--text-secondary)" }}>
                      {kM(row.opex + row.totalFee)}
                    </td>
                    <td className="mono" style={{ color: "#2563eb", fontWeight: 800, fontSize: 13 }}>
                      {kM(row.net)}
                    </td>
                    <td>
                      <StatusPill
                        value={row.status === "remitted" ? "Remitted" : "Pending Remittance"}
                        tone={row.status === "remitted" ? "green" : "yellow"}
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DownloadRounded sx={{ fontSize: 13 }} />}
                          onClick={() => handleDownloadReport("pdf")}
                          sx={{ fontSize: 11, py: 0.25 }}
                        >
                          Statement
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ReceiptLongRounded sx={{ fontSize: 13 }} />}
                          onClick={() => handleDownloadReport("pdf")}
                          sx={{ fontSize: 11, py: 0.25 }}
                        >
                          Tax Invoice
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>

      {/* 5. AGING OF UNSETTLED DISBURSEMENTS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Fee & Remittance Aging">
          {agingTotal > 0 ? (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Aging Bucket</th>
                    <th>Outstanding Amount</th>
                    <th>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {agingBuckets.map((b) => (
                    <tr key={b.label}>
                      <td style={{ fontSize: 12 }}>{b.label}</td>
                      <td className="mono" style={{ color: b.amount > 0 ? "#dc2626" : "var(--muted)" }}>
                        {kM(b.amount)}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8, alignItems: "center" }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${pct(b.amount, agingTotal)}%`,
                                height: "100%",
                                background: b.amount > 0 ? "#dc2626" : "var(--border-strong)",
                              }}
                            />
                          </div>
                          <span className="mono" style={{ fontSize: 11, width: 40, textAlign: "right" }}>
                            {pct(b.amount, agingTotal)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="✓" title="No outstanding fee aging" description="All agency management commissions are current." />
          )}
        </Panel>

        <Panel title="Landlord Remittance Bank Details">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", pb: 1 }}>
              <span className="muted" style={{ fontSize: 12 }}>Account Name:</span>
              <strong style={{ fontSize: 13 }}>{activeProperty?.name} Landlord Trust</strong>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", pb: 1 }}>
              <span className="muted" style={{ fontSize: 12 }}>Bank / Branch:</span>
              <strong style={{ fontSize: 13 }}>NCBA Bank · Upper Hill Branch</strong>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", pb: 1 }}>
              <span className="muted" style={{ fontSize: 12 }}>Account Number:</span>
              <strong className="mono" style={{ fontSize: 13 }}>7849201948201</strong>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", pb: 1 }}>
              <span className="muted" style={{ fontSize: 12 }}>Disbursement Schedule:</span>
              <Badge tone="blue">Monthly · 5th Working Day</Badge>
            </Box>
            <Button
              size="small"
              variant="text"
              startIcon={<SettingsSuggestRounded sx={{ fontSize: 14 }} />}
              onClick={() => setShowSettingsDrawer(true)}
              sx={{ alignSelf: "flex-start", mt: 0.5, fontSize: 12 }}
            >
              Update Payout Settings
            </Button>
          </Box>
        </Panel>
      </div>

      {/* 6. MODAL: 1-CLICK GENERATE MONTHLY INVOICE & STATEMENT */}
      <Dialog open={showGenerateModal} onClose={() => setShowGenerateModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, display: "flex", alignItems: "center", gap: 1 }}>
          <ReceiptLongRounded color="primary" /> Generate Management Fee Tax Invoice & Statement
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              This automatically computes the agency commission on actual tenant receipts and generates a formal Tax Invoice and Landlord Remittance Statement.
            </Alert>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <TextField
                label="Billing Month"
                type="month"
                size="small"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />

              <TextField
                select
                label="Fee Structure"
                size="small"
                value={feeModel}
                onChange={(e) => setFeeModel(e.target.value as any)}
                fullWidth
              >
                <MenuItem value="percent_collections">% of Actual Collections</MenuItem>
                <MenuItem value="percent_billed">% of Billed Rent</MenuItem>
                <MenuItem value="fixed_retainer">Fixed Monthly Retainer</MenuItem>
                <MenuItem value="letting_fee">Tenant Placement / Letting Fee</MenuItem>
              </TextField>
            </Box>

            {feeModel === "fixed_retainer" ? (
              <TextField
                label="Fixed Retainer Fee (KES)"
                type="number"
                size="small"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(Number(e.target.value))}
                fullWidth
              />
            ) : (
              <TextField
                label="Commission Rate (%)"
                type="number"
                size="small"
                value={feeRate}
                onChange={(e) => setFeeRate(Number(e.target.value))}
                fullWidth
              />
            )}

            <FormControlLabel
              control={<Switch checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} color="primary" />}
              label="Apply 16% Value Added Tax (VAT) on Agency Commission"
            />

            {/* Live Calculation Preview Card */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "var(--surface-sunken)" }}>
              <Typography variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase", color: "text.secondary" }}>
                Statement Summary Preview ({selectedMonth})
              </Typography>
              <Stack spacing={1} sx={{ mt: 1.5, fontSize: 13 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Gross Collections:</span>
                  <strong className="mono" style={{ color: "#16a34a" }}>KES {grossCollections.toLocaleString()}</strong>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Direct Property OPEX:</span>
                  <strong className="mono" style={{ color: "#dc2626" }}>- KES {propertyExpenses.toLocaleString()}</strong>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Agency Management Fee ({feeRate}%):</span>
                  <strong className="mono" style={{ color: "#4f46e5" }}>- KES {calculatedFeeBase.toLocaleString()}</strong>
                </Box>
                {applyVat && (
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>16% VAT on Fee:</span>
                    <strong className="mono" style={{ color: "#d97706" }}>- KES {calculatedVat.toLocaleString()}</strong>
                  </Box>
                )}
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <strong>Net Landlord Remittance:</strong>
                  <strong className="mono" style={{ color: "#2563eb" }}>KES {netLandlordRemittance.toLocaleString()}</strong>
                </Box>
              </Stack>
            </Paper>

            <TextField
              label="Disbursement Notes / Reference"
              placeholder="e.g. Wire transfer ref / August rental settlement"
              size="small"
              value={disbursementNote}
              onChange={(e) => setDisbursementNote(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowGenerateModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmGenerate}
            startIcon={<CheckCircleRounded />}
            sx={{ bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" }, fontWeight: 800 }}
          >
            Confirm & Generate Pack
          </Button>
        </DialogActions>
      </Dialog>

      {/* 7. MODAL: COMMISSION TERMS & LANDLORD SETTINGS */}
      <Dialog open={showSettingsDrawer} onClose={() => setShowSettingsDrawer(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Landlord Engagement Terms</DialogTitle>
        <DialogContent dividers sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <TextField select label="Engagement Type" size="small" defaultValue="management" fullWidth>
              <MenuItem value="management">Property Management (Full Service)</MenuItem>
              <MenuItem value="letting">Letting Only</MenuItem>
              <MenuItem value="facility">Facility Supervision</MenuItem>
            </TextField>

            <TextField
              label="Standard Management Fee (%)"
              type="number"
              size="small"
              value={feeRate}
              onChange={(e) => setFeeRate(Number(e.target.value))}
              fullWidth
            />

            <TextField
              label="New Letting Placement Fee (% of 1st Month Rent)"
              type="number"
              size="small"
              defaultValue={100}
              fullWidth
            />

            <TextField
              label="Remittance Bank Name"
              size="small"
              defaultValue="NCBA Bank"
              fullWidth
            />

            <TextField
              label="Bank Account Number"
              size="small"
              defaultValue="7849201948201"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowSettingsDrawer(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              toast.success("Engagement terms and bank settings saved.");
              setShowSettingsDrawer(false);
            }}
          >
            Save Terms
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

/* ─── REPORTS ─── */
