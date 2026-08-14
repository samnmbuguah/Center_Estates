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

export function ReceiptAllocationsView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
}) {
  const allocations = rows as ReceiptAllocationRow[];

  return (
    <>
      <ViewToolbar title="Receipt Allocations" subtitle="How each receipt is allocated against open invoices" search={search} onSearch={setSearch} placeholder="Search receipt, invoice or tenant…" />

      <Panel title="Allocations">
        <ListState loading={loading} empty={allocations.length === 0} emptyTitle="No allocations found" emptyDesc="Receipts allocated to invoices appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Allocation</th>
                  <th>Receipt</th>
                  <th>Invoice</th>
                  <th>Tenant</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={String(a.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{shortId(a.id)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(a.receipt_number ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(a.invoice_number ?? "—")}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(a.tenant_name ?? "—")}</strong></td>
                    <td className="mono">{kM(a.amount)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(a.created_at)}</td>
                    <td><Badge tone="green">Applied</Badge></td>
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

/* ─── BANK RECONCILIATION ─── */

