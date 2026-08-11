"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, Tab, Tabs, TextField, Typography } from "@mui/material";
import { Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { EmptyState, LoadingState, money } from "@/components/module-ui";
import { PropertyReportLibrary } from "@/components/property-report-library";

type Row = Record<string, string | number | null>;
type FinancialData = {
  kpis: Record<string, string | number>; collection_performance: Row[]; arrears_ageing: Record<string, string | number>;
  income_summary: Row[]; expense_summary: Row[]; billing_collection: Row[]; arrears: Row[];
  vat: { output_vat: string; input_vat: string; net_vat: string; transactions: Row[] };
  expenses: Row[]; budgets: Row[]; service_charge: Row[];
};

const sections = ["Overview", "Billing & collection", "Arrears", "Income & expense", "VAT & statutory", "Expenses", "Service charge", "Budgets", "Reports library"];

export function PropertyFinancialReports() {
  const { session } = useAuth(); const organizationId = session?.activeOrganizationId ?? null;
  const now = new Date(); const [section, setSection] = useState(0);
  const [start, setStart] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [end, setEnd] = useState(now.toISOString().slice(0, 10));
  const [exportFormat, setExportFormat] = useState<"pdf" | "xlsx" | "csv">("pdf");
  const [data, setData] = useState<FinancialData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const query = useMemo(() => new URLSearchParams({ start, end }).toString(), [end, start]);
  const load = useCallback(async () => { if (!organizationId) return; setLoading(true); setError(""); const response = await apiFetch(`/property/analytics/financial-reports/?${query}`, {}, organizationId); if (!response.ok) setError(await apiErrorMessage(response, "Financial reports could not be loaded.")); else setData(await response.json() as FinancialData); setLoading(false); }, [organizationId, query]);
  useEffect(() => { void load(); }, [load]);
  async function exportReport(kind: string) { if (!organizationId) return; const response = await apiFetch(`/property/analytics/exports/${kind}/?${query}&output=${exportFormat}`, {}, organizationId); if (!response.ok) { setError(await apiErrorMessage(response, "The financial report could not be exported.")); return; } const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `${kind}-${start}-${end}.${exportFormat}`; link.click(); URL.revokeObjectURL(url); }
  if (loading && !data) return <LoadingState rows={8}/>;
  const k = data?.kpis ?? {};
  const rows = section === 1 ? data?.billing_collection : section === 2 ? data?.arrears : section === 4 ? data?.vat.transactions : section === 5 ? data?.expenses : section === 6 ? data?.service_charge : section === 7 ? data?.budgets : [];
  const columns = rows?.length ? Object.keys(rows[0]) : [];
  const exportKind = section === 1 ? "billing-schedule" : section === 2 ? "aging" : section === 3 ? "income-expense" : section === 4 ? "vat-schedule" : section === 5 ? "expenses-schedule" : section === 6 ? "service-charge" : section === 7 ? "budget-actual" : "income-expense";
  return <Box sx={{ display: "grid", gap: 2 }}>
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}><Box><Typography variant="overline" color="primary" sx={{ fontWeight: 900 }}>Reports & analytics</Typography><Typography variant="h5" sx={{ fontWeight: 900 }}>Financial reports</Typography><Typography variant="body2" color="text.secondary">Reconciled financial performance for the selected property and reporting period.</Typography></Box><Box sx={{ display: "flex", gap: 1 }}><TextField select size="small" label="Format" value={exportFormat} onChange={event => setExportFormat(event.target.value as typeof exportFormat)} sx={{ minWidth: 110 }}><MenuItem value="pdf">PDF</MenuItem><MenuItem value="xlsx">Excel</MenuItem><MenuItem value="csv">CSV</MenuItem></TextField><Button variant="contained" startIcon={<Download size={17}/>} onClick={() => void exportReport(exportKind)} disabled={section === 8}>Export</Button></Box></Paper>
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}><Tabs value={section} onChange={(_, value) => setSection(value)} variant="scrollable" scrollButtons="auto">{sections.map(label => <Tab key={label} label={label}/>)}</Tabs></Paper>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}><TextField type="date" size="small" label="From" value={start} onChange={event => setStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }}/><TextField type="date" size="small" label="To" value={end} onChange={event => setEnd(event.target.value)} slotProps={{ inputLabel: { shrink: true } }}/><Button variant="outlined" startIcon={<RefreshCw size={16}/>} onClick={() => void load()}>Apply period</Button></Paper>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(6,1fr)" }, gap: 1.25 }}>{[["Total billed", k.total_billed], ["Total collected", k.total_collected], ["Collection rate", `${k.collection_rate ?? 0}%`], ["Total arrears", k.total_arrears], ["Total expenses", k.total_expenses], ["Net income", k.net_income]].map(([label, value], index) => <Paper key={String(label)} variant="outlined" sx={{ p: 1.75, borderRadius: 3, borderTop: 3, borderTopColor: index === 3 ? "error.main" : index === 5 ? "success.main" : "primary.main" }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" sx={{ fontWeight: 900 }}>{label === "Collection rate" ? value : money.format(Number(value ?? 0))}</Typography></Paper>)}</Box>
    {section === 0 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.3fr .8fr .8fr" }, gap: 2 }}><ReportCard title="Collection performance" rows={data?.collection_performance ?? []}/><ReportCard title="Income summary" rows={data?.income_summary ?? []}/><ReportCard title="Expense summary" rows={data?.expense_summary ?? []}/></Box>}
    {section === 2 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 1.25 }}>{Object.entries(data?.arrears_ageing ?? {}).map(([bucket, value]) => <Paper key={bucket} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography color="text.secondary">{bucket.replaceAll("_", "–")} days</Typography><Typography variant="h6" color="error.main" sx={{ fontWeight: 900 }}>{money.format(Number(value))}</Typography></Paper>)}</Box>}
    {section === 3 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}><ReportCard title="Income by category" rows={data?.income_summary ?? []}/><ReportCard title="Expenses by category" rows={data?.expense_summary ?? []}/></Box>}
    {section === 4 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(1,1fr)", md: "repeat(3,1fr)" }, gap: 1.25 }}>{[["Output VAT", data?.vat.output_vat], ["Input VAT", data?.vat.input_vat], ["Net VAT payable", data?.vat.net_vat]].map(([label, value]) => <Paper key={label} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography color="text.secondary">{label}</Typography><Typography variant="h5" sx={{ fontWeight: 900 }}>{money.format(Number(value ?? 0))}</Typography></Paper>)}</Box>}
    {section > 0 && section !== 3 && section !== 8 && <DataTable rows={rows ?? []} columns={columns}/>}
    {section === 8 && <PropertyReportLibrary domain="financial"/>}
  </Box>;
}

function ReportCard({ title, rows }: { title: string; rows: Row[] }) { return <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography sx={{ fontWeight: 900, mb: 1 }}>{title}</Typography>{rows.length ? rows.slice(0, 8).map((row, index) => <Box key={index} sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 1, borderBottom: 1, borderColor: "divider" }}><Typography variant="body2">{String(row.property ?? row.category ?? "Other")}</Typography><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.collection_rate !== undefined ? `${row.collection_rate}%` : money.format(Number(row.total ?? row.collected ?? 0))}</Typography></Box>) : <Typography color="text.secondary">No transactions in this period.</Typography>}</Paper>; }
function DataTable({ rows, columns }: { rows: Row[]; columns: string[] }) { return <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>{!rows.length ? <EmptyState title="No matching transactions" description="No ledger records match the selected property and period."/> : <Box sx={{ overflowX: "auto" }}><table className="fc-data-table"><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{column === "status" ? <Chip size="small" label={String(row[column] ?? "")}/> : String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table></Box>}</Paper>; }
