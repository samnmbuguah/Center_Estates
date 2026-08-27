"use client";

import dynamic from "next/dynamic";
import { ModuleShell } from "@/components/module-shell";
import { FacilityTab } from "./types/facility.types";
import { useFacilityLogic } from "./hooks/useFacilityLogic";
import { OverviewView } from "./components/tabs/OverviewView";
import { BuildingsView } from "./components/tabs/BuildingsView";
import { AssetsView } from "./components/tabs/AssetsView";
import { WorkOrdersView } from "./components/tabs/WorkOrdersView";
import { PlannedMaintenanceView } from "./components/tabs/PlannedMaintenanceView";
import { InspectionsView } from "./components/tabs/InspectionsView";
import { ServiceRequestsView } from "./components/tabs/ServiceRequestsView";
import { UtilitiesView } from "./components/tabs/UtilitiesView";
import { ContractorsView } from "./components/tabs/ContractorsView";
import { InventoryView } from "./components/tabs/InventoryView";
import { GenericListView } from "./components/tabs/GenericListView";
import { OperationsRegistryView } from "./components/tabs/OperationsRegistryView";
import { RequisitionsView } from "./components/tabs/RequisitionsView";
import { SupplierInvoicesView } from "./components/tabs/SupplierInvoicesView";
import { ProcurementView } from "./components/tabs/ProcurementView";
import { FinanceControlView } from "./components/tabs/FinanceControlView";
import { FacilityModals } from "./components/modals/FacilityModals";
import { ErrorBanner, LoadingState } from "@/components/module-ui";

const StrategicFMPlanView = dynamic(() => import("./components/tabs/StrategicFMPlanView").then((m) => m.StrategicFMPlanView), { loading: () => <LoadingState rows={6} /> });
const FMBudgetView = dynamic(() => import("./components/tabs/FMBudgetView").then((m) => m.FMBudgetView), { loading: () => <LoadingState rows={6} /> });
const ComplianceRiskView = dynamic(() => import("./components/tabs/ComplianceRiskView").then((m) => m.ComplianceRiskView), { loading: () => <LoadingState rows={6} /> });
const ReportsView = dynamic(() => import("./components/tabs/ReportsView").then((module) => module.ReportsView), { loading: () => <LoadingState rows={6} /> });
const ExpenditureView = dynamic(() => import("./components/tabs/ExpenditureView").then((module) => module.ExpenditureView), { loading: () => <LoadingState rows={6} /> });
const ModuleTicketsView = dynamic(() => import("@/components/module-activity").then((module) => module.ModuleTicketsView), { loading: () => <LoadingState rows={6} /> });
const ModuleCalendarView = dynamic(() => import("@/components/module-activity").then((module) => module.ModuleCalendarView), { loading: () => <LoadingState rows={6} /> });

export function FacilityFeaturePage({ defaultTab = "overview" }: { defaultTab?: FacilityTab }) {
  const logic = useFacilityLogic(defaultTab);

  return (
    <ModuleShell
      moduleKey="facility"
      moduleName="Facility Management"
      eyebrow="Operations center"
      title="Facility Management"
      subtitle="Assets, maintenance, compliance, services and utility performance."
      accent="#e23b3b"
      activeId={logic.tab}
      onSelect={logic.selectTab}
    >
      <div className="facility-app">
        {logic.error && (
          <ErrorBanner message={logic.error} onRetry={logic.load} />
        )}

        {logic.loading ? (
          <LoadingState rows={6} />
        ) : logic.tab === "overview" && logic.dashboard ? (
          <OverviewView dashboard={logic.dashboard} setTab={logic.setTab} setShowCreate={logic.setShowCreate} canWork={logic.canWork} />
        ) : logic.tab === "strategic-plans" ? (
          <StrategicFMPlanView rows={logic.rows} organizationId={logic.organizationId} />
        ) : logic.tab === "buildings" ? (
          <BuildingsView rows={logic.rows} kpis={logic.dashboard?.kpis ?? {}} />
        ) : logic.tab === "assets" ? (
          <AssetsView rows={logic.rows} kpis={logic.dashboard?.kpis ?? {}} onAdd={() => logic.setCreateModal("asset")} organizationId={logic.organizationId} reload={logic.load} />
        ) : logic.tab === "budgets" ? (
          <FMBudgetView rows={logic.rows} organizationId={logic.organizationId} />
        ) : logic.tab === "compliance" || logic.tab === "risks" ? (
          <ComplianceRiskView
            mode={logic.tab}
            complianceRows={logic.tab === "compliance" ? logic.rows : []}
            riskRows={logic.tab === "risks" ? logic.rows : []}
            organizationId={logic.organizationId}
          />
        ) : logic.tab === "work-orders" ? (
          <WorkOrdersView
            rows={logic.rows}
            kpis={logic.dashboard?.kpis ?? {}}
            permissions={{ canWork: logic.canWork, canApprove: logic.canApprove }}
            setShowCreate={logic.setShowCreate}
            organizationId={logic.organizationId}
            onTransition={(row, target, notes) => void logic.runWorkTransition(row, target, notes)}
            onVerify={(row) => void logic.verifyWorkOrder(row)}
          />
        ) : logic.tab === "requisitions" ? (
          <RequisitionsView
            rows={logic.rows}
            loading={logic.loading}
            error={logic.error}
            search={logic.search}
            setSearch={logic.setSearch}
            organizationId={logic.organizationId}
            propertyOptions={logic.properties}
            canWork={logic.canWork}
            canApprove={logic.canApprove}
            reload={() => void logic.load()}
            setTab={logic.selectTab}
          />
        ) : logic.tab === "procurement" ? (
          <ProcurementView
            rows={logic.rows}
            organizationId={logic.organizationId}
            reload={() => void logic.load()}
            canApprove={logic.canApprove}
          />
        ) : logic.tab === "planned-maintenance" ? (
          <PlannedMaintenanceView
            rows={logic.rows}
            kpis={logic.dashboard?.kpis ?? {}}
            onAction={logic.runAction}
            permissions={{ canAdminister: logic.canAdminister }}
            onAdd={() => logic.setCreateModal("ppm")}
            organizationId={logic.organizationId}
            reload={() => void logic.load()}
          />
        ) : logic.tab === "inspections" ? (
          <InspectionsView
            rows={logic.rows}
            kpis={logic.dashboard?.kpis ?? {}}
            onAction={logic.runAction}
            permissions={{ canInspect: logic.canInspect }}
            onAdd={() => logic.setCreateModal("inspection")}
          />
        ) : logic.tab === "service-requests" ? (
          <ServiceRequestsView
            rows={logic.rows}
            kpis={logic.dashboard?.kpis ?? {}}
            onAction={logic.runAction}
            permissions={{ canWork: logic.canWork, canApprove: logic.canApprove }}
            onAdd={() => logic.setCreateModal("service-request")}
          />
        ) : logic.tab === "service-profiles" || logic.tab === "incidents" ? (
          <OperationsRegistryView
            mode={logic.tab}
            rows={logic.rows}
            organizationId={logic.organizationId}
            propertyId={logic.activePropertyId}
            canApprove={logic.canApprove}
            canAdminister={logic.canAdminister}
            reload={logic.load}
          />
        ) : logic.tab === "meters" ? (
          <UtilitiesView
            rows={logic.rows}
            kpis={logic.dashboard?.kpis ?? {}}
            organizationId={logic.organizationId}
            canWork={logic.canWork}
            canApprove={logic.canApprove}
            canAdminister={logic.canAdminister}
            reload={logic.load}
          />
        ) : logic.tab === "service-providers" ? (
          <ContractorsView
            rows={logic.rows}
            organizationId={logic.organizationId}
            onAdd={() => logic.setCreateModal("contractor")}
            canAdminister={logic.canAdminister}
            reload={logic.load}
          />
        ) : logic.tab === "contractors" ? (
          <ContractorsView
            rows={logic.rows}
            organizationId={logic.organizationId}
            onAdd={() => logic.setCreateModal("contractor")}
            canAdminister={logic.canAdminister}
            reload={logic.load}
          />
        ) : logic.tab === "reports" || logic.tab === "operations-reports" || logic.tab === "asset-reports" || logic.tab === "compliance-reports" || logic.tab === "energy-reports" ? (
          logic.dashboard ? (
            <ReportsView
              dashboard={logic.dashboard}
              organizationId={logic.organizationId}
              initialCategory={
                logic.tab === "operations-reports"
                  ? "Work Orders & Maintenance"
                  : logic.tab === "asset-reports"
                  ? "Asset & Lifecycle"
                  : logic.tab === "compliance-reports"
                  ? "Statutory & Compliance"
                  : logic.tab === "energy-reports"
                  ? "Energy & Utilities"
                  : "All reports"
              }
            />
          ) : null
        ) : logic.tab === "supplier-invoices" ? (
          <SupplierInvoicesView
            rows={logic.rows}
            loading={logic.loading}
            error={logic.error}
            search={logic.search}
            setSearch={logic.setSearch}
            organizationId={logic.organizationId}
            reload={() => void logic.load()}
            setTab={logic.selectTab}
          />
        ) : logic.tab === "finance-control" ? (
          <FinanceControlView
            rows={logic.rows}
            organizationId={logic.organizationId}
            reload={() => void logic.load()}
            canApprove={logic.canApprove}
            setTab={logic.selectTab}
          />
        ) : logic.tab === "expenditure" ? (
          <ExpenditureView
            rows={logic.rows}
            organizationId={logic.organizationId}
            propertyId={logic.activePropertyId}
            canApprove={logic.canApprove}
            reload={logic.load}
          />
        ) : logic.tab === "spare-parts" ? (
          <InventoryView variant="spare-parts" rows={logic.rows} onAdd={() => logic.setCreateModal("asset")} />
        ) : logic.tab === "consumables" ? (
          <InventoryView variant="consumables" rows={logic.rows} onAdd={() => logic.setCreateModal("asset")} />
        ) : logic.tab === "tickets" ? (
          <ModuleTicketsView moduleName="Facility" />
        ) : logic.tab === "calendar" ? (
          <ModuleCalendarView moduleName="Facility" />
        ) : (
          <GenericListView tab={logic.tab} rows={logic.rows} />
        )}

        <FacilityModals
          showCreate={logic.showCreate}
          setShowCreate={logic.setShowCreate}
          createWorkOrder={logic.createWorkOrder}
          actionModal={logic.actionModal}
          setActionModal={logic.setActionModal}
          submitActionModal={logic.submitActionModal}
          createModal={logic.createModal}
          setCreateModal={logic.setCreateModal}
          handleCreate={logic.handleCreate}
          properties={logic.properties}
          assets={logic.assets}
          createError={logic.createError}
          creating={logic.creating}
        />
      </div>
    </ModuleShell>
  );
}

export default FacilityFeaturePage;
