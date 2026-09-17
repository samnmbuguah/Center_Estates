"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  Box, Button, Chip, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
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

export function RemindersView({ rows, loading, search, setSearch, onSendReminder, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  onSendReminder: (r: ReminderRow) => void; setTab: (t: PropertyTab) => void;
}) {
  const reminders = rows as ReminderRow[];

  return (
    <>
      <ViewToolbar title="Payment Reminders" subtitle="Sent and scheduled payment reminders" search={search} onSearch={setSearch} placeholder="Search tenant or invoice…" />

      <Panel title="Reminders">
        <ListState loading={loading} empty={reminders.length === 0} emptyTitle="No reminders found" emptyDesc="Payment reminders sent from the collection workflow appear here.">
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Invoice</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Channel</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Recipient</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Sent At</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reminders.map((r) => (
                  <TableRow key={String(r.id)} hover>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(r.tenant_name ?? "—")}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main" }}>
                        {String(r.invoice_number ?? "—")}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{String(r.channel ?? "—").replace(/_/g, " ")}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{String(r.recipient ?? "—")}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{fmtDate(r.sent_at)}</Typography></TableCell>
                    <TableCell align="center"><Badge tone="green">Sent</Badge></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                        <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onSendReminder(r)}>Send now</Button>
                        <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => setTab("rent")}>Invoices</Button>
                      </Stack>
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

/* ─── RECEIPTS ─── */

