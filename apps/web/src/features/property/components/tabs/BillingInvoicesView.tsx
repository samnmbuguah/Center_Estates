"use client";

import { SubTabs } from "../PropertyToolbar";
import { PropertyBillingDashboard } from "@/components/property-billing-dashboard";
import { RentView } from "./RentView";
import type { PropertyTab, Row, InvoiceRow, AgingAnalytics, BillingSection } from "../../types/property.types";
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
  analytics = null,
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  canFinance = true,
  canApprove = true,
  onAddInvoice = () => {},
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
  analytics?: AgingAnalytics | null;
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  canFinance?: boolean;
  canApprove?: boolean;
  onAddInvoice?: () => void;
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
        ]}
        active={billingSection}
        onChange={(id) => setBillingSection(id as BillingSection)}
      />

      {billingSection === "pipeline" ? (
        <PropertyBillingDashboard onNavigate={onNavigateBilling} onSingleInvoice={onSingleInvoice} />
      ) : (
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
    </div>
  );
}
