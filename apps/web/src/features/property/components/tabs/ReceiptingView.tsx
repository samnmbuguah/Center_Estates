"use client";

import { SubTabs } from "../PropertyToolbar";
import { ReceiptsView } from "./ReceiptsView";
import { ReceiptAllocationsView } from "./ReceiptAllocationsView";
import { CreditNotesView } from "./CreditNotesView";
import { RentSchedulesView } from "./RentSchedulesView";
import type { PropertyTab, Row, CreditNoteRow, ReceiptingSection } from "../../types/property.types";

export function ReceiptingView({
  receiptingSection = "receipts",
  setReceiptingSection = () => {},
  rows = [],
  receipts = [],
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
  onGenerateInvoice = () => {},
  onVoidCreditNote = () => {},
}: {
  receiptingSection?: ReceiptingSection;
  setReceiptingSection?: (s: ReceiptingSection) => void;
  rows?: Row[];
  receipts?: Row[];
  creditNotes?: Row[];
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  onRecordReceipt?: (invoiceId?: string) => void;
  onAddCreditNote?: () => void;
  onDownloadPdf?: (row: any) => void;
  canFinance?: boolean;
  onRefresh?: () => void;
  onGenerateInvoice?: (row: any, taxRate?: number) => void;
  onVoidCreditNote?: (row: CreditNoteRow) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <SubTabs
        tabs={[
          { id: "receipts", label: "Receipts" },
          { id: "allocations", label: "Allocations" },
          { id: "credit-notes", label: "Credit Notes" },
          { id: "schedules", label: "Payment Schedules" },
        ]}
        active={receiptingSection}
        onChange={(id) => setReceiptingSection(id as ReceiptingSection)}
      />

      {receiptingSection === "receipts" && (
        <ReceiptsView
          receipts={receipts.length ? receipts : rows}
          creditNotes={creditNotes}
          rows={rows}
          loading={loading}
          search={search}
          setSearch={setSearch}
          setTab={setTab}
          onRecordReceipt={onRecordReceipt}
          onAddCreditNote={onAddCreditNote}
          onDownloadPdf={onDownloadPdf}
          canFinance={canFinance}
          onRefresh={onRefresh}
        />
      )}

      {receiptingSection === "allocations" && (
        <ReceiptAllocationsView rows={rows} loading={loading} search={search} setSearch={setSearch} />
      )}

      {receiptingSection === "credit-notes" && (
        <CreditNotesView
          rows={rows}
          loading={loading}
          search={search}
          setSearch={setSearch}
          setTab={setTab}
          onAdd={onAddCreditNote}
          onVoid={onVoidCreditNote as any}
        />
      )}

      {receiptingSection === "schedules" && (
        <RentSchedulesView
          rows={rows}
          loading={loading}
          search={search}
          setSearch={setSearch}
          onGenerateInvoice={onGenerateInvoice}
          onRefresh={onRefresh}
          canFinance={canFinance}
        />
      )}
    </div>
  );
}
