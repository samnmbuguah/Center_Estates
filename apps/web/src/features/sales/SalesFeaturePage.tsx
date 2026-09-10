"use client";

import { ModuleCalendarView, ModuleTicketsView } from "@/components/module-activity";
import { ModuleShell } from "@/components/module-shell";
import { EmptyState, ErrorBanner, LoadingState } from "@/components/module-ui";
import {
  NewListingModal,
  NewSaleModal,
  PaymentActionModal,
  RecordVisitModal,
  RegisterBuyerModal,
  TransitionModal,
} from "./components/modals/SalesModals";
import { AuditEventsView } from "./components/tabs/AuditEventsView";
import { BankReconciliationView } from "./components/tabs/BankReconciliationView";
import { BuyersView } from "./components/tabs/BuyersView";
import { CommissionsView } from "./components/tabs/CommissionsView";
import { DocumentsView } from "./components/tabs/DocumentsView";
import { HandoverView } from "./components/tabs/HandoverView";
import { InstallmentsView } from "./components/tabs/InstallmentsView";
import { InventoryView } from "./components/tabs/InventoryView";
import { LeadsView } from "./components/tabs/LeadsView";
import { OverviewView } from "./components/tabs/OverviewView";
import { PaymentsView } from "./components/tabs/PaymentsView";
import { PerformanceView } from "./components/tabs/PerformanceView";
import { ReportsView } from "./components/tabs/ReportsView";
import { SalesView } from "./components/tabs/SalesView";
import { SalesClerkView } from "./components/tabs/SalesClerkView";
import { SiteVisitsView } from "./components/tabs/SiteVisitsView";
import { useSalesLogic } from "./hooks/useSalesLogic";
import { salesTabLabels } from "./types/sales.types";

export function SalesFeaturePage({ initialTab = "overview" }: { initialTab?: string }) {
  const logic = useSalesLogic(initialTab);

  return (
    <ModuleShell
      moduleKey="sales"
      moduleName="Sales Management"
      eyebrow="Sales & Marketing Workspace"
      title="Sales Management"
      subtitle="Multi-project unit sales, buyer onboarding, payments, site visits & commissions."
      accent="#ea580c"
      activeId={logic.tab}
      onSelect={logic.selectTab}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {logic.error && <ErrorBanner message={logic.error} onRetry={logic.loadData} />}

        {logic.loading ? (
          <LoadingState rows={5} />
        ) : logic.tab === "overview" && logic.dashboard ? (
          <OverviewView
            dashboard={logic.dashboard}
            setTab={logic.setTab}
            openRegisterBuyer={logic.openBuyerRegistration}
            openNewSale={logic.openNewSaleModal}
            openRecordVisit={logic.openRecordVisitModal}
          />
        ) : logic.tab === "clerk" ? (
          <SalesClerkView
            rows={logic.rows}
            canVisit={logic.canVisit}
            canSell={logic.canSell}
            openRecordVisit={logic.openRecordVisitModal}
            openRegisterBuyer={logic.openBuyerRegistration}
            openNewSale={logic.openNewSaleModal}
          />
        ) : logic.tab === "inventory" ? (
          <InventoryView
            rows={logic.rows}
            search={logic.search}            setSearch={logic.setSearch}
            status={logic.status}
            setStatus={logic.setStatus}
            canSell={logic.canSell}
            openNewListing={logic.openNewListingModal}
          />
        ) : logic.tab === "buyers" ? (
          <BuyersView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
            status={logic.status}
            setStatus={logic.setStatus}
            openRegisterBuyer={logic.openBuyerRegistration}
            transitionBuyer={logic.openTransitionBuyer}
            org={logic.org}
            canSell={logic.canSell}
          />
        ) : logic.tab === "leads" ? (
          <LeadsView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
            status={logic.status}
            setStatus={logic.setStatus}
            openRegisterBuyer={logic.openBuyerRegistration}
            quickTransition={logic.quickTransitionBuyer}
          />
        ) : logic.tab === "sales" ? (
          <SalesView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
            status={logic.status}
            setStatus={logic.setStatus}
            canSell={logic.canSell}
            openNewSale={logic.openNewSaleModal}
            transitionSale={logic.openTransitionSale}
          />
        ) : logic.tab === "site-visits" ? (
          <SiteVisitsView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
            canVisit={logic.canVisit}
            openRecordVisit={logic.openRecordVisitModal}
          />
        ) : logic.tab === "installments" ? (
          <InstallmentsView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
            status={logic.status}
            setStatus={logic.setStatus}
          />
        ) : logic.tab === "payments" ? (
          <PaymentsView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
            status={logic.status}
            setStatus={logic.setStatus}
            openPaymentAction={logic.openPaymentAction}
          />
        ) : logic.tab === "commissions" ? (
          <CommissionsView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
            status={logic.status}
            setStatus={logic.setStatus}
            runCommissionAction={logic.runCommissionAction}
          />
        ) : logic.tab === "performance" && logic.dashboard ? (
          <PerformanceView dashboard={logic.dashboard} />
        ) : logic.tab === "reports" ? (
          <ReportsView
            rows={logic.rows}
            recentExports={logic.recentExports}
            reportPreview={logic.reportPreview}
            reportLoading={logic.reportLoading}
            reportKey={logic.reportKey}
            loadReportPreview={logic.loadReportPreview}
            downloadReport={logic.downloadReport}
          />
        ) : logic.tab === "documents" ? (
          <DocumentsView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
          />
        ) : logic.tab === "handover" ? (
          <HandoverView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
          />
        ) : logic.tab === "audit-events" ? (
          <AuditEventsView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
          />
        ) : logic.tab === "tickets" ? (
          <ModuleTicketsView moduleName="Sales" />
        ) : logic.tab === "calendar" ? (
          <ModuleCalendarView moduleName="Sales" />
        ) : logic.tab === "bank-reconciliation" ? (
          <BankReconciliationView
            rows={logic.rows}
            search={logic.search}
            setSearch={logic.setSearch}
            org={logic.org}
          />
        ) : (
          <EmptyState
            icon="📋"
            title={salesTabLabels[logic.tab]}
            description="No data available for this scope yet."
          />
        )}
      </div>

      {/* Modals */}
      <RegisterBuyerModal
        open={logic.showRegisterBuyer}
        onClose={() => logic.setShowRegisterBuyer(false)}
        onSubmit={logic.submitRegisterBuyer}
        error={logic.formError}
      />
      <NewSaleModal
        open={logic.showNewSale}
        onClose={() => logic.setShowNewSale(false)}
        onSubmit={logic.submitNewSale}
        error={logic.formError}
        buyers={logic.options.buyers}
        listings={logic.options.listings}
      />
      <RecordVisitModal
        open={logic.showRecordVisit}
        onClose={() => logic.setShowRecordVisit(false)}
        onSubmit={logic.submitRecordVisit}
        error={logic.formError}
        projects={logic.options.projects}
      />
      <NewListingModal
        open={logic.showNewListing}
        onClose={() => logic.setShowNewListing(false)}
        onSubmit={logic.submitNewListing}
        error={logic.formError}
        projects={logic.options.projects}
        units={logic.options.units}
      />
      <PaymentActionModal
        payment={logic.paymentAction}
        onClose={() => logic.setPaymentAction(null)}
        onAction={logic.submitPaymentAction}
        error={logic.formError}
      />
      <TransitionModal
        title="Transition Sale Status"
        row={logic.transitionSaleRow}
        options={logic.saleOptions}
        onClose={() => logic.setTransitionSaleRow(null)}
        onSubmit={logic.submitTransitionSale}
        error={logic.formError}
      />
      <TransitionModal
        title="Transition Buyer Status"
        row={logic.transitionBuyerRow}
        options={logic.buyerOptions}
        onClose={() => logic.setTransitionBuyerRow(null)}
        onSubmit={logic.submitTransitionBuyer}
        error={logic.formError}
      />
    </ModuleShell>
  );
}
