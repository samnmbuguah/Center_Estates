"use client";

import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  LinearProgress, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import { CheckCircle, KeyRound, Plus } from "lucide-react";
import { EmptyState, KpiCard, KpiStrip, StatusPill, money } from "@/components/module-ui";
import { ViewToolbar, SubTabs } from "../PropertyToolbar";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import type { PropertyTab, Row } from "../../types/property.types";

type Handover = {
  id: string; code: string; lease_reference: string; tenant_name: string; unit_code: string;
  status: string; handover_date: string | null; caretaker_name: string;
  condition_lines: Array<Record<string, string>>; keys_items: Array<Record<string, unknown>>;
  electricity_meter_number: string; electricity_opening_reading: string | null;
};

type Clearance = {
  id: string; code: string; lease_reference: string; tenant_name: string;
  status: string; move_out_date: string | null; deposit_amount: string | null;
  refund_amount: string | null; utilities_cleared: boolean; inspection_passed: boolean;
  rent_cleared: boolean; service_charge_cleared: boolean; gate_pass_number: string;
  manager_approved_at: string | null; rejected_reason: string;
};

const EMPTY_HANDOVER = {
  lease: "", handover_date: "", notes: "",
  condition_lines: [
    { item: "Flooring", condition: "Good", notes: "" }, { item: "Walls", condition: "Good", notes: "" },
    { item: "Ceiling", condition: "Good", notes: "" }, { item: "Lights", condition: "Good", notes: "" },
    { item: "Power outlets", condition: "Good", notes: "" }, { item: "Doors & locks", condition: "Good", notes: "" },
    { item: "Plumbing", condition: "Good", notes: "" },
  ],
  keys_items: [{ item: "Main door key", quantity: "1" }],
  electricity_meter_number: "", electricity_opening_reading: "",
  water_meter_number: "", water_opening_reading: "",
};

async function post(path: string, payload: unknown, organizationId: string | null, method = "POST") {
  await apiFetch("/auth/csrf/");
  return apiFetch(path, { method, headers: { "X-CSRFToken": csrfFromCookie(), "Content-Type": "application/json" }, body: JSON.stringify(payload) }, organizationId);
}

export function HandoverExitView({ handovers, clearances, loading, error, search, setSearch, organizationId, leaseOptions, canLease, canApprove, reload, setTab }: {
  handovers: Row[]; clearances: Row[]; loading: boolean; error: string; search: string;
  setSearch: (v: string) => void; organizationId: string | null; leaseOptions: Row[];
  canLease: boolean; canApprove: boolean; reload: () => void; setTab: (t: PropertyTab) => void;
}) {
  const [subTab, setSubTab] = useState<"handover" | "exit">("handover");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitForm, setExitForm] = useState({ lease: "", move_out_date: "", move_out_conditions: "", deposit_amount: "" });
  const [form, setForm] = useState(EMPTY_HANDOVER);

  const hList = handovers as unknown as Handover[];
  const cList = clearances as unknown as Clearance[];

  const kpis = useMemo(() => ({
    openHandovers: hList.filter(h => h.status !== "acknowledged" && h.status !== "cancelled").length,
    acknowledged: hList.filter(h => h.status === "acknowledged").length,
    activeClearances: cList.filter(c => !["gate_pass_issued", "rejected"].includes(c.status)).length,
    gatePasses: cList.filter(c => c.status === "gate_pass_issued").length,
  }), [hList, cList]);

  async function run(path: string, payload: Record<string, unknown>, method = "POST") {
    setBusy(path); setActionError("");
    try {
      const res = await post(path, payload, organizationId, method);
      if (!res.ok) { setActionError(await apiErrorMessage(res, "The action could not be completed.")); return false; }
      reload();
      return true;
    } finally { setBusy(""); }
  }

  async function createHandover() {
    if (!form.lease) return;
    const payload: Record<string, unknown> = {
      lease: form.lease, handover_date: form.handover_date || null, notes: form.notes,
      condition_lines: form.condition_lines.filter(l => l.item),
      keys_items: form.keys_items.filter(k => k.item),
      electricity_meter_number: form.electricity_meter_number,
      electricity_opening_reading: form.electricity_opening_reading || null,
      water_meter_number: form.water_meter_number,
      water_opening_reading: form.water_opening_reading || null,
    };
    const ok = await run("/property/handovers/", payload);
    if (ok) { setCreateOpen(false); setForm(EMPTY_HANDOVER); }
  }

  async function createExitClearance() {
    if (!exitForm.lease) return;
    const payload: Record<string, unknown> = {
      lease: exitForm.lease,
      move_out_date: exitForm.move_out_date || null,
      move_out_conditions: exitForm.move_out_conditions,
      deposit_amount: exitForm.deposit_amount || null,
    };
    const ok = await run("/property/exit-clearances/", payload);
    if (ok) { setExitOpen(false); setExitForm({ lease: "", move_out_date: "", move_out_conditions: "", deposit_amount: "" }); }
  }

  const inputStyle = { width: "100%" } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
      <KpiStrip>
        <KpiCard icon="🔑" iconBg="rgba(79,70,229,0.12)" iconColor="var(--color-indigo)" label="Open Handovers" value={String(kpis.openHandovers)} sub="Awaiting sign-off" />
        <KpiCard icon="✓" iconBg="rgba(22,163,74,0.12)" iconColor="var(--color-success)" label="Acknowledged" value={String(kpis.acknowledged)} sub="Move-ins complete" />
        <KpiCard icon="🚪" iconBg="rgba(217,119,6,0.12)" iconColor="var(--color-warning)" label="Active Clearances" value={String(kpis.activeClearances)} sub="In progress" />
        <KpiCard icon="🎫" iconBg="rgba(22,163,74,0.12)" iconColor="var(--color-success)" label="Gate Passes" value={String(kpis.gatePasses)} sub="Exits complete" />
      </KpiStrip>

      <SubTabs tabs={[{ id: "handover", label: `Move-in Handover (${hList.length})` }, { id: "exit", label: `Exit Clearance (${cList.length})` }]} active={subTab} onChange={(id) => setSubTab(id as "handover" | "exit")} />

      {(error || actionError) && <Alert severity="error" onClose={() => setActionError("")}>{actionError || error}</Alert>}
      {loading && <LinearProgress />}

      {subTab === "handover" && (
        <>
          <ViewToolbar title="Move-in Handover" subtitle="Premises condition, keys, opening meter readings and dual sign-off" search={search} onSearch={setSearch} placeholder="Search tenant, unit or lease…">
            <button className="fc-toolbar-btn" onClick={() => setTab("leases")}>Leases →</button>
            {canLease && <button className="fc-toolbar-btn primary" onClick={() => setCreateOpen(true)}>+ New Handover</button>}
          </ViewToolbar>

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
            {hList.length === 0 && !loading ? (
              <EmptyState title="No handovers" description="Record a move-in handover to capture condition, keys and opening meter readings." />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant / Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Lease</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Condition lines</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Caretaker</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hList.map((h) => (
                    <TableRow key={h.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "info.main" }}>
                          {h.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{h.tenant_name}</Typography>
                        <Typography variant="caption" color="text.secondary">Unit {h.unit_code || "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{h.lease_reference}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{h.condition_lines?.length ?? 0} lines · {h.keys_items?.length ?? 0} keys</Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{h.caretaker_name || "—"}</Typography></TableCell>
                      <TableCell align="center"><StatusPill value={h.status} /></TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {["draft", "in_progress"].includes(h.status) && canLease && !h.caretaker_name && (
                            <Button size="small" variant="outlined" disabled={Boolean(busy)} onClick={() => void run(`/property/handovers/${h.id}/sign-caretaker/`, { caretaker_name: "Caretaker on duty" })}>Sign caretaker</Button>
                          )}
                          {["draft", "in_progress"].includes(h.status) && h.caretaker_name && (
                            <Button size="small" variant="outlined" disabled={Boolean(busy)} onClick={() => void run(`/property/handovers/${h.id}/sign-tenant/`, {})}>Sign tenant</Button>
                          )}
                          {h.status === "completed" && canApprove && (
                            <Button size="small" variant="contained" startIcon={<CheckCircle size={13} />} disabled={Boolean(busy)} onClick={() => void run(`/property/handovers/${h.id}/acknowledge/`, {})}>Acknowledge</Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </>
      )}

      {subTab === "exit" && (
        <>
          <ViewToolbar title="Exit Clearance" subtitle="Utilities, inspection, balances, deposit reconciliation, approvals and gate pass" search={search} onSearch={setSearch} placeholder="Search tenant or lease…">
            <button className="fc-toolbar-btn" onClick={() => setTab("leases")}>Leases →</button>
            {canLease && <button className="fc-toolbar-btn primary" onClick={() => setExitOpen(true)}>+ New Exit Clearance</button>}
          </ViewToolbar>

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
            {cList.length === 0 && !loading ? (
              <EmptyState title="No exit clearances" description="Start an exit clearance when a tenant gives notice to vacate." />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant / Lease</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Clearances</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Deposit → Refund</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cList.map((c) => {
                    const sections = [
                      { label: "Utilities", ok: c.utilities_cleared }, { label: "Inspection", ok: c.inspection_passed },
                      { label: "Rent", ok: c.rent_cleared }, { label: "S/C", ok: c.service_charge_cleared },
                    ];
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "error.main" }}>
                            {c.code}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.tenant_name}</Typography>
                          <Typography variant="caption" sx={{ fontFamily: "ui-monospace, monospace", color: "text.secondary", display: "block" }}>{c.lease_reference}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                            {sections.map(s => (
                              <Chip key={s.label} size="small" label={s.label} color={s.ok ? "success" : "default"} variant={s.ok ? "filled" : "outlined"} sx={{ fontSize: 10, height: 18 }} />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{c.deposit_amount ? money.format(Number(c.deposit_amount)) : "—"}</Typography>
                          {c.refund_amount !== null && (
                            <Typography variant="caption" sx={{ fontFamily: "ui-monospace, monospace", color: "success.main", display: "block" }}>
                              → {money.format(Number(c.refund_amount))}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <StatusPill value={c.status} />
                          {c.gate_pass_number && <Typography variant="caption" sx={{ fontFamily: "ui-monospace, monospace", display: "block", mt: 0.5 }}>{c.gate_pass_number}</Typography>}
                          {c.rejected_reason && <Typography variant="caption" sx={{ color: "error.main", display: "block", mt: 0.5 }}>{c.rejected_reason}</Typography>}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {["draft", "in_progress"].includes(c.status) && !(c.utilities_cleared && c.inspection_passed && c.rent_cleared && c.service_charge_cleared) && canLease && (
                              <Button size="small" variant="outlined" disabled={Boolean(busy)} onClick={() => void run(`/property/exit-clearances/${c.id}/`, {
                                utilities_cleared: true, inspection_passed: true, rent_cleared: true, service_charge_cleared: true,
                                inspection_notes: "Cleared via workspace quick action.",
                              }, "PATCH")}>Mark sections cleared</Button>
                            )}
                            {["draft", "in_progress"].includes(c.status) && canLease && (
                              <Button size="small" variant="contained" disabled={Boolean(busy)} onClick={() => void run(`/property/exit-clearances/${c.id}/mark-cleared/`, {})}>Complete</Button>
                            )}
                            {c.status === "cleared" && canApprove && (
                              <Button size="small" variant="contained" disabled={Boolean(busy)} onClick={() => void run(`/property/exit-clearances/${c.id}/approve-manager/`, {})}>Approve (mgr)</Button>
                            )}
                            {c.status === "cleared" && c.manager_approved_at && canApprove && (
                              <Button size="small" variant="contained" disabled={Boolean(busy)} onClick={() => void run(`/property/exit-clearances/${c.id}/approve-finance/`, {})}>Approve (fin)</Button>
                            )}
                            {c.status === "approved" && canApprove && (
                              <Button size="small" variant="contained" color="success" startIcon={<KeyRound size={13} />} disabled={Boolean(busy)} onClick={() => void run(`/property/exit-clearances/${c.id}/issue-gate-pass/`, {})}>Gate pass</Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </>
      )}

      {/* New exit clearance dialog */}
      <Dialog open={exitOpen} onClose={() => setExitOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>New Exit Clearance</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select required label="Lease" value={exitForm.lease} onChange={(e) => setExitForm({ ...exitForm, lease: e.target.value })} sx={inputStyle}>
              {leaseOptions.map((l) => <MenuItem key={String(l.id)} value={String(l.id)}>{String(l.reference)} — {String((l as Record<string, unknown>).tenant_name ?? "")}</MenuItem>)}
            </TextField>
            <TextField type="date" slotProps={{ inputLabel: { shrink: true } }} label="Move-out date" value={exitForm.move_out_date} onChange={(e) => setExitForm({ ...exitForm, move_out_date: e.target.value })} sx={inputStyle} />
            <TextField fullWidth multiline minRows={2} label="Move-out conditions" value={exitForm.move_out_conditions} onChange={(e) => setExitForm({ ...exitForm, move_out_conditions: e.target.value })} placeholder="e.g. Vacate by noon, remove all belongings…" />
            <TextField type="number" label="Security deposit (KES)" value={exitForm.deposit_amount} onChange={(e) => setExitForm({ ...exitForm, deposit_amount: e.target.value })} sx={inputStyle} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!exitForm.lease || Boolean(busy)} onClick={() => void createExitClearance()}>
            {busy ? "Saving…" : "Start clearance"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New handover dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>New Move-in Handover</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select required label="Lease" value={form.lease} onChange={(e) => setForm({ ...form, lease: e.target.value })} sx={inputStyle}>
                {leaseOptions.map((l) => <MenuItem key={String(l.id)} value={String(l.id)}>{String(l.reference)} — {String((l as Record<string, unknown>).tenant_name ?? "")}</MenuItem>)}
              </TextField>
              <TextField type="date" slotProps={{ inputLabel: { shrink: true } }} label="Handover date" value={form.handover_date} onChange={(e) => setForm({ ...form, handover_date: e.target.value })} sx={inputStyle} />
            </Stack>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Premises condition (pre-filled — edit conditions/notes)</Typography>
            <Stack spacing={1}>
              {form.condition_lines.map((line, i) => (
                <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField size="small" label="Item" value={line.item} onChange={(e) => setForm({ ...form, condition_lines: form.condition_lines.map((l, j) => j === i ? { ...l, item: e.target.value } : l) })} sx={{ flex: 1 }} />
                  <TextField select size="small" label="Condition" value={line.condition} onChange={(e) => setForm({ ...form, condition_lines: form.condition_lines.map((l, j) => j === i ? { ...l, condition: e.target.value } : l) })} sx={{ width: 140 }}>
                    {["Excellent", "Good", "Fair", "Poor", "Damaged"].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <TextField size="small" label="Notes" value={line.notes} onChange={(e) => setForm({ ...form, condition_lines: form.condition_lines.map((l, j) => j === i ? { ...l, notes: e.target.value } : l) })} sx={{ flex: 1 }} />
                </Stack>
              ))}
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Electricity meter no." value={form.electricity_meter_number} onChange={(e) => setForm({ ...form, electricity_meter_number: e.target.value })} sx={inputStyle} />
              <TextField type="number" label="Opening reading" value={form.electricity_opening_reading} onChange={(e) => setForm({ ...form, electricity_opening_reading: e.target.value })} sx={inputStyle} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Water meter no." value={form.water_meter_number} onChange={(e) => setForm({ ...form, water_meter_number: e.target.value })} sx={inputStyle} />
              <TextField type="number" label="Opening reading" value={form.water_opening_reading} onChange={(e) => setForm({ ...form, water_opening_reading: e.target.value })} sx={inputStyle} />
            </Stack>
            <TextField fullWidth multiline minRows={2} label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<Plus size={15} />} disabled={!form.lease || Boolean(busy)} onClick={() => void createHandover()}>
            {busy ? "Saving…" : "Create handover"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
