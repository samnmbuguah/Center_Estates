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

export function BudgetsView({ rows, loading, search, setSearch, setTab, onSelectRow, onAdd, onAction }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void; onSelectRow: (r: Row) => void; onAdd: () => void;
  onAction: (row: BudgetRow, action: "submit" | "approve" | "reject") => void;
}) {
  const budgets = rows as BudgetRow[];
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount ?? 0), 0);
  const totalActual = budgets.reduce((s, b) => s + Number(b.actual_amount ?? 0), 0);
  const totalVariance = budgets.reduce((s, b) => s + Number(b.variance ?? 0), 0);
  const utilization = pct(totalActual, totalBudget);
  const gaugeColor = utilization > 90 ? "var(--danger)" : utilization > 80 ? "var(--warning)" : "var(--success)";

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🎯" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Budget" value={kM(totalBudget)} sub="Draft, pending & approved" />
        <KpiCard icon="💸" iconBg="#dbeafe" iconColor="#2563eb" label="Actual Spend" value={kM(totalActual)} sub="Approved expenses" />
        <KpiCard icon="◔" iconBg="#fef3c7" iconColor="#d97706" label="Utilization" value={`${utilization}%`} sub="Actual vs budget" />
        <KpiCard icon="▽" iconBg="#fee2e2" iconColor="#dc2626" label="Variance" value={kM(totalVariance)} sub="Budget less actual" />
      </KpiStrip>

      <ViewToolbar title="Budgets & Estimates" subtitle="Budget versus actual performance for the selected property" search={search} onSearch={setSearch} placeholder="Search by category or year…">
        <button className="btn primary sm" onClick={onAdd}>+ Add budget line</button>
      </ViewToolbar>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Budget Utilization" action={<button className="btn ghost sm" onClick={() => setTab("service-charges")}>Service Charges →</button>}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
              <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(${gaugeColor} 0% ${utilization}%, var(--surface-3) ${utilization}% 100%)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{utilization}%</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                    <i style={{ background: gaugeColor, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Utilization
                  </span>
                  <strong className="mono">{utilization}%</strong>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                    <i style={{ background: "var(--primary)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Total Budget
                  </span>
                  <strong className="mono">{kM(totalBudget)}</strong>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                    <i style={{ background: "var(--danger)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Actual Spend
                  </span>
                  <strong className="mono">{kM(totalActual)}</strong>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Recent Budgets">
        <ListState loading={loading} empty={budgets.length === 0} emptyTitle="No budgets found" emptyDesc="Property budgets and estimates will appear here once created.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Budget</th>
                  <th>Type</th>
                  <th>Year</th>
                  <th>Total</th>
                  <th>Actual</th>
                  <th>Utilization</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => {
                  const u = pct(b.actual_amount, b.amount);
                  return (
                    <tr key={String(b.id)} onClick={() => onSelectRow(b)}>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(b.category ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(b.category ?? "—")}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(b.year ?? "—")}</td>
                      <td className="mono">{kM(b.amount)}</td>
                      <td className="mono">{kM(b.actual_amount)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(u, 100)}%`, height: "100%", background: u >= 90 ? "#e23b3b" : "#2563eb" }} />
                          </div>
                          <span className="mono" style={{ fontSize: 11, width: 34, textAlign: "right" }}>{u}%</span>
                        </div>
                      </td>
                      <td><StatusPill value={String(b.status ?? "—")} /></td>
                      <td style={{ fontSize: 12 }}>{fmtDate(b.created_at)}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {(["draft", "rejected"].includes(String(b.status))) && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onAction(b, "submit"); }}>Submit</button>}
                          {b.status === "pending" && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(b, "approve"); }}>Approve</button>}
                          {b.status === "pending" && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onAction(b, "reject"); }}>Reject</button>}
                          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onSelectRow(b); }}>View</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 260 }}>
        </div>
      </div>
    </>
  );
}

/* ─── EXPENSES ─── */
