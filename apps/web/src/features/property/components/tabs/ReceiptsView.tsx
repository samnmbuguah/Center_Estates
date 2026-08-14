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

export function ReceiptsView({
  rows,
  receipts: propReceipts,
  creditNotes = [],
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  onRecordReceipt = () => {},
  onAddCreditNote = () => {},
  onDownloadPdf = () => {},
  canFinance = true,
  onRefresh = () => {},
}: {
  rows?: Row[];
  receipts?: Row[];
  creditNotes?: Row[];
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  onRecordReceipt?: (invoiceId?: ID) => void;
  onAddCreditNote?: () => void;
  onDownloadPdf?: (row: ReceiptRow) => void;
  canFinance?: boolean;
  onRefresh?: () => void;
}) {
  const currentReceipts = (propReceipts || rows || []) as ReceiptRow[];
  const [filter, setFilter] = useState<"all" | "receipts" | "credit-notes" | "unapplied">("all");
  const [filterTenant, setFilterTenant] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const receipts = currentReceipts;
  const cns = creditNotes as CreditNoteRow[];
  const receiptTotal = receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const creditTotal = cns.filter((c) => c.status !== "void").reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const unapplied = receipts.filter((r) => !r.invoice).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const tenantNames = [...new Set(receipts.map((r) => r.tenant_name).filter(Boolean))];
  const paymentMethods = [...new Set(receipts.map((r) => r.payment_method).filter(Boolean))];
  const selStyle = { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 };

  const combined: Row[] = [
    ...receipts.map((r) => ({
      ...r,
      docType: "Receipt",
      docNumber: r.number,
      docDate: r.received_on,
      docMethod: r.payment_method,
      docRef: r.external_reference,
      docStatus: r.invoice ? "Applied" : "Unapplied",
    })),
    ...cns.map((c) => ({
      ...c,
      docType: "Credit Note",
      docNumber: c.number,
      docDate: c.issued_on,
      docMethod: "Credit Note",
      docRef: c.reason,
      docStatus: c.status === "void" ? "Void" : "Applied",
    })),
  ].filter((c) => {
    if (filter === "receipts") { if (c.docType !== "Receipt") return false; }
    else if (filter === "credit-notes") { if (c.docType !== "Credit Note") return false; }
    else if (filter === "unapplied") { if (c.docType !== "Receipt" || c.docStatus !== "Unapplied") return false; }
    if (filterTenant && c.tenant_name !== filterTenant) return false;
    if (filterType && c.docMethod !== filterType) return false;
    return true;
  });
  const pagedRows = combined.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Receipts" value={kM(receiptTotal)} sub="Collected this period" link="View receipts" onClick={() => setFilter("receipts")} />
        <KpiCard icon="↩" iconBg="#fef3c7" iconColor="#d97706" label="Credit Notes" value={kM(creditTotal)} sub="Issued credits" link="View credit notes" onClick={() => setFilter("credit-notes")} />
        <KpiCard icon="◔" iconBg="#dcfce7" iconColor="#16a34a" label="Net Collections" value={kM(Math.max(receiptTotal - creditTotal, 0))} sub="Receipts less credits" link="View receipts" onClick={() => setFilter("all")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Unapplied" value={kM(unapplied)} sub="Receipts not allocated" link="View unapplied" onClick={() => setFilter("unapplied")} />
      </KpiStrip>

      <ViewToolbar title="Receipts & Credit Notes" subtitle="Recorded payments and credit adjustments" search={search} onSearch={setSearch} placeholder="Search receipt, tenant or reference…">
        <select value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)} style={selStyle}>
          <option value="">All Tenants</option>
          {tenantNames.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selStyle}>
          <option value="">All Methods</option>
          {paymentMethods.map((m) => <option key={m} value={m}>{String(m).replace(/_/g, " ")}</option>)}
        </select>
        <button className="btn ghost sm" onClick={() => exportCsv(combined, [
          { key: "docType", label: "Type" }, { key: "docNumber", label: "Doc No" }, { key: "docDate", label: "Date" },
          { key: "tenant_name", label: "Tenant" }, { key: "docMethod", label: "Method" },
          { key: "docRef", label: "Reference" }, { key: "amount", label: "Amount" },
          { key: "docStatus", label: "Status" },
        ], "receipts-credit-notes.csv")}>Export CSV</button>
        <button className="btn primary sm" onClick={() => onRecordReceipt()}>+ Record Receipt</button>
      </ViewToolbar>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {([["all", "All"], ["receipts", "Receipts"], ["credit-notes", "Credit Notes"], ["unapplied", "Unapplied Receipts"]] as const).map(([id, label]) => (
          <button key={id} type="button" className={`btn sm ${filter === id ? "primary" : "ghost"}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      <Panel title="Transactions">
        <ListState loading={loading} empty={combined.length === 0} emptyTitle="No transactions found" emptyDesc="Receipts and credit notes will appear here once recorded.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Doc No</th>
                  <th>Date</th>
                  <th>Tenant</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Document</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <tr key={String(r.id)}>
                    <td><Badge tone={r.docType === "Credit Note" ? "yellow" : "blue"}>{String(r.docType)}</Badge></td>
                    <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(r.docNumber ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.docDate)}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(r.docMethod ?? "—").replace(/_/g, " ")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(r.docRef ?? "—")}</td>
                    <td className="mono" style={{ color: r.docType === "Credit Note" ? "var(--danger)" : "var(--text)" }}>{kM(r.amount)}</td>
                    <td><Badge tone={r.docStatus === "Applied" ? "green" : r.docStatus === "Unapplied" ? "yellow" : "gray"}>{String(r.docStatus)}</Badge></td>
                    <td>{r.docType === "Receipt" ? <button className="btn ghost sm" onClick={() => onDownloadPdf(r as ReceiptRow)}>PDF</button> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={combined.length} onPage={setPage} />
        </ListState>
      </Panel>
    </>
  );
}

/* ─── RECEIPT ALLOCATIONS ─── */

