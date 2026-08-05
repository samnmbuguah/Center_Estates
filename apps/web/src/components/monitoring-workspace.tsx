"use client";

import { useState, useEffect } from "react";
import { ModuleShell } from "@/components/module-shell";
import { constructionNav } from "@/lib/module-nav";
import { WorkspaceProvider, useWorkspace } from "@/components/monitoring/context/WorkspaceContext";
import { fetchDashboard, fetchTickets, fetchDailyLogs, fetchRequisitions, type Ticket, type DailyLog, type Requisition } from "@/components/monitoring/api";

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
  "site-visits": "Site Visits & Field Inspections",
  stakeholders: "Project Stakeholders",
  chat: "Project AI Assistant & Team Chat",
  notifications: "System Notifications",
  "audit-log": "Audit Log & Access Trail",
  "role-pm": "Project Manager Dashboard",
  "role-finance": "Finance Dashboard",
  "role-site": "Site Agent Dashboard",
  "role-dev": "Project Developer Dashboard",
  "role-sales": "Sales Dashboard",
  "role-marketing": "Buyer / Marketing Dashboard",
  "role-clerk": "Clerk Dashboard",
  "role-valuer": "Valuer Dashboard",
  "role-facilities": "Facilities Dashboard",
  "role-admin": "Administrator Dashboard",
};

/** Exact horizontal navigation items aligned with MonitoringERP */
export const monitoringHorizontalNav = [
  { id: "overview", label: "Overview" },
  { id: "tickets", label: "Tickets" },
  { id: "work-plan", label: "Programme" },
  { id: "milestones", label: "Milestones" },
  { id: "requisitions", label: "Financials" },
  { id: "risks", label: "Risks" },
  { id: "documents", label: "Documents" },
  { id: "reports", label: "Reports" },
  { id: "site-visits", label: "Site Visits" },
  { id: "daily-logs", label: "Daily Logs" },
  { id: "materials", label: "Procurement" },
  { id: "stakeholders", label: "Stakeholders" },
];

function ProjectManagerDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
    fetchTickets(pid || undefined).then(setTickets).catch(() => {});
  }, []);

  const d = (data ?? {}) as Record<string, unknown>;
  const projects = (d.projects ?? {}) as Record<string, unknown>;
  const activeProjects = Number((projects as Record<string, unknown>).total ?? 0);
  const overdueMilestones = Number(d.pending_verifications ?? 0);
  const openRisks = Number(d.tickets_open ?? 0);
  const costData = (d.cost ?? {}) as Record<string, unknown>;
  const budgetUtilization = d.cost ? Math.round(((Number(costData.certified_to_date) || 0) / (Number(costData.budget) || 1)) * 100) : 0;
  const teamMembers = Number((d.team as Record<string, unknown>)?.total ?? 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Project Manager Dashboard</h2>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[
          { label: "Active Projects", value: String(activeProjects), color: "#7c3aed" },
          { label: "Overdue Milestones", value: String(overdueMilestones), color: overdueMilestones > 0 ? "#dc2626" : "#059669" },
          { label: "Open Risks", value: String(openRisks), color: openRisks > 0 ? "#d97706" : "#059669" },
          { label: "Budget Utilization", value: `${budgetUtilization}%`, color: "#2563eb" },
          { label: "Team Members", value: String(teamMembers), color: "#7c3aed" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Project Portfolio</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>Project</th><th>Progress</th><th>Status</th><th>Budget</th></tr></thead>
            <tbody>
              {((d.recentProjects ?? (d.projects as Record<string, unknown>)?.items ?? []) as unknown[]).length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 24 }} className="muted">No active projects.</td></tr>
              ) : (
                ((d.recentProjects ?? (d.projects as Record<string, unknown>)?.items ?? []) as unknown[]).slice(0, 8).map((p, i) => {
                  const pr = p as Record<string, unknown>;
                  return (
                    <tr key={String(pr.id ?? i)}>
                      <td><strong style={{ fontSize: 12 }}>{String(pr.name ?? "—")}</strong></td>
                      <td>
                        <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
                          <div className="progress" style={{ flex: 1 }}><span style={{ width: `${Number(pr.progress ?? 0)}%` }} /></div>
                          <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{Number(pr.progress ?? 0)}%</span>
                        </div>
                      </td>
                      <td><span className="status-pill" style={{ fontSize: 11 }}>{String(pr.status ?? "active")}</span></td>
                      <td className="mono" style={{ fontSize: 12 }}>{pr.budget ? `KES ${Number(pr.budget).toLocaleString()}` : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="data-panel" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Recent Tickets</div>
        {tickets.length === 0 ? (
          <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: 16 }}>No recent tickets.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {tickets.slice(0, 5).map((t) => (
              <div key={t.id} style={{ alignItems: "center", borderBottom: "1px solid var(--line)", display: "flex", gap: 10, padding: "10px 0" }}>
                <span className="status-pill" style={{ fontSize: 11 }}>{t.priority ?? "medium"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 12 }}>{t.title ?? "—"}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>{String((t as unknown as Record<string, unknown>).project_name ?? "")}</span>
                </div>
                <span className="muted" style={{ fontSize: 11 }}>{t.status ?? "open"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FinanceDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
    fetchRequisitions().then(setRequisitions).catch(() => {});
  }, []);

  const d = (data ?? {}) as Record<string, unknown>;
  const cost = (d.cost ?? {}) as Record<string, unknown>;
  const totalBudget = Number(cost.budget ?? 0);
  const certifiedValue = Number(cost.certified_to_date ?? 0);
  const paidValue = Number(cost.paid_to_date ?? 0);
  const outstanding = totalBudget - paidValue;
  const costVariance = Number(cost.cost_variance ?? 0);
  const maxBar = Math.max(totalBudget, certifiedValue, paidValue, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Finance Dashboard</h2>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[
          { label: "Total Budget", value: `KES ${(totalBudget / 1e6).toFixed(1)}M`, color: "#7c3aed" },
          { label: "Certified Value", value: `KES ${(certifiedValue / 1e6).toFixed(1)}M`, color: "#2563eb" },
          { label: "Paid Value", value: `KES ${(paidValue / 1e6).toFixed(1)}M`, color: "#059669" },
          { label: "Outstanding", value: `KES ${(outstanding / 1e6).toFixed(1)}M`, color: outstanding > 0 ? "#d97706" : "#059669" },
          { label: "Cost Variance", value: `${costVariance > 0 ? "+" : ""}${costVariance}%`, color: costVariance > 0 ? "#dc2626" : "#059669" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="data-panel" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Budget vs Certified vs Paid</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 140, padding: "0 12px" }}>
          {[
            { label: "Budget", value: totalBudget, color: "#7c3aed" },
            { label: "Certified", value: certifiedValue, color: "#2563eb" },
            { label: "Paid", value: paidValue, color: "#059669" },
          ].map((bar) => (
            <div key={bar.label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ background: bar.color, borderRadius: 4, height: `${Math.max(4, (bar.value / maxBar) * 100)}%`, minHeight: 4, transition: "height 0.3s" }} title={`KES ${(bar.value / 1e6).toFixed(1)}M`} />
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{bar.label}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{`KES ${(bar.value / 1e6).toFixed(1)}M`}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Requisitions Pending Approval</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>Reference</th><th>Project</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {requisitions.filter((r) => r.status === "submitted" || r.status === "reviewed").length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 24 }} className="muted">No pending requisitions.</td></tr>
              ) : (
                requisitions.filter((r) => r.status === "submitted" || r.status === "reviewed").slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td><span className="mono" style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700 }}>{String((r as unknown as Record<string, unknown>).reference ?? `REQ-${r.id}`)}</span></td>
                    <td style={{ fontSize: 12 }}>{String((r as unknown as Record<string, unknown>).project_name ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>KES {Number(r.amount ?? 0).toLocaleString()}</td>
                    <td><span className="status-pill" style={{ fontSize: 11 }}>{r.status}</span></td>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{(r as unknown as Record<string, unknown>).created_at ? new Date(String((r as unknown as Record<string, unknown>).created_at)).toLocaleDateString("en-GB") : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SiteAgentDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
    fetchTickets(pid || undefined).then(setTickets).catch(() => {});
    fetchDailyLogs(pid || undefined, 10).then((r) => setDailyLogs(r.results)).catch(() => {});
  }, []);

  const d = (data ?? {}) as Record<string, unknown>;
  const projects = (d.projects ?? {}) as Record<string, unknown>;
  const activeProjects = Number((projects as Record<string, unknown>).total ?? 0);
  const todayTasks = Number(d.milestones_due_today ?? 0);
  const pendingInspections = Number(d.pending_verifications ?? 0);
  const openIssues = Number(d.tickets_open ?? 0);
  const safetyScore = Number(d.safety_score ?? 95);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Site Agent Dashboard</h2>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[
          { label: "Active Projects", value: String(activeProjects), color: "#7c3aed" },
          { label: "Today's Tasks", value: String(todayTasks), color: "#2563eb" },
          { label: "Pending Inspections", value: String(pendingInspections), color: pendingInspections > 0 ? "#d97706" : "#059669" },
          { label: "Open Issues", value: String(openIssues), color: openIssues > 0 ? "#dc2626" : "#059669" },
          { label: "Safety Score", value: `${safetyScore}%`, color: safetyScore >= 90 ? "#059669" : safetyScore >= 70 ? "#d97706" : "#dc2626" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Today&apos;s Tasks</span>
        </div>
        {tickets.filter((t) => t.status === "open" || t.status === "acknowledged").length === 0 ? (
          <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: 24 }}>No tasks for today. All clear.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {tickets.filter((t) => t.status === "open" || t.status === "acknowledged").slice(0, 6).map((t) => (
              <div key={t.id} style={{ alignItems: "center", borderBottom: "1px solid var(--line)", display: "flex", gap: 10, padding: "10px 0" }}>
                <span className="status-pill" style={{ fontSize: 11 }}>{t.priority ?? "medium"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 12 }}>{t.title ?? "—"}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>{String((t as unknown as Record<string, unknown>).project_name ?? "")}</span>
                </div>
                <span className="muted" style={{ fontSize: 11 }}>{t.status ?? "open"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Recent Daily Logs</span>
        </div>
        {dailyLogs.length === 0 ? (
          <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: 24 }}>No daily logs recorded yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {dailyLogs.slice(0, 5).map((log) => (
              <div key={log.id} style={{ alignItems: "center", borderBottom: "1px solid var(--line)", display: "flex", gap: 10, padding: "10px 0" }}>
                <span style={{ fontSize: 16 }}>📋</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 12 }}>{log.weather ?? "Log"} — {log.log_date ?? "—"}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>{log.notes ?? "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="data-panel" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Quick Actions</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <button type="button" className="btn ghost" style={{ textAlign: "left" }}>📋 Log Daily Activity</button>
          <button type="button" className="btn ghost" style={{ textAlign: "left" }}>⚠️ Report Issue</button>
          <button type="button" className="btn ghost" style={{ textAlign: "left" }}>🔍 Schedule Inspection</button>
        </div>
      </div>
    </div>
  );
}

function RoleDevDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
  }, []);
  const d = (data ?? {}) as Record<string, unknown>;
  const projects = (d.projects ?? {}) as Record<string, unknown>;
  const cost = (d.cost ?? {}) as Record<string, unknown>;
  const activeProjects = Number(projects.total ?? 0);
  const portfolioProjects = Number(projects.total ?? 0);
  const totalBudget = Number(cost.budget ?? 0);
  const certifiedValue = Number(cost.certified_to_date ?? 0);
  const budgetUtilization = totalBudget > 0 ? Math.round((certifiedValue / totalBudget) * 100) : 0;
  const openRisks = Number(d.tickets_open ?? 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Project Developer Dashboard</h2>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>Portfolio overview for project developers and committee members.</p>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Active Projects", value: String(activeProjects), color: "#7c3aed" },
          { label: "Portfolio Projects", value: String(portfolioProjects), color: "#2563eb" },
          { label: "Budget Utilization", value: `${budgetUtilization}%`, color: "#059669" },
          { label: "High Risks", value: String(openRisks), color: openRisks > 0 ? "#dc2626" : "#059669" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Project Portfolio</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>Project</th><th>Stage</th><th>Progress</th></tr></thead>
            <tbody>
              {((projects.items ?? d.recentProjects ?? []) as unknown[]).length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: 24 }} className="muted">No active projects.</td></tr>
              ) : (
                ((projects.items ?? d.recentProjects ?? []) as unknown[]).slice(0, 8).map((p, i) => {
                  const pr = p as Record<string, unknown>;
                  return (
                    <tr key={String(pr.id ?? i)}>
                      <td><strong style={{ fontSize: 12 }}>{String(pr.name ?? "—")}</strong></td>
                      <td><span className="status-pill" style={{ fontSize: 11 }}>{String(pr.stage ?? pr.status ?? "active")}</span></td>
                      <td>
                        <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
                          <div className="progress" style={{ flex: 1 }}><span style={{ width: `${Number(pr.physical_progress ?? pr.progress ?? 0)}%` }} /></div>
                          <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{Number(pr.physical_progress ?? pr.progress ?? 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleSalesDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
  }, []);
  const d = (data ?? {}) as Record<string, unknown>;
  const projects = (d.projects ?? {}) as Record<string, unknown>;
  const cost = (d.cost ?? {}) as Record<string, unknown>;
  const totalProjects = Number(projects.total ?? 0);
  const certifiedValue = Number(cost.certified_to_date ?? 0);
  const paidValue = Number(cost.paid_to_date ?? 0);
  const outstanding = certifiedValue - paidValue;
  const openRisks = Number(d.tickets_open ?? 0);
  const pendingVerifications = Number(d.pending_verifications ?? 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Sales Dashboard</h2>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>Sales pipeline and project activity overview.</p>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total Projects", value: String(totalProjects), color: "#7c3aed" },
          { label: "Certified Value", value: `KES ${(certifiedValue / 1e6).toFixed(1)}M`, color: "#2563eb" },
          { label: "Outstanding", value: `KES ${(outstanding / 1e6).toFixed(1)}M`, color: outstanding > 0 ? "#d97706" : "#059669" },
          { label: "Open Risks", value: String(openRisks), color: openRisks > 0 ? "#dc2626" : "#059669" },
          { label: "Pending Verifications", value: String(pendingVerifications), color: pendingVerifications > 0 ? "#d97706" : "#059669" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Project Sales Summary</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>Project</th><th>Status</th><th>Progress</th></tr></thead>
            <tbody>
              {((projects.items ?? d.recentProjects ?? []) as unknown[]).length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: 24 }} className="muted">No projects found.</td></tr>
              ) : (
                ((projects.items ?? d.recentProjects ?? []) as unknown[]).slice(0, 8).map((p, i) => {
                  const pr = p as Record<string, unknown>;
                  return (
                    <tr key={String(pr.id ?? i)}>
                      <td><strong style={{ fontSize: 12 }}>{String(pr.name ?? "—")}</strong></td>
                      <td><span className="status-pill" style={{ fontSize: 11 }}>{String(pr.status ?? "active")}</span></td>
                      <td>
                        <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
                          <div className="progress" style={{ flex: 1 }}><span style={{ width: `${Number(pr.progress ?? 0)}%` }} /></div>
                          <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{Number(pr.progress ?? 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleMarketingDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
  }, []);
  const d = (data ?? {}) as Record<string, unknown>;
  const projects = (d.projects ?? {}) as Record<string, unknown>;
  const cost = (d.cost ?? {}) as Record<string, unknown>;
  const totalProjects = Number(projects.total ?? 0);
  const certifiedValue = Number(cost.certified_to_date ?? 0);
  const totalBudget = Number(cost.budget ?? 0);
  const budgetUtilization = totalBudget > 0 ? Math.round((certifiedValue / totalBudget) * 100) : 0;
  const openIssues = Number(d.tickets_open ?? 0);
  const milestonesDue = Number(d.milestones_due_today ?? 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Buyer / Marketing Dashboard</h2>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>Marketing and buyer engagement overview.</p>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Project Count", value: String(totalProjects), color: "#7c3aed" },
          { label: "Lead Pipeline", value: String(totalProjects), color: "#2563eb" },
          { label: "Marketing Spend", value: `KES ${(certifiedValue / 1e6).toFixed(1)}M`, color: "#d97706" },
          { label: "Budget Utilization", value: `${budgetUtilization}%`, color: "#059669" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Projects Overview</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>Project</th><th>Status</th><th>Progress</th></tr></thead>
            <tbody>
              {((projects.items ?? d.recentProjects ?? []) as unknown[]).length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: 24 }} className="muted">No projects found.</td></tr>
              ) : (
                ((projects.items ?? d.recentProjects ?? []) as unknown[]).slice(0, 8).map((p, i) => {
                  const pr = p as Record<string, unknown>;
                  return (
                    <tr key={String(pr.id ?? i)}>
                      <td><strong style={{ fontSize: 12 }}>{String(pr.name ?? "—")}</strong></td>
                      <td><span className="status-pill" style={{ fontSize: 11 }}>{String(pr.status ?? "active")}</span></td>
                      <td>
                        <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
                          <div className="progress" style={{ flex: 1 }}><span style={{ width: `${Number(pr.progress ?? 0)}%` }} /></div>
                          <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{Number(pr.progress ?? 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {milestonesDue > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Upcoming Deadlines</div>
          <div style={{ fontSize: 12 }} className="muted">{milestonesDue} milestones due today. {openIssues} open issues to review.</div>
        </div>
      )}
    </div>
  );
}

function RoleClerkDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
  }, []);
  const d = (data ?? {}) as Record<string, unknown>;
  const projects = (d.projects ?? {}) as Record<string, unknown>;
  const cost = (d.cost ?? {}) as Record<string, unknown>;
  const totalProjects = Number(projects.total ?? 0);
  const pendingVerifications = Number(d.pending_verifications ?? 0);
  const openTickets = Number(d.tickets_open ?? 0);
  const paidValue = Number(cost.paid_to_date ?? 0);
  const certifiedValue = Number(cost.certified_to_date ?? 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Clerk Dashboard</h2>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>Document management and administrative tasks overview.</p>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total Projects", value: String(totalProjects), color: "#7c3aed" },
          { label: "Pending Approvals", value: String(pendingVerifications), color: pendingVerifications > 0 ? "#d97706" : "#059669" },
          { label: "Open Tickets", value: String(openTickets), color: openTickets > 0 ? "#dc2626" : "#059669" },
          { label: "Certified Value", value: `KES ${(certifiedValue / 1e6).toFixed(1)}M`, color: "#2563eb" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Document Activity</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>Project</th><th>Status</th><th>Progress</th></tr></thead>
            <tbody>
              {((projects.items ?? d.recentProjects ?? []) as unknown[]).length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: 24 }} className="muted">No projects found.</td></tr>
              ) : (
                ((projects.items ?? d.recentProjects ?? []) as unknown[]).slice(0, 8).map((p, i) => {
                  const pr = p as Record<string, unknown>;
                  return (
                    <tr key={String(pr.id ?? i)}>
                      <td><strong style={{ fontSize: 12 }}>{String(pr.name ?? "—")}</strong></td>
                      <td><span className="status-pill" style={{ fontSize: 11 }}>{String(pr.status ?? "active")}</span></td>
                      <td>
                        <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
                          <div className="progress" style={{ flex: 1 }}><span style={{ width: `${Number(pr.progress ?? 0)}%` }} /></div>
                          <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{Number(pr.progress ?? 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Payment Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
          <div><span className="muted">Certified:</span> <span className="mono" style={{ fontWeight: 700 }}>KES {(certifiedValue / 1e6).toFixed(1)}M</span></div>
          <div><span className="muted">Paid:</span> <span className="mono" style={{ fontWeight: 700 }}>KES {(paidValue / 1e6).toFixed(1)}M</span></div>
        </div>
      </div>
    </div>
  );
}

function RoleValuerDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
  }, []);
  const d = (data ?? {}) as Record<string, unknown>;
  const projects = (d.projects ?? {}) as Record<string, unknown>;
  const cost = (d.cost ?? {}) as Record<string, unknown>;
  const totalProjects = Number(projects.total ?? 0);
  const totalBudget = Number(cost.budget ?? 0);
  const certifiedValue = Number(cost.certified_to_date ?? 0);
  const costVariance = Number(cost.cost_variance ?? 0);
  const pendingVerifications = Number(d.pending_verifications ?? 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Valuer Dashboard</h2>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>Valuation and progress verification overview.</p>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Projects", value: String(totalProjects), color: "#7c3aed" },
          { label: "Total Budget", value: `KES ${(totalBudget / 1e6).toFixed(1)}M`, color: "#2563eb" },
          { label: "Certified Value", value: `KES ${(certifiedValue / 1e6).toFixed(1)}M`, color: "#059669" },
          { label: "Cost Variance", value: `${costVariance > 0 ? "+" : ""}${costVariance}%`, color: costVariance > 0 ? "#dc2626" : "#059669" },
          { label: "Pending Verifications", value: String(pendingVerifications), color: pendingVerifications > 0 ? "#d97706" : "#059669" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="data-panel" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Valuation Summary</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 120, padding: "0 12px" }}>
          {[
            { label: "Budget", value: totalBudget, color: "#7c3aed" },
            { label: "Certified", value: certifiedValue, color: "#2563eb" },
          ].map((bar) => (
            <div key={bar.label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ background: bar.color, borderRadius: 4, height: `${totalBudget > 0 ? Math.max(4, (bar.value / totalBudget) * 100) : 4}%`, minHeight: 4, transition: "height 0.3s" }} title={`KES ${(bar.value / 1e6).toFixed(1)}M`} />
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{bar.label}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{`KES ${(bar.value / 1e6).toFixed(1)}M`}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Projects Requiring Verification</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>Project</th><th>Status</th><th>Progress</th></tr></thead>
            <tbody>
              {((projects.items ?? d.recentProjects ?? []) as unknown[]).length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: 24 }} className="muted">No projects requiring verification.</td></tr>
              ) : (
                ((projects.items ?? d.recentProjects ?? []) as unknown[]).slice(0, 6).map((p, i) => {
                  const pr = p as Record<string, unknown>;
                  return (
                    <tr key={String(pr.id ?? i)}>
                      <td><strong style={{ fontSize: 12 }}>{String(pr.name ?? "—")}</strong></td>
                      <td><span className="status-pill" style={{ fontSize: 11 }}>{String(pr.status ?? "active")}</span></td>
                      <td>
                        <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
                          <div className="progress" style={{ flex: 1 }}><span style={{ width: `${Number(pr.progress ?? 0)}%` }} /></div>
                          <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{Number(pr.progress ?? 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleFacilitiesDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
  }, []);
  const d = (data ?? {}) as Record<string, unknown>;
  const projects = (d.projects ?? {}) as Record<string, unknown>;
  const cost = (d.cost ?? {}) as Record<string, unknown>;
  const totalProjects = Number(projects.total ?? 0);
  const totalBudget = Number(cost.budget ?? 0);
  const paidValue = Number(cost.paid_to_date ?? 0);
  const openTickets = Number(d.tickets_open ?? 0);
  const safetyScore = Number(d.safety_score ?? 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Facilities Dashboard</h2>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>Facilities management and operational overview.</p>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Active Facilities", value: String(totalProjects), color: "#7c3aed" },
          { label: "Maintenance Requests", value: String(openTickets), color: openTickets > 0 ? "#d97706" : "#059669" },
          { label: "Utilization Rate", value: `${totalBudget > 0 ? Math.round((paidValue / totalBudget) * 100) : 0}%`, color: "#2563eb" },
          { label: "Safety Score", value: `${safetyScore}%`, color: safetyScore >= 90 ? "#059669" : safetyScore >= 70 ? "#d97706" : "#dc2626" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Facilities Overview</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>Facility</th><th>Status</th><th>Progress</th></tr></thead>
            <tbody>
              {((projects.items ?? d.recentProjects ?? []) as unknown[]).length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: 24 }} className="muted">No facilities found.</td></tr>
              ) : (
                ((projects.items ?? d.recentProjects ?? []) as unknown[]).slice(0, 8).map((p, i) => {
                  const pr = p as Record<string, unknown>;
                  return (
                    <tr key={String(pr.id ?? i)}>
                      <td><strong style={{ fontSize: 12 }}>{String(pr.name ?? "—")}</strong></td>
                      <td><span className="status-pill" style={{ fontSize: 11 }}>{String(pr.status ?? "active")}</span></td>
                      <td>
                        <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
                          <div className="progress" style={{ flex: 1 }}><span style={{ width: `${Number(pr.progress ?? 0)}%` }} /></div>
                          <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{Number(pr.progress ?? 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Budget Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
          <div><span className="muted">Total Budget:</span> <span className="mono" style={{ fontWeight: 700 }}>KES {(totalBudget / 1e6).toFixed(1)}M</span></div>
          <div><span className="muted">Spent:</span> <span className="mono" style={{ fontWeight: 700 }}>KES {(paidValue / 1e6).toFixed(1)}M</span></div>
        </div>
      </div>
    </div>
  );
}

function RoleAdminDashboard() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const pid = sessionStorage.getItem("activeProject") || "";
    fetchDashboard(pid || undefined).then(setData).catch((e) => setError((e as Error).message));
  }, []);
  const d = (data ?? {}) as Record<string, unknown>;
  const projects = (d.projects ?? {}) as Record<string, unknown>;
  const cost = (d.cost ?? {}) as Record<string, unknown>;
  const team = (d.team ?? {}) as Record<string, unknown>;
  const totalProjects = Number(projects.total ?? 0);
  const teamMembers = Number(team.total ?? 0);
  const totalBudget = Number(cost.budget ?? 0);
  const openTickets = Number(d.tickets_open ?? 0);
  const pendingVerifications = Number(d.pending_verifications ?? 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Administrator Dashboard</h2>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>System administration and user management overview.</p>
      {error && <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total Projects", value: String(totalProjects), color: "#7c3aed" },
          { label: "Team Members", value: String(teamMembers), color: "#2563eb" },
          { label: "System Health", value: `${openTickets === 0 ? "100" : Math.max(0, 100 - openTickets)}%`, color: openTickets === 0 ? "#059669" : "#d97706" },
          { label: "Pending Tasks", value: String(pendingVerifications), color: pendingVerifications > 0 ? "#d97706" : "#059669" },
        ].map((kpi) => (
          <div key={kpi.label} className="card card-compact" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Recent Audit Activity</span>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>Project</th><th>Status</th><th>Progress</th></tr></thead>
            <tbody>
              {((projects.items ?? d.recentProjects ?? []) as unknown[]).length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: "center", padding: 24 }} className="muted">No recent activity.</td></tr>
              ) : (
                ((projects.items ?? d.recentProjects ?? []) as unknown[]).slice(0, 8).map((p, i) => {
                  const pr = p as Record<string, unknown>;
                  return (
                    <tr key={String(pr.id ?? i)}>
                      <td><strong style={{ fontSize: 12 }}>{String(pr.name ?? "—")}</strong></td>
                      <td><span className="status-pill" style={{ fontSize: 11 }}>{String(pr.status ?? "active")}</span></td>
                      <td>
                        <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
                          <div className="progress" style={{ flex: 1 }}><span style={{ width: `${Number(pr.progress ?? 0)}%` }} /></div>
                          <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{Number(pr.progress ?? 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Budget Overview</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
          <div><span className="muted">Total Budget:</span> <span className="mono" style={{ fontWeight: 700 }}>KES {(totalBudget / 1e6).toFixed(1)}M</span></div>
          <div><span className="muted">Open Tickets:</span> <span className="mono" style={{ fontWeight: 700 }}>{openTickets}</span></div>
        </div>
      </div>
    </div>
  );
}

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
      horizontalItemsOverride={monitoringHorizontalNav}
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
        {tab === "site-visits" && <SiteVisits />}
        {tab === "stakeholders" && <Stakeholders />}
        {tab === "chat" && <ChatPage />}
        {tab === "notifications" && <NotificationsPage />}
        {tab === "audit-log" && <AdminAuditLog />}
        {tab === "role-pm" && <ProjectManagerDashboard />}
        {tab === "role-finance" && <FinanceDashboard />}
        {tab === "role-site" && <SiteAgentDashboard />}
        {tab === "role-dev" && <RoleDevDashboard />}
        {tab === "role-sales" && <RoleSalesDashboard />}
        {tab === "role-marketing" && <RoleMarketingDashboard />}
        {tab === "role-clerk" && <RoleClerkDashboard />}
        {tab === "role-valuer" && <RoleValuerDashboard />}
        {tab === "role-facilities" && <RoleFacilitiesDashboard />}
        {tab === "role-admin" && <RoleAdminDashboard />}
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
