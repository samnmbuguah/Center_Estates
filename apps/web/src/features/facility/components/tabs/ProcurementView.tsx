"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { CheckCircle2, FileCheck2, Plus, ShoppingCart, Wrench, X } from "lucide-react";
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

async function downloadPdf(path: string, filename: string, organizationId: string | null) {
  const response = await apiFetch(path, {}, organizationId);
  if (!response.ok) throw new Error(await apiErrorMessage(response, "The document could not be generated."));
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export function ProcurementView({ rows, organizationId, reload, canApprove }: {
  rows: Row[]; organizationId: string | null; reload: () => void; canApprove: boolean;
}) {
  const procurements = rows as Procurement[];
  const [requisitions, setRequisitions] = useState<Row[]>([]);
  const [bidders, setBidders] = useState<Row[]>([]);
  const [lpos, setLpos] = useState<Row[]>([]);
  const [jobCards, setJobCards] = useState<Row[]>([]);
  const [dialog, setDialog] = useState<"start" | "quote" | "award" | "sign" | "cancel-lpo" | null>(null);
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
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}
    >
      <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, gap: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
            <Chip size="small" label="Procurement & Sourcing" sx={{ fontWeight: 800, fontSize: 11, bgcolor: "#fee2e2", color: "#b91c1c" }} />
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Controlled Supplier Lifecycle
            </Typography>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
            Procurement Control Centre
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, maxWidth: 650 }}>
            Compare supplier quotations, document tender awards, issue LPOs, and verify physical Job Card completion without recreating maintenance tickets.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => { setDialog("start"); setForm({}); }}
          sx={{ fontWeight: 700, borderRadius: "8px", px: 2, py: 1 }}
        >
          Open Approved Requisition
        </Button>
      </Stack>
    </Paper>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 1.5 }}>
      {[
        ["Sourcing & evaluation", kpis.queue, ShoppingCart, "#2563eb", "#eff6ff"],
        ["Awaiting LPO", kpis.awards, FileCheck2, "#d97706", "#fef3c7"],
        ["Work in progress", kpis.active, Wrench, "#0284c7", "#e0f2fe"],
        ["Verified completion", kpis.verified, CheckCircle2, "#16a34a", "#dcfce7"],
      ].map(([label, value, Icon, color, bg]) => (
        <Paper key={String(label)} elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #e2e8f0", background: "#ffffff" }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 800, letterSpacing: "0.04em" }}>
              {String(label).toUpperCase()}
            </Typography>
            <Box sx={{ p: 0.75, borderRadius: "6px", bgcolor: String(bg), color: String(color), display: "flex" }}>
              {createElement(Icon as typeof ShoppingCart, { size: 16 })}
            </Box>
          </Stack>
          <Typography variant="h4" sx={{ fontWeight: 900, color: "#0f172a", mt: 1 }}>
            {String(value)}
          </Typography>
        </Paper>
      ))}
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
            {p.quotations.length > 0 && <Button size="small" variant="outlined" onClick={() => void downloadPdf(`/facility/procurements/${p.id}/evaluation-pdf/`, `${p.code}-quotation-evaluation.pdf`, organizationId).catch((e) => setError(e.message))}>Evaluation PDF</Button>}
            {["sourcing", "evaluation"].includes(p.status) && <Button size="small" variant="outlined" onClick={() => { setTarget(p); setDialog("quote"); setForm({}); }}>Add quotation</Button>}
            {p.status === "evaluation" && p.quotations.length > 0 && canApprove && <Button size="small" variant="contained" color="warning" onClick={() => { setTarget(p); setDialog("award"); setForm({ quotation: String(p.quotations[0].id) }); }}>Evaluate & award</Button>}
            {p.status === "awarded" && canApprove && <Button size="small" variant="contained" onClick={() => void act(`/facility/procurements/${p.id}/issue-lpo/`, { payment_terms: "30 days after verified completion" })}>Issue LPO</Button>}
            {p.status === "lpo_issued" && lpos.find((lpo) => lpo.procurement_code === p.code && lpo.status === "issued") && canApprove && <Button size="small" color="success" variant="outlined" onClick={() => { const lpo = lpos.find((item) => item.procurement_code === p.code); if (lpo) void act(`/facility/lpos/${String(lpo.id)}/accept/`); }}>Record LPO acceptance</Button>}
            {p.status === "lpo_issued" && lpos.find((lpo) => lpo.procurement_code === p.code) && <Button size="small" variant="contained" onClick={() => void act(`/facility/lpos/${String(lpos.find((lpo) => lpo.procurement_code === p.code)?.id)}/generate-job-card/`)}>Generate Job Card</Button>}
            {p.lpo_number && <Button size="small" variant="outlined" onClick={() => { const lpo = lpos.find((item) => item.procurement_code === p.code); if (lpo) void downloadPdf(`/facility/lpos/${String(lpo.id)}/pdf/`, `${p.lpo_number}.pdf`, organizationId).catch((e) => setError(e.message)); }}>Download LPO</Button>}
            {p.job_card_number && <Button size="small" variant="outlined" onClick={() => { const card = jobCards.find((item) => item.procurement_code === p.code); if (card) void downloadPdf(`/facility/job-cards/${String(card.id)}/pdf/`, `${p.job_card_number}.pdf`, organizationId).catch((e) => setError(e.message)); }}>Download Job Card</Button>}
            {p.status === "lpo_issued" && !p.job_card_number && lpos.find((lpo) => lpo.procurement_code === p.code && ["issued", "accepted"].includes(String(lpo.status))) && canApprove && <Button size="small" color="error" onClick={() => { const lpo = lpos.find((item) => item.procurement_code === p.code); setTarget(p); setForm({ lpo: String(lpo?.id || ""), reason: "" }); setDialog("cancel-lpo"); }}>Cancel LPO</Button>}
            {p.status === "in_execution" && jobCards.find((card) => card.procurement_code === p.code) && <Button size="small" variant="contained" color="success" onClick={() => { const card = jobCards.find((item) => item.procurement_code === p.code); setTarget(p); setDialog("sign"); setForm({ card: String(card?.id), stage: String(card?.status) }); }}>Continue Job Card</Button>}
          </Stack>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(5,minmax(0,1fr))" }, gap: .75, mt: 1.5 }} aria-label={`Workflow progress for ${p.code}`}>
          {["Requisition", "Sourcing", "LPO", "Execution", "Verified"].map((label, index) => {
            const rank: Record<string, number> = { sourcing: 1, evaluation: 1, awarded: 1, lpo_issued: 2, in_execution: 3, verified: 4 };
            const complete = index <= (rank[p.status] ?? 0);
            return <Box key={label} sx={{ borderRadius: 1.5, px: 1, py: .65, textAlign: "center", fontSize: 11, fontWeight: 800, color: complete ? "var(--color-info-strong)" : "text.secondary", background: complete ? "rgba(37,99,235,.10)" : "action.hover", border: "1px solid", borderColor: complete ? "rgba(37,99,235,.24)" : "divider" }}>{complete ? "✓ " : ""}{label}</Box>;
          })}
        </Box>
        {p.quotations.length > 0 && <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: "wrap" }}>{p.quotations.map((q) => <Chip key={q.id} size="small" color={q.is_awarded ? "success" : "default"} label={`${q.bidder_name} · ${money.format(Number(q.total))}`} />)}</Stack>}
      </Box>)}
    </Paper>

    <Dialog
      open={dialog === "start"}
      onClose={() => setDialog(null)}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: "14px", overflow: "hidden" } } }}
    >
      <DialogTitle sx={{ m: 0, p: 2.5, pb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #f1f5f9" }}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
            <Box sx={{ p: 0.75, borderRadius: "8px", bgcolor: "#fee2e2", color: "#dc2626", display: "flex" }}>
              <ShoppingCart size={18} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 850, fontSize: "1.1rem" }}>
              Open Procurement from Requisition
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.82rem" }}>
            Select an approved purchase requisition to open competitive vendor sourcing, quotations, and LPO issuance.
          </Typography>
        </Box>
        <IconButton onClick={() => setDialog(null)} size="small" sx={{ color: "#94a3b8" }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
        {requisitions.length === 0 ? (
          <Alert severity="info" icon={<FileCheck2 size={20} />} sx={{ borderRadius: "10px", py: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
              No Approved Requisitions Awaiting Sourcing
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", fontSize: 13, lineHeight: 1.5 }}>
              All current maintenance requisitions have either already been opened for procurement or are still in review. 
              To create a new procurement, submit and approve a requisition under the <strong>Maintenance → Requisitions</strong> tab first.
            </Typography>
          </Alert>
        ) : (
          <>
            <TextField
              select
              fullWidth
              label="Select Approved Requisition"
              value={form.requisition ?? ""}
              onChange={(e) => setForm({ ...form, requisition: e.target.value })}
              helperText="Select a requisition to automatically import items, location, and allocated budget."
              sx={{ mt: 1 }}
            >
              {requisitions.map((r) => (
                <MenuItem key={String(r.id)} value={String(r.id)} sx={{ py: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{String(r.code)}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{String(r.title)}</Typography>
                    </Box>
                    {Boolean(r.estimated_cost) && (
                      <Chip size="small" label={money.format(Number(r.estimated_cost))} sx={{ fontSize: 11, fontWeight: 700, height: 22 }} />
                    )}
                  </Stack>
                </MenuItem>
              ))}
            </TextField>

            {(() => {
              const selectedReq = requisitions.find((r) => String(r.id) === form.requisition);
              if (!selectedReq) return null;
              return (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: "10px", bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Selected Requisition Overview
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 850, mt: 0.5, color: "#0f172a" }}>
                    {String(selectedReq.title)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#64748b", fontSize: 12, mb: 1.5 }}>
                    Code: <strong>{String(selectedReq.code)}</strong> {selectedReq.property_name ? `· Property: ${String(selectedReq.property_name)}` : ""}
                  </Typography>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, pt: 1.5, borderTop: "1px solid #e2e8f0", fontSize: 12 }}>
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Estimated Budget</span>
                      <strong style={{ fontSize: 14, color: "#16a34a" }}>
                        {selectedReq.estimated_cost ? money.format(Number(selectedReq.estimated_cost)) : "To be quoted"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Priority</span>
                      <Chip
                        size="small"
                        label={String(selectedReq.priority || "Normal").toUpperCase()}
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 800,
                          bgcolor: String(selectedReq.priority).toLowerCase() === "emergency" ? "#fee2e2" : "#eff6ff",
                          color: String(selectedReq.priority).toLowerCase() === "emergency" ? "#b91c1c" : "#1d4ed8",
                        }}
                      />
                    </div>
                    {Boolean(selectedReq.required_repair) && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <span style={{ color: "#64748b", display: "block" }}>Scope of Work / Items</span>
                        <Typography variant="body2" sx={{ color: "#334155", mt: 0.25, fontSize: 12 }}>
                          {String(selectedReq.required_repair)}
                        </Typography>
                      </div>
                    )}
                  </Box>
                </Paper>
              );
            })()}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1.5, borderTop: "1px solid #f1f5f9" }}>
        <Button onClick={() => setDialog(null)} variant="outlined">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!form.requisition || busy || requisitions.length === 0}
          onClick={() => void act("/facility/procurements/", { requisition: form.requisition })}
          startIcon={<ShoppingCart size={15} />}
        >
          {busy ? "Opening..." : "Open Procurement"}
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={dialog === "quote"} onClose={() => setDialog(null)} fullWidth maxWidth="md"><DialogTitle>Record supplier quotation</DialogTitle><DialogContent><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mt: 1 }}>
      <TextField select label="Bidder" value={form.bidder ?? ""} onChange={(e) => setForm({ ...form, bidder: e.target.value })}>{bidders.map((b) => <MenuItem key={String(b.id)} value={String(b.id)}>{String(b.name)}</MenuItem>)}</TextField>
      <TextField label="Quotation number" value={form.quotation_number ?? ""} onChange={(e) => setForm({ ...form, quotation_number: e.target.value })}/><TextField type="date" label="Quotation date" slotProps={{ inputLabel: { shrink: true } }} value={form.quoted_on ?? ""} onChange={(e) => setForm({ ...form, quoted_on: e.target.value })}/><TextField type="number" label="Lead time (days)" value={form.lead_time_days ?? ""} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}/><TextField type="number" label="Subtotal (KES)" value={form.subtotal ?? ""} onChange={(e) => setForm({ ...form, subtotal: e.target.value })}/><TextField type="number" label="VAT (KES)" value={form.vat_amount ?? ""} onChange={(e) => setForm({ ...form, vat_amount: e.target.value })}/></Box></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="contained" disabled={!target || !form.bidder || !form.quotation_number || !form.subtotal || busy} onClick={() => void act(`/facility/procurements/${target?.id}/add-quotation/`, { ...form, total: Number(form.subtotal || 0) + Number(form.vat_amount || 0) })}>Save quotation</Button></DialogActions></Dialog>

    <Dialog open={dialog === "award"} onClose={() => setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>Evaluation and award decision</DialogTitle><DialogContent><TextField select fullWidth margin="normal" label="Recommended quotation" value={form.quotation ?? ""} onChange={(e) => setForm({ ...form, quotation: e.target.value })}>{target?.quotations.map((q) => <MenuItem key={q.id} value={q.id}>{q.bidder_name} · {money.format(Number(q.total))}</MenuItem>)}</TextField><TextField fullWidth multiline minRows={3} margin="normal" label="Award reason and value-for-money assessment" value={form.reason ?? ""} onChange={(e) => setForm({ ...form, reason: e.target.value })}/></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="contained" color="warning" disabled={!form.quotation || !form.reason || busy} onClick={() => void act(`/facility/procurements/${target?.id}/award/`, form)}>Record award</Button></DialogActions></Dialog>

    <Dialog open={dialog === "sign"} onClose={() => setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>Job Card execution and sign-off</DialogTitle><DialogContent><Alert severity="info" sx={{ my: 1 }}>Required order: start work → contractor sign-off → caretaker sign-off → manager verification.</Alert><Divider sx={{ my: 2 }}/><TextField fullWidth label="Signatory" value={form.signatory ?? ""} onChange={(e) => setForm({ ...form, signatory: e.target.value })}/><TextField fullWidth multiline minRows={2} margin="normal" label="Completion / verification notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Close</Button>{form.stage === "open" && <Button variant="contained" onClick={() => void act(`/facility/job-cards/${form.card}/start/`)}>Start work</Button>}{form.stage === "in_progress" && <Button variant="contained" disabled={!form.signatory} onClick={() => void act(`/facility/job-cards/${form.card}/contractor-sign/`, { signatory: form.signatory, completion_notes: form.notes })}>Contractor sign</Button>}{form.stage === "contractor_signed" && <Button variant="contained" disabled={!form.signatory} onClick={() => void act(`/facility/job-cards/${form.card}/caretaker-sign/`, { signatory: form.signatory })}>Caretaker sign</Button>}{form.stage === "caretaker_signed" && canApprove && <Button variant="contained" color="success" onClick={() => void act(`/facility/job-cards/${form.card}/verify/`, { notes: form.notes })}>Verify completion</Button>}</DialogActions></Dialog>
    <Dialog open={dialog === "cancel-lpo"} onClose={() => setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>Cancel Local Purchase Order</DialogTitle><DialogContent><Alert severity="warning" sx={{ my: 1 }}>Cancellation returns the procurement to the awarded stage. It is blocked after a Job Card has been created.</Alert><TextField fullWidth required multiline minRows={3} margin="normal" label="Cancellation reason" value={form.reason ?? ""} onChange={(e) => setForm({ ...form, reason: e.target.value })}/></DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Keep LPO</Button><Button variant="contained" color="error" disabled={!form.reason?.trim() || busy} onClick={() => void act(`/facility/lpos/${form.lpo}/cancel/`, { reason: form.reason })}>Confirm cancellation</Button></DialogActions></Dialog>
  </Box>;
}
