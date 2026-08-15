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

export function ExpensesView({ rows, financial, loading, search, setSearch, setTab, onAdd, onAction }: {
  rows: Row[]; financial: FinancialAnalytics | null; loading: boolean;
  search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void; onAdd: () => void;
  onAction: (row: ExpenseRow, action: "submit" | "approve" | "reject" | "mark-paid") => void;
}) {
  const expenses = rows as ExpenseRow[];
  const kpis = financial?.kpis;
  const income = Number(kpis?.income ?? 0);
  const spent = Number(kpis?.expenses ?? 0);
  const net = Number(kpis?.net ?? income - spent);
  const expensesByCategory = financial?.expensesByCategory ?? [];
  const expenseMax = Math.max(...expensesByCategory.map((c) => Number(c.total ?? 0)), 1);
  const netMax = Math.max(income, spent, 1);
  const incomeByCategory = financial?.incomeByMethod ?? [];
  const incomeTotal = incomeByCategory.reduce((s, c) => s + Number(c.total ?? 0), 0);
  const incomePct = (part: unknown) => incomeTotal > 0 ? Math.round((Number(part ?? 0) / incomeTotal) * 100) : 0;
  const categoryColors = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6366f1"];
  const incomeDonutStops = incomeByCategory.reduce<string>((acc, c, i) => {
    const p = incomePct(c.total);
    const prev = incomeByCategory.slice(0, i).reduce((s, pc) => s + incomePct(pc.total), 0);
    return `${acc}${categoryColors[i % categoryColors.length]} ${prev}% ${prev + p}%, `;
  }, "");
  const incomeDonut = incomeTotal > 0
    ? `conic-gradient(${incomeDonutStops}var(--surface-3) ${incomeByCategory.reduce((s, c) => s + incomePct(c.total), 0)}% 100%)`
    : "conic-gradient(var(--surface-3) 0% 100%)";

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="📈" iconBg="#dcfce7" iconColor="#16a34a" label="Total Income" value={kM(income)} sub="Receipts YTD" link="View receipts" onClick={() => setTab("receipts")} />
        <KpiCard icon="📉" iconBg="#fee2e2" iconColor="#dc2626" label="Total Expenses" value={kM(spent)} sub="Approved & paid" link="View expenses" onClick={() => setTab("expenses")} />
        <KpiCard icon="◔" iconBg="#dbeafe" iconColor="#2563eb" label="Net Income" value={kM(net)} sub="Income less expenses" link="View expenses" onClick={() => setTab("expenses")} />
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Transactions" value={kN(expenses.length)} sub="Recent expense lines" link="View expenses" onClick={() => setTab("expenses")} />
      </KpiStrip>

      <ViewToolbar title="Property Expenses" subtitle="Track and analyse income and expenses for the selected property" search={search} onSearch={setSearch} placeholder="Search supplier or category…">
        <button className="btn primary sm" onClick={onAdd}>+ Record expense</button>
      </ViewToolbar>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Income vs Expenses (YTD)" action={<button className="btn ghost sm" onClick={() => setTab("receipts")}>Collections →</button>}>
          <div className="row" style={{ alignItems: "flex-end", gap: 24, height: 150, padding: "18px 20px 8px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 44, height: `${Math.max(pct(income, netMax), 3)}%`, background: "#22c55e", borderRadius: "6px 6px 0 0" }} />
              <span className="muted" style={{ fontSize: 11 }}>Income</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 44, height: `${Math.max(pct(spent, netMax), 3)}%`, background: "#e23b3b", borderRadius: "6px 6px 0 0" }} />
              <span className="muted" style={{ fontSize: 11 }}>Expenses</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 44, height: `${Math.max(pct(net, netMax), 3)}%`, background: "#2563eb", borderRadius: "6px 6px 0 0" }} />
              <span className="muted" style={{ fontSize: 11 }}>Net</span>
            </div>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Income", amount: income, color: "#22c55e" },
              { label: "Expenses", amount: spent, color: "#e23b3b" },
              { label: "Net", amount: net, color: "#2563eb" },
            ].map((row) => (
              <div key={row.label} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                  <i style={{ background: row.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                  {row.label}
                </span>
                <strong className="mono">{kM(row.amount)}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Expenses by Category">
          {expensesByCategory.length > 0 ? (
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {expensesByCategory.slice(0, 8).map((c) => (
                <div key={c.category} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, width: 150, color: "var(--muted)" }}>{String(c.category ?? "—")}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{ width: `${pct(c.total, expenseMax)}%`, height: "100%", background: "#e23b3b" }} />
                  </div>
                  <strong className="mono" style={{ fontSize: 11, width: 84, textAlign: "right" }}>{kM(c.total)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="📊" title="No category data" description="Expense breakdown by category will appear here once expenses are recorded." />
          )}
        </Panel>
      </div>

      <Panel title="Income by Category" action={<button className="btn ghost sm" onClick={() => setTab("receipts")}>Collections →</button>}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: incomeDonut, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{kM(income)}</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {incomeByCategory.slice(0, 5).map((c, i) => (
              <div key={c.payment_method} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                  <i style={{ background: categoryColors[i % categoryColors.length], borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />{String(c.payment_method ?? "—")}
                </span>
                <strong className="mono">{kM(c.total)}</strong>
              </div>
            ))}
          </div>
        </div>
      </Panel>

        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 260 }}>
        </div>
      </div>

      <Panel title="Recent Transactions" action={<button className="btn ghost sm" onClick={() => setTab("receipts")}>Receipts →</button>}>
        <ListState loading={loading} empty={expenses.length === 0} emptyTitle="No transactions found" emptyDesc="Recorded property expenses and supplier invoices appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Property</th>
                  <th>Supplier / Description</th>
                  <th>Category</th>
                  <th>Invoice No</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={String(e.id)}>
                    <td style={{ fontSize: 12 }}>{fmtDate(e.incurred_on)}</td>
                    <td style={{ fontSize: 12 }}>{String(e.property_name ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(e.supplier ?? e.description ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(e.category ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      <div>{String(e.invoice_number ?? "—")}</div>
                      {(e.attachment_url || (e as any).document_url || (e as any).receipt_url) && (
                        <a
                          href={String(e.attachment_url || (e as any).document_url || (e as any).receipt_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn ghost sm"
                          style={{ fontSize: 10, padding: "1px 6px", marginTop: 2, display: "inline-block" }}
                        >
                          📎 Soft Copy
                        </a>
                      )}
                    </td>
                    <td className="mono" style={{ color: "var(--danger)", fontWeight: 700 }}>{kM(e.amount)}</td>
                    <td><StatusPill value={String(e.status ?? "—")} /></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {(["draft", "rejected"].includes(String(e.status))) && <button className="btn ghost sm" onClick={() => onAction(e, "submit")}>Submit</button>}
                        {e.status === "pending" && <button className="btn primary sm" onClick={() => onAction(e, "approve")}>Approve</button>}
                        {e.status === "pending" && <button className="btn ghost sm" onClick={() => onAction(e, "reject")}>Reject</button>}
                        {e.status === "approved" && <button className="btn primary sm" onClick={() => onAction(e, "mark-paid")}>Mark paid</button>}
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

/* ─── FEES ─── */
