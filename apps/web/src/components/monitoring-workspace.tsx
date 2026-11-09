"use client";

import React, { lazy, Suspense, useState, useEffect } from "react";
import { ModuleShell } from "@/components/module-shell";
import { WorkspaceProvider, useWorkspace } from "@/components/monitoring/context/WorkspaceContext";
import {
  fetchDashboard,
  fetchTickets,
  fetchRequisitions,
  type Ticket,
  type Requisition,
} from "@/components/monitoring/api";
import { usePropertyContext } from "@/lib/property-context";
import { BrandedLoader } from "@/components/branded-loader";

const Projects = lazy(() => import("@/components/monitoring/pages/Projects").then(m => ({ default: m.Projects })));
const ProjectWorkspace = lazy(() => import("@/components/monitoring/pages/ProjectWorkspace").then(m => ({ default: m.ProjectWorkspace })));
const Timeline = lazy(() => import("@/components/monitoring/pages/Timeline").then(m => ({ default: m.Timeline })));
const FinancialRequisitions = lazy(() => import("@/components/monitoring/pages/FinancialRequisitions").then(m => ({ default: m.FinancialRequisitions })));
const Disbursements = lazy(() => import("@/components/monitoring/pages/Disbursements").then(m => ({ default: m.Disbursements })));
const CostDashboard = lazy(() => import("@/components/monitoring/pages/CostDashboard").then(m => ({ default: m.CostDashboard })));
const IpcGeneration = lazy(() => import("@/components/monitoring/pages/IpcGeneration").then(m => ({ default: m.IpcGeneration })));
const Reports = lazy(() => import("@/components/monitoring/pages/Reports").then(m => ({ default: m.Reports })));
const ExecutiveDashboard = lazy(() => import("@/components/monitoring/pages/ExecutiveDashboard").then(m => ({ default: m.ExecutiveDashboard })));
const ProjectLifecycle = lazy(() => import("@/components/monitoring/pages/ProjectLifecycle").then(m => ({ default: m.ProjectLifecycle })));
const PreConstruction = lazy(() => import("@/components/monitoring/pages/PreConstruction").then(m => ({ default: m.PreConstruction })));
const DailyLogs = lazy(() => import("@/components/monitoring/pages/DailyLogs").then(m => ({ default: m.DailyLogs })));
const SiteVisits = lazy(() => import("@/components/monitoring/pages/SiteVisits").then(m => ({ default: m.SiteVisits })));
const QualityTests = lazy(() => import("@/components/monitoring/pages/QualityTests").then(m => ({ default: m.QualityTests })));
const Issues = lazy(() => import("@/components/monitoring/pages/Issues").then(m => ({ default: m.Issues })));
const RfiList = lazy(() => import("@/components/monitoring/pages/RfiList").then(m => ({ default: m.RfiList })));
const Tickets = lazy(() => import("@/components/monitoring/pages/Tickets").then(m => ({ default: m.Tickets })));
const Subcontractors = lazy(() => import("@/components/monitoring/pages/Subcontractors").then(m => ({ default: m.Subcontractors })));
const Stakeholders = lazy(() => import("@/components/monitoring/pages/Stakeholders").then(m => ({ default: m.Stakeholders })));
const Milestones = lazy(() => import("@/components/monitoring/pages/Milestones").then(m => ({ default: m.Milestones })));
const MilestoneVerifications = lazy(() => import("@/components/monitoring/pages/MilestoneVerifications").then(m => ({ default: m.MilestoneVerifications })));
const Approvals = lazy(() => import("@/components/monitoring/pages/Approvals").then(m => ({ default: m.Approvals })));
const BoqCostStates = lazy(() => import("@/components/monitoring/pages/BoqCostStates").then(m => ({ default: m.BoqCostStates })));
const BoQMaterialReconciliation = lazy(() => import("@/components/monitoring/pages/BoQMaterialReconciliation").then(m => ({ default: m.BoQMaterialReconciliation })));
const Variations = lazy(() => import("@/components/monitoring/pages/Variations").then(m => ({ default: m.Variations })));
const AdvancePayments = lazy(() => import("@/components/monitoring/pages/AdvancePayments").then(m => ({ default: m.AdvancePayments })));
const ConsultantPayments = lazy(() => import("@/components/monitoring/pages/ConsultantPayments").then(m => ({ default: m.ConsultantPayments })));
const ContingencyDrawdowns = lazy(() => import("@/components/monitoring/pages/ContingencyDrawdowns").then(m => ({ default: m.ContingencyDrawdowns })));
const DrawdownRequests = lazy(() => import("@/components/monitoring/pages/DrawdownRequests").then(m => ({ default: m.DrawdownRequests })));
const ProvisionalSums = lazy(() => import("@/components/monitoring/pages/ProvisionalSums").then(m => ({ default: m.ProvisionalSums })));
const WorkOrderSummary = lazy(() => import("@/components/monitoring/pages/WorkOrderSummary").then(m => ({ default: m.WorkOrderSummary })));
const Ingestion = lazy(() => import("@/components/monitoring/pages/Ingestion").then(m => ({ default: m.Ingestion })));
const Store = lazy(() => import("@/components/monitoring/pages/Store").then(m => ({ default: m.Store })));
const Suppliers = lazy(() => import("@/components/monitoring/pages/Suppliers").then(m => ({ default: m.Suppliers })));
const MaterialRequisitions = lazy(() => import("@/components/monitoring/pages/MaterialRequisitions").then(m => ({ default: m.MaterialRequisitions })));
const PurchaseOrders = lazy(() => import("@/components/monitoring/pages/PurchaseOrders").then(m => ({ default: m.PurchaseOrders })));
const StockMovements = lazy(() => import("@/components/monitoring/pages/StockMovements").then(m => ({ default: m.StockMovements })));
const BimModels = lazy(() => import("@/components/monitoring/pages/BimModels").then(m => ({ default: m.BimModels })));
const BimVerificationHub = lazy(() => import("@/components/monitoring/pages/BimVerificationHub").then(m => ({ default: m.BimVerificationHub })));
const IQSKRatesHandbook = lazy(() => import("@/components/monitoring/pages/IQSKRatesHandbook").then(m => ({ default: m.IQSKRatesHandbook })));
const BimDiscrepancies = lazy(() => import("@/components/monitoring/pages/BimDiscrepancies").then(m => ({ default: m.BimDiscrepancies })));
const DroneDatasets = lazy(() => import("@/components/monitoring/pages/DroneDatasets").then(m => ({ default: m.DroneDatasets })));
const SatelliteDatasets = lazy(() => import("@/components/monitoring/pages/SatelliteDatasets").then(m => ({ default: m.SatelliteDatasets })));
const ProjectDocuments = lazy(() => import("@/components/monitoring/pages/ProjectDocuments").then(m => ({ default: m.ProjectDocuments })));
const DocumentRevisions = lazy(() => import("@/components/monitoring/pages/DocumentRevisions").then(m => ({ default: m.DocumentRevisions })));
const CalendarPage = lazy(() => import("@/components/monitoring/pages/CalendarPage"));
const ChatPage = lazy(() => import("@/components/monitoring/pages/ChatPage"));
const NotificationsPage = lazy(() => import("@/components/monitoring/pages/NotificationsPage"));
const AdminAuditLog = lazy(() => import("@/components/monitoring/pages/AdminAuditLog").then(m => ({ default: m.AdminAuditLog })));

export type Tab =
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
  | "cost-dashboard"
  | "boq"
  | "variations"
  | "provisional-sums"
  | "contingency-drawdowns"
  | "advance-payments"
  | "advance-recoveries"
  | "consultant-payments"
  | "work-orders"
  | "subcontractors"
  | "ingestion"
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
  | "bim-verification"
  | "iqsk-rates"
  | "bim-discrepancies"
  | "drone-datasets"
  | "satellite-datasets"
  | "reports"
  | "site-visits"
  | "stakeholders"
  | "chat"
  | "notifications"
  | "audit-log"
  | "role-pm"
  | "role-finance"
  | "role-site"
  | "role-dev"
  | "role-sales"
  | "role-marketing"
  | "role-clerk"
  | "role-valuer"
  | "role-facilities"
  | "role-admin";

const tabLabels: Record<Tab, string> = {
  overview: "Command Center Overview",
  projects: "Project Portfolio",
  "project-memberships": "Project Command Center",
  lifecycle: "Project Lifecycle & Milestones",
  calendar: "Site & Operational Calendar",
  milestones: "Stage-Gates & Mini-BoQ",
  "daily-logs": "Site Daily Logs & HSE",
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
  "cost-dashboard": "Commercial Cost & Cash Flow",
  boq: "Bill of Quantities & Cost States",
  variations: "Variations & Scope Changes",
  "provisional-sums": "Provisional Sums Register",
  "contingency-drawdowns": "Contingency Drawdowns",
  "advance-payments": "Advance Payments & Amortization",
  "advance-recoveries": "Advance Recovery Schedule",
  "consultant-payments": "Consultant Fee Certificates",
  "work-orders": "Subcontract Work Orders",
  subcontractors: "Subcontractor Register",
  ingestion: "BoQ & Programme Import",
  materials: "BoQ Material Reconciliation",
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
  "bim-verification": "BIM & BoQ Verification Hub",
  "iqsk-rates": "IQSK Construction Costs Handbook",
  "bim-discrepancies": "BIM Discrepancy Register",
  "drone-datasets": "Drone Photogrammetry",
  "satellite-datasets": "Satellite Orthomosaics",
  reports: "Executive & Site Reports",
  "site-visits": "Site Visits & Field Inspections",
  stakeholders: "Project Team & Stakeholders",
  chat: "Project AI Assistant & Team Chat",
  notifications: "System Notifications",
  "audit-log": "Audit Log & Access Trail",
  "role-pm": "Project Manager Dashboard",
  "role-finance": "Finance Dashboard",
  "role-site": "Site Agent Dashboard",
  "role-dev": "Project Developer Dashboard",
  "role-sales": "Sales Dashboard",
  "role-marketing": "Buyer / Marketing Dashboard",
  "role-clerk": "Clerk of Works Dashboard",
  "role-valuer": "Quantity Surveyor / Valuer Dashboard",
  "role-facilities": "Facilities Handover Dashboard",
  "role-admin": "Administrator Dashboard",
};

/** Exact horizontal navigation items aligned with MonitoringERP */
export const monitoringHorizontalNav = [
  { id: "overview", label: "Overview" },
  { id: "work-plan", label: "Programme" },
  { id: "milestones", label: "Stage-Gates & Mini-BoQ" },
  { id: "cost-dashboard", label: "Cost & Cash Flow" },
  { id: "boq", label: "Master BoQ" },
  { id: "certificates", label: "IPCs" },
  { id: "daily-logs", label: "Daily Logs" },
  { id: "tickets", label: "Issues" },
  { id: "risks", label: "Risks" },
  { id: "materials", label: "Materials" },
  { id: "documents", label: "Documents" },
  { id: "reports", label: "Reports" },
];

const ROLE_META: Record<string, { title: string; subtitle: string; tableTitle: string }> = {
  "role-pm": {
    title: "Project Manager Command View",
    subtitle: "Programme delivery, stage-gate verifications, risk exposure, and commercial utilization.",
    tableTitle: "Active Project Portfolio",
  },
  "role-finance": {
    title: "Finance & Commercial Controls",
    subtitle: "Certified IPC valuations, retention reserves, advance recoveries, and pending requisitions.",
    tableTitle: "Project Financial Portfolio",
  },
  "role-site": {
    title: "Site Agent Field Operations",
    subtitle: "Daily site logs, inspections, active work packages, and HSE compliance.",
    tableTitle: "Site Operations Portfolio",
  },
  "role-clerk": {
    title: "Clerk of Works Verification Hub",
    subtitle: "Field measurements, photographic evidence, material deliveries, and cube test tracking.",
    tableTitle: "Projects Under Site Inspection",
  },
  "role-valuer": {
    title: "Quantity Surveyor & Valuation Hub",
    subtitle: "Mini-BoQ stage-gate valuations, variation orders, and Interim Payment Certificates (IPCs).",
    tableTitle: "Projects Requiring Valuation",
  },
  "role-admin": {
    title: "Construction Operations Overview",
    subtitle: "Cross-portfolio governance, team assignments, verifications, and commercial health.",
    tableTitle: "Portfolio Activity Register",
  },
};

function UnifiedRoleDashboard({ roleKey }: { roleKey: string }) {
  const { activeProject } = useWorkspace();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const pid = activeProject?.id || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
    fetchTickets(pid || undefined).then(setTickets).catch(() => {});
    if (roleKey === "role-finance") {
      fetchRequisitions().then(setRequisitions).catch(() => {});
    }
  }, [activeProject?.id, roleKey]);

  const meta = ROLE_META[roleKey] ?? {
    title: tabLabels[roleKey as Tab] || "Role Command View",
    subtitle: "Portfolio KPIs, milestone progress, and commercial status.",
    tableTitle: "Project Portfolio",
  };

  const d = (data ?? {}) as Record<string, unknown>;
  const kpisObj = (d.kpis ?? {}) as Record<string, unknown>;
  const projectsObj = (d.projects ?? {}) as Record<string, unknown>;
  const cost = (d.cost ?? {}) as Record<string, unknown>;

  const projectItems = Array.isArray(d.projects)
    ? (d.projects as Record<string, unknown>[])
    : (((projectsObj.items ?? d.recentProjects ?? []) as Record<string, unknown>[]));

  const totalProjects = Number(kpisObj.portfolioProjects ?? projectsObj.total ?? projectItems.length ?? 0);
  const openTickets = Number(kpisObj.openTickets ?? d.tickets_open ?? tickets.length ?? 0);
  const pendingVerifications = Number(kpisObj.submittedMilestones ?? d.pending_verifications ?? 0);
  const totalBudget = Number(cost.budget ?? kpisObj.paidValue ?? 0);
  const certifiedValue = Number(cost.certified_to_date ?? kpisObj.certifiedValue ?? 0);

  const kpis = [
    { label: "Portfolio Projects", value: String(totalProjects), color: "var(--brand-primary, #2563eb)" },
    { label: "Submitted Milestones", value: String(pendingVerifications), color: "var(--color-info, #0284c7)" },
    { label: "Open Site Issues", value: String(openTickets), color: openTickets > 0 ? "var(--color-warning, #d97706)" : "var(--color-emerald-strong, #16a34a)" },
    { label: "Certified Value", value: `KES ${(certifiedValue / 1e6).toFixed(1)}M`, color: "var(--color-emerald-strong, #16a34a)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{meta.title}</h2>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>{meta.subtitle}</p>
      </div>

      {error && (
        <div style={{ background: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.25)", borderRadius: 8, color: "#dc2626", padding: "10px 14px", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="card"
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${kpi.color}`,
            }}
          >
            <div className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, marginTop: 4 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{meta.tableTitle}</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Code</th>
                <th>Stage</th>
                <th>Budget</th>
              </tr>
            </thead>
            <tbody>
              {projectItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24 }} className="muted">
                    No active projects found.
                  </td>
                </tr>
              ) : (
                projectItems.slice(0, 8).map((pr, i) => (
                  <tr key={String(pr.id ?? i)}>
                    <td><strong style={{ fontSize: 12 }}>{String(pr.name ?? "—")}</strong></td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(pr.code ?? "—")}</td>
                    <td><span className="status-pill" style={{ fontSize: 11 }}>{String(pr.stage ?? pr.status ?? "active")}</span></td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {pr.budget ? `KES ${Number(pr.budget).toLocaleString()}` : totalBudget ? `KES ${(totalBudget / 1e6).toFixed(1)}M` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {roleKey === "role-finance" && requisitions.length > 0 && (
        <div className="data-panel">
          <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Pending Payment Requisitions</span>
          </div>
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr><th>Title</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {requisitions.slice(0, 6).map((r) => (
                  <tr key={r.id}>
                    <td><strong style={{ fontSize: 12 }}>{r.title}</strong></td>
                    <td className="mono" style={{ fontSize: 12 }}>KES {Number(r.amount ?? 0).toLocaleString()}</td>
                    <td><span className="status-pill" style={{ fontSize: 11 }}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const AdvanceRecoveriesView = () => <AdvancePayments recoveryOnly />;

/** Declarative OCP Tab Registry: adding a new view requires only one entry here */
const TAB_REGISTRY: Record<string, React.ComponentType> = {
  overview: ExecutiveDashboard,
  projects: Projects,
  "project-memberships": ProjectWorkspace,
  lifecycle: ProjectLifecycle,
  calendar: CalendarPage,
  milestones: Milestones,
  "daily-logs": DailyLogs,
  tickets: Tickets,
  "ticket-comments": Tickets,
  risks: Issues,
  "safety-incidents": DailyLogs,
  "quality-tests": QualityTests,
  rfis: RfiList,
  "work-plan": Timeline,
  "milestone-verifications": MilestoneVerifications,
  "requirement-waivers": PreConstruction,
  approvals: Approvals,
  "cost-dashboard": CostDashboard,
  boq: BoqCostStates,
  variations: Variations,
  "provisional-sums": ProvisionalSums,
  "contingency-drawdowns": ContingencyDrawdowns,
  "advance-payments": AdvancePayments,
  "advance-recoveries": AdvanceRecoveriesView,
  "consultant-payments": ConsultantPayments,
  "work-orders": WorkOrderSummary,
  subcontractors: Subcontractors,
  ingestion: Ingestion,
  materials: BoQMaterialReconciliation,
  "store-items": Store,
  "store-suppliers": Suppliers,
  "material-requisitions": MaterialRequisitions,
  "purchase-orders": PurchaseOrders,
  "stock-movements": StockMovements,
  requisitions: FinancialRequisitions,
  certificates: IpcGeneration,
  disbursements: Disbursements,
  drawdowns: DrawdownRequests,
  documents: ProjectDocuments,
  "document-versions": DocumentRevisions,
  "bim-models": BimModels,
  "bim-verification": BimVerificationHub,
  "iqsk-rates": IQSKRatesHandbook,
  "bim-discrepancies": BimDiscrepancies,
  "drone-datasets": DroneDatasets,
  "satellite-datasets": SatelliteDatasets,
  reports: Reports,
  "site-visits": SiteVisits,
  stakeholders: Stakeholders,
  chat: ChatPage,
  notifications: NotificationsPage,
  "audit-log": AdminAuditLog,
};

function WorkspaceContent() {
  const { activeProperty } = usePropertyContext();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (q && tabLabels[q]) return q;
    }
    return "overview";
  });

  const handleSelectTab = (id: string) => {
    setTab(id as Tab);
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      sp.set("tab", id);
      window.history.pushState({}, "", `${window.location.pathname}?${sp.toString()}`);
    }
  };

  const ActiveComponent = TAB_REGISTRY[tab];

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Management"
      eyebrow="Construction & Site Operations"
      title={tabLabels[tab] || "Construction Management Workspace"}
      subtitle="Full lifecycle site monitoring, commercial controls, BIM/GIS, progress certification, and risk engineering."
      accent="var(--color-brand-blue)"
      activeId={tab}
      onSelect={handleSelectTab}
    >
      <Suspense fallback={<BrandedLoader compact message="Preparing this view" />}>
        <div key={activeProperty?.id ?? "portfolio"} className="monitoring-workspace-container" style={{ padding: "8px 0" }}>
          {ActiveComponent ? (
            <ActiveComponent />
          ) : tab.startsWith("role-") ? (
            <UnifiedRoleDashboard roleKey={tab} />
          ) : (
            <ExecutiveDashboard />
          )}
        </div>
      </Suspense>
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
