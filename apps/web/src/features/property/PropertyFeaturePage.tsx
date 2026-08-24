"use client";

import dynamic from "next/dynamic";
import { ModuleShell } from "@/components/module-shell";
import { propertyNav } from "@/lib/module-nav";
import { DetailDrawer, ErrorBanner, LoadingState } from "@/components/module-ui";

import { PropertyTab, TenantRow, BankTransactionRow, labels } from "./types/property.types";
import { usePropertyLogic } from "./hooks/usePropertyLogic";
import { RowDetailPanel } from "./components/RowDetailPanel";
import { TenantPortalDrawer } from "./components/TenantPortalDrawer";
import { PropertyModals } from "./components/modals/PropertyModals";

import { OverviewView } from "./components/tabs/OverviewView";
import { PropertiesView } from "./components/tabs/PropertiesView";
import { BuildingsView } from "./components/tabs/BuildingsView";
import { UnitsView } from "./components/tabs/UnitsView";
import { ProjectsView } from "./components/tabs/ProjectsView";
import { TenantsView } from "./components/tabs/TenantsView";
import { TenantDocumentsView } from "./components/tabs/TenantDocumentsView";
import { LeasesView } from "./components/tabs/LeasesView";
import { TenancyView } from "./components/tabs/TenancyView";
import { RentSchedulesView } from "./components/tabs/RentSchedulesView";
import { RentView } from "./components/tabs/RentView";
import { ArrearsRecoveryView } from "./components/tabs/ArrearsRecoveryView";
import { RemindersView } from "./components/tabs/RemindersView";
import { ReceiptsView } from "./components/tabs/ReceiptsView";
import { ReceiptAllocationsView } from "./components/tabs/ReceiptAllocationsView";
import { BankReconciliationView } from "./components/tabs/BankReconciliationView";
import { CreditNotesView } from "./components/tabs/CreditNotesView";
import { ServiceChargesView } from "./components/tabs/ServiceChargesView";
import { ServiceChargeAllocationsView } from "./components/tabs/ServiceChargeAllocationsView";
import { ServiceChargeReconciliationsView } from "./components/tabs/ServiceChargeReconciliationsView";
import { ServiceProfilesView } from "./components/tabs/ServiceProfilesView";
import { BudgetsView } from "./components/tabs/BudgetsView";
import { ExpensesView } from "./components/tabs/ExpensesView";
import { FeesView } from "./components/tabs/FeesView";
import { ReportsView } from "./components/tabs/ReportsView";
import { ForecastView } from "./components/tabs/ForecastView";
import { CriticalDatesView } from "./components/tabs/CriticalDatesView";

import { PropertyBillingDashboard } from "@/components/property-billing-dashboard";
const PropertyTenancyReports = dynamic(() => import("@/components/property-tenancy-reports").then((module) => module.PropertyTenancyReports), { loading: () => <LoadingState rows={7} /> });
const PropertyFinancialReports = dynamic(() => import("@/components/property-financial-reports").then((module) => module.PropertyFinancialReports), { loading: () => <LoadingState rows={7} /> });
const ModuleTicketsView = dynamic(() => import("@/components/module-activity").then((module) => module.ModuleTicketsView), { loading: () => <LoadingState rows={6} /> });
const ModuleCalendarView = dynamic(() => import("@/components/module-activity").then((module) => module.ModuleCalendarView), { loading: () => <LoadingState rows={6} /> });
import { FeedbackQrManager } from "@/components/feedback-qr-manager";

export function PropertyFeaturePage({
  initialTab = "properties",
  standaloneOnboarding = false,
}: {
  initialTab?: string;
  standaloneOnboarding?: boolean;
}) {
  const logic = usePropertyLogic({ initialTab, standaloneOnboarding });

  const renderActiveTab = () => {
    switch (logic.tab) {
      case "overview":
        return <OverviewView dashboard={logic.dashboard} loading={logic.loading} setTab={logic.setTab} canOperate={logic.canOperate} canLease={logic.canLease} canFinance={logic.canFinance} />;
      case "properties":
        return <PropertiesView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} onSelectRow={logic.handleSelectRow} onAdd={() => logic.setShowAddProperty(true)} setTab={logic.setTab} />;
      case "buildings":
        return <BuildingsView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} />;
      case "feedback-qr":
        return <FeedbackQrManager organizationId={logic.organizationId} />;
      case "units":
        return <UnitsView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} onSelectRow={logic.handleSelectRow} />;
      case "projects":
        return <ProjectsView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} />;
      case "tenancy":
        return <TenancyView activeSection={logic.tenancySection as any} onSectionChange={logic.setTenancySection} onAddTenant={() => logic.setShowAddTenant(true)} onBulkUploadTenant={() => logic.setShowBulkTenantUpload(true)} onAddLease={() => logic.setShowAddLease(true)} unitsRows={logic.tenancyUnitsRows} tenantsRows={logic.tenantsRows} leasesRows={logic.leasesRows} tenantDocsRows={logic.tenantDocsRows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} onSelectRow={logic.handleSelectRow} onOpenPortal={(r) => logic.setPortalTenant(r as TenantRow)} onUploadDoc={(t) => { logic.setSelectedRow(t ?? null); logic.setShowUploadDoc(true); }} onDownloadDoc={logic.handleDownloadDoc} onVerifyDoc={logic.handleVerifyDoc} onRejectDoc={logic.handleRejectDocPrompt} setTab={logic.setTab} canLease={logic.canLease} onRenewLease={logic.setRenewalTarget} onTerminateLease={logic.setTerminationTarget} onRefresh={logic.fetchData} onDeleteTenant={logic.handleDeleteTenant} onEditTenant={(r) => { logic.setEditTenant(r as TenantRow); logic.setShowEditTenant(true); }} onActivateTenant={logic.handleActivateTenant} onBulkActivateTenants={logic.handleBulkActivateTenants} />;
      case "tenants":
        return <TenantsView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} onSelectRow={logic.handleSelectRow} onAdd={() => logic.setShowAddTenant(true)} onBulkUpload={() => logic.setShowBulkTenantUpload(true)} onOpenPortal={(r) => logic.setPortalTenant(r as TenantRow)} setTab={logic.setTab} onUploadDoc={(t) => { logic.setSelectedRow(t ?? null); logic.setShowUploadDoc(true); }} canLease={logic.canLease} onRefresh={logic.fetchData} onEdit={(r) => { logic.setEditTenant(r as TenantRow); logic.setShowEditTenant(true); }} onDelete={logic.handleDeleteTenant} onActivate={logic.handleActivateTenant} onBulkActivate={logic.handleBulkActivateTenants} />;
      case "tenant-documents":
        return <TenantDocumentsView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} onUpload={() => logic.setShowUploadDoc(true)} onDownload={logic.handleDownloadDoc} onVerify={logic.handleVerifyDoc} onReject={logic.handleRejectDocPrompt} />;
      case "leases":
        return <LeasesView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} onSelectRow={logic.handleSelectRow} onAdd={() => logic.setShowAddLease(true)} setTab={logic.setTab} canLease={logic.canLease} onRenew={logic.setRenewalTarget} onTerminate={logic.setTerminationTarget} onRefresh={logic.fetchData} />;
      case "financials":
        return <ReceiptsView rows={logic.rows} receipts={logic.rows} creditNotes={logic.creditNotes} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} onRecordReceipt={() => logic.setShowRecordReceipt(true)} onAddCreditNote={() => logic.handleCreateCreditNote(null)} canFinance={logic.canFinance} onRefresh={logic.fetchData} />;
      case "billing":
        return <PropertyBillingDashboard onNavigate={(t) => logic.setTab(t as PropertyTab)} onSingleInvoice={(ctx) => logic.openInvoiceComposer(ctx)} />;
      case "rent-schedules":
        return <RentSchedulesView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} onGenerateInvoice={logic.handleGenerateScheduleInvoice} onRefresh={logic.fetchData} canFinance={logic.canFinance} />;
      case "rent":
        return <RentView rows={logic.rows} invoices={logic.rentInvoices} analytics={logic.analytics} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} canFinance={logic.canFinance} canApprove={logic.canApprove} onAddInvoice={() => logic.setShowInvoiceComposer(true)} onRecordReceipt={(invoiceId) => { logic.setReceiptInvoice(invoiceId ?? ""); logic.setShowRecordReceipt(true); }} onSendReminder={logic.handleSendReminder} onInvoiceAction={logic.handleInvoiceAction} onSelectRow={logic.setSelectedRow} onDownloadPdf={logic.downloadInvoicePdf} onRefresh={logic.fetchData} />;
      case "arrears":
        return <ArrearsRecoveryView rows={logic.rows} reminders={logic.reminders} analytics={logic.analytics} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} onSendReminder={logic.handleSendReminder} />;
      case "reminders":
        return <RemindersView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} onSendReminder={logic.handleSendReminder} setTab={logic.setTab} />;
      case "receipts":
        return <ReceiptsView receipts={logic.rows} creditNotes={logic.creditNotes} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} onRecordReceipt={() => logic.setShowRecordReceipt(true)} onAddCreditNote={() => logic.handleCreateCreditNote(null)} canFinance={logic.canFinance} onRefresh={logic.fetchData} />;
      case "payments":
        return <ReceiptsView receipts={logic.rows} creditNotes={logic.creditNotes} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} onRecordReceipt={() => logic.setShowRecordReceipt(true)} onAddCreditNote={() => logic.handleCreateCreditNote(null)} canFinance={logic.canFinance} onRefresh={logic.fetchData} />;
      case "receipt-allocations":
        return <ReceiptAllocationsView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} />;
      case "bank-reconciliation":
        return <BankReconciliationView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} onMatch={(r) => logic.setMatchTarget(r as BankTransactionRow)} />;
      case "credit-notes":
        return <CreditNotesView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} onAdd={() => logic.handleCreateCreditNote(null)} onVoid={logic.handleVoidCreditNote} />;
      case "service-profiles":
        return <ServiceProfilesView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} organizationId={logic.organizationId} reload={logic.fetchData} />;
      case "service-charges":
        return <ServiceChargesView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} onAdd={() => logic.setShowAddServiceCharge(true)} onAllocate={logic.generateServiceChargeAllocations} onReconcile={logic.setReconciliationTarget} />;
      case "service-charge-allocations":
        return <ServiceChargeAllocationsView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} />;
      case "service-charge-reconciliations":
        return <ServiceChargeReconciliationsView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} />;
      case "budgets":
        return <BudgetsView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} onSelectRow={logic.setSelectedRow} onAdd={() => logic.handleCreateBudget(null)} onAction={(b, a) => { if (a === "approve") logic.handleApproveBudget(b); else if (a === "reject") logic.handleRejectBudgetPrompt(b); }} />;
      case "expenses":
        return <ExpensesView rows={logic.rows} financial={logic.financial} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} onAdd={() => logic.handleCreateExpense(null)} onAction={(e) => logic.setSelectedRow(e)} />;
      case "fees":
        return <FeesView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} setTab={logic.setTab} />;
      case "reports":
        return <ReportsView rows={logic.rows} loading={logic.loading} onExport={logic.handleExportReport} />;
      case "tenancy-reports":
        return <PropertyTenancyReports />;
      case "financial-reports":
        return <PropertyFinancialReports />;
      case "owner-portal":
        return <OverviewView dashboard={logic.dashboard} loading={logic.loading} setTab={logic.setTab} canOperate={logic.canOperate} canLease={logic.canLease} canFinance={logic.canFinance} />;
      case "forecast":
        return <ForecastView dashboard={logic.dashboard} />;
      case "critical-dates":
        return <CriticalDatesView leases={logic.leasesRows} contractors={logic.contractors} inspections={logic.inspections} serviceCharges={logic.criticalServiceCharges} loading={logic.loading} setTab={logic.setTab} />;
      case "tickets":
        return <ModuleTicketsView moduleName="Property" />;
      case "calendar":
        return <ModuleCalendarView moduleName="Property" />;
      default:
        return <PropertiesView rows={logic.rows} loading={logic.loading} search={logic.search} setSearch={logic.setSearch} onSelectRow={logic.handleSelectRow} onAdd={() => logic.setShowAddProperty(true)} setTab={logic.setTab} />;
    }
  };

  if (standaloneOnboarding) {
    return (
      <div className="property-workspace" style={{ padding: "16px 24px", width: "100%", boxSizing: "border-box" }}>
        {logic.error && <ErrorBanner message={logic.error} onRetry={logic.fetchData} />}
        {renderActiveTab()}
        <PropertyModals {...logic} />
      </div>
    );
  }

  return (
    <ModuleShell
      moduleKey="property"
      moduleName="Property"
      title="Property Management"
      subtitle="Operations, occupancy and financial performance for the selected property"
      groups={propertyNav}
      activeId={logic.tab}
      onSelect={(id) => logic.handleSelectTab(id as PropertyTab)}
    >
      <div className="property-workspace" style={{ padding: "16px 24px", width: "100%", boxSizing: "border-box" }}>
        {logic.error && <ErrorBanner message={logic.error} onRetry={logic.fetchData} />}
        {renderActiveTab()}

        {logic.selectedRow && (
          <DetailDrawer
            title={`${String(logic.selectedRow.name ?? logic.selectedRow.reference ?? logic.selectedRow.code ?? logic.selectedRow.number ?? labels[logic.tab])} (${labels[logic.tab]})`}
            onClose={() => logic.setSelectedRow(null)}
          >
            <RowDetailPanel
              tab={logic.tab}
              row={logic.selectedRow}
              canLease={logic.canLease}
              onActivate={logic.handleActivateTenant}
              onEdit={(r) => {
                logic.setEditTenant(r as TenantRow);
                logic.setShowEditTenant(true);
              }}
              onDelete={logic.handleDeleteTenant}
              onOpenPortal={(r) => logic.setPortalTenant(r as TenantRow)}
            />
          </DetailDrawer>
        )}

        {logic.portalTenant && (
          <TenantPortalDrawer
            tenant={logic.portalTenant}
            organizationId={logic.organizationId}
            onClose={() => logic.setPortalTenant(null)}
          />
        )}

        <PropertyModals {...logic} />
      </div>
    </ModuleShell>
  );
}
