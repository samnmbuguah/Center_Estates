"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Box, Button, Chip, MenuItem, TextField, Typography } from "@mui/material";
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
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Invoice</th>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Sent At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={String(r.id)}>
                    <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(r.invoice_number ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.channel ?? "—").replace(/_/g, " ")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.recipient ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.sent_at)}</td>
                    <td><Badge tone="green">Sent</Badge></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn ghost sm" onClick={() => onSendReminder(r)}>Send now</button>
                        <button className="btn ghost sm" onClick={() => setTab("rent")}>Invoices</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
    </>
  );
}

/* ─── RECEIPTS ─── */

