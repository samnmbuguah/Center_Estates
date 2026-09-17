"use client";

import { useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
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
        <KpiCard icon="📋" iconBg="rgba(79,70,229,0.12)" iconColor="var(--color-indigo)" label="Total Profiles" value={String(profiles.length)} sub="Service definitions" />
        <KpiCard icon="✓" iconBg="rgba(22,163,74,0.12)" iconColor="var(--color-success)" label="Active" value={String(active)} sub="Currently in use" />
        <KpiCard icon="⚠️" iconBg="rgba(220,38,38,0.12)" iconColor="var(--color-danger)" label="Critical" value={String(critical)} sub="High-priority services" />
        <KpiCard icon="🔗" iconBg="rgba(217,119,6,0.12)" iconColor="var(--color-warning)" label="Unallocated" value={String(unallocated)} sub="Awaiting provider assignment" />
      </KpiStrip>

      <ViewToolbar title="Service Profiles" subtitle="Define what services are required, then allocate providers per property" search={search} onSearch={setSearch} placeholder="Search service profile name or category…">
        <button className="btn ghost sm" onClick={() => setTab("properties")}>Properties →</button>
      </ViewToolbar>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      <Panel title="Service Profiles">
        <ListState loading={loading} empty={profiles.length === 0} emptyTitle="No service profiles" emptyDesc="Create service profiles in Facility → Operations to define required services.">
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Service</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Type</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Criticality</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Frequency</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Allocations</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                        {p.code}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{p.name}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{p.category || "—"}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{p.service_type?.replace(/_/g, " ") || "—"}</Typography></TableCell>
                    <TableCell align="center">
                      <Badge tone={p.criticality === "critical" ? "red" : p.criticality === "high" ? "yellow" : "blue"}>{p.criticality || "—"}</Badge>
                    </TableCell>
                    <TableCell><Typography variant="body2">{p.default_frequency?.replace(/_/g, " ") || "—"}</Typography></TableCell>
                    <TableCell align="center">
                      <Badge tone={p.allocations?.length ? "green" : "yellow"}>{p.allocations?.length || 0}</Badge>
                    </TableCell>
                    <TableCell align="center">
                      <Badge tone={p.status === "active" ? "green" : "gray"}>{p.status || "—"}</Badge>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => void openAllocations(p)}>
                        Allocate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Property</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Provider</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Period</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>SLA</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allocations.map((a) => (
                    <TableRow key={a.id} hover>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{a.property_name}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{a.provider_name || "Unassigned"}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{a.starts_on || "—"} → {a.ends_on || "open"}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: "ui-monospace, monospace" }}>
                          {a.response_target_minutes ? `R${a.response_target_minutes}` : "—"} / {a.resolution_target_minutes ? `R${a.resolution_target_minutes}` : "—"} / {a.quality_target_percent ? `${a.quality_target_percent}%` : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Badge tone={a.is_active ? "green" : "gray"}>{a.is_active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" color="error" startIcon={<Trash2 size={13} />} disabled={Boolean(busy)} onClick={() => void removeAllocation(a.id)}>
                          {busy === a.id ? "…" : "Remove"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
      </Dialog>
    </>
  );
}
