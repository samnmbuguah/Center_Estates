"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, Tab, Tabs, TextField, Typography } from "@mui/material";
import { AlertTriangle, BadgeDollarSign, BanknoteArrowDown, CircleGauge, ReceiptText, WalletCards } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { EmptyState, LoadingState, money } from "@/components/module-ui";
import { PropertyReportLibrary } from "@/components/property-report-library";
import {
  CriticalReportCards, ExportFormat, PeriodFilterBar, ReportDataTable, ReportKpiCard, ReportToolbar,
} from "@/components/property-report-shared";

type Row = Record<string, string | number | null>;
type FinancialData = {
  kpis: Record<string, string | number>; collection_performance: Row[]; arrears_ageing: Record<string, string | number>;
  income_summary: Row[]; expense_summary: Row[]; billing_collection: Row[]; arrears: Row[];
  vat: { output_vat: string; input_vat: string; net_vat: string; transactions: Row[] };
  expenses: Row[]; budgets: Row[]; service_charge: Row[];
  filter_options?: {
    owners: { id: string; name: string; code: string; unit_count: number }[];
    selected_owner: { id: string; name: string; code: string } | null;
  };
};

const sections = ["Overview", "Billing & collection", "Arrears", "Income & expense", "VAT & statutory", "Expenses", "Service charge", "Budgets", "Reports library"];
const exportKinds = ["income-expense", "tenant-payment-status", "aging", "income-expense", "vat-schedule", "expenses-schedule", "service-charge", "budget-actual"];

export function PropertyFinancialReports() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const now = new Date();
  const [section, setSection] = useState(0);
  const [start, setStart] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [end, setEnd] = useState(now.toISOString().slice(0, 10));
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ start, end });
    if (ownerId) params.set("owner", ownerId);
    return params.toString();
  }, [end, ownerId, start]);
  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    const response = await apiFetch(`/property/analytics/financial-reports/?${query}`, {}, organizationId);
    if (!response.ok) setError(await apiErrorMessage(response, "Financial reports could not be loaded."));
    else setData(await response.json() as FinancialData);
    setLoading(false);
  }, [organizationId, query]);
  useEffect(() => { void load(); }, [load]);

  async function exportReport(kind?: string, format?: ExportFormat) {
    if (!organizationId) return;
    const reportKind = kind ?? exportKinds[section] ?? "income-expense";
    const output = format ?? exportFormat;
    setExporting(true); setError(""); setNotice("");
    const response = await apiFetch(`/property/analytics/exports/${reportKind}/?${query}&output=${output}`, {}, organizationId);
    if (!response.ok) {
      setError(await apiErrorMessage(response, "The financial report could not be exported."));
      setExporting(false);
      return;
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? `${reportKind}-${start}-${end}.${output}`;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
    setNotice(`${reportKind.replaceAll("-", " ")} exported as ${output.toUpperCase()}.`);
    setExporting(false);
  }

  if (loading && !data) return <LoadingState rows={8} />;
  const k = data?.kpis ?? {};
  const rows = section === 1 ? data?.billing_collection
    : section === 2 ? data?.arrears
      : section === 4 ? data?.vat.transactions
        : section === 5 ? data?.expenses
          : section === 6 ? data?.service_charge
            : section === 7 ? data?.budgets
              : [];
  const columns = rows?.length ? Object.keys(rows[0]) : [];
  const propertyName = String(data?.collection_performance?.[0]?.property ?? "Selected property");
  const selectedOwner = data?.filter_options?.selected_owner;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <ReportToolbar
        title="Financial reports"
        subtitle="Reconciled billed, collected, arrears, VAT, expenses and budget performance for the selected property and period."
        exportFormat={exportFormat}
        onFormatChange={setExportFormat}
        onExport={() => void exportReport()}
        exporting={exporting}
        exportDisabled={section === 8}
        scope={`${propertyName} · ${selectedOwner ? `${selectedOwner.name} (${selectedOwner.code})` : "All landlords"} · ${start} to ${end}`}
      />
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", p: .5, bgcolor: "background.paper" }}>
        <Tabs aria-label="Financial report views" value={section} onChange={(_, value) => setSection(value)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 42, "& .MuiTab-root": { minHeight: 42, borderRadius: 2, px: 2 }, "& .Mui-selected": { bgcolor: "action.selected" } }}>
          {sections.map(label => <Tab key={label} label={label} />)}
        </Tabs>
      </Paper>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      <PeriodFilterBar
        start={start} end={end} onStart={setStart} onEnd={setEnd} onApply={() => void load()}
        extra={
          <TextField
            select size="small" label="Landlord / unit owner" value={ownerId}
            onChange={event => setOwnerId(event.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 250 } }}
            helperText={ownerId ? "Only this owner's units" : "Property-wide reporting"}
          >
            <MenuItem value="">All landlords</MenuItem>
            {(data?.filter_options?.owners ?? []).map(owner => (
              <MenuItem key={owner.id} value={owner.id}>{owner.name} ({owner.code}) · {owner.unit_count} unit{owner.unit_count === 1 ? "" : "s"}</MenuItem>
            ))}
          </TextField>
        }
      />
      {selectedOwner && (
        <Alert severity="info">
          Showing invoices, collections and arrears only for units owned by <strong>{selectedOwner.name}</strong>. Shared property expenses and budgets are excluded because they have not been allocated to individual owners.
        </Alert>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(3,minmax(0,1fr))", xl: "repeat(6,minmax(0,1fr))" }, gap: 1.25 }}>
        <ReportKpiCard icon={ReceiptText} label="Total billed" value={money.format(Number(k.total_billed ?? 0))} helper="Charges raised in period" />
        <ReportKpiCard icon={BadgeDollarSign} label="Total collected" value={money.format(Number(k.total_collected ?? 0))} helper="Receipts allocated" tone="success" />
        <ReportKpiCard icon={CircleGauge} label="Collection rate" value={`${k.collection_rate ?? 0}%`} helper="Collected against billed" tone="info" />
        <ReportKpiCard icon={AlertTriangle} label="Total arrears" value={money.format(Number(k.total_arrears ?? 0))} helper="Outstanding tenant balances" tone="error" />
        <ReportKpiCard icon={BanknoteArrowDown} label="Total expenses" value={money.format(Number(k.total_expenses ?? 0))} helper="Posted expenditure" tone="warning" />
        <ReportKpiCard icon={WalletCards} label="Net income" value={money.format(Number(k.net_income ?? 0))} helper="Collections less expenses" tone="success" />
      </Box>

      {section === 0 && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.3fr .8fr .8fr" }, gap: 2 }}>
            <ReportCard title="Collection performance" rows={data?.collection_performance ?? []} valueKey="collection_rate" />
            <ReportCard title="Income summary" rows={data?.income_summary ?? []} />
            <ReportCard title="Expense summary" rows={data?.expense_summary ?? []} />
          </Box>
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 2, mb: 1.25 }}>
              <Box><Typography variant="h6" sx={{ fontWeight: 900 }}>Critical financial packs</Typography><Typography variant="body2" color="text.secondary">Client-ready statements with branded PDF, Excel and CSV outputs.</Typography></Box>
              <Chip size="small" label="4 report packs" variant="outlined" />
            </Box>
            <CriticalReportCards
              onExport={(key, format) => void exportReport(key, format)}
              items={[
                { key: "tenant-payment-status", title: "Tenants payment's status", description: "Monthly billings, receipts and balances carried forward by tenant and unit." },
                { key: "income-expense", title: "Receipts & expenditure", description: "Income and disbursements with cumulative year-to-date performance." },
                { key: "aging", title: "Arrears ageing", description: "Open balances by age bucket with collection priority detail." },
                { key: "vat-schedule", title: "VAT schedule", description: "Output and input VAT transactions for the selected period." },
              ]}
            />
          </Box>
        </Box>
      )}

      {section === 2 && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 1.25 }}>
            {Object.entries(data?.arrears_ageing ?? {}).map(([bucket, value]) => (
              <Paper key={bucket} variant="outlined" sx={{ p: 2, borderRadius: 3, borderTop: 3, borderTopColor: "error.main" }}>
                <Typography color="text.primary" sx={{ fontWeight: 800 }}>{bucket.replaceAll("_", "–")} days</Typography>
                <Typography variant="h6" color="error.main" sx={{ fontWeight: 900 }}>{money.format(Number(value))}</Typography>
              </Paper>
            ))}
          </Box>
          {!rows?.length
            ? <EmptyState title="No arrears in this period" description="All invoices are settled or no open balances fall within the selected filters." />
            : <ReportDataTable rows={rows} columns={columns} />}
        </Box>
      )}

      {section === 3 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <ReportCard title="Income by category" rows={data?.income_summary ?? []} />
          <ReportCard title="Expenses by category" rows={data?.expense_summary ?? []} />
        </Box>
      )}

      {section === 4 && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 1.25 }}>
            {[["Output VAT", data?.vat.output_vat], ["Input VAT", data?.vat.input_vat], ["Net VAT payable", data?.vat.net_vat]].map(([label, value]) => (
              <Paper key={String(label)} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography color="text.primary" sx={{ fontWeight: 800 }}>{label}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{money.format(Number(value ?? 0))}</Typography>
              </Paper>
            ))}
          </Box>
          {!rows?.length
            ? <EmptyState title="No VAT transactions" description="No taxable invoices or expenses match the selected period." />
            : <ReportDataTable rows={rows} columns={columns} />}
        </Box>
      )}

      {section > 0 && section !== 2 && section !== 3 && section !== 4 && section !== 8 && (
        !rows?.length
          ? <EmptyState title="No matching transactions" description="No ledger records match the selected property and period." />
          : <ReportDataTable rows={rows} columns={columns} />
      )}
      {section === 8 && <PropertyReportLibrary domain="financial" />}
    </Box>
  );
}

function ReportCard({ title, rows, valueKey = "total" }: { title: string; rows: Row[]; valueKey?: string }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}><Typography sx={{ fontWeight: 900 }}>{title}</Typography><Chip size="small" label={`${rows.length} categor${rows.length === 1 ? "y" : "ies"}`} variant="outlined" /></Box>
      <Box sx={{ px: 2, pb: 1 }}>
      {rows.length ? rows.slice(0, 8).map((row, index) => (
        <Box key={index} sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 1, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="body2">{String(row.property ?? row.category ?? "Other")}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            {row.collection_rate !== undefined
              ? `${row.collection_rate}%`
              : money.format(Number(row[valueKey] ?? row.collected ?? 0))}
          </Typography>
        </Box>
      )) : <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>No transactions in this period.</Typography>}
      </Box>
    </Paper>
  );
}
