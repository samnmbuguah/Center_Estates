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

export const sampleProperties = [
  { name: "Nairobi Business Park", value: 450000000, incomeYtd: 36000000, occupancy: 94, noi: 23400000, capRate: 7.8 },
  { name: "Mombasa Plaza", value: 280000000, incomeYtd: 22400000, occupancy: 88, noi: 14784000, capRate: 7.9 },
  { name: "Kisumu Commercial Centre", value: 190000000, incomeYtd: 15200000, occupancy: 91, noi: 9880000, capRate: 7.8 },
  { name: "Upper Hill Heights", value: 520000000, incomeYtd: 41600000, occupancy: 96, noi: 29952000, capRate: 8.6 },
  { name: "Westlands Square", value: 340000000, incomeYtd: 27200000, occupancy: 85, noi: 15504000, capRate: 6.8 },
];

export const sampleDistributions = [
  { date: "2026-07-31", property: "Nairobi Business Park", amount: 4850000, status: "Paid" },
  { date: "2026-07-31", property: "Mombasa Plaza", amount: 3100000, status: "Paid" },
  { date: "2026-07-31", property: "Upper Hill Heights", amount: 6200000, status: "Pending" },
  { date: "2026-06-30", property: "Kisumu Commercial Centre", amount: 2050000, status: "Paid" },
];

export const occupancyTrend = [
  { month: "Jan", rate: 87 }, { month: "Feb", rate: 88 }, { month: "Mar", rate: 89 },
  { month: "Apr", rate: 90 }, { month: "May", rate: 92 }, { month: "Jun", rate: 91 },
];

export const expenseBreakdown = [
  { category: "Maintenance", amount: 8200000, color: "#3b82f6" },
  { category: "Utilities", amount: 5400000, color: "#f59e0b" },
  { category: "Security", amount: 3800000, color: "#8b5cf6" },
  { category: "Insurance", amount: 2900000, color: "#ec4899" },
  { category: "Property Tax", amount: 4500000, color: "#ef4444" },
  { category: "Management", amount: 3200000, color: "#22c55e" },
];

export const incomeByProperty = [
  { name: "Nairobi BP", income: 36000000, color: "#3b82f6" },
  { name: "Upper Hill", income: 41600000, color: "#22c55e" },
  { name: "Westlands", income: 27200000, color: "#f59e0b" },
  { name: "Mombasa Plz", income: 22400000, color: "#8b5cf6" },
  { name: "Kisumu CC", income: 15200000, color: "#ec4899" },
];

export function OwnerPortalView() {
  const portfolioValue = sampleProperties.reduce((s, p) => s + p.value, 0);
  const grossIncome = sampleProperties.reduce((s, p) => s + p.incomeYtd, 0);
  const noiTotal = sampleProperties.reduce((s, p) => s + p.noi, 0);
  const avgOccupancy = Math.round(sampleProperties.reduce((s, p) => s + p.occupancy, 0) / sampleProperties.length);
  const capex = 12800000;
  const dscr = 1.85;
  const incomeMax = Math.max(...incomeByProperty.map((p) => p.income), 1);
  const trendMax = Math.max(...occupancyTrend.map((t) => t.rate), 1);
  const expenseTotal = expenseBreakdown.reduce((s, e) => s + e.amount, 0);
  const expenseDonut = expenseTotal > 0
    ? `conic-gradient(${expenseBreakdown.reduce((acc, e, i) => {
        const pct = Math.round((e.amount / expenseTotal) * 100);
        const prev = expenseBreakdown.slice(0, i).reduce((s, pe) => s + Math.round((pe.amount / expenseTotal) * 100), 0);
        return `${acc}${e.color} ${prev}% ${prev + pct}%, `;
      }, "")}var(--surface-3) ${expenseBreakdown.reduce((s, e) => s + Math.round((e.amount / expenseTotal) * 100), 0)}% 100%)`
    : "conic-gradient(var(--surface-3) 0% 100%)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <KpiStrip cols={6}>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Portfolio Value" value={kM(portfolioValue)} sub="Aggregate valuation" />
        <KpiCard icon="💰" iconBg="#dcfce7" iconColor="#16a34a" label="Gross Rental Income" value={kM(grossIncome)} sub="Year to date" />
        <KpiCard icon="📈" iconBg="#dbeafe" iconColor="#2563eb" label="Net Operating Income" value={kM(noiTotal)} sub={`${Math.round((noiTotal / grossIncome) * 100)}% margin`} />
        <KpiCard icon="▣" iconBg="#e0f2fe" iconColor="#0284c7" label="Occupancy Rate" value={`${avgOccupancy}%`} sub="Portfolio average" />
        <KpiCard icon="🔧" iconBg="#fee2e2" iconColor="#dc2626" label="Capital Expenditure" value={kM(capex)} sub="Year to date" />
        <KpiCard icon="📊" iconBg="#fef3c7" iconColor="#d97706" label="DSCR" value={`${dscr.toFixed(2)}x`} sub="Debt Service Coverage" />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Income by Property" action={<button className="btn ghost sm">Download →</button>}>
          <div className="row" style={{ alignItems: "flex-end", gap: 20, height: 170, padding: "18px 20px 8px", borderBottom: "1px solid var(--border)" }}>
            {incomeByProperty.map((p) => (
              <div key={p.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div title={`${kM(p.income)}`} style={{ width: 36, height: `${Math.max((p.income / incomeMax) * 100, 3)}%`, background: p.color, borderRadius: "6px 6px 0 0" }} />
                <span className="muted" style={{ fontSize: 10 }}>{p.name}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            {incomeByProperty.map((p) => (
              <div key={p.name} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                  <i style={{ background: p.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />{p.name}
                </span>
                <strong className="mono">{kM(p.income)}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Occupancy Trend (6-Month)">
          <div className="row" style={{ alignItems: "flex-end", gap: 16, height: 170, padding: "18px 20px 8px", borderBottom: "1px solid var(--border)" }}>
            {occupancyTrend.map((t) => (
              <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div title={`${t.rate}%`} style={{ width: 28, height: `${Math.max((t.rate / trendMax) * 100, 3)}%`, background: "var(--primary)", borderRadius: "4px 4px 0 0" }} />
                <span className="muted" style={{ fontSize: 11 }}>{t.month}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Top Properties" action={<button className="btn ghost sm">Export →</button>}>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Value</th>
                    <th>Income YTD</th>
                    <th>Occupancy</th>
                    <th>NOI</th>
                    <th>Cap Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleProperties.map((p) => (
                    <tr key={p.name}>
                      <td><strong style={{ fontSize: 12 }}>{p.name}</strong></td>
                      <td className="mono">{kM(p.value)}</td>
                      <td className="mono">{kM(p.incomeYtd)}</td>
                      <td><Badge tone={occupancyTone(p.occupancy)}>{p.occupancy}%</Badge></td>
                      <td className="mono">{kM(p.noi)}</td>
                      <td className="mono">{p.capRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Recent Distributions">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Property</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleDistributions.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>{fmtDate(d.date)}</td>
                      <td style={{ fontSize: 12 }}>{d.property}</td>
                      <td className="mono">{kM(d.amount)}</td>
                      <td><StatusPill value={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Expense Breakdown">
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px" }}>
              <div style={{ width: 110, height: 110, borderRadius: "50%", background: expenseDonut, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{kM(expenseTotal)}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                {expenseBreakdown.map((e) => (
                  <div key={e.category} className="row" style={{ justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 6 }}>
                      <i style={{ background: e.color, borderRadius: "50%", display: "inline-block", height: 7, width: 7 }} />{e.category}
                    </span>
                    <strong className="mono">{kM(e.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
}

