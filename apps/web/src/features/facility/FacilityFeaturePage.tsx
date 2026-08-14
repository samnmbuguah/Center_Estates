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
import { FacilityModals } from "./components/modals/FacilityModals";
import { ErrorBanner, LoadingState } from "@/components/module-ui";

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
        ) : logic.tab === "buildings" ? (
          <BuildingsView rows={logic.rows} kpis={logic.dashboard?.kpis ?? {}} />
        ) : logic.tab === "assets" ? (
          <AssetsView rows={logic.rows} kpis={logic.dashboard?.kpis ?? {}} onAdd={() => logic.setCreateModal("asset")} />
        ) : logic.tab === "work-orders" ? (
          <WorkOrdersView
            rows={logic.rows}
            kpis={logic.dashboard?.kpis ?? {}}
            permissions={{ canWork: logic.canWork }}
            setShowCreate={logic.setShowCreate}
            organizationId={logic.organizationId}
            onTransition={(row, target, notes) => void logic.runWorkTransition(row, target, notes)}
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
        ) : logic.tab === "contractors" ? (
          <ContractorsView
            rows={logic.rows}
            onAdd={() => logic.setCreateModal("contractor")}
            canAdminister={logic.canAdminister}
          />
        ) : logic.tab === "reports" ? (
          logic.dashboard ? <ReportsView dashboard={logic.dashboard} organizationId={logic.organizationId} /> : null
        ) : logic.tab === "expenditure" ? (
          <ExpenditureView rows={logic.rows} organizationId={logic.organizationId} />
        ) : logic.tab === "spare-parts" ? (
          <InventoryView variant="spare-parts" rows={logic.rows} />
        ) : logic.tab === "consumables" ? (
          <InventoryView variant="consumables" rows={logic.rows} />
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
        />
      </div>
    </ModuleShell>
  );
}

export default FacilityFeaturePage;
