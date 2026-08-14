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
  occupancyTone, shortId, exportCsv, exportLeaseICS,
} from "../../utils/property.utils";
import { RentSchedulesView } from "./RentSchedulesView";
import { RentView } from "./RentView";
import { ReceiptsView } from "./ReceiptsView";
import { ReceiptAllocationsView } from "./ReceiptAllocationsView";
import { BankReconciliationView } from "./BankReconciliationView";
import { CreditNotesView } from "./CreditNotesView";

export function FinancialsView({
  financialsSection = "schedules",
  activeSection,
  setFinancialsSection,
  onSectionChange,
  rows = [],
  schedulesRows,
  invoicesRows,
  receiptsRows,
  allocationsRows,
  bankTransactionsRows,
  creditNotesRows,
  rentInvoices = [],
  analytics = null,
  creditNotes = [],
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  rentSection = "invoices",
  setRentSection = () => {},
  onGenerateInvoice = () => {},
  onRefresh = () => {},
  onRecordReceipt = () => {},
  onQuickReceipt = () => {},
  onComposeInvoice = () => {},
  onVoidInvoice = () => {},
  onMatchBankTx = () => {},
  onSendReminder = () => {},
  onInvoiceAction = () => {},
  onSelectRow = () => {},
  onMatch = () => {},
  onAddCreditNote = () => {},
  onAddInvoice = () => {},
  onDownloadInvoicePdf = () => {},
  onDownloadReceiptPdf = () => {},
  canFinance = true,
  canApprove = true,
}: {
  financialsSection?: FinancialsSection;
  activeSection?: FinancialsSection;
  setFinancialsSection?: (s: FinancialsSection) => void;
  onSectionChange?: (s: FinancialsSection) => void;
  rows?: Row[];
  schedulesRows?: Row[];
  invoicesRows?: InvoiceRow[];
  receiptsRows?: Row[];
  allocationsRows?: Row[];
  bankTransactionsRows?: Row[];
  creditNotesRows?: Row[];
  rentInvoices?: InvoiceRow[];
  analytics?: AgingAnalytics | null;
  creditNotes?: Row[];
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  rentSection?: RentSection;
  setRentSection?: (s: RentSection) => void;
  onGenerateInvoice?: (r: any, taxRate?: number) => void;
  onRefresh?: () => void;
  onRecordReceipt?: (invoiceId?: ID) => void;
  onQuickReceipt?: (inv: InvoiceRow) => void;
  onComposeInvoice?: () => void;
  onVoidInvoice?: (inv: InvoiceRow) => void;
  onMatchBankTx?: (tx: BankTransactionRow) => void;
  onSendReminder?: (row: InvoiceRow) => void;
  onInvoiceAction?: (row: InvoiceRow, action: "submit-review" | "approve" | "issue" | "void") => void;
  onSelectRow?: (r: Row) => void;
  onMatch?: (r: any) => void;
  onAddCreditNote?: () => void;
  canFinance?: boolean;
  canApprove?: boolean;
  onAddInvoice?: () => void;
  onDownloadInvoicePdf?: (row: InvoiceRow) => void;
  onDownloadReceiptPdf?: (row: ReceiptRow) => void;
}) {
  const currentSection = activeSection || financialsSection || "schedules";
  const sRows = schedulesRows || rows;
  const iRows = invoicesRows || rentInvoices;
  const rRows = receiptsRows || rows;
  const aRows = allocationsRows || rows;
  const bRows = bankTransactionsRows || rows;
  const cRows = creditNotesRows || creditNotes;
  const changeSection = onSectionChange || setFinancialsSection || (() => {});
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <SubTabs
        active={currentSection}
        onChange={(section) => changeSection(section as FinancialsSection)}
        tabs={[
          { id: "schedules", label: "Payment schedules" },
          { id: "invoices", label: "Invoices" },
          { id: "receipts", label: "Receipts" },
          { id: "allocations", label: "Receipt allocations" },
          { id: "reconciliation", label: "Bank reconciliation" },
          { id: "credit-notes", label: "Credit notes" },
        ]}
      />
      {currentSection === "schedules" && <RentSchedulesView rows={sRows} loading={loading} search={search} setSearch={setSearch} onGenerateInvoice={onGenerateInvoice} onRefresh={onRefresh} canFinance={canFinance} />}
      {currentSection === "invoices" && <RentView rows={sRows} invoices={iRows} rentInvoices={iRows} analytics={analytics} rentSection={rentSection} setRentSection={setRentSection} loading={loading} setTab={setTab} onRecordReceipt={onRecordReceipt} onQuickReceipt={onQuickReceipt} onComposeInvoice={onComposeInvoice} onSendReminder={onSendReminder} onInvoiceAction={onInvoiceAction} onVoidInvoice={onVoidInvoice} onSelectRow={onSelectRow} onAddInvoice={onAddInvoice} onDownloadPdf={onDownloadInvoicePdf} canFinance={canFinance} canApprove={canApprove} onRefresh={onRefresh} />}
      {currentSection === "receipts" && <ReceiptsView rows={rRows} receipts={rRows} creditNotes={cRows} loading={loading} search={search} setSearch={setSearch} setTab={setTab} onRecordReceipt={onRecordReceipt} onAddCreditNote={onAddCreditNote} onDownloadPdf={onDownloadReceiptPdf} canFinance={canFinance} onRefresh={onRefresh} />}
      {currentSection === "allocations" && <ReceiptAllocationsView rows={aRows} loading={loading} search={search} setSearch={setSearch} />}
      {currentSection === "reconciliation" && <BankReconciliationView rows={bRows} loading={loading} search={search} setSearch={setSearch} onMatch={onMatch || onMatchBankTx} />}
      {currentSection === "credit-notes" && <CreditNotesView rows={cRows} loading={loading} search={search} setSearch={setSearch} setTab={setTab} onAdd={onAddCreditNote} />}
    </div>
  );
}

/* ─── SERVICE CHARGES ─── */
