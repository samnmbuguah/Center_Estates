"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField,
} from "@mui/material";
import { AlertTriangle, ClipboardCheck, Plus, ShieldCheck, Wrench } from "lucide-react";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { EmptyState, KpiCard, KpiStrip, StatusPill, ViewToolbar } from "@/components/module-ui";
import type { Row } from "../../types/facility.types";

type Mode = "service-profiles" | "incidents";

export function OperationsRegistryView({ mode, rows, organizationId, propertyId, canApprove, canAdminister, reload }: {
  mode: Mode; rows: Row[]; organizationId: string | null; propertyId: string | null;
  canApprove: boolean; canAdminister: boolean; reload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const filtered = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const active = rows.filter((row) => row.status === "active" || row.status === "under_review").length;
  const urgent = rows.filter((row) => row.severity === "high" || row.severity === "critical").length;

  async function post(path: string, payload: Record<string, unknown>) {
    await apiFetch("/auth/csrf/");
    return apiFetch(path, { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) }, organizationId);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = mode === "service-profiles" ? {
      name: raw.name, category: raw.category, service_type: raw.service_type, status: raw.status,
      criticality: raw.criticality, coverage: "property", default_frequency: raw.default_frequency,
      description: raw.description, notes: raw.notes, properties: propertyId ? [propertyId] : [], assets: [],
    } : {
      property: propertyId, location: raw.location, occurred_at: raw.occurred_at, category: raw.category,
      severity: raw.severity, narrative: raw.narrative, immediate_action: raw.immediate_action,
      recommended_action: raw.recommended_action, responsible_person: raw.responsible_person,
      target_date: raw.target_date || null,
      people_involved: String(raw.people_involved || "").split("\n").filter(Boolean),
      impacts: String(raw.impacts || "").split(",").map((v) => v.trim()).filter(Boolean), evidence: [],
    };
    const response = await post(`/facility/${mode}/`, payload);
    if (!response.ok) { setError(await apiErrorMessage(response, "The record could not be saved.")); setSaving(false); return; }
    setOpen(false); setSaving(false); await reload();
  }

  async function action(row: Row, name: string) {
    setError("");
    const payload = name === "resolve" ? { resolution_notes: "Corrective action completed and verified." } : { notes: "Reviewed in the Facility workspace." };
    const response = await post(`/facility/incidents/${row.id}/${name === "create-work-order" ? "create-work-order" : name}/`, payload);
    if (!response.ok) { setError(await apiErrorMessage(response, "The workflow action could not be completed.")); return; }
    await reload();
  }

  async function downloadMemo(row: Row) {
    setError("");
    try {
      const response = await apiFetch(`/facility/incidents/${row.id}/memo/`, {}, organizationId);
      if (!response.ok) { setError(await apiErrorMessage(response, "The incident memo could not be generated.")); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `incident-memo-${String(row.reference || row.id)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("The incident memo could not be downloaded. Check your connection and retry.");
    }
  }

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) { setError("Choose an image, video or PDF evidence file first."); return; }
    setSaving(true); setError("");
    const response = await apiFetch(`/facility/incidents/${selected.id}/attachments/`, { method: "POST", body: data }, organizationId);
    if (!response.ok) { setError(await apiErrorMessage(response, "The incident evidence could not be uploaded.")); setSaving(false); return; }
    form.reset(); setSaving(false); await reload();
    const refreshed = await apiFetch(`/facility/incidents/${selected.id}/`, {}, organizationId);
    if (refreshed.ok) setSelected(await refreshed.json());
  }

  return <Stack spacing={2.25}>
    <ViewToolbar
      title={mode === "service-profiles" ? "Service profiles" : "Incident reporting"}
      subtitle={mode === "service-profiles" ? "Define what service is required before assigning who delivers it." : "Capture, escalate, investigate and close operational incidents with a full audit trail."}
      search={search} onSearch={setSearch}
    >
      <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => setOpen(true)} disabled={mode === "service-profiles" ? !canAdminister : !propertyId}>
        {mode === "service-profiles" ? "Create service profile" : "Report incident"}
      </Button>
    </ViewToolbar>
    {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
    <KpiStrip cols={3}>
      <KpiCard icon={mode === "service-profiles" ? <ClipboardCheck size={19} /> : <AlertTriangle size={19} />} label="Total records" value={rows.length} sub="Selected property" />
      <KpiCard icon={<ShieldCheck size={19} />} label={mode === "service-profiles" ? "Active definitions" : "In review"} value={active} sub="Live workflow records" />
      <KpiCard icon={<Wrench size={19} />} label={mode === "service-profiles" ? "Provider-ready" : "High priority"} value={mode === "service-profiles" ? rows.filter((r) => Array.isArray(r.allocations) && r.allocations.length).length : urgent} sub={mode === "service-profiles" ? "Allocated profiles" : "High and critical"} />
    </KpiStrip>
    {filtered.length === 0 ? <EmptyState icon={mode === "service-profiles" ? "🧩" : "🚨"} title={mode === "service-profiles" ? "No service profiles yet" : "No incidents reported"} description={mode === "service-profiles" ? "Create a reusable service definition, then allocate an approved provider without changing the master record." : "Caretakers can save an incident as a draft on mobile and submit it when evidence is ready."} /> :
      <Box className="data-panel table-scroll">
        <Box component="table" className="fc-data-table" sx={{ width: "100%" }}>
          <thead><tr>{(mode === "service-profiles" ? ["Code", "Service", "Category", "Type", "Criticality", "Frequency", "Status", "Provider allocation"] : ["Reference", "Occurred", "Location", "Category", "Severity", "Status", "Reported by", "Actions"]).map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map((row) => mode === "service-profiles" ? <tr key={String(row.id)}>
            <td className="mono">{String(row.code)}</td><td><strong>{String(row.name)}</strong><small className="muted" style={{ display: "block" }}>{String(row.description || "")}</small></td><td>{String(row.category)}</td><td><StatusPill value={String(row.service_type)} /></td><td><StatusPill value={String(row.criticality)} /></td><td>{String(row.default_frequency || "On demand")}</td><td><StatusPill value={String(row.status)} /></td><td>{Array.isArray(row.allocations) ? row.allocations.length : 0}</td>
          </tr> : <tr key={String(row.id)}>
            <td className="mono">{String(row.reference)}</td><td>{new Date(String(row.occurred_at)).toLocaleString()}</td><td>{String(row.location)}</td><td>{String(row.category)}</td><td><StatusPill value={String(row.severity)} /></td><td><StatusPill value={String(row.status)} /></td><td>{String(row.reported_by_name || "—")}</td>            <td><Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
              <Button size="small" onClick={() => setSelected(row)}>View</Button>
              <Button size="small" onClick={() => void downloadMemo(row)}>Memo PDF</Button>
              {row.status === "draft" && <Button size="small" onClick={() => action(row, "submit")}>Submit</Button>}
              {row.status === "submitted" && canApprove && <Button size="small" onClick={() => action(row, "review")}>Review</Button>}
              {row.status === "under_review" && <Button size="small" onClick={() => action(row, "create-work-order")}>Work order</Button>}
              {(row.status === "under_review" || row.status === "follow_up") && <Button size="small" onClick={() => action(row, "resolve")}>Resolve</Button>}
              {row.status === "resolved" && canApprove && <Button size="small" onClick={() => action(row, "close")}>Close</Button>}
            </Stack></td>
          </tr>)}</tbody>
        </Box>
      </Box>}

    <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 900 }}>{mode === "service-profiles" ? "Create service profile" : "Report an incident"}</DialogTitle>
      <Box component="form" id="facility-operations-form" onSubmit={create}>
      <DialogContent dividers><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2, pt: 0.5 }}>
        {mode === "service-profiles" ? <>
          <TextField name="name" label="Service name" required /><TextField name="category" label="Service category" required placeholder="Cleaning, Security, Electrical…" />
          <TextField name="service_type" label="Service type" select required defaultValue="routine"><MenuItem value="routine">Routine</MenuItem><MenuItem value="preventive">Preventive</MenuItem><MenuItem value="reactive">Reactive</MenuItem><MenuItem value="specialist">Specialist</MenuItem></TextField>
          <TextField name="criticality" label="Criticality" select defaultValue="medium"><MenuItem value="critical">Critical</MenuItem><MenuItem value="high">High</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="low">Low</MenuItem></TextField>
          <TextField name="status" label="Status" select defaultValue="draft"><MenuItem value="draft">Draft</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="suspended">Suspended</MenuItem></TextField>
          <TextField name="default_frequency" label="Default frequency" placeholder="Daily, weekly, monthly or on demand" />
          <TextField name="description" label="Description and purpose" required multiline minRows={3} sx={{ gridColumn: { md: "1 / -1" } }} /><TextField name="notes" label="Notes" multiline minRows={2} sx={{ gridColumn: { md: "1 / -1" } }} />
        </> : <>
          <TextField name="location" label="Exact location" required /><TextField name="occurred_at" label="Date and time" type="datetime-local" required defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField name="category" label="Incident category" required placeholder="Safety, security, utility, damage…" /><TextField name="severity" label="Severity" select defaultValue="medium"><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem><MenuItem value="critical">Critical</MenuItem></TextField>
          <TextField name="narrative" label="What happened?" required multiline minRows={4} sx={{ gridColumn: { md: "1 / -1" } }} />
          <TextField name="people_involved" label="People involved (one per line)" multiline minRows={2} /><TextField name="impacts" label="Impacts (comma separated)" placeholder="Injury, service disruption, property damage" />
          <TextField name="immediate_action" label="Immediate action taken" multiline minRows={2} /><TextField name="recommended_action" label="Recommended follow-up" multiline minRows={2} />
          <TextField name="responsible_person" label="Responsible person/team" /><TextField name="target_date" label="Target date" type="date" slotProps={{ inputLabel: { shrink: true } }} />
          <Alert severity="info" sx={{ gridColumn: { md: "1 / -1" } }}>Save creates a resumable draft. Submit it from the register when the account and evidence are complete; high and critical incidents then alert managers.</Alert>
        </>}
      </Box></DialogContent>
      <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving…" : mode === "incidents" ? "Save draft" : "Create profile"}</Button></DialogActions>
      </Box>
    </Dialog>

    <Dialog open={Boolean(selected)} onClose={() => !saving && setSelected(null)} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 900 }}>{String(selected?.reference || "Incident details")}</DialogTitle>
      <DialogContent dividers>
        {selected && <Stack spacing={2}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
            <Box><small className="muted">Status</small><div><StatusPill value={String(selected.status)} /></div></Box>
            <Box><small className="muted">Severity</small><div><StatusPill value={String(selected.severity)} /></div></Box>
            <Box><small className="muted">Location</small><strong style={{ display: "block" }}>{String(selected.location)}</strong></Box>
          </Box>
          <Box><small className="muted">Incident narrative</small><p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{String(selected.narrative)}</p></Box>
          {Boolean(selected.immediate_action) && <Box><small className="muted">Immediate action</small><p style={{ margin: "4px 0 0" }}>{String(selected.immediate_action)}</p></Box>}
          <Box component="form" onSubmit={uploadEvidence} sx={{ p: 2, border: "1px solid var(--border)", borderRadius: 2, bgcolor: "var(--surface-sunken)" }}>
            <strong>Evidence</strong>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 1.25, alignItems: { sm: "center" } }}>
              <Button component="label" variant="outlined">Choose file<input hidden type="file" name="file" accept="image/*,video/*,application/pdf" /></Button>
              <TextField name="name" size="small" label="Evidence label (optional)" sx={{ flex: 1 }} />
              <Button type="submit" variant="contained" disabled={saving}>{saving ? "Uploading…" : "Upload"}</Button>
            </Stack>
            <small className="muted">Images, video or PDF up to 15 MB. Uploads are retained with the incident audit trail.</small>
            <Stack spacing={0.75} sx={{ mt: 1.5 }}>
              {(Array.isArray(selected.attachments) ? selected.attachments : []).map((item) => {
                const attachment = item as Row;
                return <Button key={String(attachment.id)} component="a" href={String(attachment.file_url)} target="_blank" rel="noreferrer" variant="text" sx={{ justifyContent: "flex-start" }}>📎 {String(attachment.name)}</Button>;
              })}
              {(!Array.isArray(selected.attachments) || selected.attachments.length === 0) && <span className="muted">No evidence uploaded yet.</span>}
            </Stack>
          </Box>
          <Box><strong>Audit trail</strong><Stack spacing={0.75} sx={{ mt: 1 }}>
            {(Array.isArray(selected.events) ? selected.events : []).map((item) => {
              const audit = item as Row;
              return <Box key={String(audit.id)} sx={{ p: 1.25, borderLeft: "3px solid var(--accent)", bgcolor: "var(--surface-sunken)" }}>
                <strong>{String(audit.event_type).replaceAll("_", " ")}</strong> <span className="muted">· {new Date(String(audit.created_at)).toLocaleString()}</span>
                {Boolean(audit.notes) && <div>{String(audit.notes)}</div>}
              </Box>;
            })}
          </Stack></Box>
        </Stack>}
      </DialogContent>
      <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
    </Dialog>
  </Stack>;
}
