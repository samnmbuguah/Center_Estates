"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Box, Button, Chip, MenuItem, TextField, Typography, Paper, Alert } from "@mui/material";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";
import { ViewToolbar, ListState, SubTabs } from "../PropertyToolbar";
import {
  PropertyTab, Row, ID, PropertyRow, BuildingRow, UnitRow, ProjectRow,
  TenantRow, TenantDocumentRow, LeaseRow, RentScheduleRow, InvoiceRow,
  InvoicePreview, ReceiptRow, ReminderRow, BankTransactionRow, ExpenseRow,
  BudgetRow, ServiceChargeRow, ServiceChargeAllocationRow,
  ServiceChargeReconciliationRow, ReceiptAllocationRow, CreditNoteRow,
  AgingTenantRow, AgingAnalytics, FinancialAnalytics, ReportItem,
  DashboardData, RentSection, ScSection, TenancySection, FinancialsSection,
} from "../../types/property.types";
import {
  kM, kN, fmtDate, daysUntil, daysLeftLabel, overdueLabel, pct,
  occupancyTone, shortId, exportCsv, exportLeaseICS, exportICS,
  criticalFormatDate, criticalDaysUntil,
} from "../../utils/property.utils";

export function ReportsView({ rows, loading, onExport }: {
  rows: Row[]; loading: boolean; onExport: (key: string, output: "csv" | "pdf" | "xlsx", start: string, end: string) => void;
}) {
  const reports = rows as ReportItem[];
  const today = new Date();
  const [start, setStart] = useState(() => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
  const [end, setEnd] = useState(() => today.toISOString().slice(0, 10));
  const [category, setCategory] = useState("All reports");
  const [query, setQuery] = useState("");
  const categories = ["All reports", ...Array.from(new Set(reports.map((r) => String(r.category ?? "Other"))))];
  const visible = reports.filter((report) => {
    const matchesCategory = category === "All reports" || report.category === category;
    const haystack = `${report.name ?? ""} ${report.description ?? ""} ${report.category ?? ""}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  });
  const critical = reports.filter((report) => report.critical);
  const reportGroups = ["Financial", "Tenants & Occupancy", "Service Providers", "Compliance & Risk"]
    .map((name) => ({ name, reports: visible.filter((report) => report.category === name) }))
    .filter((group) => group.reports.length > 0);
  const invalidPeriod = Boolean(start && end && start > end);

  const exportReport = (report: ReportItem, output: "csv" | "pdf" | "xlsx") => {
    if (!invalidPeriod) onExport(String(report.key ?? ""), output, start, end);
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Property reports</Typography>
        <Typography color="text.secondary" sx={{ mt: .5 }}>Generate management-ready PDF documents or analysis-ready CSV files for the selected property.</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 1fr) 180px 180px 220px" }, gap: 1.5, mt: 2.5 }}>
          <TextField size="small" label="Search reports" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. tenant payments" />
          <TextField size="small" label="From" type="date" value={start} onChange={(event) => setStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" label="To" type="date" value={end} onChange={(event) => setEnd(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select size="small" label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
        </Box>
        {invalidPeriod && <Alert severity="error" sx={{ mt: 1.5 }}>The start date must be before the end date.</Alert>}
      </Paper>

      {critical.length > 0 && <Box>
        <Typography variant="overline" color="error" sx={{ fontWeight: 800 }}>Critical management reports</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5, mt: .5 }}>
          {critical.map((report) => <Paper key={report.key} variant="outlined" sx={{ p: 2, borderRadius: 3, borderTop: "3px solid", borderTopColor: "error.main" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}><Typography sx={{ fontWeight: 800 }}>{report.name}</Typography><Chip size="small" label="Priority" color="error" variant="outlined" /></Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, minHeight: 40 }}>{report.description || "Property management report."}</Typography>
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}><Button size="small" variant="contained" onClick={() => exportReport(report, "pdf")} disabled={invalidPeriod}>Download PDF</Button><Button size="small" variant="outlined" onClick={() => exportReport(report, "csv")} disabled={invalidPeriod}>Export CSV</Button></Box>
          </Paper>)}
        </Box>
      </Box>}

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between" }}><Typography sx={{ fontWeight: 800 }}>All reports</Typography><Chip size="small" label={`${visible.length} available`} /></Box>
        <ListState loading={loading} empty={visible.length === 0} emptyTitle="No matching reports" emptyDesc="Change the search or category filters to see more reports.">
          <Box sx={{ display: "grid", gap: 2, p: 2 }}>
            {reportGroups.map((group) => <Box key={group.name}>
              <Typography variant="overline" sx={{ fontWeight: 900, color: "text.secondary" }}>{group.name}</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 1, mt: .5 }}>
                {group.reports.map((report) => <Box key={report.key} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                  <Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{report.name}</Typography><Typography variant="caption" color="text.secondary">{report.section || report.description || group.name}</Typography></Box>
                  <Box sx={{ display: "flex", gap: .5, flexShrink: 0 }}><Button size="small" onClick={() => exportReport(report, "csv")} disabled={invalidPeriod}>CSV</Button><Button size="small" onClick={() => exportReport(report, "xlsx")} disabled={invalidPeriod}>Excel</Button><Button size="small" variant="outlined" onClick={() => exportReport(report, "pdf")} disabled={invalidPeriod}>PDF</Button></Box>
                </Box>)}
              </Box>
            </Box>)}
          </Box>
        </ListState>
      </Paper>
    </Box>
  );
}

