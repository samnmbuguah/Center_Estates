"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  Box, Button, Chip, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
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

export function ArrearsView({
  rows,
  analytics,
  loading,
  search,
  setSearch,
  onNavigateReminders = () => {},
  setTab = () => {},
  onSendReminder = () => {},
}: {
  rows: Row[];
  analytics: AgingAnalytics | null;
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onNavigateReminders?: (tenantName: string) => void;
  setTab?: (t: PropertyTab) => void;
  onSendReminder?: (row: any) => void;
}) {
  const tenants = rows as AgingTenantRow[];
  const summary = analytics?.summary ?? {};
  const total = Number(analytics?.total ?? Object.values(summary).reduce((s, v) => s + Number(v ?? 0), 0));
  const buckets = [
    { label: "0-30 days", key: "current" },
    { label: "31-60 days", key: "31_60" },
    { label: "61-90 days", key: "61_90" },
    { label: "90+ days", key: "over_120" },
  ];

  return (
    <>
      <ViewToolbar title="Arrears Register" subtitle="Tenants with outstanding balances and aged debt" search={search} onSearch={setSearch} placeholder="Search tenant or property…" />

      <Panel title="Aging Buckets (Outstanding)">
        {total > 0 ? (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Bucket</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>% of total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {buckets.map((b) => {
                  const amount = Number(summary[b.key] ?? 0) + (b.key === "over_120" ? Number(summary["91_120"] ?? 0) : 0);
                  return (
                    <TableRow key={b.key} hover>
                      <TableCell><Typography variant="body2">{b.label}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: amount > 0 ? "error.main" : "text.secondary" }}>
                          {kM(amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Box sx={{ flex: 1, height: 6, borderRadius: 99, bgcolor: "action.selected", overflow: "hidden" }}>
                            <Box sx={{ width: `${pct(amount, total)}%`, height: "100%", bgcolor: amount > 0 ? "error.main" : "text.disabled" }} />
                          </Box>
                          <Typography variant="caption" sx={{ fontFamily: "ui-monospace, monospace", width: 40, textAlign: "right" }}>
                            {pct(amount, total)}%
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
                          {kM(amount)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow sx={{ bgcolor: "action.selected" }}>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>Total Outstanding</Typography></TableCell>
                  <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "error.main", fontWeight: 800 }}>{kM(total)}</Typography></TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState icon="✓" title="No arrears" description="There are no outstanding balances to report." />
        )}
      </Panel>

      <Panel title="Tenants in Arrears">
        <ListState loading={loading} empty={tenants.length === 0} emptyTitle="No tenants in arrears" emptyDesc="Tenants with unpaid invoices will appear here.">
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Property</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Outstanding</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Days</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.map((t, i) => (
                  <TableRow key={i} hover>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(t.tenant ?? "—")}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{String(t.property ?? "—")}</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "error.main", fontWeight: 700 }}>
                        {kM(t.outstanding)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center"><Badge tone={Number(t.oldest_days ?? 0) > 90 ? "red" : Number(t.oldest_days ?? 0) > 60 ? "yellow" : "blue"}>{kN(t.oldest_days)}d</Badge></TableCell>
                    <TableCell align="center"><Badge tone="red">Overdue</Badge></TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onNavigateReminders(String(t.tenant ?? ""))}>
                        Send reminder
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </ListState>
      </Panel>
    </>
  );
}

/* ─── REMINDERS ─── */

