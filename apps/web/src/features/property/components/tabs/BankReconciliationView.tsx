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

export function BankReconciliationView({
  rows,
  loading,
  search,
  setSearch,
  onMatch = () => {},
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onMatch?: (r: any) => void;
}) {
  const transactions = rows as BankTransactionRow[];

  return (
    <>
      <ViewToolbar title="Bank Reconciliation" subtitle="Match bank statements to recorded receipts" search={search} onSearch={setSearch} placeholder="Search reference or description…" />

      <Panel title="Bank Transactions">
        <ListState loading={loading} empty={transactions.length === 0} emptyTitle="No bank transactions found" emptyDesc="Imported bank statement transactions appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Transaction Ref</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Receipt</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={String(t.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(t.reference ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(t.transacted_on)}</td>
                    <td style={{ fontSize: 12 }}>{String(t.description ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(t.receipt_number ?? "—")}</td>
                    <td className="mono">{kM(t.amount)}</td>
                    <td><StatusPill value={String(t.status ?? "—")} /></td>
                    <td>
                      {t.status !== "matched" && (
                        <button className="btn ghost sm" onClick={() => onMatch(t)}>Match</button>
                      )}
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

/* ─── CREDIT NOTES ─── */

