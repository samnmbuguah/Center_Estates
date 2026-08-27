"use client";

import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, LinearProgress, MenuItem, Paper, Stack, Switch,
  TextField, Typography,
} from "@mui/material";
import { Eye, Plus, Send, Upload } from "lucide-react";
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
  requisition_code: string; lpo_number: string; job_card_number: string; ticket_reference: string;
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
  const [inspectTarget, setInspectTarget] = useState<Invoice | null>(null);
  const [isException, setIsException] = useState(false);
  const [exceptionNotes, setExceptionNotes] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Invoice | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payReference, setPayReference] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [propertyOptions, setPropertyOptions] = useState<Row[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<Row[]>([]);
  const [workOrderOptions, setWorkOrderOptions] = useState<Row[]>([]);
  const [profileOptions, setProfileOptions] = useState<Row[]>([]);
  const [form, setForm] = useState({
    property: "", supplier: "", supplier_invoice_number: "", classification: "repair",
    work_order: "", service_profile: "", service_period_start: "", service_period_end: "",
    description: "", subtotal: "", vat_rate: "16", cost_centre: "",
  });

  async function openCreate() {
    setCreateOpen(true);
    if (propertyOptions.length === 0 && organizationId) {
      const [propRes, supRes, woRes, spRes] = await Promise.all([
        apiFetch("/property/properties/", {}, organizationId),
        apiFetch("/facility/contractors/", {}, organizationId),
        apiFetch("/facility/work-orders/", {}, organizationId),
        apiFetch("/facility/service-profiles/", {}, organizationId),
      ]);
      if (propRes.ok) { const d = await propRes.json(); setPropertyOptions(Array.isArray(d) ? d : d.results ?? []); }
      if (supRes.ok) { const d = await supRes.json(); setSupplierOptions(Array.isArray(d) ? d : d.results ?? []); }
      if (woRes.ok) { const d = await woRes.json(); setWorkOrderOptions(Array.isArray(d) ? d : d.results ?? []); }
      if (spRes.ok) { const d = await spRes.json(); setProfileOptions(Array.isArray(d) ? d : d.results ?? []); }
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
      if (form.service_profile) {
        payload.service_profile = form.service_profile;
        payload.service_period_start = form.service_period_start || null;
        payload.service_period_end = form.service_period_end || null;
      }
      const res = await post("/facility/supplier-invoices/", payload, organizationId);
      if (!res.ok) { setActionError(await apiErrorMessage(res, "Could not create the invoice.")); return; }
      setCreateOpen(false);
      setForm({ property: "", supplier: "", supplier_invoice_number: "", classification: "repair", work_order: "", service_profile: "", service_period_start: "", service_period_end: "", description: "", subtotal: "", vat_rate: "16", cost_centre: "" });
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
                      {inv.job_card_number && <div className="mono" style={{ fontSize: 11 }}>Job {inv.job_card_number} · LPO {inv.lpo_number}</div>}
                      {inv.requisition_code && <div className="mono" style={{ fontSize: 11 }}>{inv.requisition_code}{inv.ticket_reference ? ` · ${inv.ticket_reference}` : ""}</div>}
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
                        <Button size="small" variant="text" startIcon={<Eye size={12} />} onClick={() => { setInspectTarget(inv); setIsException(Boolean(inv.exception_approved)); setExceptionNotes(""); }}>Review</Button>
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

      {/* Side-by-side Review & Verification Dialog */}
      <Dialog open={Boolean(inspectTarget)} onClose={() => setInspectTarget(null)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Invoice Review &amp; Verification — {inspectTarget?.code}</span>
          <StatusPill value={inspectTarget?.status || ""} />
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, mt: 1 }}>
            {/* Left Pane: Invoice Details & Source Linkage */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, background: "var(--surface-sunken)" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>🧾 Invoice Document &amp; Vendor Data</Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">Supplier:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{inspectTarget?.supplier_name}</Typography>
                </Box>
                {inspectTarget?.job_card_number && (
                  <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: "action.hover" }}>
                    <Typography variant="caption" color="text.secondary">Audit chain</Typography>
                    <Typography variant="body2" className="mono" sx={{ fontWeight: 700 }}>
                      {inspectTarget.ticket_reference || "Ticket —"} → {inspectTarget.requisition_code} → {inspectTarget.lpo_number} → {inspectTarget.job_card_number} → {inspectTarget.work_order_number}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">Supplier Invoice #:</Typography>
                  <Typography variant="body2" className="mono" sx={{ fontWeight: 700 }}>{inspectTarget?.supplier_invoice_number}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">Property:</Typography>
                  <Typography variant="body2">{inspectTarget?.property_name}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">Classification:</Typography>
                  <Chip size="small" label={inspectTarget?.classification === "repair" ? "Repair (WO Linked)" : "Recurring Service"} sx={{ fontSize: 11 }} />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">Description:</Typography>
                  <Typography variant="body2" sx={{ maxWidth: "60%", textAlign: "right" }}>{inspectTarget?.description}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">Subtotal:</Typography>
                  <Typography variant="body2" className="mono">{inspectTarget ? money.format(Number(inspectTarget.subtotal)) : ""}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">VAT Amount:</Typography>
                  <Typography variant="body2" className="mono">{inspectTarget ? money.format(Number(inspectTarget.vat_amount)) : ""}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Total Payable:</Typography>
                  <Typography variant="h6" className="mono" sx={{ fontWeight: 900, color: "var(--primary)" }}>
                    {inspectTarget ? money.format(Number(inspectTarget.total)) : ""}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Right Pane: Operational Verification & Exception Controls */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>🔍 Operational Verification Checklist</Typography>
              <Stack spacing={2}>
                <Box sx={{ p: 1.5, borderRadius: 1.5, background: inspectTarget?.work_order_number ? "rgba(22, 163, 74, 0.08)" : "rgba(245, 158, 11, 0.08)", border: "1px solid", borderColor: inspectTarget?.work_order_number ? "rgba(22, 163, 74, 0.3)" : "rgba(245, 158, 11, 0.3)" }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, display: "block" }}>Source Work Order:</Typography>
                  <Typography variant="body2">
                    {inspectTarget?.work_order_number ? `WO #${inspectTarget.work_order_number} · Linked & Approved` : "No Work Order linked"}
                  </Typography>
                  {inspectTarget?.work_order_value && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      Approved WO Value: {money.format(Number(inspectTarget.work_order_value))}
                    </Typography>
                  )}
                </Box>

                {inspectTarget?.variance !== null && inspectTarget?.variance !== undefined && Number(inspectTarget.variance) !== 0 && (
                  <Alert severity={Number(inspectTarget.variance) > 0 ? "warning" : "info"}>
                    Cost Variance: <strong>{Number(inspectTarget.variance) > 0 ? "+" : ""}{money.format(Number(inspectTarget.variance))}</strong> vs approved estimate.
                  </Alert>
                )}

                {inspectTarget?.exception_approved && (
                  <Alert severity="warning">
                    Authorized with exception override.
                  </Alert>
                )}

                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Verification / Approval Notes"
                  placeholder="Enter audit notes or exception justification..."
                  value={exceptionNotes}
                  onChange={(e) => setExceptionNotes(e.target.value)}
                />

                {inspectTarget?.status === "verified" && (
                  <FormControlLabel
                    control={<Switch checked={isException} onChange={(e) => setIsException(e.target.checked)} color="warning" />}
                    label={<Typography variant="body2" sx={{ fontWeight: 700 }}>Authorize Exception Approval (Override Budget / WO Gate)</Typography>}
                  />
                )}
              </Stack>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setInspectTarget(null)}>Close</Button>
          {inspectTarget?.status === "submitted" && (
            <Button variant="contained" disabled={Boolean(busy)} onClick={() => inspectTarget && void runAction(inspectTarget, "verify", { notes: exceptionNotes })}>
              Verify Invoice
            </Button>
          )}
          {inspectTarget?.status === "verified" && (
            <>
              <Button color="error" onClick={() => { setRejectTarget(inspectTarget); setInspectTarget(null); }}>
                Reject
              </Button>
              <Button
                variant="contained"
                color={isException ? "warning" : "primary"}
                disabled={Boolean(busy)}
                onClick={() => inspectTarget && void runAction(inspectTarget, "approve", { exception: isException, exception_notes: exceptionNotes, notes: exceptionNotes })}
              >
                {isException ? "Approve with Exception" : "Approve for Payment"}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Record Supplier Invoice</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* OCR / Document Attachment Upload */}
            <Paper variant="outlined" sx={{ p: 1.5, background: "var(--surface-sunken)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Attach Invoice PDF or Photo</Typography>
                <Typography variant="caption" color="text.secondary">Upload vendor bill for permanent audit trail &amp; autofill</Typography>
              </Box>
              <Button variant="outlined" size="small" component="label" startIcon={<Upload size={14} />}>
                {invoiceFile ? invoiceFile.name : "Choose Invoice File"}
                <input
                  hidden
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setInvoiceFile(f);
                      // Auto-extract invoice number from filename if applicable
                      const match = f.name.match(/(?:INV|BILL|SIN)[-_]?\d+/i);
                      if (match && !form.supplier_invoice_number) {
                        setForm((prev) => ({ ...prev, supplier_invoice_number: match[0].toUpperCase() }));
                      }
                    }
                  }}
                />
              </Button>
            </Paper>

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
              <TextField select label="Classification" value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value, work_order: e.target.value === "recurring" ? "" : form.work_order, service_profile: e.target.value === "repair" ? "" : form.service_profile })} sx={inputStyle}>
                <MenuItem value="repair">One-off repair</MenuItem>
                <MenuItem value="recurring">Recurring service</MenuItem>
              </TextField>
            </Stack>
            {form.classification === "repair" && (
              <TextField
                select
                label="Work order"
                value={form.work_order}
                onChange={(e) => {
                  const woId = e.target.value;
                  const targetWo = workOrderOptions.find((w) => String(w.id) === woId);
                  setForm((prev) => ({
                    ...prev,
                    work_order: woId,
                    description: prev.description || (targetWo ? String(targetWo.title) : ""),
                    subtotal: prev.subtotal || (targetWo && (targetWo as any).approved_amount ? String((targetWo as any).approved_amount) : prev.subtotal),
                  }));
                }}
                sx={inputStyle}
                helperText="Required at submission for repairs — auto-populates approved value and description."
              >
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
