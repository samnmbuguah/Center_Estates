"use client";

import { useState, useEffect } from "react";
import { ModuleShell } from "@/components/module-shell";
import { constructionNav } from "@/lib/module-nav";
import { WorkspaceProvider, useWorkspace } from "@/components/monitoring/context/WorkspaceContext";

// Import all MonitoringERP page components
import { Projects } from "@/components/monitoring/pages/Projects";
import { ProjectWorkspace } from "@/components/monitoring/pages/ProjectWorkspace";
import { ProjectDetail } from "@/components/monitoring/pages/ProjectDetail";
import { ProjectLifecycle } from "@/components/monitoring/pages/ProjectLifecycle";
import { PreConstruction } from "@/components/monitoring/pages/PreConstruction";
import { DailyLogs } from "@/components/monitoring/pages/DailyLogs";
import { SiteVisits } from "@/components/monitoring/pages/SiteVisits";
import { SiteRecords } from "@/components/monitoring/pages/SiteRecords";
import { QualityTests } from "@/components/monitoring/pages/QualityTests";
import { Issues } from "@/components/monitoring/pages/Issues";
import { RfiList } from "@/components/monitoring/pages/RfiList";
import { Notices } from "@/components/monitoring/pages/Notices";
import { Tickets } from "@/components/monitoring/pages/Tickets";
import { Subcontractors } from "@/components/monitoring/pages/Subcontractors";
import { Stakeholders } from "@/components/monitoring/pages/Stakeholders";
import { Timeline } from "@/components/monitoring/pages/Timeline";
import { Milestones } from "@/components/monitoring/pages/Milestones";
import { Approvals } from "@/components/monitoring/pages/Approvals";
import { Finance } from "@/components/monitoring/pages/Finance";
import { CostDashboard } from "@/components/monitoring/pages/CostDashboard";
import { CashFlow } from "@/components/monitoring/pages/CashFlow";
import { BoqCostStates } from "@/components/monitoring/pages/BoqCostStates";
import { BoQReview } from "@/components/monitoring/pages/BoQReview";
import { BoQMaterialReconciliation } from "@/components/monitoring/pages/BoQMaterialReconciliation";
import { IpcGeneration } from "@/components/monitoring/pages/IpcGeneration";
import { Variations } from "@/components/monitoring/pages/Variations";
import { AdvancePayments } from "@/components/monitoring/pages/AdvancePayments";
import { ConsultantPayments } from "@/components/monitoring/pages/ConsultantPayments";
import { ContingencyDrawdowns } from "@/components/monitoring/pages/ContingencyDrawdowns";
import { DrawdownRequests } from "@/components/monitoring/pages/DrawdownRequests";
import { ProvisionalSums } from "@/components/monitoring/pages/ProvisionalSums";
import { RetentionRegister } from "@/components/monitoring/pages/RetentionRegister";
import { WorkOrderSummary } from "@/components/monitoring/pages/WorkOrderSummary";
import { Ingestion } from "@/components/monitoring/pages/Ingestion";
import { Store } from "@/components/monitoring/pages/Store";
import { BimModels } from "@/components/monitoring/pages/BimModels";
import { BimDiscrepancies } from "@/components/monitoring/pages/BimDiscrepancies";
import { DroneDatasets } from "@/components/monitoring/pages/DroneDatasets";
import { SatelliteDatasets } from "@/components/monitoring/pages/SatelliteDatasets";
import { ProjectDocuments } from "@/components/monitoring/pages/ProjectDocuments";
import { Reports } from "@/components/monitoring/pages/Reports";
import { MonthlyReports } from "@/components/monitoring/pages/MonthlyReports";
import CalendarPage from "@/components/monitoring/pages/CalendarPage";
import ChatPage from "@/components/monitoring/pages/ChatPage";
import NotificationsPage from "@/components/monitoring/pages/NotificationsPage";
import { Administration } from "@/components/monitoring/pages/Administration";
import { RolesPermissions } from "@/components/monitoring/pages/RolesPermissions";
import { Users } from "@/components/monitoring/pages/Users";
import { AdminAuditLog } from "@/components/monitoring/pages/AdminAuditLog";
import { ExecutiveDashboard } from "@/components/monitoring/pages/ExecutiveDashboard";

type Tab =
  | "overview"
  | "projects"
  | "project-memberships"
  | "lifecycle"
  | "calendar"
  | "milestones"
  | "daily-logs"
  | "tickets"
  | "ticket-comments"
  | "risks"
  | "safety-incidents"
  | "quality-tests"
  | "rfis"
  | "work-plan"
  | "milestone-verifications"
  | "requirement-waivers"
  | "approvals"
  | "boq"
  | "variations"
  | "provisional-sums"
  | "contingency-drawdowns"
  | "advance-payments"
  | "advance-recoveries"
  | "consultant-payments"
  | "work-orders"
  | "subcontractors"
  | "materials"
  | "store-items"
  | "store-suppliers"
  | "material-requisitions"
  | "purchase-orders"
  | "stock-movements"
  | "requisitions"
  | "certificates"
  | "disbursements"
  | "drawdowns"
  | "documents"
  | "document-versions"
  | "bim-models"
  | "bim-discrepancies"
  | "drone-datasets"
  | "satellite-datasets"
  | "reports"
  | "chat"
  | "notifications"
  | "audit-log";

const tabLabels: Record<Tab, string> = {
  overview: "Command Center Overview",
  projects: "Project Portfolio",
  "project-memberships": "Project Team & Responsibility",
  lifecycle: "Project Lifecycle & Milestones",
  calendar: "Site & Operational Calendar",
  milestones: "Physical Progress & Milestones",
  "daily-logs": "Site Daily Logs & Weather",
  tickets: "Site Issues & Escalations",
  "ticket-comments": "Issue Discussions & Attachments",
  risks: "Risk Register & Matrix",
  "safety-incidents": "H&S Incidents & Inspections",
  "quality-tests": "Quality Assurance Tests",
  rfis: "Requests For Information (RFIs)",
  "work-plan": "Programme & Schedule Timeline",
  "milestone-verifications": "Progress Verification & Certification",
  "requirement-waivers": "Requirement Waivers",
  approvals: "Statutory & Governance Approvals",
  boq: "Bill of Quantities & Cost States",
  variations: "Variations & Scope Changes",
  "provisional-sums": "Provisional Sums Register",
  "contingency-drawdowns": "Contingency Drawdowns",
  "advance-payments": "Advance Payments & Amortization",
  "advance-recoveries": "Advance Recovery Schedule",
  "consultant-payments": "Consultant Fee Certificates",
  "work-orders": "Subcontract Work Orders",
  subcontractors: "Subcontractor Register",
  materials: "Material Deliveries & Ingestion",
  "store-items": "Store & Inventory Ledger",
  "store-suppliers": "Material Suppliers",
  "material-requisitions": "Material Requisitions",
  "purchase-orders": "Purchase Orders",
  "stock-movements": "Stock Movement Ledger",
  requisitions: "Financial Requisitions",
  certificates: "Interim Payment Certificates (IPC)",
  disbursements: "Payment Disbursements",
  drawdowns: "Fund Drawdown Requests",
  documents: "Controlled Project Documents",
  "document-versions": "Document Revisions & CAD",
  "bim-models": "BIM Models & IFC Viewer",
  "bim-discrepancies": "BIM Discrepancy Register",
  "drone-datasets": "Drone Photogrammetry",
  "satellite-datasets": "Satellite Orthomosaics",
  reports: "Executive & Site Reports",
  chat: "Project AI Assistant & Team Chat",
  notifications: "System Notifications",
  "audit-log": "Audit Log & Access Trail",
};

function WorkspaceContent() {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (q && tabLabels[q]) return q;
    }
    return "overview";
  });

  const { activeProject } = useWorkspace();

  const handleSelectTab = (id: string) => {
    setTab(id as Tab);
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      sp.set("tab", id);
      window.history.pushState({}, "", `${window.location.pathname}?${sp.toString()}`);
    }
  };

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Management"
      eyebrow="Construction & Site Operations"
      title="Construction Management Workspace"
      subtitle="Full lifecycle site monitoring, commercial controls, BIM/GIS, progress certification, and risk engineering."
      accent="#00a3ff"
      groups={constructionNav}
      activeId={tab}
      onSelect={handleSelectTab}
      contextLabel="Active Project"
      contextValue={activeProject?.name || "All Projects"}
    >
      <div className="monitoring-workspace-container" style={{ padding: "8px 0" }}>
        {tab === "overview" && <ExecutiveDashboard />}
        {tab === "projects" && <Projects />}
        {tab === "project-memberships" && <ProjectWorkspace />}
        {tab === "lifecycle" && <ProjectLifecycle />}
        {tab === "calendar" && <CalendarPage />}
        {tab === "milestones" && <Milestones />}
        {tab === "daily-logs" && <DailyLogs />}
        {tab === "tickets" && <Tickets />}
        {tab === "ticket-comments" && <Issues />}
        {tab === "risks" && <Issues />}
        {tab === "safety-incidents" && <DailyLogs />}
        {tab === "quality-tests" && <QualityTests />}
        {tab === "rfis" && <RfiList />}
        {tab === "work-plan" && <Timeline />}
        {tab === "milestone-verifications" && <Milestones />}
        {tab === "requirement-waivers" && <PreConstruction />}
        {tab === "approvals" && <Approvals />}
        {tab === "boq" && <BoqCostStates />}
        {tab === "variations" && <Variations />}
        {tab === "provisional-sums" && <ProvisionalSums />}
        {tab === "contingency-drawdowns" && <ContingencyDrawdowns />}
        {tab === "advance-payments" && <AdvancePayments />}
        {tab === "advance-recoveries" && <AdvancePayments />}
        {tab === "consultant-payments" && <ConsultantPayments />}
        {tab === "work-orders" && <WorkOrderSummary />}
        {tab === "subcontractors" && <Subcontractors />}
        {tab === "materials" && <Ingestion />}
        {tab === "store-items" && <Store />}
        {tab === "store-suppliers" && <Store />}
        {tab === "material-requisitions" && <Store />}
        {tab === "purchase-orders" && <Store />}
        {tab === "stock-movements" && <Store />}
        {tab === "requisitions" && <Finance />}
        {tab === "certificates" && <IpcGeneration />}
        {tab === "disbursements" && <Finance />}
        {tab === "drawdowns" && <DrawdownRequests />}
        {tab === "documents" && <ProjectDocuments />}
        {tab === "document-versions" && <ProjectDocuments />}
        {tab === "bim-models" && <BimModels />}
        {tab === "bim-discrepancies" && <BimDiscrepancies />}
        {tab === "drone-datasets" && <DroneDatasets />}
        {tab === "satellite-datasets" && <SatelliteDatasets />}
        {tab === "reports" && <Reports />}
        {tab === "chat" && <ChatPage />}
        {tab === "notifications" && <NotificationsPage />}
        {tab === "audit-log" && <AdminAuditLog />}
      </div>
    </ModuleShell>
  );
}

export default function MonitoringWorkspace() {
  return (
    <WorkspaceProvider>
      <WorkspaceContent />
    </WorkspaceProvider>
  );
}
