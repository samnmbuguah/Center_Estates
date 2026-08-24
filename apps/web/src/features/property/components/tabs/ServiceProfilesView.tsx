"use client";

import { useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { Plus, Trash2 } from "lucide-react";
import { Badge, EmptyState, KpiCard, KpiStrip, Panel } from "@/components/module-ui";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { PropertyTab, Row } from "../../types/property.types";

type Allocation = {
  id: string; property: string; property_name: string; provider: string | null;
  provider_name: string; starts_on: string | null; ends_on: string | null;
  response_target_minutes: number | null; resolution_target_minutes: number | null;
  quality_target_percent: string | null; is_active: boolean;
};

type ServiceProfile = {
  id: string; code: string; name: string; category: string; service_type: string;
  criticality: string; status: string; default_frequency: string; description: string;
  allocations?: Allocation[];
};

async function facilityPost(path: string, payload: unknown, organizationId: string | null, method = "POST") {
  await apiFetch("/auth/csrf/");
  return apiFetch(path, { method, headers: { "X-CSRFToken": csrfFromCookie(), "Content-Type": "application/json" }, body: JSON.stringify(payload) }, organizationId);
}

export function ServiceProfilesView({ rows, loading, search, setSearch, setTab, organizationId, reload }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void; organizationId: string | null; reload: () => void;
}) {
  const profiles = rows as ServiceProfile[];
  const active = profiles.filter(p => p.status === "active").length;
  const critical = profiles.filter(p => p.criticality === "critical").length;
  const unallocated = profiles.filter(p => !p.allocations?.length).length;

  const [selected, setSelected] = useState<ServiceProfile | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<Row[]>([]);
  const [providerOptions, setProviderOptions] = useState<Row[]>([]);
  const [allocLoading, setAllocLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState({ property: "", provider: "", starts_on: "", ends_on: "", response_target_minutes: "", resolution_target_minutes: "", quality_target_percent: "" });

  async function openAllocations(profile: ServiceProfile) {
    setSelected(profile);
    setAllocations(profile.allocations ?? []);
    setError("");
    if (propertyOptions.length === 0) {
      const [propRes, conRes] = await Promise.all([
        apiFetch("/property/properties/", {}, organizationId),
        apiFetch("/facility/contractors/", {}, organizationId),
      ]);
      if (propRes.ok) { const d = await propRes.json(); setPropertyOptions(Array.isArray(d) ? d : d.results ?? []); }
      if (conRes.ok) { const d = await conRes.json(); setProviderOptions(Array.isArray(d) ? d : d.results ?? []); }
    }
  }

  async function addAllocation() {
    if (!selected || !form.property) return;
    setBusy("add"); setError("");
    try {
      const payload: Record<string, unknown> = {
        service_profile: selected.id,
        property: form.property,
        provider: form.provider || null,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        response_target_minutes: form.response_target_minutes ? Number(form.response_target_minutes) : null,
        resolution_target_minutes: form.resolution_target_minutes ? Number(form.resolution_target_minutes) : null,
        quality_target_percent: form.quality_target_percent || null,
        is_active: true,
      };
      const res = await facilityPost("/facility/service-profile-allocations/", payload, organizationId);
      if (!res.ok) { setError(await apiErrorMessage(res, "Could not add the allocation.")); return; }
      const created = await res.json() as Allocation;
      setAllocations(curr => [...curr, created]);
      setForm({ property: "", provider: "", starts_on: "", ends_on: "", response_target_minutes: "", resolution_target_minutes: "", quality_target_percent: "" });
      reload();
    } finally { setBusy(""); }
  }

  async function removeAllocation(id: string) {
    setBusy(id); setError("");
    try {
      const res = await facilityPost(`/facility/service-profile-allocations/${id}/`, {}, organizationId, "DELETE");
      if (!res.ok) { setError(await apiErrorMessage(res, "Could not remove the allocation.")); return; }
      setAllocations(curr => curr.filter(a => a.id !== id));
      reload();
    } finally { setBusy(""); }
  }

  return (
    <>
      <KpiStrip>
        <KpiCard icon="📋" iconBg="rgba(79,70,229,0.12)" iconColor="#4f46e5" label="Total Profiles" value={String(profiles.length)} sub="Service definitions" />
        <KpiCard icon="✓" iconBg="rgba(22,163,74,0.12)" iconColor="#16a34a" label="Active" value={String(active)} sub="Currently in use" />
        <KpiCard icon="⚠️" iconBg="rgba(220,38,38,0.12)" iconColor="#dc2626" label="Critical" value={String(critical)} sub="High-priority services" />
        <KpiCard icon="🔗" iconBg="rgba(217,119,6,0.12)" iconColor="#d97706" label="Unallocated" value={String(unallocated)} sub="Awaiting provider assignment" />
      </KpiStrip>

      <ViewToolbar title="Service Profiles" subtitle="Define what services are required, then allocate providers per property" search={search} onSearch={setSearch} placeholder="Search service profile name or category…">
        <button className="btn ghost sm" onClick={() => setTab("properties")}>Properties →</button>
      </ViewToolbar>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      <Panel title="Service Profiles">
        <ListState loading={loading} empty={profiles.length === 0} emptyTitle="No service profiles" emptyDesc="Create service profiles in Facility → Operations to define required services.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Criticality</th>
                  <th>Frequency</th>
                  <th>Allocations</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{p.code}</td>
                    <td><strong style={{ fontSize: 13 }}>{p.name}</strong></td>
                    <td style={{ fontSize: 12 }}>{p.category || "—"}</td>
                    <td style={{ fontSize: 12 }}>{p.service_type?.replace(/_/g, " ") || "—"}</td>
                    <td><Badge tone={p.criticality === "critical" ? "red" : p.criticality === "high" ? "yellow" : "blue"}>{p.criticality || "—"}</Badge></td>
                    <td style={{ fontSize: 12 }}>{p.default_frequency?.replace(/_/g, " ") || "—"}</td>
                    <td><Badge tone={p.allocations?.length ? "green" : "yellow"}>{p.allocations?.length || 0}</Badge></td>
                    <td><Badge tone={p.status === "active" ? "green" : "gray"}>{p.status || "—"}</Badge></td>
                    <td>
                      <button className="btn ghost sm" onClick={() => void openAllocations(p)}>Allocate</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Provider allocations — {selected?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
            Time-safe allocations: changing a provider never rewrites the service definition or past history.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Stack spacing={2} sx={{ mb: 3 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select required size="small" label="Property" value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value })} sx={{ flex: 1 }}>
                {propertyOptions.map((p) => <MenuItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} sx={{ flex: 1 }}>
                <MenuItem value="">— Unassigned —</MenuItem>
                {providerOptions.map((p) => <MenuItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField type="date" size="small" slotProps={{ inputLabel: { shrink: true } }} label="Starts on" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} sx={{ flex: 1 }} />
              <TextField type="date" size="small" slotProps={{ inputLabel: { shrink: true } }} label="Ends on" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} sx={{ flex: 1 }} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField type="number" size="small" label="Response SLA (min)" value={form.response_target_minutes} onChange={(e) => setForm({ ...form, response_target_minutes: e.target.value })} sx={{ flex: 1 }} />
              <TextField type="number" size="small" label="Resolution SLA (min)" value={form.resolution_target_minutes} onChange={(e) => setForm({ ...form, resolution_target_minutes: e.target.value })} sx={{ flex: 1 }} />
              <TextField type="number" size="small" label="Quality target %" value={form.quality_target_percent} onChange={(e) => setForm({ ...form, quality_target_percent: e.target.value })} sx={{ flex: 1 }} />
            </Stack>
            <Button variant="contained" startIcon={<Plus size={15} />} disabled={!form.property || Boolean(busy)} onClick={() => void addAllocation()}>
              {busy === "add" ? "Adding…" : "Add allocation"}
            </Button>
          </Stack>

          {allocLoading ? null : allocations.length === 0 ? (
            <EmptyState title="No allocations" description="Assign this service to a property, optionally with a provider and SLA targets." />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "8px 10px" }}>Property</th>
                    <th style={{ padding: "8px 10px" }}>Provider</th>
                    <th style={{ padding: "8px 10px" }}>Period</th>
                    <th style={{ padding: "8px 10px" }}>SLA</th>
                    <th style={{ padding: "8px 10px" }}>Status</th>
                    <th style={{ padding: "8px 10px" }} />
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>{a.property_name}</td>
                      <td style={{ padding: "8px 10px" }}>{a.provider_name || "Unassigned"}</td>
                      <td style={{ padding: "8px 10px" }}>{a.starts_on || "—"} → {a.ends_on || "open"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 11 }}>
                        {a.response_target_minutes ? `R${a.response_target_minutes}` : "—"} / {a.resolution_target_minutes ? `R${a.resolution_target_minutes}` : "—"} / {a.quality_target_percent ? `${a.quality_target_percent}%` : "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}><Badge tone={a.is_active ? "green" : "gray"}>{a.is_active ? "Active" : "Inactive"}</Badge></td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>
                        <Button size="small" color="error" startIcon={<Trash2 size={13} />} disabled={Boolean(busy)} onClick={() => void removeAllocation(a.id)}>
                          {busy === a.id ? "…" : "Remove"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
      </Dialog>
    </>
  );
}
