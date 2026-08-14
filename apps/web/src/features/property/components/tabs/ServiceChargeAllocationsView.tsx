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

export function ServiceChargeAllocationsView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
}) {
  const allocations = rows as ServiceChargeAllocationRow[];

  return (
    <>
      <ViewToolbar title="Charge Allocations" subtitle="Unit-level apportionment for each service charge" search={search} onSearch={setSearch} placeholder="Search charge or unit…" />

      <Panel title="Allocations">
        <ListState loading={loading} empty={allocations.length === 0} emptyTitle="No allocations found" emptyDesc="Generate allocations from a service charge to apportion its budget across units.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Allocation</th>
                  <th>Charge</th>
                  <th>Unit</th>
                  <th>Ratio</th>
                  <th>Monthly Amount</th>
                  <th>Annual Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={String(a.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{shortId(a.id)}</td>
                    <td style={{ fontSize: 12 }}>{String(a.service_charge_name ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(a.unit_code ?? "—")}</td>
                    <td className="mono">{Number((Number(a.ratio ?? 0) * 100).toFixed(2))}%</td>
                    <td className="mono">{kM(a.monthly_amount)}</td>
                    <td className="mono">{kM(a.annual_amount)}</td>
                    <td><Badge tone="green">Active</Badge></td>
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

/* ─── SERVICE CHARGE RECONCILIATIONS (dedicated tab) ─── */
