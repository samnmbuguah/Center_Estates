"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Paper, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import { Banknote, CheckCircle2, FileClock, Plus, ReceiptText } from "lucide-react";
import { EmptyState, StatusPill, money } from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import type { FacilityTab, Row } from "../../types/facility.types";

async function post(path: string, payload: unknown, organizationId: string | null) {
  await apiFetch("/auth/csrf/");
  return apiFetch(path, { method: "POST", headers: { "X-CSRFToken": csrfFromCookie(), "Content-Type": "application/json" }, body: JSON.stringify(payload) }, organizationId);
}

export function FinanceControlView({ rows, organizationId, reload, canApprove, setTab }: {
  rows: Row[]; organizationId: string | null; reload: () => void; canApprove: boolean; setTab: (tab: FacilityTab) => void;
}) {
  const [section, setSection] = useState<"requests" | "appraisals" | "payments">("requests");
  const [appraisals, setAppraisals] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [properties, setProperties] = useState<Row[]>([]);
  const [dialog, setDialog] = useState<"request" | "appraisal" | "pay" | null>(null);
  const [target, setTarget] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function supporting() {
    if (!organizationId) return;
    const [a, p, props] = await Promise.all([
      apiFetch("/facility/contract-invoice-appraisals/", {}, organizationId),
      apiFetch("/facility/payments/", {}, organizationId),
      apiFetch("/property/properties/", {}, organizationId),
    ]);
    if (a.ok) { const data = await a.json(); setAppraisals(Array.isArray(data) ? data : data.results ?? []); }
    if (p.ok) { const data = await p.json(); setPayments(Array.isArray(data) ? data : data.results ?? []); }
    if (props.ok) { const data = await props.json(); setProperties(Array.isArray(data) ? data : data.results ?? []); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void supporting(), 0);
    return () => window.clearTimeout(timer);
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => ({
    pending: rows.filter((r) => ["submitted", "approved"].includes(String(r.status))).length,
    appraisal: appraisals.filter((a) => a.status !== "approved" && a.status !== "rejected").length,
    processing: rows.filter((r) => r.status === "processing").length,
    paid: payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
  }), [rows, appraisals, payments]);

  async function act(path: string, payload: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try {
      const response = await post(path, payload, organizationId);
      if (!response.ok) { setError(await apiErrorMessage(response, "The Finance action could not be completed.")); return; }
      setDialog(null); setTarget(null); setForm({}); reload(); await supporting();
    } finally { setBusy(false); }
  }

  return <Box sx={{ display: "grid", gap: 2.25 }}>
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, background: "linear-gradient(135deg, rgba(5,150,105,.09), rgba(14,165,233,.04))" }}>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", gap: 2 }}>
        <Box><Typography variant="overline" sx={{ color: "success.main", fontWeight: 900 }}>Central invoice and payment control</Typography><Typography variant="h5" sx={{ fontWeight: 900 }}>Facility Finance workspace</Typography><Typography color="text.secondary">Separate procurement invoices, contracted-service appraisals and independent obligations while posting every completed payment to expenses.</Typography></Box>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}><Button variant="outlined" startIcon={<ReceiptText size={17}/>} onClick={() => setTab("supplier-invoices")}>Invoice processing</Button><Button variant="contained" startIcon={<Plus size={17}/>} onClick={() => { setDialog("request"); setForm({ category: "statutory" }); }}>New payment request</Button></Stack>
      </Stack>
    </Paper>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 1.5 }}>{[
      ["Awaiting approval", kpis.pending, FileClock], ["Appraisals pending", kpis.appraisal, CheckCircle2], ["Finance processing", kpis.processing, Banknote], ["Payments posted", money.format(kpis.paid), ReceiptText],
    ].map(([label, value, Icon]) => <Paper key={String(label)} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>{String(label).toUpperCase()}</Typography>{createElement(Icon as typeof FileClock, { size: 18 })}</Stack><Typography variant="h5" sx={{ fontWeight: 900 }}>{String(value)}</Typography></Paper>)}</Box>
    {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}><Tabs value={section} onChange={(_, value) => setSection(value)} variant="scrollable" sx={{ px: 1, borderBottom: "1px solid", borderColor: "divider" }}><Tab value="requests" label="Other payment requests"/><Tab value="appraisals" label="Contract appraisals"/><Tab value="payments" label="Payments & expense posting"/></Tabs>
      {section === "requests" && <Box>{rows.length === 0 ? <EmptyState title="No payment requests" description="Create statutory, utility, tax, licence, refund or other approved obligations here."/> : rows.map((r) => <Stack key={String(r.id)} direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", gap: 1.5,  p: 2, borderBottom: "1px solid", borderColor: "divider" }}><Box><Stack direction="row" sx={{ gap: 1 }}><Typography sx={{ fontWeight: 900 }}>{String(r.number)}</Typography><StatusPill value={String(r.status)}/></Stack><Typography sx={{ fontWeight: 800 }}>{String(r.payee)} · {money.format(Number(r.amount))}</Typography><Typography variant="body2" color="text.secondary">{String(r.description)} · due {String(r.due_date)}</Typography></Box><Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>{r.status === "draft" && <Button size="small" variant="outlined" onClick={() => void act(`/facility/payment-requests/${String(r.id)}/submit/`)}>Submit</Button>}{r.status === "submitted" && canApprove && <Button size="small" variant="contained" onClick={() => void act(`/facility/payment-requests/${String(r.id)}/approve/`)}>Approve</Button>}{r.status === "approved" && canApprove && <Button size="small" variant="contained" onClick={() => void act(`/facility/payment-requests/${String(r.id)}/start-processing/`)}>Start processing</Button>}{r.status === "processing" && canApprove && <Button size="small" variant="contained" color="success" onClick={() => { setTarget(r); setDialog("pay"); }}>Record payment</Button>}</Stack></Stack>)}</Box>}
      {section === "appraisals" && <Box>{appraisals.length === 0 ? <EmptyState title="No contract appraisals" description="A recurring supplier invoice automatically creates its contract and performance appraisal."/> : appraisals.map((a) => <Stack key={String(a.id)} direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", gap: 1.5,  p: 2, borderBottom: "1px solid", borderColor: "divider" }}><Box><Stack direction="row" sx={{ gap: 1 }}><Typography sx={{ fontWeight: 900 }}>{String(a.invoice_code)}</Typography><StatusPill value={String(a.status)}/></Stack><Typography sx={{ fontWeight: 800 }}>{String(a.supplier_name)} · {String(a.contract_number)}</Typography><Typography variant="body2" color="text.secondary">Contract {a.contract_valid ? "valid" : "invalid"} · mapping {a.service_mapping_valid ? "verified" : "requires attention"} · score {String(a.average_score)}/5</Typography></Box><Stack direction="row" sx={{ gap: 1 }}>{a.status === "pending_caretaker" && <Button size="small" variant="contained" onClick={() => { setTarget(a); setDialog("appraisal"); setForm({ quality_score: "5", timeliness_score: "5", responsiveness_score: "5" }); }}>Caretaker review</Button>}{a.status === "pending_manager" && canApprove && <Button size="small" variant="contained" color="success" onClick={() => void act(`/facility/contract-invoice-appraisals/${String(a.id)}/manager-approve/`)}>Manager approve</Button>}</Stack></Stack>)}</Box>}
      {section === "payments" && <Box>{payments.length === 0 ? <EmptyState title="No processed payments" description="Paid supplier invoices and approved payment requests appear here with their expense record."/> : payments.map((p) => <Stack key={String(p.id)} direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between",  p: 2, borderBottom: "1px solid", borderColor: "divider" }}><Box><Typography sx={{ fontWeight: 900 }}>{String(p.number)} · {String(p.payee)}</Typography><Typography variant="body2" color="text.secondary">Source {String(p.source_reference)} · {String(p.reference)} · {String(p.paid_on)}</Typography></Box><Typography sx={{ fontWeight: 900, color: "success.main" }}>{money.format(Number(p.amount))}</Typography></Stack>)}</Box>}
    </Paper>

    <Dialog open={dialog === "request"} onClose={() => setDialog(null)} fullWidth maxWidth="md"><DialogTitle>Create independent payment request</DialogTitle><DialogContent><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mt: 1 }}><TextField select label="Category" value={form.category ?? "statutory"} onChange={(e) => setForm({...form, category:e.target.value})}>{["statutory","tax","licence","utility","fee","refund","other"].map(v=><MenuItem key={v} value={v}>{v.replace("_"," ")}</MenuItem>)}</TextField><TextField select label="Property" value={form.property ?? ""} onChange={(e)=>setForm({...form,property:e.target.value})}><MenuItem value="">Organization-wide</MenuItem>{properties.map(p=><MenuItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</MenuItem>)}</TextField><TextField label="Payee" value={form.payee??""} onChange={(e)=>setForm({...form,payee:e.target.value})}/><TextField type="number" label="Amount (KES)" value={form.amount??""} onChange={(e)=>setForm({...form,amount:e.target.value})}/><TextField type="date" label="Due date" slotProps={{ inputLabel: { shrink: true } }} value={form.due_date??""} onChange={(e)=>setForm({...form,due_date:e.target.value})}/><TextField label="Reference" value={form.statutory_reference??""} onChange={(e)=>setForm({...form,statutory_reference:e.target.value})}/><TextField sx={{gridColumn:{sm:"1 / -1"}}} multiline minRows={2} label="Description" value={form.description??""} onChange={(e)=>setForm({...form,description:e.target.value})}/><TextField sx={{gridColumn:{sm:"1 / -1"}}} label="Supporting document URL" helperText="Document upload integration stores the resulting URL here." value={form.document??""} onChange={(e)=>setForm({...form,document:e.target.value})}/></Box></DialogContent><DialogActions><Button onClick={()=>setDialog(null)}>Cancel</Button><Button variant="contained" disabled={!form.payee||!form.amount||!form.due_date||!form.description||!form.document||busy} onClick={()=>void act("/facility/payment-requests/", {...form, property:form.property||null, supporting_documents:[form.document]})}>Save draft</Button></DialogActions></Dialog>
    <Dialog open={dialog === "appraisal"} onClose={()=>setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>Caretaker performance appraisal</DialogTitle><DialogContent><Stack sx={{ gap: 1.5, mt: 1 }}>{[["quality_score","Quality"],["timeliness_score","Timeliness"],["responsiveness_score","Responsiveness"]].map(([key,label])=><TextField key={key} select label={`${label} score`} value={form[key]??"5"} onChange={(e)=>setForm({...form,[key]:e.target.value})}>{[1,2,3,4,5].map(v=><MenuItem key={v} value={String(v)}>{v} / 5</MenuItem>)}</TextField>)}<TextField multiline minRows={2} label="Service observations" value={form.notes??""} onChange={(e)=>setForm({...form,notes:e.target.value})}/></Stack></DialogContent><DialogActions><Button onClick={()=>setDialog(null)}>Cancel</Button><Button variant="contained" disabled={busy} onClick={()=>void act(`/facility/contract-invoice-appraisals/${String(target?.id)}/caretaker-sign/`, form)}>Sign appraisal</Button></DialogActions></Dialog>
    <Dialog open={dialog === "pay"} onClose={()=>setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>Record Finance payment</DialogTitle><DialogContent><TextField fullWidth margin="normal" label="Bank / payment reference" value={form.payment_reference??""} onChange={(e)=>setForm({...form,payment_reference:e.target.value})}/></DialogContent><DialogActions><Button onClick={()=>setDialog(null)}>Cancel</Button><Button variant="contained" color="success" disabled={!form.payment_reference||busy} onClick={()=>void act(`/facility/payment-requests/${String(target?.id)}/mark-paid/`, form)}>Post payment & expense</Button></DialogActions></Dialog>
  </Box>;
}
