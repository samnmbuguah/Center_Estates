"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Paper, Tab, Tabs, Typography } from "@mui/material";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { EmptyState, LoadingState, money } from "@/components/module-ui";
import { PropertyReportLibrary } from "@/components/property-report-library";
import {
  CriticalReportCards, ExportFormat, PeriodFilterBar, ReportDataTable, ReportToolbar,
} from "@/components/property-report-shared";

type Row = Record<string, string | number | null>;
type FinancialData = {
  kpis: Record<string, string | number>; collection_performance: Row[]; arrears_ageing: Record<string, string | number>;
  income_summary: Row[]; expense_summary: Row[]; billing_collection: Row[]; arrears: Row[];
  vat: { output_vat: string; input_vat: string; net_vat: string; transactions: Row[] };
  expenses: Row[]; budgets: Row[]; service_charge: Row[];
};

const sections = ["Overview", "Billing & collection", "Arrears", "Income & expense", "VAT & statutory", "Expenses", "Service charge", "Budgets", "Reports library"];
const exportKinds = ["income-expense", "billing-schedule", "aging", "income-expense", "vat-schedule", "expenses-schedule", "service-charge", "budget-actual"];

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

  const query = useMemo(() => new URLSearchParams({ start, end }).toString(), [end, start]);
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
      />
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Tabs value={section} onChange={(_, value) => setSection(value)} variant="scrollable" scrollButtons="auto">
          {sections.map(label => <Tab key={label} label={label} />)}
        </Tabs>
      </Paper>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      <PeriodFilterBar start={start} end={end} onStart={setStart} onEnd={setEnd} onApply={() => void load()} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(6,1fr)" }, gap: 1.25 }}>
        {[
          ["Total billed", k.total_billed, "primary"],
          ["Total collected", k.total_collected, "success"],
          ["Collection rate", `${k.collection_rate ?? 0}%`, "primary"],
          ["Total arrears", k.total_arrears, "error"],
          ["Total expenses", k.total_expenses, "warning"],
          ["Net income", k.net_income, "success"],
        ].map(([label, value, color]) => (
          <Paper key={String(label)} variant="outlined" sx={{ p: 1.75, borderRadius: 3, borderTop: 3, borderTopColor: `${color}.main` }}>
            <Typography variant="caption" color="text.primary" sx={{ fontWeight: 800 }}>{label}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              {String(label).includes("rate") ? value : money.format(Number(value ?? 0))}
            </Typography>
          </Paper>
        ))}
      </Box>

      {section === 0 && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.3fr .8fr .8fr" }, gap: 2 }}>
            <ReportCard title="Collection performance" rows={data?.collection_performance ?? []} valueKey="collection_rate" />
            <ReportCard title="Income summary" rows={data?.income_summary ?? []} />
            <ReportCard title="Expense summary" rows={data?.expense_summary ?? []} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, mb: 1.25 }}>Critical financial packs</Typography>
            <CriticalReportCards
              onExport={(key, format) => void exportReport(key, format)}
              items={[
                { key: "tenant-payment-status", title: "Tenants payments status", description: "Monthly billings, receipts and balances carried forward by tenant and unit." },
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
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Typography sx={{ fontWeight: 900, mb: 1 }}>{title}</Typography>
      {rows.length ? rows.slice(0, 8).map((row, index) => (
        <Box key={index} sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 1, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="body2">{String(row.property ?? row.category ?? "Other")}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            {row.collection_rate !== undefined
              ? `${row.collection_rate}%`
              : money.format(Number(row[valueKey] ?? row.collected ?? 0))}
          </Typography>
        </Box>
      )) : <Typography color="text.primary" sx={{ fontWeight: 800 }}>No transactions in this period.</Typography>}
    </Paper>
  );
}
