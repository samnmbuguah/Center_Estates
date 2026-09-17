"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Alert, Box, Button, Chip, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { SubTabs } from "../PropertyToolbar";
import { PropertyBillingDashboard } from "@/components/property-billing-dashboard";
import { RentView } from "./RentView";
import { CreditNotesView } from "./CreditNotesView";
import type { PropertyTab, Row, InvoiceRow, AgingAnalytics, BillingSection, CreditNoteRow } from "../../types/property.types";
import type { ID } from "../../types/property.types";
import { Panel, StatusPill, LoadingState, EmptyState } from "@/components/module-ui";
import { kM, fmtDate } from "../../utils/property.utils";
import { apiFetch, csrfFromCookie, apiErrorMessage, downloadApiPdf } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/components/auth-provider";

type LandlordInvoice = {
  id: string; number: string; property: string; property_name: string;
  landlord_name: string; fee_type: string;
  billing_period: string; gross_collections: string; fee_amount: string;
  vat_rate: string; vat_amount: string; total_amount: string; net_payout: string;
  status: string; issued_on: string | null; due_on: string | null;
  paid_at: string | null; payment_reference: string; notes: string;
};

/** Inline landlord-invoice sub-panel shown inside the Invoice Register tab */
function LandlordInvoicePanel({ search }: { search: string }) {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [invoices, setInvoices] = useState<LandlordInvoice[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setFetching(true);
    setFetchError("");
    try {
      const res = await apiFetch("/property/landlord-invoices/", {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : (data.results ?? []));
      } else {
        setFetchError("Could not load landlord invoices.");
      }
    } catch {
      setFetchError("Unable to reach the server.");
    } finally {
      setFetching(false);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const handleSend = async (inv: LandlordInvoice) => {
    try {
      await apiFetch("/auth/csrf/");
      const csrf = csrfFromCookie();
      const res = await apiFetch(`/property/landlord-invoices/${inv.id}/send/`, {
        method: "POST", headers: { "X-CSRFToken": csrf },
      });
      if (res.ok) { toast.success(`Invoice ${inv.number} issued.`); void load(); }
      else { toast.error(await apiErrorMessage(res, "Could not issue invoice.")); }
    } catch { toast.error("Unable to reach the server."); }
  };

  const handleMarkPaid = async (inv: LandlordInvoice) => {
    const paymentReference = window.prompt(`Enter the payment reference for ${inv.number}:`)?.trim();
    if (!paymentReference) {
      toast.error("A payment reference is required before an invoice can be marked as paid.");
      return;
    }
    try {
      await apiFetch("/auth/csrf/");
      const csrf = csrfFromCookie();
      const res = await apiFetch(`/property/landlord-invoices/${inv.id}/mark-paid/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: JSON.stringify({ payment_reference: paymentReference }),
      });
      if (res.ok) { toast.success(`Invoice ${inv.number} marked as paid.`); void load(); }
      else { toast.error(await apiErrorMessage(res, "Could not mark as paid.")); }
    } catch { toast.error("Unable to reach the server."); }
  };

  const handleDelete = async (inv: LandlordInvoice) => {
    if (!confirm(`Delete draft invoice ${inv.number}? This cannot be undone.`)) return;
    try {
      await apiFetch("/auth/csrf/");
      const csrf = csrfFromCookie();
      const res = await apiFetch(`/property/landlord-invoices/${inv.id}/`, {
        method: "DELETE", headers: { "X-CSRFToken": csrf },
      });
      if (res.ok) { toast.success(`Invoice ${inv.number} deleted.`); void load(); }
      else { toast.error(await apiErrorMessage(res, "Could not delete invoice. Only draft invoices can be deleted.")); }
    } catch { toast.error("Unable to reach the server."); }
  };

  const handleDownloadPdf = async (inv: LandlordInvoice) => {
    try {
      await downloadApiPdf(`/property/landlord-invoices/${inv.id}/pdf/`, `Tax-Invoice-${inv.number}.pdf`, organizationId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The tax invoice PDF could not be downloaded.");
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = invoices.filter(inv =>
    !q || inv.number?.toLowerCase().includes(q) || inv.landlord_name?.toLowerCase().includes(q) ||
    inv.billing_period?.includes(q) || inv.property_name?.toLowerCase().includes(q)
  );

  return (
    <Panel title="Landlord & Agency Fee Invoices" action={
      <Button size="small" variant="outlined" sx={{ fontSize: 11 }} onClick={() => void load()}>↻ Refresh</Button>
    }>
      {fetchError && <Alert severity="error" sx={{ mb: 1 }}>{fetchError}</Alert>}
      {fetching && <LoadingState rows={3} />}
      {!fetching && filtered.length === 0 && (
        <EmptyState
          title="No landlord invoices"
          description="Landlord management fee and letting fee invoices will appear here once generated from the Billing Pipeline."
        />
      )}
      {!fetching && filtered.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Invoice No</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Period</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Property</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Landlord</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Fee Amount</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>VAT</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Net Payout</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Issued</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "primary.main" }}>
                      {inv.number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={inv.fee_type === "letting" ? "Letting Fee" : "Mgmt Commission"}
                      color={inv.fee_type === "letting" ? "secondary" : "info"}
                      variant="outlined"
                      sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell><Typography variant="body2">{inv.billing_period}</Typography></TableCell>
                  <TableCell sx={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Typography variant="body2">{inv.property_name}</Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2">{inv.landlord_name}</Typography></TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main" }}>
                      {kM(Number(inv.fee_amount))}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "warning.main" }}>
                      {kM(Number(inv.vat_amount))}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 800 }}>
                      {kM(Number(inv.total_amount))}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "info.main", fontWeight: 800 }}>
                      {kM(Number(inv.net_payout))}
                    </Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2">{inv.issued_on ? fmtDate(inv.issued_on) : "—"}</Typography></TableCell>
                  <TableCell align="center">
                    <StatusPill value={inv.status === "sent" ? "issued" : inv.status} />
                    {inv.payment_reference && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 11 }}>
                        {inv.payment_reference}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: 10 }} onClick={() => handleDownloadPdf(inv)}>PDF</Button>
                      {inv.status === "draft" && (
                        <Button size="small" variant="contained" sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: 10 }} onClick={() => void handleSend(inv)}>Issue</Button>
                      )}
                      {inv.status === "sent" && (
                        <Button size="small" variant="contained" color="success" sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: 10 }} onClick={() => void handleMarkPaid(inv)}>Mark Paid</Button>
                      )}
                      {inv.status === "draft" && (
                        <Button size="small" variant="outlined" color="error" sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: 10 }} onClick={() => void handleDelete(inv)}>Del</Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {invoices.length > 0 && (
        <Box sx={{ pt: 1.5, pb: 0.5, px: 1, display: "flex", gap: 2, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} total
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--color-indigo)", fontWeight: 700 }}>
            Fees: {kM(invoices.reduce((s, i) => s + Number(i.fee_amount || 0), 0))}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--color-success)", fontWeight: 700 }}>
            Paid: {invoices.filter(i => i.status === "paid").length}
          </Typography>
          <Typography variant="caption" sx={{ color: "#ca8a04", fontWeight: 700 }}>
            Pending: {invoices.filter(i => i.status !== "paid").length}
          </Typography>
        </Box>
      )}
    </Panel>
  );
}

export function BillingInvoicesView({
  billingSection = "pipeline",
  setBillingSection = () => {},
  // pipeline props
  onNavigateBilling = () => {},
  onSingleInvoice = () => {},
  onLettingFeeInvoice = () => {},
  // invoice register props
  rows = [],
  rentInvoices = [],
  creditNotes = [],
  analytics = null,
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  organizationId = null,
  canFinance = true,
  canApprove = true,
  onAddInvoice = () => {},
  onAddCreditNote = () => {},
  onVoidCreditNote = () => {},
  onRecordReceipt = () => {},
  onSendReminder = () => {},
  onInvoiceAction = () => {},
  onSelectRow = () => {},
  onDownloadPdf = () => {},
  onRefresh = () => {},
}: {
  billingSection?: BillingSection;
  setBillingSection?: (s: BillingSection) => void;
  onNavigateBilling?: (t: string) => void;
  onSingleInvoice?: (ctx: any) => void;
  onLettingFeeInvoice?: () => void;
  rows?: Row[];
  rentInvoices?: InvoiceRow[];
  creditNotes?: Row[];
  analytics?: AgingAnalytics | null;
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  organizationId?: string | null;
  canFinance?: boolean;
  canApprove?: boolean;
  onAddInvoice?: () => void;
  onAddCreditNote?: () => void;
  onVoidCreditNote?: (row: CreditNoteRow) => void;
  onRecordReceipt?: (invoiceId?: ID) => void;
  onSendReminder?: (row: InvoiceRow) => void;
  onInvoiceAction?: (row: InvoiceRow, action: "submit-review" | "approve" | "issue" | "void") => void;
  onSelectRow?: (r: Row) => void;
  onDownloadPdf?: (row: InvoiceRow) => void;
  onRefresh?: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <SubTabs
        tabs={[
          { id: "pipeline", label: "Billing Pipeline" },
          { id: "invoices", label: "Invoice Register" },
          { id: "credit-notes", label: "Credit Notes & Adjustments" },
        ]}
        active={billingSection}
        onChange={(id) => { setBillingSection(id as BillingSection); setSearch(""); }}
      />

      {billingSection === "pipeline" && (
        <PropertyBillingDashboard
          onNavigate={(target) => {
            onNavigateBilling(target);
          }}
          onSingleInvoice={onSingleInvoice}
          onLettingFeeInvoice={onLettingFeeInvoice}
        />
      )}

      {billingSection === "invoices" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Tenant Invoices */}
          <RentView
            rows={rows}
            rentInvoices={rentInvoices}
            analytics={analytics}
            loading={loading}
            search={search}
            setSearch={setSearch}
            setTab={setTab}
            canFinance={canFinance}
            canApprove={canApprove}
            onAddInvoice={onAddInvoice}
            onRecordReceipt={onRecordReceipt}
            onSendReminder={onSendReminder}
            onInvoiceAction={onInvoiceAction}
            onSelectRow={onSelectRow}
            onDownloadPdf={onDownloadPdf}
            onRefresh={onRefresh}
          />

          {/* Landlord / Agency Invoices */}
          <LandlordInvoicePanel search={search} />
        </div>
      )}

      {billingSection === "credit-notes" && (
        <CreditNotesView
          rows={rows}
          loading={loading}
          search={search}
          setSearch={setSearch}
          setTab={setTab}
          onAdd={onAddCreditNote}
          onVoid={onVoidCreditNote as any}
        />
      )}
    </div>
  );
}
