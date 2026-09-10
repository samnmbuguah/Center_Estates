"use client";

import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  LinearProgress, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { Plus, CheckCircle, X, Send, Download } from "lucide-react";
import { EmptyState, StatusPill, money } from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import type { FacilityTab, Row } from "../../types/facility.types";

type Requisition = {
  id: string; code: string; title: string; location: string; property_name: string;
  unit_code: string; issue_description: string; required_repair: string;
  quotation_specification: string; estimated_cost: string | null; priority: string;
  status: string; required_by: string | null; requester_name: string;
  manager_notes: string; rejected_reason: string; provider_name: string;
  service_request_reference: string; work_order_number: string;
};

async function post(path: string, payload: unknown, organizationId: string | null) {
  await apiFetch("/auth/csrf/");
  return apiFetch(path, { method: "POST", headers: { "X-CSRFToken": csrfFromCookie(), "Content-Type": "application/json" }, body: JSON.stringify(payload) }, organizationId);
}

export function RequisitionsView({ rows, loading, error, search, setSearch, organizationId, propertyOptions, canWork, canApprove, reload, setTab }: {
  rows: Row[]; loading: boolean; error: string; search: string; setSearch: (v: string) => void;
  organizationId: string | null; propertyOptions: Row[]; canWork: boolean; canApprove: boolean;
  reload: () => void; setTab: (t: FacilityTab) => void;
}) {
  const requisitions = rows as unknown as Requisition[];
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Requisition | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [localPropertyOptions, setLocalPropertyOptions] = useState<Row[]>(propertyOptions);
  const [form, setForm] = useState({
    title: "", property: "", location: "", issue_description: "", required_repair: "",
    quotation_specification: "", estimated_cost: "", priority: "medium", required_by: "",
  });

  async function downloadRequisitionPdf(r: Requisition) {
    try {
      const res = await apiFetch(`/facility/requisitions/${r.id}/pdf/`, {}, organizationId);
      if (!res.ok) {
        setActionError(await apiErrorMessage(res, "Requisition PDF could not be generated."));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `Requisition-${r.code || r.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionError("Failed to download requisition PDF.");
    }
  }

  const kpis = useMemo(() => ({
    total: requisitions.length,
    pending: requisitions.filter(r => r.status === "submitted").length,
    approved: requisitions.filter(r => r.status === "approved").length,
    converted: requisitions.filter(r => r.status === "converted").length,
  }), [requisitions]);

  async function runAction(r: Requisition, action: string, payload: Record<string, unknown> = {}) {
    setBusy(`${r.id}:${action}`); setActionError("");
    try {
      const res = await post(`/facility/requisitions/${r.id}/${action}/`, payload, organizationId);
      if (!res.ok) { setActionError(await apiErrorMessage(res, `${action} failed.`)); return; }
      setRejectTarget(null); setRejectReason("");
      reload();
    } finally { setBusy(""); }
  }

  async function openCreate() {
    setCreateOpen(true);
    if (localPropertyOptions.length === 0 && organizationId) {
      const res = await apiFetch("/property/properties/", {}, organizationId);
      if (res.ok) { const d = await res.json(); setLocalPropertyOptions(Array.isArray(d) ? d : d.results ?? []); }
    }
  }

  async function createRequisition() {
    if (!form.title.trim() || !form.property || !form.issue_description.trim() || !form.required_repair.trim()) return;
    setBusy("create"); setActionError("");
    try {
      const res = await post("/facility/requisitions/", {
        title: form.title, property: form.property, location: form.location,
        issue_description: form.issue_description, required_repair: form.required_repair,
        quotation_specification: form.quotation_specification,
        estimated_cost: form.estimated_cost || null,
        priority: form.priority, required_by: form.required_by || null,
      }, organizationId);
      if (!res.ok) { setActionError(await apiErrorMessage(res, "Could not create requisition.")); return; }
      setCreateOpen(false);
      setForm({ title: "", property: "", location: "", issue_description: "", required_repair: "", quotation_specification: "", estimated_cost: "", priority: "medium", required_by: "" });
      reload();
    } finally { setBusy(""); }
  }

  const inputStyle = { width: "100%" } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
        {[
          { label: "Total", value: kpis.total, color: "var(--color-indigo-strong)", icon: "📝" },
          { label: "Awaiting Approval", value: kpis.pending, color: kpis.pending > 0 ? "var(--color-warning)" : "var(--color-slate-400)", icon: "⏳" },
          { label: "Approved", value: kpis.approved, color: "var(--color-info)", icon: "✓" },
          { label: "Converted to WO", value: kpis.converted, color: "var(--color-success)", icon: "🔧" },
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
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Repair Requisitions</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Ticket → requisition → approval → work order → verification → invoice</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <TextField size="small" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 200 }} />
          {canWork && <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => void openCreate()}>New Requisition</Button>}
          <Button variant="outlined" onClick={() => setTab("work-orders")}>Work Orders →</Button>
        </Stack>
      </Paper>

      {(error || actionError) && <Alert severity="error" onClose={() => setActionError("")}>{actionError || error}</Alert>}
      {loading && <LinearProgress />}

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        {requisitions.length === 0 && !loading ? (
          <EmptyState title="No requisitions" description="Raise a requisition from a ticket or directly to start the repair approval workflow." />
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px" }}>Code</th>
                  <th style={{ padding: "10px 14px" }}>Title / Location</th>
                  <th style={{ padding: "10px 14px" }}>Property</th>
                  <th style={{ padding: "10px 14px" }}>Est. Cost</th>
                  <th style={{ padding: "10px 14px" }}>Priority</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div className="mono" style={{ fontWeight: 700, fontSize: 12, color: "var(--brand-primary, var(--color-danger))" }}>{r.code}</div>
                      {r.service_request_reference && <div style={{ fontSize: 11, color: "text.secondary" }}>from {r.service_request_reference}</div>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 700 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: "text.secondary" }}>{r.location || r.property_name}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{r.property_name}{r.unit_code ? ` · ${r.unit_code}` : ""}</td>
                    <td style={{ padding: "12px 14px" }} className="mono">{r.estimated_cost ? money.format(Number(r.estimated_cost)) : "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <Chip size="small" label={r.priority} color={r.priority === "emergency" ? "error" : r.priority === "high" ? "warning" : "default"} sx={{ fontWeight: 700, fontSize: 11 }} />
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <StatusPill value={r.status} />
                      {r.work_order_number && <div className="mono" style={{ fontSize: 11, color: "text.secondary", marginTop: 2 }}>→ {r.work_order_number}</div>}
                      {r.rejected_reason && <div style={{ fontSize: 11, color: "var(--error, var(--color-danger))", marginTop: 2 }}>{r.rejected_reason}</div>}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Button size="small" variant="outlined" startIcon={<Download size={13} />} onClick={() => void downloadRequisitionPdf(r)}>PDF</Button>
                        {r.status === "draft" && canWork && (
                          <Button size="small" variant="outlined" startIcon={<Send size={13} />} disabled={Boolean(busy)} onClick={() => void runAction(r, "submit")}>Submit</Button>
                        )}
                        {r.status === "submitted" && canApprove && (
                          <>
                            <Button size="small" variant="contained" color="success" startIcon={<CheckCircle size={13} />} disabled={Boolean(busy)} onClick={() => void runAction(r, "approve", { notes: "" })}>Approve</Button>
                            <Button size="small" variant="outlined" color="error" startIcon={<X size={13} />} onClick={() => setRejectTarget(r)}>Reject</Button>
                          </>
                        )}
                        {r.status === "approved" && canWork && (
                          <Button size="small" variant="contained" disabled={Boolean(busy)} onClick={() => setTab("procurement")}>Open procurement</Button>
                        )}
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
        <DialogTitle sx={{ fontWeight: 800 }}>New Repair Requisition</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField required label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select required label="Property" value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value })} sx={inputStyle}>
                {localPropertyOptions.map((p) => <MenuItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</MenuItem>)}
              </TextField>
              <TextField label="Location" placeholder="e.g. Block A, 3rd floor" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} sx={inputStyle} />
            </Stack>
            <TextField required multiline minRows={2} label="Issue description" value={form.issue_description} onChange={(e) => setForm({ ...form, issue_description: e.target.value })} />
            <TextField required multiline minRows={2} label="Required repair" value={form.required_repair} onChange={(e) => setForm({ ...form, required_repair: e.target.value })} />
            <TextField multiline minRows={2} label="Quotation specification (optional)" value={form.quotation_specification} onChange={(e) => setForm({ ...form, quotation_specification: e.target.value })} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField type="number" label="Estimated cost (KES)" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} sx={inputStyle} />
              <TextField select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} sx={inputStyle}>
                {["low", "medium", "high", "emergency"].map(p => <MenuItem key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</MenuItem>)}
              </TextField>
              <TextField type="date" label="Required by" slotProps={{ inputLabel: { shrink: true } }} value={form.required_by} onChange={(e) => setForm({ ...form, required_by: e.target.value })} sx={inputStyle} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy === "create" || !form.title.trim() || !form.property || !form.issue_description.trim() || !form.required_repair.trim()} onClick={() => void createRequisition()}>
            {busy === "create" ? "Saving…" : "Create Requisition"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Reject Requisition</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>{rejectTarget?.code} — {rejectTarget?.title}</Typography>
          <TextField fullWidth multiline minRows={3} required label="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={!rejectReason.trim() || Boolean(busy)} onClick={() => rejectTarget && void runAction(rejectTarget, "reject", { reason: rejectReason })}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
