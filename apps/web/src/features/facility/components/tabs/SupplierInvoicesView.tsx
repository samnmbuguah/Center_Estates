"use client";

import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  LinearProgress, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { Plus, Send } from "lucide-react";
import { EmptyState, StatusPill, money } from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import type { FacilityTab, Row } from "../../types/facility.types";

type Invoice = {
  id: string; code: string; supplier_invoice_number: string; supplier_name: string;
  property_name: string; classification: string; work_order_number: string;
  service_profile_name: string; description: string; subtotal: string; vat_amount: string;
  total: string; status: string; cost_centre: string; variance: string | null;
  work_order_value: string | null; rejected_reason: string; exception_approved: boolean;
  payment_reference: string;
};

async function post(path: string, payload: unknown, organizationId: string | null) {
  await apiFetch("/auth/csrf/");
  return apiFetch(path, { method: "POST", headers: { "X-CSRFToken": csrfFromCookie(), "Content-Type": "application/json" }, body: JSON.stringify(payload) }, organizationId);
}

export function SupplierInvoicesView({ rows, loading, error, search, setSearch, organizationId, reload, setTab }: {
  rows: Row[]; loading: boolean; error: string; search: string; setSearch: (v: string) => void;
  organizationId: string | null; reload: () => void; setTab: (t: FacilityTab) => void;
}) {
  const invoices = rows as unknown as Invoice[];
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Invoice | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payReference, setPayReference] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [propertyOptions, setPropertyOptions] = useState<Row[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Row[]>([]);
  const [workOrderOptions, setWorkOrderOptions] = useState<Row[]>([]);
  const [form, setForm] = useState({
    property: "", supplier: "", supplier_invoice_number: "", classification: "repair",
    work_order: "", description: "", subtotal: "", vat_rate: "16", cost_centre: "",
  });

  async function openCreate() {
    setCreateOpen(true);
    if (propertyOptions.length === 0 && organizationId) {
      const [propRes, supRes, woRes] = await Promise.all([
        apiFetch("/property/properties/", {}, organizationId),
        apiFetch("/facility/contractors/", {}, organizationId),
        apiFetch("/facility/work-orders/", {}, organizationId),
      ]);
      if (propRes.ok) { const d = await propRes.json(); setPropertyOptions(Array.isArray(d) ? d : d.results ?? []); }
      if (supRes.ok) { const d = await supRes.json(); setSupplierOptions(Array.isArray(d) ? d : d.results ?? []); }
      if (woRes.ok) { const d = await woRes.json(); setWorkOrderOptions(Array.isArray(d) ? d : d.results ?? []); }
    }
  }

  const vatAmount = useMemo(() => {
    const sub = Number(form.subtotal || 0);
    const rate = Number(form.vat_rate || 0);
    return (sub * rate / 100).toFixed(2);
  }, [form.subtotal, form.vat_rate]);
  const total = useMemo(() => (Number(form.subtotal || 0) + Number(vatAmount)).toFixed(2), [form.subtotal, vatAmount]);

  const kpis = useMemo(() => ({
    pending: invoices.filter(i => ["submitted", "verified"].includes(i.status)).length,
    approved: invoices.filter(i => i.status === "approved" || i.status === "payment_processing").length,
    paidTotal: invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total || 0), 0),
    exceptions: invoices.filter(i => i.exception_approved).length,
  }), [invoices]);

  async function runAction(invoice: Invoice, action: string, payload: Record<string, unknown> = {}) {
    setBusy(`${invoice.id}:${action}`); setActionError("");
    try {
      const res = await post(`/facility/supplier-invoices/${invoice.id}/${action}/`, payload, organizationId);
      if (!res.ok) { setActionError(await apiErrorMessage(res, `${action.replace(/-/g, " ")} failed.`)); return; }
      setRejectTarget(null); setRejectReason(""); setPayTarget(null); setPayReference("");
      reload();
    } finally { setBusy(""); }
  }

  async function createInvoice() {
    if (!form.property || !form.supplier || !form.supplier_invoice_number || !form.description || !Number(form.subtotal)) return;
    setBusy("create"); setActionError("");
    try {
      const subtotal = Number(form.subtotal);
      const vat = Number(vatAmount);
      const payload: Record<string, unknown> = {
        property: form.property, supplier: form.supplier,
        supplier_invoice_number: form.supplier_invoice_number,
        classification: form.classification,
        description: form.description, subtotal: subtotal.toFixed(2),
        vat_rate: Number(form.vat_rate).toFixed(2), vat_amount: vat,
        total: (subtotal + vat).toFixed(2), cost_centre: form.cost_centre,
      };
      if (form.work_order) payload.work_order = form.work_order;
      const res = await post("/facility/supplier-invoices/", payload, organizationId);
      if (!res.ok) { setActionError(await apiErrorMessage(res, "Could not create the invoice.")); return; }
      setCreateOpen(false);
      setForm({ property: "", supplier: "", supplier_invoice_number: "", classification: "repair", work_order: "", description: "", subtotal: "", vat_rate: "16", cost_centre: "" });
      reload();
    } finally { setBusy(""); }
  }

  const inputStyle = { width: "100%" } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
        {[
          { label: "Awaiting Review", value: kpis.pending, color: kpis.pending > 0 ? "#d97706" : "#94a3b8", icon: "⏳" },
          { label: "Approved / Paying", value: kpis.approved, color: "#2563eb", icon: "✓" },
          { label: "Paid (total)", value: money.format(kpis.paidTotal), color: "#16a34a", icon: "💰" },
          { label: "Exception Approvals", value: kpis.exceptions, color: kpis.exceptions > 0 ? "#dc2626" : "#94a3b8", icon: "⚠️" },
        ].map((k, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, borderTop: "3px solid", borderTopColor: k.color }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: 10 }}>{k.label}</Typography>
              <span style={{ fontSize: 14 }}>{k.icon}</span>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>{k.value}</Typography>
          </Paper>
        ))}
      </Box>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Supplier Invoices</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Draft → Submitted → Verified → Approved → Payment → Paid · duplicates blocked · work-order verification enforced</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <TextField size="small" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 200 }} />
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => void openCreate()}>Record Invoice</Button>
          <Button variant="outlined" onClick={() => setTab("expenditure")}>Expenditure →</Button>
        </Stack>
      </Paper>

      {(error || actionError) && <Alert severity="error" onClose={() => setActionError("")}>{actionError || error}</Alert>}
      {loading && <LinearProgress />}

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        {invoices.length === 0 && !loading ? (
          <EmptyState title="No supplier invoices" description="Record a supplier invoice to start the verification and payment workflow." />
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px" }}>Code / Supplier No.</th>
                  <th style={{ padding: "10px 14px" }}>Supplier</th>
                  <th style={{ padding: "10px 14px" }}>Source</th>
                  <th style={{ padding: "10px 14px" }}>Total</th>
                  <th style={{ padding: "10px 14px" }}>Variance</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div className="mono" style={{ fontWeight: 700, fontSize: 12, color: "var(--brand-primary, #dc2626)" }}>{inv.code}</div>
                      <div className="mono" style={{ fontSize: 11, color: "text.secondary" }}>{inv.supplier_invoice_number}</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 700 }}>{inv.supplier_name}</div>
                      <div style={{ fontSize: 11, color: "text.secondary" }}>{inv.property_name}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>
                      <Chip size="small" label={inv.classification === "repair" ? "Repair" : "Recurring"} sx={{ fontSize: 10, height: 18 }} />
                      {inv.work_order_number && <div className="mono" style={{ fontSize: 11, marginTop: 2 }}>WO {inv.work_order_number}</div>}
                      {inv.service_profile_name && <div style={{ fontSize: 11, marginTop: 2 }}>{inv.service_profile_name}</div>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 800 }} className="mono">{money.format(Number(inv.total))}</div>
                      {inv.payment_reference && <div style={{ fontSize: 11, color: "text.secondary" }}>{inv.payment_reference}</div>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {inv.variance === null || inv.variance === undefined ? "—" : (
                        <span className="mono" style={{ color: Number(inv.variance) > 0 ? "var(--error, #dc2626)" : "#16a34a", fontWeight: 700 }}>
                          {Number(inv.variance) > 0 ? "+" : ""}{money.format(Number(inv.variance))}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <StatusPill value={inv.status} />
                      {inv.exception_approved && <Chip size="small" label="Exception" color="warning" sx={{ fontSize: 9, height: 16, ml: 0.5 }} />}
                      {inv.rejected_reason && <div style={{ fontSize: 11, color: "var(--error, #dc2626)", marginTop: 2 }}>{inv.rejected_reason}</div>}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {inv.status === "draft" && <Button size="small" variant="outlined" startIcon={<Send size={12} />} disabled={Boolean(busy)} onClick={() => void runAction(inv, "submit")}>Submit</Button>}
                        {inv.status === "submitted" && <Button size="small" variant="outlined" disabled={Boolean(busy)} onClick={() => void runAction(inv, "verify")}>Verify</Button>}
                        {inv.status === "verified" && (
                          <>
                            <Button size="small" variant="contained" disabled={Boolean(busy)} onClick={() => void runAction(inv, "approve", {})}>Approve</Button>
                            <Button size="small" color="error" onClick={() => setRejectTarget(inv)}>Reject</Button>
                          </>
                        )}
                        {inv.status === "approved" && <Button size="small" variant="contained" disabled={Boolean(busy)} onClick={() => void runAction(inv, "start-payment")}>Start payment</Button>}
                        {inv.status === "payment_processing" && <Button size="small" variant="contained" color="success" onClick={() => setPayTarget(inv)}>Mark paid</Button>}
                        {inv.status === "rejected" && <Button size="small" variant="outlined" startIcon={<Send size={12} />} disabled={Boolean(busy)} onClick={() => void runAction(inv, "submit")}>Resubmit</Button>}
                      </Stack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </Paper>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Record Supplier Invoice</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select required label="Property" value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value })} sx={inputStyle}>
                {propertyOptions.map((p) => <MenuItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</MenuItem>)}
              </TextField>
              <TextField select required label="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} sx={inputStyle}>
                {supplierOptions.map((s) => <MenuItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField required label="Supplier invoice number" value={form.supplier_invoice_number} onChange={(e) => setForm({ ...form, supplier_invoice_number: e.target.value })} sx={inputStyle} />
              <TextField select label="Classification" value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value, work_order: e.target.value === "recurring" ? "" : form.work_order })} sx={inputStyle}>
                <MenuItem value="repair">One-off repair</MenuItem>
                <MenuItem value="recurring">Recurring service</MenuItem>
              </TextField>
            </Stack>
            {form.classification === "repair" && (
              <TextField select label="Work order" value={form.work_order} onChange={(e) => setForm({ ...form, work_order: e.target.value })} sx={inputStyle} helperText="Required at submission for repairs — variance is checked against the approved work-order value.">
                {workOrderOptions.map((w) => <MenuItem key={String(w.id)} value={String(w.id)}>{String(w.number)} — {String(w.title)}</MenuItem>)}
              </TextField>
            )}
            <TextField required multiline minRows={2} label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField required type="number" label="Subtotal (KES)" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} sx={inputStyle} />
              <TextField type="number" label="VAT rate (%)" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} sx={inputStyle} />
              <TextField label="Cost centre" value={form.cost_centre} onChange={(e) => setForm({ ...form, cost_centre: e.target.value })} sx={inputStyle} />
            </Stack>
            <Stack direction="row" spacing={3} sx={{ justifyContent: "flex-end" }}>
              <Typography variant="body2" color="text.secondary">VAT: <strong className="mono">{money.format(Number(vatAmount))}</strong></Typography>
              <Typography variant="body2">Total: <strong className="mono">{money.format(Number(total))}</strong></Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy === "create" || !form.property || !form.supplier || !form.supplier_invoice_number || !form.description || !Number(form.subtotal)} onClick={() => void createInvoice()}>
            {busy === "create" ? "Saving…" : "Create Invoice"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Reject Invoice</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>{rejectTarget?.code} — {rejectTarget?.supplier_name}</Typography>
          <TextField fullWidth multiline minRows={3} required label="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={!rejectReason.trim() || Boolean(busy)} onClick={() => rejectTarget && void runAction(rejectTarget, "reject", { reason: rejectReason })}>Reject</Button>
        </DialogActions>
      </Dialog>

      {/* Mark paid dialog */}
      <Dialog open={Boolean(payTarget)} onClose={() => setPayTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Mark Invoice Paid</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>{payTarget?.code} — {payTarget ? money.format(Number(payTarget.total)) : ""}</Typography>
          <TextField fullWidth required label="Payment reference" value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="e.g. RTGS-8891 / M-Pesa ref" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayTarget(null)}>Cancel</Button>
          <Button variant="contained" color="success" disabled={!payReference.trim() || Boolean(busy)} onClick={() => payTarget && void runAction(payTarget, "mark-paid", { payment_reference: payReference })}>Confirm payment</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
