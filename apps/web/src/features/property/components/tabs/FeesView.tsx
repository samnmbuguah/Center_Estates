"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Stack, Switch, TextField, Typography,
} from "@mui/material";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SettingsSuggestRounded from "@mui/icons-material/SettingsSuggestRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";

import { KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState } from "@/components/module-ui";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import type { PropertyTab, Row, FinancialAnalytics, ReportItem } from "../../types/property.types";
import { kM, kN, fmtDate } from "../../utils/property.utils";
import { usePropertyContext } from "@/lib/property-context";
import { useToast } from "@/components/monitoring/hooks/useToast";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type LandlordInvoice = {
  id: string; number: string; property: string; property_name: string;
  landlord_name: string; landlord_pin: string; fee_type: string;
  billing_period: string; gross_collections: string; fee_rate: string;
  fee_amount: string; vat_rate: string; vat_amount: string;
  total_amount: string; deductions: string; net_payout: string;
  status: string; issued_on: string | null; due_on: string | null;
  paid_at: string | null; payment_reference: string; notes: string;
};

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

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [invoices, setInvoices] = useState<LandlordInvoice[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Fee calculation parameters
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [feeModel, setFeeModel] = useState<"percent_collections" | "percent_billed" | "fixed_retainer" | "letting_fee">("percent_collections");
  const [feeRate, setFeeRate] = useState<number>(8.0);
  const [fixedAmount, setFixedAmount] = useState<number>(50000);
  const [applyVat, setApplyVat] = useState(true);
  const [disbursementNote, setDisbursementNote] = useState("");

  // Fetch real landlord invoices from API
  const loadInvoices = useCallback(async () => {
    if (!organizationId) return;
    setFetching(true);
    setFetchError("");
    try {
      const res = await apiFetch("/property/landlord-invoices/", {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : data.results ?? []);
      } else {
        setFetchError("Landlord invoices could not be loaded.");
      }
    } catch {
      setFetchError("Unable to reach the server. Check your connection.");
    } finally {
      setFetching(false);
    }
  }, [organizationId]);

  useEffect(() => { void loadInvoices(); }, [loadInvoices]);

  // Compute KPIs from real invoices
  const kpis = financial?.kpis;
  const grossCollections = invoices.reduce((s, inv) => s + Number(inv.gross_collections ?? 0), 0) || Number(kpis?.income ?? 0);
  const totalFees = invoices.reduce((s, inv) => s + Number(inv.fee_amount ?? 0), 0);
  const totalVat = invoices.reduce((s, inv) => s + Number(inv.vat_amount ?? 0), 0);
  const totalNet = invoices.reduce((s, inv) => s + Number(inv.net_payout ?? 0), 0);
  const unpaidInvoices = invoices.filter(inv => inv.status !== "paid");

  // Generate invoice via real API
  const handleConfirmGenerate = async () => {
    if (!organizationId || !activeProperty) return;
    const gross = grossCollections || 0;
    const rate = feeModel === "fixed_retainer" ? 0 : feeRate;
    const fee = feeModel === "fixed_retainer" ? fixedAmount : Math.round((gross * rate) / 100);
    const vat = applyVat ? Math.round(fee * 0.16) : 0;
    const total = fee + vat;
    const deductions = 0;
    const net = Math.max(gross - fee - vat - deductions, 0);

    try {
      const res = await apiFetch("/property/landlord-invoices/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          property: activeProperty.id,
          landlord_name: activeProperty.name || "Landlord",
          fee_type: feeModel === "letting_fee" ? "letting" : "management",
          billing_period: selectedMonth,
          gross_collections: gross,
          fee_rate: rate,
          vat_rate: applyVat ? 16 : 0,
          deductions: deductions,
          notes: disbursementNote || `Generated for ${selectedMonth}`,
        }),
      }, organizationId);
      if (res.ok) {
        toast.success(`Management fee invoice generated for ${selectedMonth}.`);
        setShowGenerateModal(false);
        setDisbursementNote("");
        void loadInvoices();
      } else {
        const body = await res.json().catch(() => ({}));
        const msg = Object.values(body as Record<string, unknown>).flat().join(" ");
        toast.error(msg || "Invoice generation failed.");
      }
    } catch {
      toast.error("Unable to reach the server. Check your connection.");
    }
  };

  // Send invoice
  const handleSend = async (inv: LandlordInvoice) => {
    if (!organizationId) return;
    try {
      const res = await apiFetch(`/property/landlord-invoices/${inv.id}/send/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
      }, organizationId);
      if (res.ok) {
        toast.success(`Invoice ${inv.number} sent to landlord.`);
        void loadInvoices();
      } else {
        toast.error("Could not send invoice.");
      }
    } catch {
      toast.error("Unable to reach the server.");
    }
  };

  // Mark paid
  const handleMarkPaid = async (inv: LandlordInvoice) => {
    if (!organizationId) return;
    const ref = prompt("Enter payment reference (e.g. RTGS-12345):");
    if (!ref) return;
    try {
      const res = await apiFetch(`/property/landlord-invoices/${inv.id}/mark-paid/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ payment_reference: ref }),
      }, organizationId);
      if (res.ok) {
        toast.success(`Invoice ${inv.number} marked as paid.`);
        void loadInvoices();
      } else {
        toast.error("Could not mark invoice as paid.");
      }
    } catch {
      toast.error("Unable to reach the server.");
    }
  };

  // Delete draft invoice
  const handleDelete = async (inv: LandlordInvoice) => {
    if (!organizationId) return;
    if (!window.confirm(`Delete draft invoice ${inv.number} for ${inv.landlord_name}? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/property/landlord-invoices/${inv.id}/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": csrfFromCookie() },
      }, organizationId);
      if (res.ok) {
        toast.success(`Invoice ${inv.number} deleted.`);
        void loadInvoices();
      } else {
        const body = await res.json().catch(() => ({}));
        const msg = Object.values(body as Record<string, unknown>).flat().join(" ");
        toast.error(msg || "Could not delete invoice. Only draft invoices can be deleted.");
      }
    } catch {
      toast.error("Unable to reach the server.");
    }
  };

  const handleDownloadReport = (format: "pdf" | "excel" | "csv") => {
    if (onExport) {
      void onExport({ key: "management-fee", name: "Management Fee Report", description: "Agency management commission and landlord disbursements", category: "Financial" } as any, format);
    } else {
      toast.success(`Exporting management fee report as ${format.toUpperCase()}…`);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.number?.toLowerCase().includes(q) || inv.landlord_name?.toLowerCase().includes(q) || inv.billing_period?.includes(q);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {/* KPI Strip */}
      <KpiStrip cols={4}>
        <KpiCard icon="💰" iconBg="#dcfce7" iconColor="#16a34a" label="Gross Collections" value={kM(grossCollections)} sub="From landlord invoices" onClick={() => setTab("receipting")} />
        <KpiCard icon="💼" iconBg="#e0e7ff" iconColor="#4f46e5" label="Agency Fees Earned" value={kM(totalFees)} sub={`${invoices.length} invoice(s)`} />
        <KpiCard icon="🏛️" iconBg="#fef3c7" iconColor="#d97706" label="VAT on Commission" value={kM(totalVat)} sub="16% Output Tax" />
        <KpiCard icon="🏦" iconBg="#dbeafe" iconColor="#2563eb" label="Net Landlord Payout" value={kM(totalNet)} sub="After fees & deductions" />
      </KpiStrip>

      {/* Toolbar */}
      <ViewToolbar
        title="Management Fees & Landlord Invoicing"
        subtitle={`Commission calculation and landlord settlement for ${activeProperty?.name || "selected property"}`}
        search={search}
        onSearch={setSearch}
        placeholder="Search invoice number, landlord, or period…"
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn secondary sm" onClick={() => handleDownloadReport("csv")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <DownloadRounded sx={{ fontSize: 16 }} /> Export CSV
          </button>
          <button className="btn primary sm" onClick={() => setShowGenerateModal(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800 }}>
            <ReceiptLongRounded sx={{ fontSize: 16 }} /> Generate Fee Invoice
          </button>
        </div>
      </ViewToolbar>

      {fetchError && <Alert severity="error">{fetchError}</Alert>}

      {/* Invoice Register */}
      <Panel title="Landlord Fee Invoices">
        <ListState loading={fetching} empty={filteredInvoices.length === 0} emptyTitle="No fee invoices" emptyDesc="Generate a management fee invoice to start tracking landlord disbursements.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Period</th>
                  <th>Landlord</th>
                  <th>Gross Collections</th>
                  <th>Fee</th>
                  <th>VAT</th>
                  <th>Total</th>
                  <th>Net Payout</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono" style={{ fontWeight: 700, color: "var(--brand-primary, #dc2626)" }}>{inv.number}</td>
                    <td style={{ fontSize: 12 }}>{inv.billing_period}</td>
                    <td style={{ fontSize: 12 }}>{inv.landlord_name}</td>
                    <td className="mono" style={{ color: "#16a34a", fontWeight: 600 }}>{kM(Number(inv.gross_collections))}</td>
                    <td className="mono" style={{ color: "#4f46e5" }}>{kM(Number(inv.fee_amount))}</td>
                    <td className="mono" style={{ color: "#d97706" }}>{kM(Number(inv.vat_amount))}</td>
                    <td className="mono" style={{ fontWeight: 800 }}>{kM(Number(inv.total_amount))}</td>
                    <td className="mono" style={{ color: "#2563eb", fontWeight: 800 }}>{kM(Number(inv.net_payout))}</td>
                    <td>
                      <StatusPill value={inv.status} />
                      {inv.payment_reference && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{inv.payment_reference}</div>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        {inv.status === "draft" && (
                          <Button size="small" variant="outlined" onClick={() => void handleSend(inv)} sx={{ fontSize: 11, py: 0.25 }}>Send</Button>
                        )}
                        {inv.status === "sent" && (
                          <Button size="small" variant="contained" color="success" onClick={() => void handleMarkPaid(inv)} sx={{ fontSize: 11, py: 0.25 }}>Mark Paid</Button>
                        )}
                        {inv.status === "draft" && (
                          <Button size="small" variant="outlined" color="error" onClick={() => void handleDelete(inv)} sx={{ fontSize: 11, py: 0.25, minWidth: 0 }}>
                            <DeleteRounded sx={{ fontSize: 15 }} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>

      {/* Generate Invoice Modal */}
      <Dialog open={showGenerateModal} onClose={() => setShowGenerateModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, display: "flex", alignItems: "center", gap: 1 }}>
          <ReceiptLongRounded color="primary" /> Generate Management Fee Invoice
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              This computes the agency commission and generates a formal landlord fee invoice.
            </Alert>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <TextField label="Billing Month" type="month" size="small" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
              <TextField select label="Fee Structure" size="small" value={feeModel} onChange={(e) => setFeeModel(e.target.value as any)} fullWidth>
                <MenuItem value="percent_collections">% of Actual Collections</MenuItem>
                <MenuItem value="percent_billed">% of Billed Rent</MenuItem>
                <MenuItem value="fixed_retainer">Fixed Monthly Retainer</MenuItem>
                <MenuItem value="letting_fee">Tenant Placement / Letting Fee</MenuItem>
              </TextField>
            </Box>
            {feeModel === "fixed_retainer" ? (
              <TextField label="Fixed Retainer Fee (KES)" type="number" size="small" value={fixedAmount} onChange={(e) => setFixedAmount(Number(e.target.value))} fullWidth />
            ) : (
              <TextField label="Commission Rate (%)" type="number" size="small" value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} fullWidth />
            )}
            <Switch checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} /> Apply 16% VAT on Commission
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "var(--surface-sunken)" }}>
              <Typography variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase", color: "text.secondary" }}>Preview</Typography>
              <Stack spacing={1} sx={{ mt: 1.5, fontSize: 13 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}><span>Gross Collections:</span><strong className="mono" style={{ color: "#16a34a" }}>{kM(grossCollections)}</strong></Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}><span>Fee ({feeRate}%):</span><strong className="mono" style={{ color: "#4f46e5" }}>- {kM(feeModel === "fixed_retainer" ? fixedAmount : Math.round((grossCollections * feeRate) / 100))}</strong></Box>
                {applyVat && <Box sx={{ display: "flex", justifyContent: "space-between" }}><span>VAT (16%):</span><strong className="mono" style={{ color: "#d97706" }}>- {kM(Math.round((feeModel === "fixed_retainer" ? fixedAmount : Math.round((grossCollections * feeRate) / 100)) * 0.16))}</strong></Box>}
                <Box sx={{ borderTop: "1px solid var(--border)", pt: 1, display: "flex", justifyContent: "space-between", fontSize: 14 }}><strong>Net Payout:</strong><strong className="mono" style={{ color: "#2563eb" }}>{kM(Math.max(grossCollections - (feeModel === "fixed_retainer" ? fixedAmount : Math.round((grossCollections * feeRate) / 100)) - (applyVat ? Math.round((feeModel === "fixed_retainer" ? fixedAmount : Math.round((grossCollections * feeRate) / 100)) * 0.16) : 0), 0))}</strong></Box>
              </Stack>
            </Paper>
            <TextField label="Notes / Reference" placeholder="e.g. Wire transfer ref / August rental settlement" size="small" value={disbursementNote} onChange={(e) => setDisbursementNote(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowGenerateModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleConfirmGenerate()} startIcon={<CheckCircleRounded />} sx={{ bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" }, fontWeight: 800 }}>Confirm & Generate</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
