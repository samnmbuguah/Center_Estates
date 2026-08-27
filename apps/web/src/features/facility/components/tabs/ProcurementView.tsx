"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { CheckCircle2, FileCheck2, Plus, ShoppingCart, Wrench } from "lucide-react";
import { EmptyState, StatusPill, money } from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import type { Row } from "../../types/facility.types";

type Procurement = Row & {
  id: string; code: string; requisition_code: string; requisition_title: string; property_name: string;
  status: string; quotations: Array<Row & { id: string; bidder_name: string; total: string; quotation_number: string; is_awarded: boolean }>;
  lpo_number?: string; job_card_number?: string;
};

async function post(path: string, payload: unknown, organizationId: string | null) {
  await apiFetch("/auth/csrf/");
  return apiFetch(path, {
    method: "POST",
    headers: { "X-CSRFToken": csrfFromCookie(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, organizationId);
}

export function ProcurementView({ rows, organizationId, reload, canApprove }: {
  rows: Row[]; organizationId: string | null; reload: () => void; canApprove: boolean;
}) {
  const procurements = rows as Procurement[];
  const [requisitions, setRequisitions] = useState<Row[]>([]);
  const [bidders, setBidders] = useState<Row[]>([]);
  const [lpos, setLpos] = useState<Row[]>([]);
  const [jobCards, setJobCards] = useState<Row[]>([]);
  const [dialog, setDialog] = useState<"start" | "quote" | "award" | "sign" | null>(null);
  const [target, setTarget] = useState<Procurement | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadSupporting() {
    if (!organizationId) return;
    const [req, bidder, po, cards] = await Promise.all([
      apiFetch("/facility/requisitions/", {}, organizationId),
      apiFetch("/facility/contractors/", {}, organizationId),
      apiFetch("/facility/lpos/", {}, organizationId),
      apiFetch("/facility/job-cards/", {}, organizationId),
    ]);
    if (req.ok) { const data = await req.json(); setRequisitions((Array.isArray(data) ? data : data.results ?? []).filter((r: Row) => r.status === "approved" && !r.procurement)); }
    if (bidder.ok) { const data = await bidder.json(); setBidders(Array.isArray(data) ? data : data.results ?? []); }
    if (po.ok) { const data = await po.json(); setLpos(Array.isArray(data) ? data : data.results ?? []); }
    if (cards.ok) { const data = await cards.json(); setJobCards(Array.isArray(data) ? data : data.results ?? []); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSupporting(), 0);
    return () => window.clearTimeout(timer);
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => ({
    queue: procurements.filter((p) => ["sourcing", "evaluation"].includes(p.status)).length,
    awards: procurements.filter((p) => p.status === "awarded").length,
    active: procurements.filter((p) => ["lpo_issued", "in_execution"].includes(p.status)).length,
    verified: procurements.filter((p) => p.status === "verified").length,
  }), [procurements]);

  async function act(path: string, payload: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try {
      const response = await post(path, payload, organizationId);
      if (!response.ok) { setError(await apiErrorMessage(response, "The procurement action could not be completed.")); return; }
      setDialog(null); setForm({}); setTarget(null); reload(); await loadSupporting();
    } finally { setBusy(false); }
  }

  return <Box sx={{ display: "grid", gap: 2.25 }}>
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, background: "linear-gradient(135deg, rgba(37,99,235,.08), rgba(14,165,233,.04))" }}>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 900 }}>Approved requisition onward</Typography>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Procurement control centre</Typography>
          <Typography color="text.secondary">Compare quotations, document the award, issue the LPO and verify physical completion without recreating the ticket.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => { setDialog("start"); setForm({}); }}>Open approved requisition</Button>
      </Stack>
    </Paper>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 1.5 }}>
      {[
        ["Sourcing & evaluation", kpis.queue, ShoppingCart, "primary.main"],
        ["Awaiting LPO", kpis.awards, FileCheck2, "warning.main"],
        ["Work in progress", kpis.active, Wrench, "info.main"],
        ["Verified completion", kpis.verified, CheckCircle2, "success.main"],
      ].map(([label, value, Icon, color]) => <Paper key={String(label)} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>{String(label).toUpperCase()}</Typography><Icon size={19} /></Stack>
        <Typography variant="h4" sx={{ fontWeight: 900, color: String(color) }}>{String(value)}</Typography>
      </Paper>)}
    </Box>

    {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}><Typography sx={{ fontWeight: 900 }}>Live procurement pipeline</Typography><Typography variant="body2" color="text.secondary">Every row retains the requisition, property, quotation, LPO and Job Card chain.</Typography></Box>
      {procurements.length === 0 ? <EmptyState title="No procurement records" description="Open an approved requisition to begin controlled sourcing." /> : procurements.map((p) => <Box key={p.id} sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}><Typography sx={{ fontWeight: 900 }}>{p.code}</Typography><StatusPill value={p.status} /><Chip size="small" label={`${p.quotations.length} quote${p.quotations.length === 1 ? "" : "s"}`} /></Stack>
            <Typography sx={{ fontWeight: 800 }}>{p.requisition_title}</Typography>
            <Typography variant="body2" color="text.secondary">{p.requisition_code} · {p.property_name}{p.lpo_number ? ` · ${p.lpo_number}` : ""}{p.job_card_number ? ` · ${p.job_card_number}` : ""}</Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {["sourcing", "evaluation"].includes(p.status) && <Button size="small" variant="outlined" onClick={() => { setTarget(p); setDialog("quote"); setForm({}); }}>Add quotation</Button>}
            {p.status === "evaluation" && p.quotations.length > 0 && canApprove && <Button size="small" variant="contained" color="warning" onClick={() => { setTarget(p); setDialog("award"); setForm({ quotation: String(p.quotations[0].id) }); }}>Evaluate & award</Button>}
            {p.status === "awarded" && canApprove && <Button size="small" variant="contained" onClick={() => void act(`/facility/procurements/${p.id}/issue-lpo/`, { payment_terms: "30 days after verified completion" })}>Issue LPO</Button>}
            {p.status === "lpo_issued" && lpos.find((lpo) => lpo.procurement_code === p.code) && <Button size="small" variant="contained" onClick={() => void act(`/facility/lpos/${String(lpos.find((lpo) => lpo.procurement_code === p.code)?.id)}/generate-job-card/`)}>Generate Job Card</Button>}
            {p.status === "in_execution" && jobCards.find((card) => card.procurement_code === p.code) && <Button size="small" variant="contained" color="success" onClick={() => { const card = jobCards.find((item) => item.procurement_code === p.code); setTarget(p); setDialog("sign"); setForm({ card: String(card?.id), stage: String(card?.status) }); }}>Continue Job Card</Button>}
          </Stack>
        </Stack>
        {p.quotations.length > 0 && <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: "wrap" }}>{p.quotations.map((q) => <Chip key={q.id} size="small" color={q.is_awarded ? "success" : "default"} label={`${q.bidder_name} · ${money.format(Number(q.total))}`} />)}</Stack>}
      </Box>)}
    </Paper>

    <Dialog open={dialog === "start"} onClose={() => setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>Open procurement from requisition</DialogTitle><DialogContent><TextField select fullWidth margin="normal" label="Approved requisition" value={form.requisition ?? ""} onChange={(e) => setForm({ ...form, requisition: e.target.value })}>{requisitions.map((r) => <MenuItem key={String(r.id)} value={String(r.id)}>{String(r.code)} · {String(r.title)}</MenuItem>)}</TextField></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="contained" disabled={!form.requisition || busy} onClick={() => void act("/facility/procurements/", { requisition: form.requisition })}>Open procurement</Button></DialogActions></Dialog>

    <Dialog open={dialog === "quote"} onClose={() => setDialog(null)} fullWidth maxWidth="md"><DialogTitle>Record supplier quotation</DialogTitle><DialogContent><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mt: 1 }}>
      <TextField select label="Bidder" value={form.bidder ?? ""} onChange={(e) => setForm({ ...form, bidder: e.target.value })}>{bidders.map((b) => <MenuItem key={String(b.id)} value={String(b.id)}>{String(b.name)}</MenuItem>)}</TextField>
      <TextField label="Quotation number" value={form.quotation_number ?? ""} onChange={(e) => setForm({ ...form, quotation_number: e.target.value })}/><TextField type="date" label="Quotation date" InputLabelProps={{ shrink: true }} value={form.quoted_on ?? ""} onChange={(e) => setForm({ ...form, quoted_on: e.target.value })}/><TextField type="number" label="Lead time (days)" value={form.lead_time_days ?? ""} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}/><TextField type="number" label="Subtotal (KES)" value={form.subtotal ?? ""} onChange={(e) => setForm({ ...form, subtotal: e.target.value })}/><TextField type="number" label="VAT (KES)" value={form.vat_amount ?? ""} onChange={(e) => setForm({ ...form, vat_amount: e.target.value })}/></Box></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="contained" disabled={!target || !form.bidder || !form.quotation_number || !form.subtotal || busy} onClick={() => void act(`/facility/procurements/${target?.id}/add-quotation/`, { ...form, total: Number(form.subtotal || 0) + Number(form.vat_amount || 0) })}>Save quotation</Button></DialogActions></Dialog>

    <Dialog open={dialog === "award"} onClose={() => setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>Evaluation and award decision</DialogTitle><DialogContent><TextField select fullWidth margin="normal" label="Recommended quotation" value={form.quotation ?? ""} onChange={(e) => setForm({ ...form, quotation: e.target.value })}>{target?.quotations.map((q) => <MenuItem key={q.id} value={q.id}>{q.bidder_name} · {money.format(Number(q.total))}</MenuItem>)}</TextField><TextField fullWidth multiline minRows={3} margin="normal" label="Award reason and value-for-money assessment" value={form.reason ?? ""} onChange={(e) => setForm({ ...form, reason: e.target.value })}/></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="contained" color="warning" disabled={!form.quotation || !form.reason || busy} onClick={() => void act(`/facility/procurements/${target?.id}/award/`, form)}>Record award</Button></DialogActions></Dialog>

    <Dialog open={dialog === "sign"} onClose={() => setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>Job Card execution and sign-off</DialogTitle><DialogContent><Alert severity="info" sx={{ my: 1 }}>Required order: start work → contractor sign-off → caretaker sign-off → manager verification.</Alert><Divider sx={{ my: 2 }}/><TextField fullWidth label="Signatory" value={form.signatory ?? ""} onChange={(e) => setForm({ ...form, signatory: e.target.value })}/><TextField fullWidth multiline minRows={2} margin="normal" label="Completion / verification notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Close</Button>{form.stage === "open" && <Button variant="contained" onClick={() => void act(`/facility/job-cards/${form.card}/start/`)}>Start work</Button>}{form.stage === "in_progress" && <Button variant="contained" disabled={!form.signatory} onClick={() => void act(`/facility/job-cards/${form.card}/contractor-sign/`, { signatory: form.signatory, completion_notes: form.notes })}>Contractor sign</Button>}{form.stage === "contractor_signed" && <Button variant="contained" disabled={!form.signatory} onClick={() => void act(`/facility/job-cards/${form.card}/caretaker-sign/`, { signatory: form.signatory })}>Caretaker sign</Button>}{form.stage === "caretaker_signed" && canApprove && <Button variant="contained" color="success" onClick={() => void act(`/facility/job-cards/${form.card}/verify/`, { notes: form.notes })}>Verify completion</Button>}</DialogActions></Dialog>
  </Box>;
}
