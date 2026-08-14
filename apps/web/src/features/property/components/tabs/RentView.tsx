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

function renderInvoiceRows(invoices: InvoiceRow[], full: boolean, onPay: (id: ID) => void, onRemind: (row: InvoiceRow) => void, onAction: (row: InvoiceRow, action: "submit-review" | "approve" | "issue" | "void") => void, onSelect: (r: Row) => void, onDownloadPdf: (row: InvoiceRow) => void, canFinance: boolean, canApprove: boolean) {
  return invoices.map((inv) => (
    <tr key={String(inv.id)} onClick={() => onSelect(inv)}>
      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(inv.number ?? "—")}</td>
      <td><strong style={{ fontSize: 12 }}>{String(inv.tenant_name ?? "—")}</strong></td>
      <td style={{ fontSize: 12 }}>{String((inv.metadata as Record<string, unknown> | undefined)?.property_name ?? "—")}</td>
      {full && <td style={{ fontSize: 12 }}>{fmtDate(inv.issued_on)}</td>}
      <td style={{ fontSize: 12 }}>{fmtDate(inv.due_on)}</td>
      <td className="mono">{kM(inv.amount)}</td>
      {full && <td className="mono" style={{ color: Number(inv.amount) - Number(inv.balance ?? 0) > 0 ? "#16a34a" : "var(--muted)" }}>{kM(Number(inv.amount) - Number(inv.balance ?? 0))}</td>}
      <td className="mono" style={{ color: Number(inv.balance ?? 0) > 0 ? "var(--danger)" : "#16a34a" }}>{kM(inv.balance)}</td>
      <td><StatusPill value={String(inv.status ?? "—")} /></td>
      <td>
        <div className="row" style={{ gap: 6 }}>
          {Number(inv.balance ?? 0) > 0 && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onPay(String(inv.id)); }}>Pay</button>}
          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onDownloadPdf(inv); }}>PDF</button>
          {Number(inv.balance ?? 0) > 0 && !["draft", "void", "paid"].includes(String(inv.status)) && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onRemind(inv); }}>Send reminder</button>}
          {inv.status === "draft" && canFinance && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(inv, "submit-review"); }}>Submit review</button>}
          {inv.status === "review" && canApprove && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(inv, "approve"); }}>Approve</button>}
          {inv.status === "approved" && canApprove && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(inv, "issue"); }}>Issue</button>}
          {(["draft", "issued", "overdue"].includes(String(inv.status))) && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onAction(inv, "void"); }}>Void</button>}
        </div>
      </td>
    </tr>
  ));
}

export function RentView({
  rows = [],
  rentInvoices = [],
  invoices,
  receipts = [],
  arrears = [],
  reminders = [],
  analytics = null,
  rentSection = "invoices",
  activeSection,
  setRentSection = () => {},
  onSectionChange,
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  onRecordReceipt = () => {},
  onQuickReceipt = () => {},
  onComposeInvoice = () => {},
  onSendReminder = () => {},
  onInvoiceAction = () => {},
  onVoidInvoice = () => {},
  onSelectRow = () => {},
  onAddInvoice = () => {},
  onDownloadPdf = () => {},
  onRefresh = () => {},
  canFinance = true,
  canApprove = true,
}: {
  rows?: Row[];
  rentInvoices?: InvoiceRow[];
  invoices?: InvoiceRow[];
  receipts?: Row[];
  arrears?: Row[];
  reminders?: Row[];
  analytics?: AgingAnalytics | null;
  rentSection?: RentSection;
  activeSection?: RentSection;
  setRentSection?: (s: RentSection) => void;
  onSectionChange?: (s: RentSection) => void;
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  onRecordReceipt?: (invoiceId?: ID) => void;
  onQuickReceipt?: (inv: InvoiceRow) => void;
  onComposeInvoice?: () => void;
  onSendReminder?: (row: InvoiceRow) => void;
  onInvoiceAction?: (row: InvoiceRow, action: "submit-review" | "approve" | "issue" | "void") => void;
  onVoidInvoice?: (inv: InvoiceRow) => void;
  onSelectRow?: (r: Row) => void;
  canFinance?: boolean;
  canApprove?: boolean;
  onAddInvoice?: () => void;
  onDownloadPdf?: (row: InvoiceRow) => void;
  onRefresh?: () => void;
}) {
  const currentInvoices = invoices || rentInvoices;
  const currentSection = activeSection || rentSection || "invoices";
  const setCurrentSection = onSectionChange || setRentSection;
  const totalBilled = currentInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const outstanding = currentInvoices.reduce((s, i) => s + Number(i.balance ?? 0), 0);
  const collected = Math.max(totalBilled - outstanding, 0);
  const collectionRate = pct(collected, totalBilled);
  const dueThisMonth = rentInvoices.filter((i) => {
    const d = new Date(String(i.due_on ?? ""));
    const now = new Date();
    return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && Number(i.balance ?? 0) > 0;
  }).length;
  const aging = analytics?.summary ?? {};
  const agingTotal = Object.values(aging).reduce((s, v) => s + Number(v ?? 0), 0);
  const agingBuckets = [
    { label: "Current (0-30)", key: "current" },
    { label: "31-60", key: "31_60" },
    { label: "61-90", key: "61_90" },
    { label: "91-120", key: "91_120" },
    { label: "120+", key: "over_120" },
  ];
  const topTenants = analytics?.tenants ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>

      <KpiStrip>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Billed" value={kM(totalBilled)} sub={`${kN(dueThisMonth)} due this month`} link="View invoices" onClick={() => setRentSection("invoices")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Collected" value={kM(collected)} sub={`${collectionRate}% collection rate`} link="View receipts" onClick={() => setRentSection("receipts")} />
        <KpiCard icon="◔" iconBg="#e0f2fe" iconColor="#0284c7" label="Collection Rate" value={`${collectionRate}%`} sub="Billed vs collected" link="View invoices" onClick={() => setRentSection("invoices")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding" value={kM(outstanding)} sub="Unpaid balances" link="View arrears" onClick={() => setRentSection("arrears")} />
        <KpiCard icon="📅" iconBg="#fff7ed" iconColor="#ea580c" label="Due This Month" value={kN(dueThisMonth)} sub="Open invoices" link="View invoices" onClick={() => setRentSection("invoices")} />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

      {rentSection === "invoices" && (
        <Panel title="Rent Invoices & Collection Ledger" action={<div className="row" style={{ gap: 8 }}>{canFinance && <button className="btn ghost sm" onClick={onAddInvoice}>+ New invoice</button>}<button className="btn primary sm" onClick={() => onRecordReceipt()}>+ Record Rent Payment</button></div>}>
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No invoices found" emptyDesc="Generate invoices from rent schedules or issue draft invoices.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th>Due Date</th>
                    <th>Billed</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>{renderInvoiceRows(rows as InvoiceRow[], false, onRecordReceipt, onSendReminder, onInvoiceAction, onSelectRow, onDownloadPdf, canFinance, canApprove)}</tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {rentSection === "ledger" && (
        <Panel title="Invoice Ledger" action={<button className="btn primary sm" onClick={() => onRecordReceipt()}>+ Record Rent Payment</button>}>
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No ledger entries" emptyDesc="Issued invoices will appear in the ledger with payment status.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th>Issued</th>
                    <th>Due Date</th>
                    <th>Billed</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>{renderInvoiceRows(rows as InvoiceRow[], true, onRecordReceipt, onSendReminder, onInvoiceAction, onSelectRow, onDownloadPdf, canFinance, canApprove)}</tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {rentSection === "receipts" && (
        <Panel title="Receipts">
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No receipts found" emptyDesc="Recorded rent payments appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Tenant</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as ReceiptRow[]).map((r) => (
                    <tr key={String(r.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(r.number ?? "—")}</td>
                      <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.received_on)}</td>
                      <td style={{ fontSize: 12 }}>{String(r.payment_method ?? "—").replace(/_/g, " ")}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(r.external_reference ?? "—")}</td>
                      <td className="mono">{kM(r.amount)}</td>
                      <td><Badge tone={r.invoice ? "green" : "yellow"}>{r.invoice ? "Applied" : "Unapplied"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {rentSection === "arrears" && (
        <Panel title="Arrears">
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No arrears" emptyDesc="Tenants with outstanding balances appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th>Unit</th>
                    <th>Outstanding</th>
                    <th>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as AgingTenantRow[]).map((t, i) => (
                    <tr key={i}>
                      <td><strong style={{ fontSize: 12 }}>{String(t.tenant ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{String(t.property ?? "—")}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(t.unit ?? "—")}</td>
                      <td className="mono" style={{ color: "var(--danger)" }}>{kM(t.outstanding)}</td>
                      <td><Badge tone="red">{kN(t.oldest_days)}d</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {rentSection === "reminders" && (
        <Panel title="Sent Reminders" action={<button className="btn ghost sm" onClick={() => setTab("reminders")}>All Reminders →</button>}>
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No reminders" emptyDesc="Payment reminders sent to tenants appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Invoice</th>
                    <th>Channel</th>
                    <th>Recipient</th>
                    <th>Sent</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as ReminderRow[]).map((r) => (
                    <tr key={String(r.id)}>
                      <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(r.invoice_number ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.channel ?? "—").replace(/_/g, " ")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.recipient ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.sent_at)}</td>
                      <td><Badge tone="green">Sent</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      <Panel title="Collection Performance" action={<button className="btn ghost sm" data-testid="property-invoices-btn" onClick={() => setRentSection("invoices")}>Invoices →</button>}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(var(--primary) 0% ${collectionRate}%, var(--surface-3) ${collectionRate}% 100%)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{collectionRate}%</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                <i style={{ background: "var(--primary)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Collected
              </span>
              <strong className="mono">{kM(collected)}</strong>
            </div>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                <i style={{ background: "var(--surface-3)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Outstanding
              </span>
              <strong className="mono">{kM(outstanding)}</strong>
            </div>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                <i style={{ background: "var(--border-strong)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Total Billed
              </span>
              <strong className="mono">{kM(totalBilled)}</strong>
            </div>
          </div>
        </div>
      </Panel>

        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 260 }}>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Aging Summary (Outstanding)" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>Ageing Report →</button>}>
          {agingTotal > 0 ? (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Bucket</th>
                    <th>Amount</th>
                    <th>% of total</th>
                  </tr>
                </thead>
                <tbody>
                  {agingBuckets.map((b) => {
                    const amount = Number(aging[b.key] ?? 0);
                    return (
                      <tr key={b.key}>
                        <td style={{ fontSize: 12 }}>{b.label}</td>
                        <td className="mono" style={{ color: amount > 0 ? "var(--danger)" : "var(--muted)" }}>{kM(amount)}</td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                              <div style={{ width: `${pct(amount, agingTotal)}%`, height: "100%", background: amount > 0 ? "#e23b3b" : "var(--border-strong)" }} />
                            </div>
                            <span className="mono" style={{ fontSize: 11, width: 40, textAlign: "right" }}>{pct(amount, agingTotal)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="✓" title="No outstanding balances" description="All invoices have been collected." />
          )}
        </Panel>

        <Panel title="Top Tenants by Outstanding" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>View All Arrears →</button>}>
          {topTenants.length > 0 ? (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Property / Unit</th>
                    <th>Outstanding</th>
                    <th>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {topTenants.slice(0, 6).map((t, i) => (
                    <tr key={i}>
                      <td><strong style={{ fontSize: 12 }}>{String(t.tenant ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{String(t.property ?? "—")} · {String(t.unit ?? "—")}</td>
                      <td className="mono" style={{ color: "var(--danger)" }}>{kM(t.outstanding)}</td>
                      <td><Badge tone="red">{kN(t.oldest_days)}d</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="✓" title="No outstanding tenants" description="Every tenant is up to date." />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ─── ARREARS ─── */

