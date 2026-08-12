"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { CalendarClock, Download, Play, Save } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/module-ui";

type Definition = { id: string; key: string; name: string; domain: string; description: string; is_standard: boolean };
type Execution = { id: string; report_key: string; property_name: string; period_start: string | null; period_end: string | null; output_format: string; status: string; generated_by_name: string; generated_at: string | null; row_count: number };
type Schedule = {
  id: string; report_name: string; definition: string; frequency: string; next_run_at: string;
  output_format: string; is_active: boolean; recipients: string[];
  last_delivery_status?: string; last_delivery_error?: string; last_delivery_at?: string | null;
};

export function PropertyReportLibrary({ domain = "financial" }: { domain?: "financial" | "tenancy" | "billing" }) {
  const { session, can } = useAuth(); const organizationId = session?.activeOrganizationId ?? null;
  const [definitions, setDefinitions] = useState<Definition[]>([]); const [executions, setExecutions] = useState<Execution[]>([]); const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [name, setName] = useState(""); const [reportKey, setReportKey] = useState(domain === "tenancy" ? "occupancy" : "income-expense");
  const [definitionId, setDefinitionId] = useState(""); const [frequency, setFrequency] = useState("monthly"); const [format, setFormat] = useState("pdf"); const [recipient, setRecipient] = useState("");
  const load = useCallback(async () => { if (!organizationId) return; setLoading(true); const responses = await Promise.all([apiFetch("/property/report-definitions/", {}, organizationId), apiFetch("/property/report-executions/", {}, organizationId), apiFetch("/property/scheduled-reports/", {}, organizationId)]); if (responses.some(response => !response.ok)) setError("The report library could not be loaded."); else { const [defs, runs, jobs] = await Promise.all(responses.map(response => response.json())); setDefinitions((defs as Definition[]).filter(item => item.domain === domain)); setExecutions(runs as Execution[]); setSchedules(jobs as Schedule[]); } setLoading(false); }, [domain, organizationId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!definitionId && definitions[0]) setDefinitionId(definitions[0].id); }, [definitionId, definitions]);

  async function saveView(event: FormEvent) { event.preventDefault(); if (!organizationId) return; setError(""); const response = await apiFetch("/property/report-definitions/", { method: "POST", body: JSON.stringify({ key: `${reportKey}-${Date.now()}`, name, domain, description: `Saved ${domain} report view`, selected_fields: [], default_filters: { _report_key: reportKey }, grouping: [], sorting: [], is_standard: false, is_active: true }) }, organizationId); if (!response.ok) setError(await apiErrorMessage(response, "The report view could not be saved.")); else { setName(""); setNotice("Saved report view created."); await load(); } }
  async function createSchedule(event: FormEvent) { event.preventDefault(); if (!organizationId || !definitionId) return; const next = new Date(); next.setMinutes(next.getMinutes() + 5); const response = await apiFetch("/property/scheduled-reports/", { method: "POST", body: JSON.stringify({ definition: definitionId, frequency, next_run_at: next.toISOString(), recipients: recipient ? recipient.split(",").map(value => value.trim()).filter(Boolean) : [], filters: {}, output_format: format, is_active: true }) }, organizationId); if (!response.ok) setError(await apiErrorMessage(response, "The report schedule could not be created.")); else { setNotice("Report schedule created."); await load(); } }
  async function runSchedule(id: string) { if (!organizationId) return; const response = await apiFetch(`/property/scheduled-reports/${id}/run/`, { method: "POST", body: "{}" }, organizationId); if (!response.ok) setError(await apiErrorMessage(response, "The scheduled report could not run.")); else { setNotice("Report generated and stored in execution history."); await load(); } }
  async function downloadExecution(id: string) { if (!organizationId) return; const response = await apiFetch(`/property/report-executions/${id}/download/`, {}, organizationId); if (!response.ok) { setError(await apiErrorMessage(response, "The generated report could not be downloaded.")); return; } const disposition = response.headers.get("content-disposition") ?? ""; const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? `report-${id}`; const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
  if (loading) return <LoadingState rows={5}/>;
  const canManage = can("property.reports") || can("property.report");
  return <Box sx={{ display: "grid", gap: 2 }}>
    {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}{notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.2fr" }, gap: 2 }}>
      <Paper component="form" onSubmit={saveView} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography sx={{ fontWeight: 900 }}>Save a filtered view</Typography><Typography variant="body2" color="text.primary" sx={{ fontWeight: 800, mb: 2 }}>Keep an approved report configuration for reuse and scheduling.</Typography><Box sx={{ display: "grid", gap: 1.5 }}><TextField required size="small" label="View name" value={name} onChange={event => setName(event.target.value)}/><TextField select size="small" label="Base report" value={reportKey} onChange={event => setReportKey(event.target.value)}>{(domain === "tenancy" ? [["occupancy", "Occupancy"], ["lease-expiry", "Lease expiry"]] : [["income-expense", "Income & expenditure"], ["tenant-payment-status", "Billing & collection"], ["aging", "Arrears ageing"], ["budget-actual", "Budget vs actual"], ["service-charge", "Service charge"]]).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField><Button type="submit" variant="contained" startIcon={<Save size={16}/>} disabled={!canManage}>Save view</Button></Box></Paper>
      <Paper component="form" onSubmit={createSchedule} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography sx={{ fontWeight: 900 }}>Schedule delivery</Typography><Typography variant="body2" color="text.primary" sx={{ fontWeight: 800, mb: 2 }}>Generate stored, auditable reports for authorized recipients.</Typography><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}><TextField select required size="small" label="Saved report" value={definitionId} onChange={event => setDefinitionId(event.target.value)} sx={{ gridColumn: { sm: "1 / -1" } }}>{definitions.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField><TextField select size="small" label="Frequency" value={frequency} onChange={event => setFrequency(event.target.value)}>{["daily", "weekly", "monthly", "quarterly"].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><TextField select size="small" label="Format" value={format} onChange={event => setFormat(event.target.value)}>{["pdf", "xlsx", "csv"].map(value => <MenuItem key={value} value={value}>{value.toUpperCase()}</MenuItem>)}</TextField><TextField size="small" label="Recipient emails" value={recipient} onChange={event => setRecipient(event.target.value)} helperText="Comma-separated; access is rechecked when generated" sx={{ gridColumn: { sm: "1 / -1" } }}/><Button type="submit" variant="contained" startIcon={<CalendarClock size={16}/>} disabled={!canManage || !definitionId} sx={{ gridColumn: { sm: "1 / -1" } }}>Create schedule</Button></Box></Paper>
    </Box>
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}><Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}><Typography sx={{ fontWeight: 900 }}>Scheduled reports</Typography></Box>{schedules.length ? schedules.map(item => {
      const failed = ["delivery_failed", "generation_failed"].includes(item.last_delivery_status ?? "");
      return <Box key={item.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, p: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{item.report_name}</Typography>
          <Typography variant="caption" color="text.primary" sx={{ fontWeight: 800 }}>{item.frequency} · {item.output_format.toUpperCase()} · next {new Date(item.next_run_at).toLocaleString()}</Typography>
          {item.last_delivery_status && (
            <Box sx={{ mt: .5, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Chip size="small" color={failed ? "error" : item.last_delivery_status === "delivered" || item.last_delivery_status === "generated" ? "success" : "default"} label={item.last_delivery_status.replaceAll("_", " ")} />
              {item.last_delivery_error && <Typography variant="caption" color="error.main">{item.last_delivery_error}</Typography>}
            </Box>
          )}
        </Box>
        <Button size="small" startIcon={<Play size={15}/>} onClick={() => void runSchedule(item.id)} disabled={!canManage} color={failed ? "warning" : "primary"}>
          {failed ? "Retry now" : "Run now"}
        </Button>
      </Box>;
    }) : <EmptyState title="No report schedules" description="Save a view, then schedule its recurring generation."/>}</Paper>
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}><Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}><Typography sx={{ fontWeight: 900 }}>Generation history</Typography></Box>{executions.length ? executions.slice(0, 20).map(item => <Box key={item.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, p: 1.5, borderBottom: 1, borderColor: "divider" }}><Box><Typography sx={{ fontWeight: 800 }}>{item.report_key.replaceAll("-", " ")}</Typography><Typography variant="caption" color="text.primary" sx={{ fontWeight: 800 }}>{item.property_name} · {item.period_start ?? "—"} to {item.period_end ?? "—"} · {item.generated_by_name || "System"}</Typography></Box><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><Chip size="small" label={`${item.output_format.toUpperCase()} · ${item.status}`}/><Button size="small" startIcon={<Download size={15}/>} onClick={() => void downloadExecution(item.id)} disabled={item.status !== "completed"}>Download</Button></Box></Box>) : <EmptyState title="No generated reports" description="Exports and scheduled runs will appear here with their filters and audit information."/>}</Paper>
  </Box>;
}
