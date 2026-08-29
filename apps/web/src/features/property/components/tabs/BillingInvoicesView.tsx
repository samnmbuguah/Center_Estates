"use client";

import { SubTabs } from "../PropertyToolbar";
import { PropertyBillingDashboard } from "@/components/property-billing-dashboard";
import { RentView } from "./RentView";
import { CreditNotesView } from "./CreditNotesView";
import type { PropertyTab, Row, InvoiceRow, AgingAnalytics, BillingSection, CreditNoteRow } from "../../types/property.types";
import type { ID } from "../../types/property.types";

export function BillingInvoicesView({
  billingSection = "pipeline",
  setBillingSection = () => {},
  // pipeline props
  onNavigateBilling = () => {},
  onSingleInvoice = () => {},
  // invoice register props
  rows = [],
  rentInvoices = [],
  creditNotes = [],
  analytics = null,
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  organizationId = null,
  canFinance = true,
  canApprove = true,
  onAddInvoice = () => {},
  onAddCreditNote = () => {},
  onVoidCreditNote = () => {},
  onRecordReceipt = () => {},
  onSendReminder = () => {},
  onInvoiceAction = () => {},
  onSelectRow = () => {},
  onDownloadPdf = () => {},
  onRefresh = () => {},
}: {
  billingSection?: BillingSection;
  setBillingSection?: (s: BillingSection) => void;
  onNavigateBilling?: (t: string) => void;
  onSingleInvoice?: (ctx: any) => void;
  rows?: Row[];
  rentInvoices?: InvoiceRow[];
  creditNotes?: Row[];
  analytics?: AgingAnalytics | null;
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  organizationId?: string | null;
  canFinance?: boolean;
  canApprove?: boolean;
  onAddInvoice?: () => void;
  onAddCreditNote?: () => void;
  onVoidCreditNote?: (row: CreditNoteRow) => void;
  onRecordReceipt?: (invoiceId?: ID) => void;
  onSendReminder?: (row: InvoiceRow) => void;
  onInvoiceAction?: (row: InvoiceRow, action: "submit-review" | "approve" | "issue" | "void") => void;
  onSelectRow?: (r: Row) => void;
  onDownloadPdf?: (row: InvoiceRow) => void;
  onRefresh?: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <SubTabs
        tabs={[
          { id: "pipeline", label: "Billing Pipeline" },
          { id: "invoices", label: "Invoice Register" },
          { id: "credit-notes", label: "Credit Notes & Adjustments" },
        ]}
        active={billingSection}
        onChange={(id) => { setBillingSection(id as BillingSection); setSearch(""); }}
      />

      {billingSection === "pipeline" && (
        <PropertyBillingDashboard
          onNavigate={(target) => {
            onNavigateBilling(target);
          }}
          onSingleInvoice={onSingleInvoice}
        />
      )}

      {billingSection === "invoices" && (
        <RentView
          rows={rows}
          rentInvoices={rentInvoices}
          analytics={analytics}
          loading={loading}
          search={search}
          setSearch={setSearch}
          setTab={setTab}
          canFinance={canFinance}
          canApprove={canApprove}
          onAddInvoice={onAddInvoice}
          onRecordReceipt={onRecordReceipt}
          onSendReminder={onSendReminder}
          onInvoiceAction={onInvoiceAction}
          onSelectRow={onSelectRow}
          onDownloadPdf={onDownloadPdf}
          onRefresh={onRefresh}
        />
      )}

      {billingSection === "credit-notes" && (
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
    </div>
  );
}
