"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { constructionNav } from "@/lib/module-nav";

type Row = Record<string, string | number | boolean | null | string[]>;
type Tab = "overview" | "projects" | "project-memberships" | "milestones" | "milestone-verifications" | "requirement-waivers" | "daily-logs" | "risks" | "tickets" | "ticket-comments" | "work-plan" | "boq" | "variations" | "quality-tests" | "rfis" | "safety-incidents" | "calendar" | "documents" | "document-versions" | "approvals" | "lifecycle" | "materials" | "store-items" | "store-suppliers" | "material-requisitions" | "purchase-orders" | "stock-movements" | "consultant-payments" | "drone-datasets" | "satellite-datasets" | "provisional-sums" | "contingency-drawdowns" | "advance-payments" | "advance-recoveries" | "subcontractors" | "work-orders" | "bim-models" | "bim-discrepancies" | "requisitions" | "certificates" | "disbursements" | "drawdowns" | "reports" | "chat" | "notifications" | "audit-log";
type Dashboard = {
  kpis: Record<string, string | number>;
  projects: Row[];
  projectStages: { stage: string; count: number }[];
  recentTickets: Row[];
  topRisks: Row[];
};

const labels: Record<Tab, string> = {
  overview: "Command center", projects: "Projects", "project-memberships": "Project team", milestones: "Progress", "milestone-verifications": "Progress verification", "requirement-waivers": "Requirement waivers",
  "daily-logs": "Daily logs", risks: "Risks", tickets: "Issues", "ticket-comments": "Issue discussion",
  "work-plan": "Programme", boq: "BoQ & cost", variations: "Variations",
  "quality-tests": "Quality", rfis: "RFIs", "safety-incidents": "Safety",
  calendar: "Calendar", documents: "Documents", "document-versions": "Document revisions", approvals: "Approvals",
  lifecycle: "Lifecycle", materials: "Deliveries", "store-items": "Inventory", "store-suppliers": "Suppliers",
  "material-requisitions": "Material requests", "purchase-orders": "Purchase orders", "stock-movements": "Stock ledger", "consultant-payments": "Consultants",
  "drone-datasets": "Drone", "satellite-datasets": "Satellite", "provisional-sums": "Provisional sums",
  "contingency-drawdowns": "Contingency", "advance-payments": "Advances", "advance-recoveries": "Advance recoveries", subcontractors: "Subcontractors",
  "work-orders": "Work orders", "bim-models": "BIM models", "bim-discrepancies": "BIM issues",
  requisitions: "Requisitions", certificates: "Certificates", disbursements: "Payments", drawdowns: "Drawdowns",
  reports: "Reports", chat: "Project chat", notifications: "Notifications", "audit-log": "Audit trail",
};

const columns: Record<Exclude<Tab, "overview">, { key: string; label: string; kind?: "money" | "status" | "progress" }[]> = {
  projects: [{key:"code",label:"Project"},{key:"name",label:"Name"},{key:"client_name",label:"Client"},{key:"location",label:"Location"},{key:"stage",label:"Stage",kind:"status"},{key:"budget",label:"Budget",kind:"money"},{key:"planned_completion_date",label:"Completion"}],
  "project-memberships": [{key:"project_name",label:"Project"},{key:"user_name",label:"Team member"},{key:"role_name",label:"Access role"},{key:"label",label:"Project responsibility"},{key:"created_at",label:"Assigned"}],
  milestones: [{key:"milestone_id",label:"Milestone"},{key:"project_id",label:"Project"},{key:"percent_complete",label:"Progress",kind:"progress"},{key:"required_certifying_role",label:"Certifier"},{key:"payment_value",label:"Value",kind:"money"},{key:"submitted_at",label:"Submitted"}],
  "milestone-verifications": [{key:"milestone_name",label:"Milestone"},{key:"decision",label:"Decision",kind:"status"},{key:"verifier_name",label:"Verified by"},{key:"note",label:"Review note"},{key:"verified_at",label:"Verified"}],
  "requirement-waivers": [{key:"project_name",label:"Project"},{key:"requirement_key",label:"Requirement"},{key:"requirement_type",label:"Type",kind:"status"},{key:"reason",label:"Approved reason"},{key:"waived_by_name",label:"Waived by"},{key:"waived_at",label:"Waived"}],
  "daily-logs": [{key:"log_date",label:"Date"},{key:"project_id",label:"Project"},{key:"weather",label:"Weather"},{key:"labour_count",label:"Labour"},{key:"notes",label:"Site notes"},{key:"verified_at",label:"Verified"}],
  risks: [{key:"reference",label:"Risk"},{key:"description",label:"Description"},{key:"category",label:"Category"},{key:"likelihood",label:"Likelihood"},{key:"impact",label:"Impact"},{key:"mitigation",label:"Mitigation"},{key:"status",label:"Status",kind:"status"}],
  tickets: [{key:"title",label:"Issue"},{key:"priority",label:"Priority",kind:"status"},{key:"risk_level",label:"Risk",kind:"status"},{key:"due_date",label:"Due"},{key:"escalation_level",label:"Escalation"},{key:"status",label:"Status",kind:"status"}],
  "ticket-comments": [{key:"created_at",label:"Posted"},{key:"ticket_title",label:"Issue"},{key:"author_name",label:"Author"},{key:"body",label:"Comment"},{key:"attachment_name",label:"Attachment"}],
  "work-plan": [{key:"task_id",label:"WBS"},{key:"task_name",label:"Task"},{key:"responsible_party",label:"Owner"},{key:"start_date",label:"Start"},{key:"end_date",label:"Finish"},{key:"percent_complete",label:"Progress",kind:"progress"},{key:"status",label:"Status",kind:"status"}],
  boq: [{key:"section",label:"Section"},{key:"item_number",label:"Item"},{key:"description",label:"Description"},{key:"unit",label:"Unit"},{key:"quantity",label:"Qty"},{key:"rate",label:"Rate",kind:"money"},{key:"amount",label:"Amount",kind:"money"},{key:"cost_state",label:"State",kind:"status"}],
  variations: [{key:"variation_number",label:"Variation"},{key:"description",label:"Description"},{key:"variation_type",label:"Type"},{key:"amount",label:"Amount",kind:"money"},{key:"justification",label:"Justification"},{key:"status",label:"Status",kind:"status"}],
  "quality-tests": [{key:"sample_id",label:"Sample"},{key:"test_type",label:"Test"},{key:"location",label:"Location"},{key:"test_date",label:"Date"},{key:"result_value",label:"Result"},{key:"passed",label:"Passed"},{key:"notes",label:"Notes"}],
  rfis: [{key:"number",label:"RFI"},{key:"title",label:"Subject"},{key:"priority",label:"Priority",kind:"status"},{key:"category",label:"Category"},{key:"due_date",label:"Due"},{key:"status",label:"Status",kind:"status"}],
  "safety-incidents": [{key:"incident_date",label:"Date"},{key:"severity",label:"Severity",kind:"status"},{key:"description",label:"Incident"},{key:"action_taken",label:"Action taken"},{key:"verified_at",label:"Verified"}],
  calendar: [{key:"title",label:"Event"},{key:"event_type",label:"Type",kind:"status"},{key:"location",label:"Location"},{key:"start",label:"Start"},{key:"end",label:"End"},{key:"status",label:"Status",kind:"status"}],
  documents: [{key:"title",label:"Document"},{key:"doc_type",label:"Type",kind:"status"},{key:"discipline",label:"Discipline"},{key:"created_at",label:"Added"}],
  "document-versions": [{key:"document_title",label:"Document"},{key:"project_name",label:"Project"},{key:"version",label:"Version"},{key:"revision_number",label:"Revision"},{key:"file_format",label:"Format",kind:"status"},{key:"uploaded_by_name",label:"Uploaded by"},{key:"uploaded_at",label:"Uploaded"}],
  approvals: [{key:"approval_type",label:"Approval"},{key:"authority",label:"Authority"},{key:"reference",label:"Reference"},{key:"issue_date",label:"Issued"},{key:"status",label:"Status",kind:"status"}],
  lifecycle: [{key:"stage",label:"Stage",kind:"status"},{key:"record_type",label:"Record"},{key:"title",label:"Title"},{key:"reference",label:"Reference"},{key:"responsible_party",label:"Owner"},{key:"due_date",label:"Due"},{key:"status",label:"Status",kind:"status"}],
  materials: [{key:"delivery_date",label:"Delivered"},{key:"material",label:"Material"},{key:"quantity",label:"Quantity"},{key:"unit",label:"Unit"},{key:"supplier",label:"Supplier"},{key:"remarks",label:"Verification"}],
  "store-items": [{key:"code",label:"Item code"},{key:"name",label:"Material"},{key:"category",label:"Category"},{key:"unit",label:"Unit"},{key:"quantity_on_hand",label:"On hand"}],
  "store-suppliers": [{key:"name",label:"Supplier"},{key:"contact",label:"Contact"}],
  "material-requisitions": [{key:"reference",label:"Request"},{key:"project_name",label:"Project"},{key:"raised_by_name",label:"Raised by"},{key:"created_at",label:"Raised"},{key:"status",label:"Status",kind:"status"}],
  "purchase-orders": [{key:"number",label:"Purchase order"},{key:"project_name",label:"Project"},{key:"supplier_name",label:"Supplier"},{key:"total",label:"Total",kind:"money"},{key:"created_by_name",label:"Created by"},{key:"status",label:"Status",kind:"status"},{key:"received_at",label:"Received"}],
  "stock-movements": [{key:"created_at",label:"Posted"},{key:"item_name",label:"Material"},{key:"project_name",label:"Project"},{key:"movement_type",label:"Movement",kind:"status"},{key:"quantity",label:"Quantity"},{key:"reference",label:"Reference"},{key:"created_by_name",label:"Posted by"}],
  "consultant-payments": [{key:"certificate_number",label:"Certificate"},{key:"consultant_name",label:"Consultant"},{key:"consultant_role",label:"Role"},{key:"amount",label:"Amount",kind:"money"},{key:"retention_percent",label:"Retention %"},{key:"status",label:"Status",kind:"status"}],
  "drone-datasets": [{key:"flight_date",label:"Flight"},{key:"data_type",label:"Dataset"},{key:"operator_id",label:"Operator"},{key:"classification",label:"Use"},{key:"compliance_declared",label:"Compliant"},{key:"review_status",label:"Review",kind:"status"}],
  "satellite-datasets": [{key:"capture_date",label:"Captured"},{key:"sat_type",label:"Type"},{key:"source_provider",label:"Provider"},{key:"resolution_cm",label:"Resolution (cm)"},{key:"cloud_cover_pct",label:"Cloud %"},{key:"notes",label:"Purpose"}],
  "provisional-sums": [{key:"item_number",label:"Item"},{key:"description",label:"Description"},{key:"budgeted_amount",label:"Budget",kind:"money"},{key:"ascertained_amount",label:"Ascertained",kind:"money"},{key:"status",label:"Status",kind:"status"}],
  "contingency-drawdowns": [{key:"drawdown_number",label:"Drawdown"},{key:"reason",label:"Reason"},{key:"category",label:"Category"},{key:"amount",label:"Amount",kind:"money"},{key:"status",label:"Status",kind:"status"}],
  "advance-payments": [{key:"contractor_name",label:"Contractor"},{key:"amount",label:"Advance",kind:"money"},{key:"recovery_rate",label:"Recovery %"},{key:"recovered_amount",label:"Recovered",kind:"money"},{key:"status",label:"Status",kind:"status"}],
  "advance-recoveries": [{key:"created_at",label:"Posted"},{key:"project_name",label:"Project"},{key:"contractor_name",label:"Contractor"},{key:"certificate_number",label:"Certificate"},{key:"amount_recovered",label:"Recovered",kind:"money"}],
  subcontractors: [{key:"name",label:"Subcontractor"},{key:"contact_person",label:"Contact"},{key:"email",label:"Email"},{key:"phone",label:"Phone"}],
  "work-orders": [{key:"order_number",label:"Order"},{key:"boq_section",label:"BoQ section"},{key:"description",label:"Scope"},{key:"total_value",label:"Value",kind:"money"},{key:"certified_value",label:"Certified",kind:"money"},{key:"status",label:"Status",kind:"status"}],
  "bim-models": [{key:"name",label:"Model"},{key:"discipline",label:"Discipline"},{key:"version",label:"Version"},{key:"file_format",label:"Format"},{key:"element_count",label:"Elements"},{key:"processing_status",label:"Processing",kind:"status"}],
  "bim-discrepancies": [{key:"severity",label:"Severity",kind:"status"},{key:"description",label:"Discrepancy"},{key:"milestone_ref",label:"Milestone"},{key:"confidence_score",label:"Confidence %"},{key:"status",label:"Status",kind:"status"}],
  requisitions: [{key:"title",label:"Requisition"},{key:"description",label:"Purpose"},{key:"amount",label:"Amount",kind:"money"},{key:"status",label:"Status",kind:"status"}],
  certificates: [{key:"number",label:"Certificate"},{key:"cert_type",label:"Type"},{key:"contractor_name",label:"Contractor"},{key:"current_gross",label:"Gross",kind:"money"},{key:"net_payable",label:"Net payable",kind:"money"},{key:"status",label:"Status",kind:"status"}],
  disbursements: [{key:"certificate",label:"Certificate ID"},{key:"amount",label:"Amount",kind:"money"},{key:"status",label:"Status",kind:"status"},{key:"paid_at",label:"Paid"}],
  drawdowns: [{key:"request_number",label:"Request"},{key:"purpose",label:"Purpose"},{key:"amount",label:"Requested",kind:"money"},{key:"valuation_amount",label:"Valuation",kind:"money"},{key:"status",label:"Status",kind:"status"}],
  reports: [{key:"week",label:"ISO week"},{key:"submissions",label:"Submissions"},{key:"distinctMilestones",label:"Milestones"},{key:"averageProgress",label:"Average progress",kind:"progress"},{key:"issues",label:"Issues"},{key:"urgentIssues",label:"Urgent"},{key:"materialDeliveries",label:"Deliveries"},{key:"safetyIncidents",label:"H&S incidents"}],
  chat: [{key:"created_at",label:"Sent"},{key:"channel",label:"Channel"},{key:"sender_name",label:"From"},{key:"body",label:"Message"},{key:"attachment_name",label:"Attachment"}],
  notifications: [{key:"created_at",label:"Received"},{key:"type",label:"Type",kind:"status"},{key:"title",label:"Notification"},{key:"body",label:"Details"},{key:"read_at",label:"Read"}],
  "audit-log": [{key:"timestamp",label:"Time"},{key:"user_name",label:"User"},{key:"category",label:"Category",kind:"status"},{key:"action",label:"Action"},{key:"resource",label:"Resource"},{key:"outcome",label:"Outcome",kind:"status"}],
};
const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function MonitoringPage() {
  const { session, can } = useAuth();
  const organization = session?.activeOrganizationId ?? null;
  const canAdminister = can("monitoring.project_admin") || can("monitoring.manage");
  const canReport = can("monitoring.report");
  const canCertify = can("monitoring.certify") || can("monitoring.manage");
  const canCommercial = can("monitoring.commercial") || can("monitoring.manage");
  const canFinance = can("monitoring.finance") || can("monitoring.manage");
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [portfolioProjects, setPortfolioProjects] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Row | null>(null);
  const [workspaceData, setWorkspaceData] = useState<{
    milestones: Row[];
    risks: Row[];
    tickets: Row[];
    workPlan: Row[];
    documents: Row[];
    bimModels: Row[];
    scurve: { series?: { week: string; planned_percent?: number | null; actual_percent?: number | null }[] };
    kpis: Record<string, string | number>;
    project: Row;
  }>({ milestones: [], risks: [], tickets: [], workPlan: [], documents: [], bimModels: [], scurve: { series: [] }, kpis: {}, project: {} });
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [portfolioView, setPortfolioView] = useState<"cards" | "list">("cards");
  const [stageFilter, setStageFilter] = useState("all");
  const dashboardProjectId = selectedProject?.id ?? dashboard?.projects[0]?.id;

  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true); setError("");
    const projectScope = selectedProject?.id ? `&project=${encodeURIComponent(String(selectedProject.id))}` : "";
    let path = tab === "overview" ? "/construction/dashboard/" : `/construction/${tab}/?search=${encodeURIComponent(search)}${projectScope}`;
    if (tab === "reports") {
      const projectId = dashboardProjectId;
      if (!projectId) { setRows([]); setLoading(false); return; }
      path = `/construction/reports/${projectId}/`;
    }
    const response = await apiFetch(path, {}, organization);
    if (!response.ok) { setError("Construction monitoring data could not be loaded."); setLoading(false); return; }
    const data = await response.json();
    if (tab === "overview") setDashboard(data); else setRows(tab === "reports" ? data.weekly : data);
    setLoading(false);
  }, [dashboardProjectId, organization, search, selectedProject, tab]);
  useEffect(() => { const timer = setTimeout(load, search ? 250 : 0); return () => clearTimeout(timer); }, [load, search]);
  useEffect(() => {
    if (modal && organization) apiFetch("/property/projects/", {}, organization).then(r => r.ok ? r.json() : []).then(setPortfolioProjects);
  }, [modal, organization]);

  const openProjectWorkspace = useCallback(async (project: Row) => {
    if (!organization) return;
    setSelectedProject(project);
    setTab("projects");
    setWorkspaceLoading(true);
    setError("");
    const projectId = String(project.id);
    const [workspace, risks, tickets, workPlan, documents, bimModels] = await Promise.all([
      apiFetch(`/construction/projects/${projectId}/workspace/`, {}, organization).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`/construction/risks/?project=${encodeURIComponent(projectId)}`, {}, organization).then((r) => (r.ok ? r.json() : [])),
      apiFetch(`/construction/tickets/?project=${encodeURIComponent(projectId)}`, {}, organization).then((r) => (r.ok ? r.json() : [])),
      apiFetch(`/construction/work-plan/?project=${encodeURIComponent(projectId)}`, {}, organization).then((r) => (r.ok ? r.json() : [])),
      apiFetch(`/construction/documents/?project=${encodeURIComponent(projectId)}`, {}, organization).then((r) => (r.ok ? r.json() : [])),
      apiFetch(`/construction/bim-models/?project=${encodeURIComponent(projectId)}`, {}, organization).then((r) => (r.ok ? r.json() : [])),
    ]);
    setWorkspaceData({
      milestones: (workspace?.milestones as Row[] | undefined) ?? [],
      risks: (risks as Row[]).slice(0, 8),
      tickets: (tickets as Row[]).slice(0, 8),
      workPlan: (workPlan as Row[]).slice(0, 10),
      documents: (documents as Row[]).slice(0, 8),
      bimModels: (bimModels as Row[]).slice(0, 6),
      scurve: workspace?.scurve ?? { series: [] },
      kpis: workspace?.kpis ?? {},
      project: workspace?.project ?? project,
    });
    setWorkspaceLoading(false);
  }, [organization]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); await apiFetch("/auth/csrf/");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await apiFetch("/construction/projects/", { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(data) }, organization);
    if (!response.ok) { setError("Project workspace could not be created. Check the shared project and code."); return; }
    setModal(false); setTab("projects"); await load();
  }

  async function markAllNotificationsRead() {
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/construction/notifications/read-all/", { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: "{}" }, organization);
    if (!response.ok) { setError("Notifications could not be marked as read."); return; }
    await load();
  }

  async function verifyMilestone(row: Row, decision: "verified" | "rejected" | "clarification") {
    if (!canCertify) { setError("Progress verification requires the construction certifier permission."); return; }
    const note = decision === "verified"
      ? (window.prompt("Optional verification note:") ?? "")
      : (window.prompt("Record the reason for this decision:")?.trim() ?? "");
    if (decision !== "verified" && !note) return;
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/construction/milestone-verifications/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ milestone_entry: row.id, decision, note }),
    }, organization);
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      setError(String(detail.milestone_entry ?? detail.detail ?? detail.note ?? "Milestone verification failed."));
      return;
    }
    await load();
  }

  async function runFinanceAction(row: Row, actionName: string) {
    const commercialTabs = ["variations", "provisional-sums", "contingency-drawdowns", "advance-payments"];
    const financeTabs = ["requisitions", "disbursements", "drawdowns"];
    if (commercialTabs.includes(tab) && !canCommercial && !canFinance && !canAdminister) {
      setError("This commercial action is not permitted for your role.");
      return;
    }
    if (financeTabs.includes(tab) && !canFinance && !canAdminister && !canCertify) {
      setError("This finance control action is not permitted for your role.");
      return;
    }
    await apiFetch("/auth/csrf/");
    let endpoint = "";
    let payload: Record<string, string> = {};
    if (tab === "variations") {
      endpoint = `/construction/variations/${row.id}/transition/`; payload = { status: actionName };
    } else if (tab === "requisitions") {
      endpoint = `/construction/requisitions/${row.id}/${actionName === "review" ? "review" : "decide"}/`;
      if (actionName !== "review") payload = { decision: actionName };
    } else if (tab === "disbursements") {
      endpoint = `/construction/disbursements/${row.id}/${actionName}/`;
    } else if (tab === "drawdowns") {
      endpoint = `/construction/drawdowns/${row.id}/transition/`; payload = { action: actionName };
    } else if (tab === "provisional-sums") {
      endpoint = `/construction/provisional-sums/${row.id}/${actionName}/`;
      if (actionName === "ascertain") {
        const amount = window.prompt("Enter the ascertained amount:")?.trim(); if (!amount) return;
        payload = { ascertained_amount: amount };
      }
    } else if (tab === "contingency-drawdowns") {
      endpoint = `/construction/contingency-drawdowns/${row.id}/decide/`; payload = { decision: actionName };
    } else if (tab === "advance-payments") {
      endpoint = `/construction/advance-payments/${row.id}/recover/`;
      const amount = window.prompt("Enter the recovery amount:")?.trim(); if (!amount) return;
      const certificate = window.prompt("Certificate reference (optional):")?.trim() ?? "";
      payload = { amount_recovered: amount, certificate_number: certificate };
    }
    if (["rejected", "reject", "void"].includes(actionName)) {
      const reason = window.prompt("Record the reason for this decision:")?.trim();
      if (!reason) return;
      payload[actionName === "void" ? "reason" : tab === "drawdowns" ? "notes" : "reason"] = reason;
    }
    const response = await apiFetch(endpoint, { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) }, organization);
    if (!response.ok) { const detail = await response.json().catch(() => ({})); setError(String(detail.detail ?? "The finance workflow action was rejected.")); return; }
    await load();
  }

  async function downloadReport(kind: "boq" | "cost" | "milestones") {
    if (!dashboardProjectId) return;
    const response = await apiFetch(`/construction/exports/${kind}/${dashboardProjectId}.csv`, {}, organization);
    if (!response.ok) { setError("The report export could not be generated."); return; }
    const blob = await response.blob(); const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${kind}-${dashboardProjectId}.csv`; anchor.click();
    URL.revokeObjectURL(url);
  }

  const selectedColumns = useMemo(() => tab === "overview" ? [] : columns[tab], [tab]);
  const selectTab = (item: Tab | string) => {
    setRows([]);
    setSearch("");
    setTab(item as Tab);
    if (item !== "projects") setSelectedProject(null);
  };
  const kpis = dashboard?.kpis;
  const activeProject = dashboard?.projects[0];
  const firstName = session?.user.firstName || session?.user.username || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const stageColors: Record<string, string> = {
    planning: "#3b82f6",
    active: "#f59e0b",
    on_hold: "#94a3b8",
    complete: "#06b6d4",
    closed: "#10b981",
    review_required: "#8b5cf6",
  };
  const totalProjects = Number(kpis?.portfolioProjects ?? 0);
  const utilPct = Number(kpis?.budgetUtilization ?? 0);
  const stageBreakdown = (dashboard?.projectStages ?? []).map((item) => ({
    ...item,
    pct: totalProjects ? Math.round((item.count / totalProjects) * 100) : 0,
    color: stageColors[item.stage] || "#94a3b8",
  }));
  const stageConic = (() => {
    if (!stageBreakdown.length) return "#e5e7eb 0% 100%";
    let acc = 0;
    const parts = stageBreakdown.map((item) => {
      const start = acc;
      acc += item.pct;
      return `${item.color} ${start}% ${acc}%`;
    });
    if (acc < 100) parts.push(`#e5e7eb ${acc}% 100%`);
    return parts.join(", ");
  })();

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Monitoring"
      eyebrow="Construction management"
      title={tab === "overview" ? "Project monitoring" : labels[tab]}
      subtitle={tab === "overview" ? `${greeting}, ${firstName}. Live portfolio control from verified site evidence, programme, commercial and close-out.` : `Review and manage ${labels[tab].toLowerCase()} across the active organization.`}
      accent="#dc2626"
      groups={constructionNav}
      activeId={tab}
      onSelect={selectTab}
      contextLabel={selectedProject ? "Active project" : "Portfolio"}
      contextValue={selectedProject ? String(selectedProject.name) : activeProject ? String(activeProject.name) : "All projects"}
      actions={
        <>
          <span className="welcome-meta">📅 {todayLabel}</span>
          {canReport && <button className="secondary-action" onClick={() => selectTab("reports")}>Export & reports</button>}
          {canAdminister && <button className="primary-action" onClick={() => setModal(true)}>+ Project workspace</button>}
        </>
      }
    >
    <div className="property-app monitoring-app">
    {selectedProject && tab !== "overview" && (
      <div className="project-scope-banner">
        <div>
          <small>Project scope</small>
          <strong>{String(selectedProject.code)} — {String(selectedProject.name)}</strong>
        </div>
        <div className="module-heading-actions">
          <button className="secondary-action" onClick={() => { setTab("projects"); void openProjectWorkspace(selectedProject); }}>Open workspace</button>
          <button className="secondary-action" onClick={() => setSelectedProject(null)}>Clear filter</button>
        </div>
      </div>
    )}
    {error && <div className="form-error">{error}<button onClick={load}>Retry</button></div>}
    {loading ? <div className="data-loading">Loading verified construction records…</div> : tab === "overview" && dashboard && kpis ? <>
      <section className="kpi-grid monitoring-kpis">
        <button className="icon-kpi" onClick={() => selectTab("projects")}><span style={{background:"#fee2e2",color:"#dc2626"}}>🏗️</span><div><small>Active Projects</small><strong>{String(kpis.activeProjects)}</strong><b>{kpis.portfolioProjects} total workspaces</b></div></button>
        <button className="icon-kpi" onClick={() => selectTab("calendar")}><span style={{background:"#ffedd5",color:"#ea580c"}}>📋</span><div><small>Site Visits / Calendar</small><strong>{String(kpis.submittedMilestones)}</strong><b>Progress submissions</b></div></button>
        <button className="icon-kpi" onClick={() => selectTab("drawdowns")}><span style={{background:"#dcfce7",color:"#16a34a"}}>💰</span><div><small>Drawdowns & Finance</small><strong>{cash.format(Number(kpis.certifiedValue))}</strong><b>Certified value</b></div></button>
        <button className="icon-kpi" onClick={() => selectTab("risks")}><span style={{background:"#fee2e2",color:"#ef4444"}}>⚠</span><div><small>Risks Open</small><strong>{String(kpis.highRisks)}</strong><b>High exposure risks</b></div></button>
        <button className="icon-kpi" onClick={() => selectTab("tickets")}><span style={{background:"#ede9fe",color:"#7c3aed"}}>🎫</span><div><small>Open Issues</small><strong>{String(kpis.openTickets)}</strong><b>Tracked to resolution</b></div></button>
        <button className="icon-kpi" onClick={() => selectTab("disbursements")}><span style={{background:"#dbeafe",color:"#2563eb"}}>💹</span><div><small>Budget Utilization</small><strong>{utilPct}%</strong><b>{cash.format(Number(kpis.paidValue))} paid to date</b></div></button>
      </section>
      <div className="monitoring-dash-layout">
        <div>
          <section className="monitoring-overview-grid">
            <article className="data-panel">
              <PanelTitle title="Project Progress Overview" onClick={() => selectTab("projects")} />
              <div className="donut-panel">
                <div className="donut" style={{ background: `conic-gradient(${stageConic})` }}>
                  <strong>{totalProjects}</strong>
                  <small>Total</small>
                </div>
                <div className="donut-legend">
                  {stageBreakdown.length ? stageBreakdown.map((item) => (
                    <span key={item.stage}>
                      <i style={{ background: item.color }} />
                      {item.stage.replaceAll("_", " ")}
                      <b>{item.count} ({item.pct}%)</b>
                    </span>
                  )) : <span>No projects yet</span>}
                </div>
              </div>
            </article>
            <article className="data-panel">
              <PanelTitle title="Budget Utilization" onClick={() => selectTab("disbursements")} />
              <div className="compliance-gauge">
                <div className="donut" style={{ background: `conic-gradient(#e23b3b 0% ${Math.min(100, utilPct)}%, #e5e7eb ${Math.min(100, utilPct)}% 100%)` }}>
                  <strong>{utilPct}%</strong>
                  <small>Utilized</small>
                </div>
                <p>Paid {cash.format(Number(kpis.paidValue))} · Certified {cash.format(Number(kpis.certifiedValue))}</p>
              </div>
            </article>
            <article className="data-panel">
              <PanelTitle title="Top Risks" onClick={() => selectTab("risks")} />
              {dashboard.topRisks.length ? dashboard.topRisks.map((row) => {
                const score = Number(row.likelihood) * Number(row.impact);
                return <button className="invoice-alert" key={String(row.id)} onClick={() => selectTab("risks")}>
                  <span>
                    <strong>{String(row.reference || "Risk")}</strong>
                    <small>{String(row.description)}</small>
                  </span>
                  <b className={score >= 16 ? "status-critical" : score >= 9 ? "status-high" : ""} style={{ background: "transparent", color: score >= 16 ? "#c32929" : score >= 9 ? "#91620d" : "#566177" }}>{score}</b>
                </button>;
              }) : <Empty />}
            </article>
          </section>
          <section className="monitoring-secondary-grid">
            <article className="data-panel">
              <PanelTitle title="Issues requiring action" onClick={() => selectTab("tickets")} />
              {dashboard.recentTickets.length ? dashboard.recentTickets.map((row) => (
                <button className="invoice-alert" key={String(row.id)} onClick={() => selectTab("tickets")}>
                  <span>
                    <strong>{String(row.title)}</strong>
                    <small>{String(row.due_date || "No due date")} · escalation {String(row.escalation_level)}</small>
                  </span>
                  <Status value={String(row.priority)} />
                </button>
              )) : <Empty />}
            </article>
            <article className="data-panel">
              <PanelTitle title="Active construction portfolio" onClick={() => selectTab("projects")} />
              <Table cols={columns.projects.slice(0, 5)} rows={dashboard.projects.slice(0, 5)} />
            </article>
            <article className="data-panel">
              <PanelTitle title="Recent activity" onClick={() => selectTab("audit-log")} />
              {dashboard.recentTickets.slice(0, 4).map((row) => (
                <button className="invoice-alert" key={`act-${String(row.id)}`} onClick={() => selectTab("tickets")}>
                  <span>
                    <strong>{String(row.title)}</strong>
                    <small>Issue · {String(row.status)}</small>
                  </span>
                  <Status value={String(row.priority)} />
                </button>
              ))}
              {!dashboard.recentTickets.length && <Empty />}
            </article>
          </section>
          <section className="lifecycle-strip" aria-label="Project lifecycle stages">
            {stageBreakdown.length ? stageBreakdown.map((item) => (
              <button key={item.stage} className={item.stage === "active" ? "active" : ""} onClick={() => selectTab("projects")}>
                <small>{item.stage.replaceAll("_", " ")}</small>
                <strong>{item.count}</strong>
              </button>
            )) : (
              <button onClick={() => selectTab("projects")}><small>Portfolio</small><strong>0</strong></button>
            )}
          </section>
        </div>
        <aside className="facility-side-stack">
          <article className="quick-actions-card">
            <header><h3>Quick Actions</h3></header>
            {canAdminister && <button onClick={() => setModal(true)}><span style={{background:"#fee2e2"}}>＋</span>New Project Workspace</button>}
            <button onClick={() => selectTab("daily-logs")}><span style={{background:"#dbeafe"}}>📷</span>Site Diary / Logs</button>
            <button onClick={() => selectTab("tickets")}><span style={{background:"#ffedd5"}}>⚠</span>Raise Issue / Risk</button>
            <button onClick={() => selectTab("drawdowns")}><span style={{background:"#dcfce7"}}>$</span>Review Drawdown</button>
            <button onClick={() => selectTab("calendar")}><span style={{background:"#ede9fe"}}>📅</span>Schedule Meeting</button>
            <button onClick={() => selectTab("reports")}><span style={{background:"#e0f2fe"}}>📄</span>Generate Report</button>
            <button onClick={() => selectTab("documents")}><span style={{background:"#ffedd5"}}>📁</span>Upload Document</button>
          </article>
          <article className="data-panel">
            <div className="report-hero" style={{ borderRadius: 0, minHeight: 140 }}>
              <div>
                <p>Construction monitoring</p>
                <h3 style={{ fontSize: 16 }}>Made simple, transparent and accountable.</h3>
                <span>Evidence-backed progress for every project stage.</span>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </> : tab === "projects" && selectedProject ? (
      <ProjectWorkspace
        project={selectedProject}
        loading={workspaceLoading}
        data={workspaceData}
        onBack={() => setSelectedProject(null)}
        onNavigate={(item) => selectTab(item)}
      />
    ) : (
      <RegisterView
        tab={tab as Exclude<Tab, "overview">}
        rows={rows}
        cols={selectedColumns}
        search={search}
        setSearch={setSearch}
        onAction={runFinanceAction}
        onVerifyMilestone={canCertify ? verifyMilestone : undefined}
        markAllNotificationsRead={markAllNotificationsRead}
        downloadReport={downloadReport}
        selectTab={selectTab}
        openProject={openProjectWorkspace}
        portfolioView={portfolioView}
        setPortfolioView={setPortfolioView}
        stageFilter={stageFilter}
        setStageFilter={setStageFilter}
        canCommercial={canCommercial || canAdminister}
        canFinance={canFinance || canAdminister}
      />
    )}
    {modal && <div className="modal-backdrop" onMouseDown={() => { setModal(false); setOnboardingStep(1); }}><div className="form-modal tenant-intake-modal" onMouseDown={event => event.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">Project onboarding</p><h2>Create construction workspace</h2></div><button onClick={() => { setModal(false); setOnboardingStep(1); }}>×</button></div><div className="onboarding-steps"><span className={onboardingStep === 1 ? "active" : ""}>1. Project</span><span className={onboardingStep === 2 ? "active" : ""}>2. Commercial</span><span className={onboardingStep === 3 ? "active" : ""}>3. Review</span></div><form onSubmit={async (event) => { if (onboardingStep < 3) { event.preventDefault(); setOnboardingStep((step) => step + 1); return; } await createProject(event); setOnboardingStep(1); }}><div style={{ display: onboardingStep === 1 ? "grid" : "none", gap: 16 }}><label>Shared portfolio project<select required name="portfolio_project" defaultValue=""><option disabled value="">Select project</option>{portfolioProjects.map(project => <option key={String(project.id)} value={String(project.id)}>{project.code} — {project.name}</option>)}</select></label><div className="form-row"><label>Construction code<input required name="code"/></label><label>Stage<select name="stage" defaultValue="planning"><option value="planning">Planning</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="complete">Complete</option></select></label></div><label>Workspace name<input required name="name"/></label></div><div style={{ display: onboardingStep === 2 ? "grid" : "none", gap: 16 }}><div className="form-row"><label>Client<input name="client_name"/></label><label>Location<input name="location"/></label></div><label>Description<textarea name="description" rows={3}/></label><p className="form-help">Commercial baseline, BoQ and programme can be imported after the workspace is created.</p></div><div style={{ display: onboardingStep === 3 ? "grid" : "none", gap: 16 }}><p className="form-help">Review the project identity and create the organization-scoped construction workspace. Field evidence remains mobile-authoritative.</p></div><div className="form-actions"><button type="button" onClick={() => onboardingStep === 1 ? (setModal(false), setOnboardingStep(1)) : setOnboardingStep((step) => step - 1)}>{onboardingStep === 1 ? "Cancel" : "Back"}</button><button className="primary-action">{onboardingStep === 3 ? "Create workspace" : "Continue"}</button></div></form></div></div>}
    </div>
    </ModuleShell>
  );
}

function RegisterHeader({ tab, search, setSearch, markAllNotificationsRead, downloadReport }: { tab: Exclude<Tab, "overview">; search: string; setSearch: (value: string) => void; markAllNotificationsRead: () => void; downloadReport: (kind: "boq" | "cost" | "milestones") => void }) {
  return <header className="collection-title"><div><p className="eyebrow">Organization-scoped live workspace</p><h2>{labels[tab]}</h2></div><div className="collection-actions">{tab === "notifications" && <button className="secondary-action" onClick={markAllNotificationsRead}>Mark all read</button>}{tab === "reports" && <><button className="secondary-action" onClick={() => downloadReport("boq")}>Export BoQ</button><button className="secondary-action" onClick={() => downloadReport("cost")}>Export cost</button><button className="secondary-action" onClick={() => downloadReport("milestones")}>Export progress</button></>}<label className="register-search"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records…" aria-label={`Search ${labels[tab]}`} /></label></div></header>;
}

function ProjectWorkspace({
  project,
  loading,
  data,
  onBack,
  onNavigate,
}: {
  project: Row;
  loading: boolean;
  data: {
    milestones: Row[];
    risks: Row[];
    tickets: Row[];
    workPlan: Row[];
    documents: Row[];
    bimModels: Row[];
    scurve: { series?: { week: string; planned_percent?: number | null; actual_percent?: number | null }[] };
    kpis: Record<string, string | number>;
    project: Row;
  };
  onBack: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const active = data.project?.id ? data.project : project;
  const avgProgress = Number(data.kpis.averageProgress ?? (
    data.milestones.length
      ? Math.round((data.milestones.reduce((sum, row) => sum + Number(row.percent_complete ?? 0), 0) / data.milestones.length) * 10) / 10
      : 0
  ));
  const completed = Number(data.kpis.milestonesComplete ?? data.milestones.filter((row) => Number(row.percent_complete ?? 0) >= 100).length);
  const nextMilestone = data.milestones.find((row) => Number(row.percent_complete ?? 0) < 100);
  const openTickets = Number(data.kpis.openTickets ?? data.tickets.filter((row) => !["closed", "resolved"].includes(String(row.status))).length);
  const openRisks = Number(data.kpis.openRisks ?? data.risks.filter((row) => String(row.status) !== "closed").length);
  const series = data.scurve?.series ?? [];
  const maxY = Math.max(100, ...series.map((point) => Math.max(Number(point.planned_percent ?? 0), Number(point.actual_percent ?? 0))));
  return (
    <article className="data-panel project-workspace-panel">
      <header className="project-workspace-header">
        <div>
          <button className="secondary-action" onClick={onBack}>← Back to portfolio</button>
          <div className="project-workspace-title">
            <span className="mono-code">{String(active.code ?? "PROJECT")}</span>
            <h2>{String(active.name ?? "Project workspace")}</h2>
            <Status value={String(active.stage ?? "planning")} />
          </div>
          <p className="project-workspace-meta">
            ⌖ {String(active.location ?? "Location not set")}
            {active.client_name ? ` · Client: ${String(active.client_name)}` : ""}
            {active.planned_completion_date ? ` · Target ${String(active.planned_completion_date)}` : ""}
          </p>
        </div>
        <div className="monitoring-heading-actions">
          <button className="secondary-action" onClick={() => onNavigate("reports")}>Share / Reports</button>
          <button className="secondary-action" onClick={() => onNavigate("bim-models")}>BIM models</button>
          <button className="primary-action" onClick={() => onNavigate("daily-logs")}>+ New log</button>
        </div>
      </header>
      {loading ? <div className="data-loading">Loading project command center…</div> : (
        <>
          <div className="workspace-stat-row project-workspace-stats">
            <WorkspaceStat label="Physical progress" value={`${avgProgress}%`} tone="blue" />
            <WorkspaceStat label="Milestones complete" value={`${completed}/${Number(data.kpis.milestones ?? data.milestones.length ?? 0)}`} tone="green" />
            <WorkspaceStat label="Open issues" value={openTickets} tone="red" />
            <WorkspaceStat label="Open risks" value={openRisks} tone="amber" />
            <WorkspaceStat label="Budget utilized" value={`${Number(data.kpis.budgetUtilization ?? 0)}%`} tone="blue" />
          </div>
          <div className="project-workspace-shortcuts">
            {([
              ["milestones", "Progress"],
              ["work-plan", "Programme"],
              ["tickets", "Issues"],
              ["risks", "Risks"],
              ["boq", "BoQ & cost"],
              ["documents", "Documents"],
              ["bim-models", "BIM"],
              ["drawdowns", "Drawdowns"],
              ["daily-logs", "Site diary"],
            ] as [Tab, string][]).map(([item, label]) => (
              <button key={item} onClick={() => onNavigate(item)}>{label}</button>
            ))}
          </div>
          <div className="monitoring-overview-grid">
            <article className="data-panel nested-panel">
              <PanelTitle title="Progress over time (S-curve)" onClick={() => onNavigate("milestones")} />
              {series.length ? (
                <div className="scurve-chart" aria-label="Planned versus actual progress">
                  <div className="scurve-plot">
                    {series.map((point) => (
                      <div className="scurve-column" key={point.week}>
                        <div className="scurve-bars">
                          <i className="planned" style={{ height: `${(Number(point.planned_percent ?? 0) / maxY) * 100}%` }} title={`Planned ${point.planned_percent ?? "—"}%`} />
                          <i className="actual" style={{ height: `${(Number(point.actual_percent ?? 0) / maxY) * 100}%` }} title={`Actual ${point.actual_percent ?? "—"}%`} />
                        </div>
                        <span>{point.week.replace(/^\d{4}-W/, "W")}</span>
                      </div>
                    ))}
                  </div>
                  <div className="chart-legend">
                    <span><i className="billed" />Planned</span>
                    <span><i className="collected" />Actual</span>
                  </div>
                </div>
              ) : <Empty />}
            </article>
            <article className="data-panel nested-panel">
              <PanelTitle title="Progress milestones" onClick={() => onNavigate("milestones")} />
              {data.milestones.length ? data.milestones.slice(0, 5).map((row, index) => (
                <button className="invoice-alert" key={String(row.id ?? index)} onClick={() => onNavigate("milestones")}>
                  <span>
                    <strong>{String(row.milestone_id ?? "Milestone")}</strong>
                    <small>{String(row.required_certifying_role ?? "Certifier")} · {String(row.submitted_at ?? "Not submitted")}</small>
                  </span>
                  <b>{Number(row.percent_complete ?? 0)}%</b>
                </button>
              )) : <Empty />}
              {nextMilestone && (
                <div className="next-milestone-callout">
                  <small>Next milestone</small>
                  <strong>{String(nextMilestone.milestone_id ?? "In progress")}</strong>
                </div>
              )}
            </article>
            <article className="data-panel nested-panel">
              <PanelTitle title="BIM & digital twin" onClick={() => onNavigate("bim-models")} />
              {data.bimModels.length ? data.bimModels.map((row, index) => (
                <button className="invoice-alert" key={String(row.id ?? index)} onClick={() => onNavigate("bim-models")}>
                  <span>
                    <strong>{String(row.name ?? "BIM model")}</strong>
                    <small>{String(row.discipline ?? "Model")} · v{String(row.version ?? "1")} · {String(row.element_count ?? 0)} elements</small>
                  </span>
                  <Status value={String(row.processing_status ?? "ready")} />
                </button>
              )) : <Empty />}
              <div className="bim-viewer-preview" aria-hidden="true">
                <span>IFC / model preview</span>
                <strong>{String(active.code ?? "MODEL")}</strong>
              </div>
            </article>
          </div>
          <div className="monitoring-secondary-grid">
            <article className="data-panel nested-panel">
              <PanelTitle title="Programme snapshot" onClick={() => onNavigate("work-plan")} />
              {data.workPlan.length ? data.workPlan.slice(0, 5).map((row, index) => (
                <div className="programme-row compact" key={String(row.id ?? index)}>
                  <div>
                    <span>{String(row.task_id ?? index + 1)}</span>
                    <strong>{String(row.task_name ?? "Activity")}</strong>
                    <small>{String(row.responsible_party ?? "Unassigned")}</small>
                  </div>
                  <div className="programme-progress">
                    <span><i style={{ width: `${Math.min(100, Number(row.percent_complete ?? 0))}%` }} /></span>
                    <b>{Number(row.percent_complete ?? 0)}%</b>
                  </div>
                </div>
              )) : <Empty />}
            </article>
            <article className="data-panel nested-panel">
              <PanelTitle title="Risks & issues" onClick={() => onNavigate("risks")} />
              {data.risks.length ? data.risks.slice(0, 4).map((row, index) => (
                <button className="invoice-alert" key={String(row.id ?? index)} onClick={() => onNavigate("risks")}>
                  <span>
                    <strong>{String(row.reference ?? "Risk")}</strong>
                    <small>{String(row.description)}</small>
                  </span>
                  <b>{Number(row.likelihood ?? 0) * Number(row.impact ?? 0)}</b>
                </button>
              )) : <Empty />}
              {data.tickets.slice(0, 3).map((row, index) => (
                <button className="invoice-alert" key={`t-${String(row.id ?? index)}`} onClick={() => onNavigate("tickets")}>
                  <span>
                    <strong>{String(row.title)}</strong>
                    <small>Issue · due {String(row.due_date ?? "not set")}</small>
                  </span>
                  <Status value={String(row.priority ?? "normal")} />
                </button>
              ))}
            </article>
            <article className="data-panel nested-panel">
              <PanelTitle title="Controlled documents" onClick={() => onNavigate("documents")} />
              {data.documents.length ? (
                <div className="document-card-grid">
                  {data.documents.map((row, index) => (
                    <article className="document-card" key={String(row.id ?? index)}>
                      <div className="file-icon">{String(row.doc_type ?? "DOC").slice(0, 4).toUpperCase()}</div>
                      <div>
                        <p>{String(row.discipline ?? "Project document")}</p>
                        <strong>{String(row.title ?? "Controlled document")}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <Empty />}
            </article>
          </div>
        </>
      )}
    </article>
  );
}

function RegisterView({
  tab,
  rows,
  cols,
  search,
  setSearch,
  onAction,
  onVerifyMilestone,
  markAllNotificationsRead,
  downloadReport,
  selectTab,
  openProject,
  portfolioView,
  setPortfolioView,
  stageFilter,
  setStageFilter,
  canCommercial = true,
  canFinance = true,
}: {
  tab: Exclude<Tab, "overview">;
  rows: Row[];
  cols: { key: string; label: string; kind?: "money" | "status" | "progress" }[];
  search: string;
  setSearch: (value: string) => void;
  onAction: (row: Row, action: string) => void;
  onVerifyMilestone?: (row: Row, decision: "verified" | "rejected" | "clarification") => void;
  markAllNotificationsRead: () => void;
  downloadReport: (kind: "boq" | "cost" | "milestones") => void;
  selectTab: (tab: Tab) => void;
  openProject: (project: Row) => void;
  portfolioView: "cards" | "list";
  setPortfolioView: (view: "cards" | "list") => void;
  stageFilter: string;
  setStageFilter: (value: string) => void;
  canCommercial?: boolean;
  canFinance?: boolean;
}) {
  const header = <RegisterHeader tab={tab} search={search} setSearch={setSearch} markAllNotificationsRead={markAllNotificationsRead} downloadReport={downloadReport} />;
  if (tab === "projects") {
    const stages = Array.from(new Set(rows.map((row) => String(row.stage ?? "planning"))));
    const filtered = rows.filter((row) => stageFilter === "all" || String(row.stage) === stageFilter);
    const activeCount = rows.filter((row) => row.stage === "active").length;
    const planningCount = rows.filter((row) => row.stage === "planning").length;
    const completeCount = rows.filter((row) => ["complete", "closed"].includes(String(row.stage))).length;
    return (
      <article className="data-panel construction-portfolio">
        {header}
        <div className="portfolio-filter-bar">
          <div className="stage-filter-pills">
            {[
              { id: "all", label: `All Projects (${rows.length})` },
              { id: "active", label: `Active (${activeCount})` },
              { id: "planning", label: `Planning (${planningCount})` },
              { id: "complete", label: `Completed (${completeCount})` },
              ...stages.filter((stage) => !["active", "planning", "complete", "closed"].includes(stage)).map((stage) => ({ id: stage, label: stage.replaceAll("_", " ") })),
            ].map((item) => (
              <button key={item.id} className={stageFilter === item.id ? "active" : ""} onClick={() => setStageFilter(item.id)}>{item.label}</button>
            ))}
          </div>
          <div className="portfolio-toolbar-row inline">
            <span><b>{filtered.length}</b> project workspaces</span>
            <div>
              <button className={`view-option ${portfolioView === "cards" ? "active" : ""}`} aria-label="Card view" onClick={() => setPortfolioView("cards")}>▦</button>
              <button className={`view-option ${portfolioView === "list" ? "active" : ""}`} aria-label="List view" onClick={() => setPortfolioView("list")}>☷</button>
            </div>
          </div>
        </div>
        {filtered.length ? (
          portfolioView === "cards" ? (
            <div className="construction-project-grid">
              {filtered.map((row, index) => (
                <button className="construction-project-card" key={String(row.id ?? index)} onClick={() => openProject(row)}>
                  <div className={`project-visual project-visual-${index % 3}`}>
                    <span>{String(row.code ?? "PROJECT")}</span>
                    <Status value={String(row.stage ?? "planning")} />
                  </div>
                  <div className="project-card-body">
                    <p>{String(row.client_name ?? "Client project")}</p>
                    <h3>{String(row.name ?? "Untitled project")}</h3>
                    <span className="project-location">⌖ {String(row.location ?? "Location not set")}</span>
                    <div className="project-budget">
                      <span><small>Approved budget</small><b>{cash.format(Number(row.budget ?? 0))}</b></span>
                      <span><small>Target completion</small><b>{String(row.planned_completion_date ?? "—")}</b></span>
                    </div>
                    <span className="project-open">Open project workspace →</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Table cols={columns.projects} rows={filtered} />
          )
        ) : <Empty />}
      </article>
    );
  }
  if (tab === "work-plan") return <article className="data-panel programme-workspace">{header}<div className="programme-summary"><span><small>Programme activities</small><strong>{rows.length}</strong></span><span><small>In progress</small><strong>{rows.filter(row => String(row.status).includes("progress")).length}</strong></span><span><small>Completed</small><strong>{rows.filter(row => String(row.status) === "completed").length}</strong></span><span><small>Requires attention</small><strong>{rows.filter(row => ["delayed", "blocked", "overdue"].includes(String(row.status))).length}</strong></span></div>{rows.length ? <div className="programme-list">{rows.map((row, index) => <div className="programme-row" key={String(row.id ?? index)}><div><span>{String(row.task_id ?? index + 1)}</span><strong>{String(row.task_name ?? "Programme activity")}</strong><small>{String(row.responsible_party ?? "Unassigned")}</small></div><div className="programme-dates"><small>{String(row.start_date ?? "—")}</small><span>→</span><small>{String(row.end_date ?? "—")}</small></div><div className="programme-progress"><span><i style={{width:`${Math.min(100, Number(row.percent_complete ?? 0))}%`}} /></span><b>{Number(row.percent_complete ?? 0)}%</b></div><Status value={String(row.status ?? "planned")}/></div>)}</div> : <Empty/>}</article>;
  if (tab === "risks") return <article className="data-panel risk-workspace">{header}<div className="risk-layout-new"><div className="risk-register-cards">{rows.length ? rows.map((row, index) => { const score = Number(row.likelihood ?? 0) * Number(row.impact ?? 0); return <button key={String(row.id ?? index)} className="risk-register-card" onClick={() => selectTab("tickets")}><span className={`risk-score risk-score-${score >= 16 ? "critical" : score >= 9 ? "high" : "moderate"}`}>{score}</span><div><p>{String(row.reference ?? "Risk")}</p><strong>{String(row.description ?? "Risk description")}</strong><small>{String(row.category ?? "General")} · {String(row.mitigation ?? "Mitigation not recorded")}</small></div><Status value={String(row.status ?? "open")}/></button>}) : <Empty/>}</div><aside className="risk-matrix"><h3>Exposure matrix</h3><p>Likelihood × impact</p><div className="matrix-grid">{[5,4,3,2,1].flatMap(likelihood => [1,2,3,4,5].map(impact => { const count = rows.filter(row => Number(row.likelihood) === likelihood && Number(row.impact) === impact).length; const score = likelihood * impact; return <span className={score >= 16 ? "critical" : score >= 9 ? "high" : score >= 4 ? "moderate" : "low"} key={`${likelihood}-${impact}`}>{count || ""}</span> }))}</div><div className="matrix-legend"><span><i className="low"/>Low</span><span><i className="moderate"/>Moderate</span><span><i className="high"/>High</span><span><i className="critical"/>Critical</span></div></aside></div></article>;
  if (tab === "tickets") return <article className="data-panel issues-workspace">{header}<div className="workspace-stat-row"><WorkspaceStat label="Open issues" value={rows.filter(row => !["closed", "resolved"].includes(String(row.status))).length} tone="blue"/><WorkspaceStat label="Urgent priority" value={rows.filter(row => ["urgent", "critical", "high"].includes(String(row.priority))).length} tone="red"/><WorkspaceStat label="Escalated" value={rows.filter(row => Number(row.escalation_level ?? 0) > 0).length} tone="amber"/><WorkspaceStat label="Resolved" value={rows.filter(row => ["closed", "resolved"].includes(String(row.status))).length} tone="green"/></div><div className="issue-board">{["urgent", "high", "normal"].map(priority => <section key={priority}><h3><span className={`priority-dot ${priority}`}/>{priority === "normal" ? "Other active" : `${priority} priority`}<b>{rows.filter(row => priority === "normal" ? !["urgent", "high"].includes(String(row.priority)) : String(row.priority) === priority).length}</b></h3>{rows.filter(row => priority === "normal" ? !["urgent", "high"].includes(String(row.priority)) : String(row.priority) === priority).map((row,index) => <button className="issue-card" key={String(row.id ?? index)} onClick={() => selectTab("ticket-comments")}><div><Status value={String(row.status ?? "open")}/><span>{String(row.risk_level ?? "medium")} risk</span></div><strong>{String(row.title ?? "Site issue")}</strong><small>Due {String(row.due_date ?? "not set")} · escalation {String(row.escalation_level ?? 0)}</small><i>Open discussion →</i></button>)}</section>)}</div></article>;
  if (tab === "daily-logs") return <article className="data-panel site-diary-workspace">{header}<div className="workspace-stat-row"><WorkspaceStat label="Diary entries" value={rows.length} tone="blue"/><WorkspaceStat label="Total labour" value={rows.reduce((sum,row) => sum + Number(row.labour_count ?? 0),0)} tone="green"/><WorkspaceStat label="Verified entries" value={rows.filter(row => row.verified_at).length} tone="green"/><WorkspaceStat label="Awaiting review" value={rows.filter(row => !row.verified_at).length} tone="amber"/></div><div className="site-diary-list">{rows.length ? rows.map((row,index) => <article key={String(row.id ?? index)}><div className="diary-date"><strong>{String(row.log_date ?? "—").slice(-2)}</strong><span>{String(row.log_date ?? "Site date")}</span></div><div><p>{String(row.weather ?? "Weather not recorded")} · {Number(row.labour_count ?? 0)} personnel</p><strong>{String(row.notes ?? "No site notes recorded")}</strong><small>Project {String(row.project_id ?? "—")}</small></div><Status value={row.verified_at ? "verified" : "pending"}/></article>) : <Empty/>}</div></article>;
  const commercialTabs: Tab[] = ["boq", "variations", "provisional-sums", "contingency-drawdowns", "advance-payments", "advance-recoveries", "consultant-payments", "work-orders"];
  if (commercialTabs.includes(tab)) {
    const amountKey = tab === "boq" ? "amount" : tab === "work-orders" ? "total_value" : tab === "consultant-payments" ? "amount" : tab === "advance-recoveries" ? "amount_recovered" : tab === "provisional-sums" ? "budgeted_amount" : "amount";
    const total = rows.reduce((sum,row) => sum + Number(row[amountKey] ?? 0),0);
    const pending = rows.filter(row => ["draft", "pending", "submitted", "requested", "active"].includes(String(row.status))).length;
    return <article className="data-panel commercial-workspace">{header}<div className="commercial-banner"><div><small>Register value</small><strong>{cash.format(total)}</strong><span>Live organization-scoped commercial exposure</span></div><WorkspaceStat label="Register items" value={rows.length} tone="blue"/><WorkspaceStat label="Requiring action" value={pending} tone="amber"/><WorkspaceStat label="Controlled records" value={rows.filter(row => ["approved", "paid", "closed", "complete"].includes(String(row.status))).length} tone="green"/></div><Table cols={cols} rows={rows} tab={tab} onAction={canCommercial ? onAction : undefined}/></article>;
  }
  const financeTabs: Tab[] = ["requisitions", "certificates", "disbursements", "drawdowns"];
  if (financeTabs.includes(tab)) {
    const amountKey = tab === "certificates" ? "net_payable" : "amount";
    const total = rows.reduce((sum,row) => sum + Number(row[amountKey] ?? 0),0);
    return <article className="data-panel finance-control-workspace">{header}<div className="finance-control-strip"><div><p>Financial control</p><strong>{cash.format(total)}</strong><small>Total visible value</small></div><div className="finance-ring" style={{"--ring": `${Math.min(100, rows.length ? rows.filter(row => ["approved","paid","disbursed"].includes(String(row.status))).length / rows.length * 100 : 0)}%`} as CSSProperties}><span>{rows.length}</span><small>records</small></div><WorkspaceStat label="Pending control" value={rows.filter(row => ["draft","submitted","pending","reviewed","document_review","valuation_review"].includes(String(row.status))).length} tone="amber"/><WorkspaceStat label="Completed" value={rows.filter(row => ["approved","paid","disbursed"].includes(String(row.status))).length} tone="green"/></div><Table cols={cols} rows={rows} tab={tab} onAction={canFinance ? onAction : undefined}/></article>;
  }
  if (tab === "milestones" && onVerifyMilestone) {
    return <article className="data-panel">{header}<div className="workspace-stat-row"><WorkspaceStat label="Submissions" value={rows.length} tone="blue"/><WorkspaceStat label="Awaiting verification" value={rows.filter(row => row.submitted_at).length} tone="amber"/><WorkspaceStat label="Certifier role" value="Required" tone="green"/></div><Table cols={cols} rows={rows} tab={tab} onVerifyMilestone={onVerifyMilestone}/></article>;
  }
  if (tab === "documents" || tab === "document-versions") return <article className="data-panel document-workspace">{header}<div className="document-toolbar"><span><b>{rows.length}</b> controlled files</span><span>Immutable revision history</span><span>Organization scoped</span></div>{rows.length ? <div className="document-card-grid">{rows.map((row,index) => <article className="document-card" key={String(row.id ?? index)}><div className="file-icon">{String(row.file_format ?? row.doc_type ?? "DOC").slice(0,4).toUpperCase()}</div><div><p>{String(row.discipline ?? row.project_name ?? "Project document")}</p><strong>{String(row.title ?? row.document_title ?? "Controlled document")}</strong>{tab === "document-versions" ? <small><span>{String(row.revision_number ?? "Revision")}</span> · version {String(row.version ?? "—")}</small> : <small>{String(row.doc_type ?? "Document")}</small>}</div><div className="document-meta"><Status value={String(row.file_format ?? row.doc_type ?? "file")}/><small>{String(row.uploaded_at ?? row.created_at ?? "")}</small></div></article>)}</div> : <Empty/>}</article>;
  if (tab === "bim-models") return <article className="data-panel bim-workspace">{header}<div className="document-toolbar"><span><b>{rows.length}</b> BIM models</span><span>Discipline-linked digital twins</span><span>Project scoped</span></div><div className="bim-layout">{rows.length ? <div className="document-card-grid">{rows.map((row,index) => <article className="document-card" key={String(row.id ?? index)}><div className="file-icon">BIM</div><div><p>{String(row.discipline ?? "Model")}</p><strong>{String(row.name ?? "BIM model")}</strong><small>v{String(row.version ?? "1")} · {String(row.element_count ?? 0)} elements · {String(row.file_format ?? "IFC")}</small></div><div className="document-meta"><Status value={String(row.processing_status ?? "ready")}/></div></article>)}</div> : <Empty/>}<aside className="bim-viewer-panel"><p>Model viewer</p><div className="bim-viewer-preview large"><span>IFC viewport</span><strong>{rows[0] ? String(rows[0].name) : "No model selected"}</strong><small>Clash detection, quantity take-off and progress overlays attach here.</small></div></aside></div></article>;
  if (tab === "reports") return <article className="data-panel reports-workspace">{header}<div className="report-hero"><div><p>Construction intelligence</p><h3>Progress and control reporting</h3><span>Export auditable project evidence or review reporting periods below.</span></div><div><strong>{rows.length}</strong><small>reporting periods</small></div></div><div className="report-cards"><button onClick={() => downloadReport("boq")}><span>▤</span><strong>Bill of quantities</strong><small>Commercial baseline and item status</small></button><button onClick={() => downloadReport("cost")}><span>◈</span><strong>Cost report</strong><small>Budget, commitments and exposure</small></button><button onClick={() => downloadReport("milestones")}><span>◷</span><strong>Progress evidence</strong><small>Verified milestone submissions</small></button></div><Table cols={cols} rows={rows}/></article>;
  if (tab === "notifications" || tab === "chat") return <article className="data-panel collaboration-workspace">{header}<div className="collaboration-layout"><div className="collaboration-feed">{rows.length ? rows.map((row,index) => <article key={String(row.id ?? index)}><span className="feed-avatar">{String(row.sender_name ?? row.type ?? "CE").slice(0,2).toUpperCase()}</span><div><p>{String(row.sender_name ?? row.title ?? "System notification")}</p><strong>{String(row.body ?? "No message body")}</strong><small>{String(row.channel ?? row.created_at ?? "")}</small></div>{tab === "notifications" && <Status value={row.read_at ? "read" : "unread"}/>}</article>) : <Empty/>}</div><aside><h3>Team collaboration</h3><p>Messages and notifications remain connected to the active organization and project evidence.</p><span><b>{rows.length}</b> visible records</span><span><b>{rows.filter(row => !row.read_at).length}</b> requiring attention</span></aside></div></article>;
  return <article className="data-panel">{header}<Table cols={cols} rows={rows} tab={tab} onAction={onAction}/></article>;
}

function WorkspaceStat({ label, value, tone }: { label: string; value: string | number; tone: "blue" | "red" | "amber" | "green" }) { return <span className={`workspace-stat ${tone}`}><small>{label}</small><strong>{value}</strong><i/></span>; }

function PanelTitle({ title, onClick }: { title: string; onClick: () => void }) { return <header className="panel-title"><h2>{title}</h2><button onClick={onClick}>View all →</button></header>; }
function Status({ value }: { value: string }) { return <span className={`data-status status-${value}`}>{value.replaceAll("_", " ")}</span>; }
function Empty() { return <div className="empty-state">No records requiring attention.</div>; }
function Table({ cols, rows, tab, onAction, onVerifyMilestone }: { cols: { key: string; label: string; kind?: "money" | "status" | "progress" }[]; rows: Row[]; tab?: Tab; onAction?: (row: Row, action: string) => void; onVerifyMilestone?: (row: Row, decision: "verified" | "rejected" | "clarification") => void }) {
  const controlled = Boolean(tab && onAction && ["variations", "requisitions", "disbursements", "drawdowns", "provisional-sums", "contingency-drawdowns", "advance-payments"].includes(tab));
  const verifiable = Boolean(tab === "milestones" && onVerifyMilestone);
  return rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{cols.map(col => <th key={col.key}>{col.label}</th>)}{(controlled || verifiable) && <th>Actions</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{cols.map(col => <td key={col.key}>{col.kind === "money" ? cash.format(Number(row[col.key] ?? 0)) : col.kind === "status" ? <Status value={String(row[col.key] ?? "unknown")}/> : col.kind === "progress" ? <span className="progress-cell"><i style={{width:`${Math.min(100, Number(row[col.key] ?? 0))}%`}}/><b>{Number(row[col.key] ?? 0)}%</b></span> : typeof row[col.key] === "boolean" ? (row[col.key] ? "Yes" : "No") : Array.isArray(row[col.key]) ? (row[col.key] as string[]).join(", ") : String(row[col.key] ?? "—")}</td>)}{controlled && <td><WorkflowButtons tab={tab!} row={row} act={actionName => onAction?.(row, actionName)}/></td>}{verifiable && <td><div className="table-actions">{row.submitted_at ? <><button onClick={() => onVerifyMilestone?.(row, "verified")}>Verify</button><button onClick={() => onVerifyMilestone?.(row, "clarification")}>Clarify</button><button onClick={() => onVerifyMilestone?.(row, "rejected")}>Reject</button></> : <span>Awaiting submission</span>}</div></td>}</tr>)}</tbody></table></div> : <Empty/>;
}

function WorkflowButtons({ tab, row, act }: { tab: Tab; row: Row; act: (action: string) => void }) {
  const status = String(row.status);
  let actions: [string, string][] = [];
  if (tab === "variations") actions = status === "draft" ? [["submitted", "Submit"]] : status === "submitted" ? [["approved", "Approve"], ["rejected", "Reject"]] : [];
  if (tab === "requisitions") actions = status === "submitted" ? [["review", "Review"]] : status === "reviewed" ? [["approved", "Approve"], ["rejected", "Reject"]] : [];
  if (tab === "disbursements") actions = status === "pending" ? [["pay", "Mark paid"], ["void", "Void"]] : status === "paid" ? [["void", "Void"]] : [];
  if (tab === "drawdowns") actions = status === "submitted" ? [["review_documents", "Review documents"], ["reject", "Reject"]] : status === "document_review" ? [["review_valuation", "Review valuation"], ["reject", "Reject"]] : status === "valuation_review" ? [["approve", "Approve"], ["reject", "Reject"]] : status === "approved" ? [["disburse", "Disburse"]] : [];
  if (tab === "provisional-sums") actions = status === "pending" ? [["ascertain", "Ascertain"]] : status === "ascertained" ? [["close", "Close"]] : [];
  if (tab === "contingency-drawdowns") actions = status === "requested" ? [["approved", "Approve"], ["rejected", "Reject"]] : [];
  if (tab === "advance-payments") actions = status === "active" ? [["recover", "Record recovery"]] : [];
  return actions.length ? <div className="table-actions">{actions.map(([key, label]) => <button key={key} onClick={() => act(key)}>{label}</button>)}</div> : <span>Complete</span>;
}
