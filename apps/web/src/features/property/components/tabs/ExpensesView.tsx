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
  const categoryColors = ["var(--color-green)", "var(--color-blue)", "var(--color-amber)", "var(--color-violet-strong)", "#ec4899", "#06b6d4", "#f97316", "var(--color-indigo-strong)"];
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
        <KpiCard icon="📈" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Total Income" value={kM(income)} sub="Receipts YTD" link="View receipts" onClick={() => setTab("receipts")} />
        <KpiCard icon="📉" iconBg="var(--color-red-bg)" iconColor="var(--color-danger)" label="Total Expenses" value={kM(spent)} sub="Approved & paid" link="View expenses" onClick={() => setTab("expenses")} />
        <KpiCard icon="◔" iconBg="var(--color-blue-bg)" iconColor="var(--color-info)" label="Net Income" value={kM(net)} sub="Income less expenses" link="View expenses" onClick={() => setTab("expenses")} />
        <KpiCard icon="🧾" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Transactions" value={kN(expenses.length)} sub="Recent expense lines" link="View expenses" onClick={() => setTab("expenses")} />
      </KpiStrip>

      <ViewToolbar title="Property Expenses" subtitle="Track and analyse income and expenses for the selected property" search={search} onSearch={setSearch} placeholder="Search supplier or category…">
        <button className="btn primary sm" onClick={onAdd}>Record expense</button>
      </ViewToolbar>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Income vs Expenses (YTD)" action={<button className="btn ghost sm" onClick={() => setTab("receipts")}>Collections →</button>}>
          <div className="row" style={{ alignItems: "flex-end", gap: 24, height: 150, padding: "18px 20px 8px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 44, height: `${Math.max(pct(income, netMax), 3)}%`, background: "var(--color-green)", borderRadius: "6px 6px 0 0" }} />
              <span className="muted" style={{ fontSize: 11 }}>Income</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 44, height: `${Math.max(pct(spent, netMax), 3)}%`, background: "var(--color-brand-red)", borderRadius: "6px 6px 0 0" }} />
              <span className="muted" style={{ fontSize: 11 }}>Expenses</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 44, height: `${Math.max(pct(net, netMax), 3)}%`, background: "var(--color-info)", borderRadius: "6px 6px 0 0" }} />
              <span className="muted" style={{ fontSize: 11 }}>Net</span>
            </div>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Income", amount: income, color: "var(--color-green)" },
              { label: "Expenses", amount: spent, color: "var(--color-brand-red)" },
              { label: "Net", amount: net, color: "var(--color-info)" },
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
                    <div style={{ width: `${pct(c.total, expenseMax)}%`, height: "100%", background: "var(--color-brand-red)" }} />
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
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Property</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Supplier / Description</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Invoice No</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Amount</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={String(e.id)} hover>
                    <TableCell><Typography variant="body2">{fmtDate(e.incurred_on)}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{String(e.property_name ?? "—")}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{String(e.supplier ?? e.description ?? "—")}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{String(e.category ?? "—")}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main" }}>
                        {String(e.invoice_number ?? "—")}
                      </Typography>
                      {(e.attachment_url || (e as any).document_url || (e as any).receipt_url) && (
                        <Button
                          component="a"
                          href={String(e.attachment_url || (e as any).document_url || (e as any).receipt_url)}
                          target="_blank"
                          rel="noreferrer"
                          size="small"
                          variant="outlined"
                          sx={{ minWidth: 0, px: 0.75, py: 0.1, fontSize: 10, mt: 0.5 }}
                        >
                          📎 Soft Copy
                        </Button>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "error.main" }}>
                        {kM(e.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center"><StatusPill value={String(e.status ?? "—")} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                        {(["draft", "rejected"].includes(String(e.status))) && (
                          <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onAction(e, "submit")}>Submit</Button>
                        )}
                        {e.status === "pending" && (
                          <Button size="small" variant="contained" color="success" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onAction(e, "approve")}>Approve</Button>
                        )}
                        {e.status === "pending" && (
                          <Button size="small" variant="outlined" color="error" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onAction(e, "reject")}>Reject</Button>
                        )}
                        {e.status === "approved" && (
                          <Button size="small" variant="contained" color="primary" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onAction(e, "mark-paid")}>Mark paid</Button>
                        )}
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

/* ─── FEES ─── */
