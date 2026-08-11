"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, Tab, Tabs, TextField, Typography } from "@mui/material";
import { Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { EmptyState, LoadingState, money } from "@/components/module-ui";
import { PropertyReportLibrary } from "@/components/property-report-library";

type ReportData = {
  period: { start: string; end: string };
  kpis: Record<string, string | number>;
  unit_status_distribution: Array<{ status: string; count: number }>;
  tenancy_schedule: Array<Record<string, string | number | null>>;
  vacant_units: Array<Record<string, string | number | null>>;
  movements: Array<Record<string, string | number | null>>;
  lease_expiry: Array<Record<string, string | number | null>>;
  filter_options: { unit_types: string[]; unit_statuses: string[]; lease_statuses: string[] };
};

const sections = ["Overview", "Tenancy schedule", "Vacancy", "Move ins / move outs", "Income analysis", "Lease expiry", "Custom reports"];

export function PropertyTenancyReports() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const now = new Date();
  const [section, setSection] = useState(0);
  const [start, setStart] = useState(`${now.getFullYear()}-01-01`);
  const [end, setEnd] = useState(now.toISOString().slice(0, 10));
  const [unitType, setUnitType] = useState("");
  const [unitStatus, setUnitStatus] = useState("");
  const [leaseStatus, setLeaseStatus] = useState("");
  const [exportFormat, setExportFormat] = useState<"pdf" | "xlsx" | "csv">("pdf");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => new URLSearchParams({ start, end, ...(unitType && { unit_type: unitType }), ...(unitStatus && { unit_status: unitStatus }), ...(leaseStatus && { lease_status: leaseStatus }) }).toString(), [end, leaseStatus, start, unitStatus, unitType]);
  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    const response = await apiFetch(`/property/analytics/tenancy-occupancy/?${query}`, {}, organizationId);
    if (!response.ok) setError(await apiErrorMessage(response, "Tenancy reporting data could not be loaded."));
    else setData(await response.json() as ReportData);
    setLoading(false);
  }, [organizationId, query]);
  useEffect(() => { void load(); }, [load]);

  async function exportReport() {
    if (!organizationId) return;
    const reportKind = ["occupancy", "tenancy-schedule", "vacancy", "movements", "income-analysis", "lease-expiry"][section] ?? "occupancy";
    const response = await apiFetch(`/property/analytics/exports/${reportKind}/?${query}&output=${exportFormat}`, {}, organizationId);
    if (!response.ok) { setError(await apiErrorMessage(response, "The report could not be exported.")); return; }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a"); link.href = url; link.download = `${reportKind}-${start}-${end}.${exportFormat}`; link.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !data) return <LoadingState rows={8} />;
  const kpi = data?.kpis ?? {};
  const rows = section === 1 ? data?.tenancy_schedule : section === 2 ? data?.vacant_units : section === 3 ? data?.movements : section === 5 ? data?.lease_expiry : [];
  const columns = rows?.length ? Object.keys(rows[0]) : [];

  return <Box sx={{ display: "grid", gap: 2 }}>
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
      <Box><Typography variant="overline" color="primary" sx={{ fontWeight: 900 }}>Reports & analytics</Typography><Typography variant="h5" sx={{ fontWeight: 900 }}>Tenancy & occupancy reports</Typography><Typography variant="body2" color="text.secondary">Real-time occupancy, vacancy, movements, income and lease-expiry analysis for the selected property.</Typography></Box>
      <Box sx={{ display: "flex", gap: 1 }}><TextField select size="small" label="Format" value={exportFormat} onChange={event => setExportFormat(event.target.value as typeof exportFormat)} sx={{ minWidth: 110 }}><MenuItem value="pdf">PDF</MenuItem><MenuItem value="xlsx">Excel</MenuItem><MenuItem value="csv">CSV</MenuItem></TextField><Button variant="contained" startIcon={<Download size={17}/>} onClick={() => void exportReport()} disabled={section === 6}>Export</Button></Box>
    </Paper>
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}><Tabs value={section} onChange={(_, value) => setSection(value)} variant="scrollable" scrollButtons="auto">{sections.map(label => <Tab key={label} label={label}/>)}</Tabs></Paper>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(6,1fr)" }, gap: 1.25 }}>
      <TextField type="date" size="small" label="From" value={start} onChange={event => setStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }}/><TextField type="date" size="small" label="To" value={end} onChange={event => setEnd(event.target.value)} slotProps={{ inputLabel: { shrink: true } }}/>
      <TextField select size="small" label="Unit type" value={unitType} onChange={event => setUnitType(event.target.value)}><MenuItem value="">All types</MenuItem>{data?.filter_options.unit_types.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      <TextField select size="small" label="Unit status" value={unitStatus} onChange={event => setUnitStatus(event.target.value)}><MenuItem value="">All statuses</MenuItem>{data?.filter_options.unit_statuses.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      <TextField select size="small" label="Tenancy status" value={leaseStatus} onChange={event => setLeaseStatus(event.target.value)}><MenuItem value="">All statuses</MenuItem>{data?.filter_options.lease_statuses.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      <Button variant="outlined" startIcon={<RefreshCw size={16}/>} onClick={() => void load()}>Apply filters</Button>
    </Paper>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(6,1fr)" }, gap: 1.25 }}>{[
      ["Total units", kpi.total_units], ["Occupied units", kpi.occupied_units], ["Vacant units", kpi.vacant_units], ["Occupancy rate", `${kpi.occupancy_rate ?? 0}%`], ["Potential income", money.format(Number(kpi.current_monthly_income ?? 0))], ["Overdue tenants", kpi.overdue_tenants],
    ].map(([label, value]) => <Paper key={String(label)} variant="outlined" sx={{ p: 1.75, borderRadius: 3 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" sx={{ fontWeight: 900 }}>{value}</Typography></Paper>)}</Box>
    {section === 0 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}><Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography sx={{ fontWeight: 900, mb: 2 }}>Unit status distribution</Typography>{data?.unit_status_distribution.map(row => <Box key={row.status} sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: 1, borderColor: "divider" }}><Chip size="small" label={row.status}/><strong>{row.count}</strong></Box>)}</Paper><Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography sx={{ fontWeight: 900 }}>Income outlook</Typography><Typography variant="h4" color="success.main" sx={{ fontWeight: 900, mt: 2 }}>{money.format(Number(kpi.projected_monthly_income_90_days ?? 0))}</Typography><Typography color="text.secondary">Projected monthly income within 90 days, including effective rent escalations.</Typography></Paper></Box>}
    {section === 4 && <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}><Typography sx={{ fontWeight: 900 }}>Monthly income analysis</Typography><Typography variant="h3" color="success.main" sx={{ fontWeight: 900, my: 2 }}>{money.format(Number(kpi.current_monthly_income ?? 0))}</Typography><Typography color="text.secondary">Current effective monthly rent for active tenancies. Projected in 90 days: {money.format(Number(kpi.projected_monthly_income_90_days ?? 0))}.</Typography></Paper>}
    {section > 0 && section !== 4 && section !== 6 && <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>{!rows?.length ? <EmptyState title={`No ${sections[section].toLowerCase()} records`} description="No records match the selected property, period and filters."/> : <Box sx={{ overflowX: "auto" }}><table className="fc-data-table"><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table></Box>}</Paper>}
    {section === 6 && <PropertyReportLibrary domain="tenancy"/>}
  </Box>;
}
