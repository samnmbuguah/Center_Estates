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

export function ServiceChargeReconciliationsView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
}) {
  const reconciliations = rows as ServiceChargeReconciliationRow[];

  return (
    <>
      <ViewToolbar title="Service Charge Reconciliations" subtitle="Budget vs actual for each scheme period" search={search} onSearch={setSearch} placeholder="Search charge or period…" />

      <Panel title="Reconciliations">
        <ListState loading={loading} empty={reconciliations.length === 0} emptyTitle="No reconciliations found" emptyDesc="Period reconciliations comparing budgeted to actual expenditure appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Reconciliation</th>
                  <th>Charge</th>
                  <th>Period</th>
                  <th>Billed</th>
                  <th>Collected</th>
                  <th>Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.map((r) => (
                  <tr key={String(r.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{shortId(r.id)}</td>
                    <td style={{ fontSize: 12 }}>{String(r.service_charge_name ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.period_start)} — {fmtDate(r.period_end)}</td>
                    <td className="mono">{kM(r.budgeted_amount)}</td>
                    <td className="mono">{kM(r.actual_amount)}</td>
                    <td className="mono" style={{ color: Number(r.variance ?? 0) < 0 ? "var(--danger)" : "#16a34a" }}>{kM(r.variance)}</td>
                    <td><StatusPill value={String(r.status ?? "—")} /></td>
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

/* ─── BUDGETS ─── */

