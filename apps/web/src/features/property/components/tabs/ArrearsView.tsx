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
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Amount</th>
                  <th>% of total</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => {
                  const amount = Number(summary[b.key] ?? 0) + (b.key === "over_120" ? Number(summary["91_120"] ?? 0) : 0);
                  return (
                    <tr key={b.key}>
                      <td style={{ fontSize: 12 }}>{b.label}</td>
                      <td className="mono" style={{ color: amount > 0 ? "var(--danger)" : "var(--muted)" }}>{kM(amount)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{ width: `${pct(amount, total)}%`, height: "100%", background: amount > 0 ? "var(--color-brand-red)" : "var(--border-strong)" }} />
                          </div>
                          <span className="mono" style={{ fontSize: 11, width: 40, textAlign: "right" }}>{pct(amount, total)}%</span>
                        </div>
                      </td>
                      <td className="mono">{kM(amount)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td><strong style={{ fontSize: 12 }}>Total Outstanding</strong></td>
                  <td className="mono" style={{ color: "var(--danger)" }}><strong>{kM(total)}</strong></td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="✓" title="No arrears" description="There are no outstanding balances to report." />
        )}
      </Panel>

      <Panel title="Tenants in Arrears">
        <ListState loading={loading} empty={tenants.length === 0} emptyTitle="No tenants in arrears" emptyDesc="Tenants with unpaid invoices will appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th>Outstanding</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, i) => (
                  <tr key={i}>
                    <td><strong style={{ fontSize: 12 }}>{String(t.tenant ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(t.property ?? "—")}</td>
                    <td className="mono" style={{ color: "var(--danger)" }}>{kM(t.outstanding)}</td>
                    <td><Badge tone={Number(t.oldest_days ?? 0) > 90 ? "red" : Number(t.oldest_days ?? 0) > 60 ? "yellow" : "blue"}>{kN(t.oldest_days)}d</Badge></td>
                    <td><Badge tone="red">Overdue</Badge></td>
                    <td>
                      <button className="btn ghost sm" onClick={() => onNavigateReminders(String(t.tenant ?? ""))}>Send reminder</button>
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

/* ─── REMINDERS ─── */

