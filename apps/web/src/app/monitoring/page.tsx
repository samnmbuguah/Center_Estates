"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

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

const navigationGroups: { label: string; icon: string; tabs: Tab[] }[] = [
  { label: "Portfolio", icon: "⌂", tabs: ["overview", "projects", "project-memberships", "lifecycle", "calendar"] },
  { label: "Site operations", icon: "◫", tabs: ["milestones", "daily-logs", "tickets", "ticket-comments", "risks", "safety-incidents", "quality-tests", "rfis"] },
  { label: "Programme & controls", icon: "◷", tabs: ["work-plan", "milestone-verifications", "requirement-waivers", "approvals"] },
  { label: "Commercial", icon: "◈", tabs: ["boq", "variations", "provisional-sums", "contingency-drawdowns", "advance-payments", "advance-recoveries", "consultant-payments", "work-orders", "subcontractors"] },
  { label: "Procurement & stores", icon: "▣", tabs: ["materials", "store-items", "store-suppliers", "material-requisitions", "purchase-orders", "stock-movements"] },
  { label: "Finance", icon: "◎", tabs: ["requisitions", "certificates", "disbursements", "drawdowns"] },
  { label: "Documents & digital", icon: "◇", tabs: ["documents", "document-versions", "bim-models", "bim-discrepancies", "drone-datasets", "satellite-datasets"] },
  { label: "Insights & collaboration", icon: "◌", tabs: ["reports", "chat", "notifications", "audit-log"] },
];
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
  const { session } = useAuth();
  const organization = session?.activeOrganizationId ?? null;
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [portfolioProjects, setPortfolioProjects] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [navigationSearch, setNavigationSearch] = useState("");
  const dashboardProjectId = dashboard?.projects[0]?.id;

  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true); setError("");
    let path = tab === "overview" ? "/construction/dashboard/" : `/construction/${tab}/?search=${encodeURIComponent(search)}`;
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
  }, [dashboardProjectId, organization, search, tab]);
  useEffect(() => { const timer = setTimeout(load, search ? 250 : 0); return () => clearTimeout(timer); }, [load, search]);
  useEffect(() => {
    if (modal && organization) apiFetch("/property/projects/", {}, organization).then(r => r.ok ? r.json() : []).then(setPortfolioProjects);
  }, [modal, organization]);

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

  async function runFinanceAction(row: Row, actionName: string) {
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
  const visibleNavigation = useMemo(() => {
    const query = navigationSearch.trim().toLowerCase();
    if (!query) return navigationGroups;
    return navigationGroups.map(group => ({ ...group, tabs: group.tabs.filter(item => labels[item].toLowerCase().includes(query)) })).filter(group => group.tabs.length);
  }, [navigationSearch]);
  const selectTab = (item: Tab) => { setRows([]); setSearch(""); setTab(item); setNavigationOpen(false); };
  const kpis = dashboard?.kpis;
  const activeProject = dashboard?.projects[0];
  return <div className="monitoring-shell">
    <button className={`monitoring-nav-scrim ${navigationOpen ? "visible" : ""}`} aria-label="Close construction navigation" onClick={() => setNavigationOpen(false)} />
    <aside className={`monitoring-navigation ${navigationOpen ? "open" : ""}`} aria-label="Construction sections">
      <div className="monitoring-nav-title"><span className="construction-mark">M</span><div><strong>Construction</strong><small>Monitoring workspace</small></div><button aria-label="Close construction navigation" onClick={() => setNavigationOpen(false)}>×</button></div>
      <label className="monitoring-nav-search"><span aria-hidden="true">⌕</span><input value={navigationSearch} onChange={event => setNavigationSearch(event.target.value)} placeholder="Find a workspace" aria-label="Find a construction workspace" /></label>
      <div className="monitoring-nav-scroll">{visibleNavigation.map(group => <section className="monitoring-nav-group" key={group.label}><p><span aria-hidden="true">{group.icon}</span>{group.label}</p>{group.tabs.map(item => <button aria-label={labels[item]} className={tab === item ? "active" : ""} key={item} onClick={() => selectTab(item)}><span>{labels[item]}</span>{item === "notifications" && <i aria-hidden="true">●</i>}</button>)}</section>)}</div>
      <div className="monitoring-nav-footer"><span className="sync-dot" />Live organization data<small>Role and tenant scoped</small></div>
    </aside>
    <div className="monitoring-content">
    <header className="monitoring-context-bar"><button className="monitoring-menu" aria-label="Open construction navigation" onClick={() => setNavigationOpen(true)}>☰</button><div className="monitoring-breadcrumb"><span>Construction monitoring</span><b>/</b><strong>{labels[tab]}</strong></div><div className="project-context"><span className="context-health" />{activeProject ? <><small>Active workspace</small><strong>{String(activeProject.name)}</strong></> : <strong>Portfolio view</strong>}</div></header>
    <div className="page-wrap property-app monitoring-app">
    <section className="monitoring-page-heading"><div><p className="eyebrow">Construction management</p><h1>{tab === "overview" ? "Project monitoring" : labels[tab]}</h1><p>{tab === "overview" ? "Verified field evidence, programme, quality, commercial control and close-out." : `Review and manage ${labels[tab].toLowerCase()} across the active organization.`}</p></div><div className="monitoring-heading-actions"><button className="secondary-action" onClick={() => selectTab("reports")}>Export & reports</button><button className="primary-action" onClick={() => setModal(true)}>+ Project workspace</button></div></section>
    {error && <div className="form-error">{error}<button onClick={load}>Retry</button></div>}
    {loading ? <div className="data-loading">Loading verified construction records…</div> : tab === "overview" && dashboard && kpis ? <>
      <section className="monitoring-brief"><div><span className="brief-pulse"/><p>Portfolio control room</p><strong>{String(kpis.activeProjects)} active projects</strong></div><div><small>Progress submissions</small><strong>{Number(kpis.submittedMilestones)}</strong><span className="brief-stat-line">Verified milestone evidence</span></div><div><small>Budget utilization</small><strong>{Number(kpis.budgetUtilization)}%</strong><span className="brief-progress warning"><i style={{width:`${Math.min(100, Number(kpis.budgetUtilization))}%`}} /></span></div><button onClick={() => selectTab("notifications")}><small>Attention queue</small><strong>{Number(kpis.openTickets) + Number(kpis.highRisks)}</strong><span>Open issues and high risks →</span></button></section>
      <section className="kpi-grid monitoring-kpis"><Kpi label="Active projects" value={String(kpis.activeProjects)} note={`${kpis.portfolioProjects} workspaces`} onClick={() => selectTab("projects")}/><Kpi label="Open site issues" value={String(kpis.openTickets)} note="Tracked through resolution" onClick={() => selectTab("tickets")}/><Kpi label="High exposure risks" value={String(kpis.highRisks)} note="Likelihood × impact ≥ 16" onClick={() => selectTab("risks")}/><Kpi label="Approved variations" value={cash.format(Number(kpis.approvedVariations))} note={`${kpis.submittedMilestones} progress submissions`} onClick={() => selectTab("variations")}/><Kpi label="Certified value" value={cash.format(Number(kpis.certifiedValue))} note="Current non-void certificates" onClick={() => selectTab("certificates")}/><Kpi label="Paid to date" value={cash.format(Number(kpis.paidValue))} note={`${kpis.budgetUtilization}% budget utilized`} onClick={() => selectTab("disbursements")}/></section>
      <section className="dashboard-columns"><article className="data-panel"><PanelTitle title="Active construction portfolio" onClick={() => setTab("projects")}/><Table cols={columns.projects} rows={dashboard.projects}/></article><div className="facility-side-stack"><article className="data-panel"><PanelTitle title="Issues requiring action" onClick={() => setTab("tickets")}/>{dashboard.recentTickets.length ? dashboard.recentTickets.map(row => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("tickets")}><span><strong>{String(row.title)}</strong><small>{String(row.due_date || "No due date")} · escalation {String(row.escalation_level)}</small></span><Status value={String(row.priority)}/></button>) : <Empty/>}</article><article className="data-panel"><PanelTitle title="Risk watchlist" onClick={() => setTab("risks")}/>{dashboard.topRisks.length ? dashboard.topRisks.map(row => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("risks")}><span><strong>{String(row.reference || "Risk")}</strong><small>{String(row.description)}</small></span><b>{Number(row.likelihood) * Number(row.impact)}</b></button>) : <Empty/>}</article></div></section>
      <section className="summary-strip">{dashboard.projectStages.map(item => <button key={item.stage} onClick={() => setTab("projects")}><b>{item.count}</b>{item.stage.replaceAll("_", " ")}</button>)}</section>
    </> : <RegisterView tab={tab as Exclude<Tab, "overview">} rows={rows} cols={selectedColumns} search={search} setSearch={setSearch} onAction={runFinanceAction} markAllNotificationsRead={markAllNotificationsRead} downloadReport={downloadReport} selectTab={selectTab} />}
    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><div className="form-modal" onMouseDown={event => event.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">Unified hierarchy</p><h2>Create construction workspace</h2></div><button onClick={() => setModal(false)}>×</button></div><form onSubmit={createProject}><label>Shared portfolio project<select required name="portfolio_project" defaultValue=""><option disabled value="">Select project</option>{portfolioProjects.map(project => <option key={String(project.id)} value={String(project.id)}>{project.code} — {project.name}</option>)}</select></label><div className="form-row"><label>Construction code<input required name="code"/></label><label>Stage<select name="stage" defaultValue="planning"><option value="planning">Planning</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="complete">Complete</option></select></label></div><label>Workspace name<input required name="name"/></label><div className="form-row"><label>Client<input name="client_name"/></label><label>Location<input name="location"/></label></div><label>Description<textarea name="description" rows={3}/></label><div className="form-actions"><button type="button" onClick={() => setModal(false)}>Cancel</button><button className="primary-action">Create workspace</button></div></form></div></div>}
    </div></div>
  </div>;
}

function RegisterHeader({ tab, search, setSearch, markAllNotificationsRead, downloadReport }: { tab: Exclude<Tab, "overview">; search: string; setSearch: (value: string) => void; markAllNotificationsRead: () => void; downloadReport: (kind: "boq" | "cost" | "milestones") => void }) {
  return <header className="collection-title"><div><p className="eyebrow">Organization-scoped live workspace</p><h2>{labels[tab]}</h2></div><div className="collection-actions">{tab === "notifications" && <button className="secondary-action" onClick={markAllNotificationsRead}>Mark all read</button>}{tab === "reports" && <><button className="secondary-action" onClick={() => downloadReport("boq")}>Export BoQ</button><button className="secondary-action" onClick={() => downloadReport("cost")}>Export cost</button><button className="secondary-action" onClick={() => downloadReport("milestones")}>Export progress</button></>}<label className="register-search"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records…" aria-label={`Search ${labels[tab]}`} /></label></div></header>;
}

function RegisterView({ tab, rows, cols, search, setSearch, onAction, markAllNotificationsRead, downloadReport, selectTab }: { tab: Exclude<Tab, "overview">; rows: Row[]; cols: { key: string; label: string; kind?: "money" | "status" | "progress" }[]; search: string; setSearch: (value: string) => void; onAction: (row: Row, action: string) => void; markAllNotificationsRead: () => void; downloadReport: (kind: "boq" | "cost" | "milestones") => void; selectTab: (tab: Tab) => void }) {
  const header = <RegisterHeader tab={tab} search={search} setSearch={setSearch} markAllNotificationsRead={markAllNotificationsRead} downloadReport={downloadReport} />;
  if (tab === "projects") return <article className="data-panel construction-portfolio">{header}<div className="portfolio-toolbar-row"><span><b>{rows.length}</b> project workspaces</span><div><button className="view-option active" aria-label="Card view">▦</button><button className="view-option" aria-label="List view">☷</button></div></div>{rows.length ? <div className="construction-project-grid">{rows.map((row, index) => <button className="construction-project-card" key={String(row.id ?? index)} onClick={() => selectTab("milestones")}><div className={`project-visual project-visual-${index % 3}`}><span>{String(row.code ?? "PROJECT")}</span><Status value={String(row.stage ?? "planning")}/></div><div className="project-card-body"><p>{String(row.client_name ?? "Client project")}</p><h3>{String(row.name ?? "Untitled project")}</h3><span className="project-location">⌖ {String(row.location ?? "Location not set")}</span><div className="project-budget"><span><small>Approved budget</small><b>{cash.format(Number(row.budget ?? 0))}</b></span><span><small>Target completion</small><b>{String(row.planned_completion_date ?? "—")}</b></span></div><span className="project-open">Open project workspace →</span></div></button>)}</div> : <Empty/>}</article>;
  if (tab === "work-plan") return <article className="data-panel programme-workspace">{header}<div className="programme-summary"><span><small>Programme activities</small><strong>{rows.length}</strong></span><span><small>In progress</small><strong>{rows.filter(row => String(row.status).includes("progress")).length}</strong></span><span><small>Completed</small><strong>{rows.filter(row => String(row.status) === "completed").length}</strong></span><span><small>Requires attention</small><strong>{rows.filter(row => ["delayed", "blocked", "overdue"].includes(String(row.status))).length}</strong></span></div>{rows.length ? <div className="programme-list">{rows.map((row, index) => <div className="programme-row" key={String(row.id ?? index)}><div><span>{String(row.task_id ?? index + 1)}</span><strong>{String(row.task_name ?? "Programme activity")}</strong><small>{String(row.responsible_party ?? "Unassigned")}</small></div><div className="programme-dates"><small>{String(row.start_date ?? "—")}</small><span>→</span><small>{String(row.end_date ?? "—")}</small></div><div className="programme-progress"><span><i style={{width:`${Math.min(100, Number(row.percent_complete ?? 0))}%`}} /></span><b>{Number(row.percent_complete ?? 0)}%</b></div><Status value={String(row.status ?? "planned")}/></div>)}</div> : <Empty/>}</article>;
  if (tab === "risks") return <article className="data-panel risk-workspace">{header}<div className="risk-layout-new"><div className="risk-register-cards">{rows.length ? rows.map((row, index) => { const score = Number(row.likelihood ?? 0) * Number(row.impact ?? 0); return <button key={String(row.id ?? index)} className="risk-register-card" onClick={() => selectTab("tickets")}><span className={`risk-score risk-score-${score >= 16 ? "critical" : score >= 9 ? "high" : "moderate"}`}>{score}</span><div><p>{String(row.reference ?? "Risk")}</p><strong>{String(row.description ?? "Risk description")}</strong><small>{String(row.category ?? "General")} · {String(row.mitigation ?? "Mitigation not recorded")}</small></div><Status value={String(row.status ?? "open")}/></button>}) : <Empty/>}</div><aside className="risk-matrix"><h3>Exposure matrix</h3><p>Likelihood × impact</p><div className="matrix-grid">{[5,4,3,2,1].flatMap(likelihood => [1,2,3,4,5].map(impact => { const count = rows.filter(row => Number(row.likelihood) === likelihood && Number(row.impact) === impact).length; const score = likelihood * impact; return <span className={score >= 16 ? "critical" : score >= 9 ? "high" : score >= 4 ? "moderate" : "low"} key={`${likelihood}-${impact}`}>{count || ""}</span> }))}</div><div className="matrix-legend"><span><i className="low"/>Low</span><span><i className="moderate"/>Moderate</span><span><i className="high"/>High</span><span><i className="critical"/>Critical</span></div></aside></div></article>;
  if (tab === "tickets") return <article className="data-panel issues-workspace">{header}<div className="workspace-stat-row"><WorkspaceStat label="Open issues" value={rows.filter(row => !["closed", "resolved"].includes(String(row.status))).length} tone="blue"/><WorkspaceStat label="Urgent priority" value={rows.filter(row => ["urgent", "critical", "high"].includes(String(row.priority))).length} tone="red"/><WorkspaceStat label="Escalated" value={rows.filter(row => Number(row.escalation_level ?? 0) > 0).length} tone="amber"/><WorkspaceStat label="Resolved" value={rows.filter(row => ["closed", "resolved"].includes(String(row.status))).length} tone="green"/></div><div className="issue-board">{["urgent", "high", "normal"].map(priority => <section key={priority}><h3><span className={`priority-dot ${priority}`}/>{priority === "normal" ? "Other active" : `${priority} priority`}<b>{rows.filter(row => priority === "normal" ? !["urgent", "high"].includes(String(row.priority)) : String(row.priority) === priority).length}</b></h3>{rows.filter(row => priority === "normal" ? !["urgent", "high"].includes(String(row.priority)) : String(row.priority) === priority).map((row,index) => <button className="issue-card" key={String(row.id ?? index)} onClick={() => selectTab("ticket-comments")}><div><Status value={String(row.status ?? "open")}/><span>{String(row.risk_level ?? "medium")} risk</span></div><strong>{String(row.title ?? "Site issue")}</strong><small>Due {String(row.due_date ?? "not set")} · escalation {String(row.escalation_level ?? 0)}</small><i>Open discussion →</i></button>)}</section>)}</div></article>;
  if (tab === "daily-logs") return <article className="data-panel site-diary-workspace">{header}<div className="workspace-stat-row"><WorkspaceStat label="Diary entries" value={rows.length} tone="blue"/><WorkspaceStat label="Total labour" value={rows.reduce((sum,row) => sum + Number(row.labour_count ?? 0),0)} tone="green"/><WorkspaceStat label="Verified entries" value={rows.filter(row => row.verified_at).length} tone="green"/><WorkspaceStat label="Awaiting review" value={rows.filter(row => !row.verified_at).length} tone="amber"/></div><div className="site-diary-list">{rows.length ? rows.map((row,index) => <article key={String(row.id ?? index)}><div className="diary-date"><strong>{String(row.log_date ?? "—").slice(-2)}</strong><span>{String(row.log_date ?? "Site date")}</span></div><div><p>{String(row.weather ?? "Weather not recorded")} · {Number(row.labour_count ?? 0)} personnel</p><strong>{String(row.notes ?? "No site notes recorded")}</strong><small>Project {String(row.project_id ?? "—")}</small></div><Status value={row.verified_at ? "verified" : "pending"}/></article>) : <Empty/>}</div></article>;
  const commercialTabs: Tab[] = ["boq", "variations", "provisional-sums", "contingency-drawdowns", "advance-payments", "advance-recoveries", "consultant-payments", "work-orders"];
  if (commercialTabs.includes(tab)) {
    const amountKey = tab === "boq" ? "amount" : tab === "work-orders" ? "total_value" : tab === "consultant-payments" ? "amount" : tab === "advance-recoveries" ? "amount_recovered" : tab === "provisional-sums" ? "budgeted_amount" : "amount";
    const total = rows.reduce((sum,row) => sum + Number(row[amountKey] ?? 0),0);
    const pending = rows.filter(row => ["draft", "pending", "submitted", "requested", "active"].includes(String(row.status))).length;
    return <article className="data-panel commercial-workspace">{header}<div className="commercial-banner"><div><small>Register value</small><strong>{cash.format(total)}</strong><span>Live organization-scoped commercial exposure</span></div><WorkspaceStat label="Register items" value={rows.length} tone="blue"/><WorkspaceStat label="Requiring action" value={pending} tone="amber"/><WorkspaceStat label="Controlled records" value={rows.filter(row => ["approved", "paid", "closed", "complete"].includes(String(row.status))).length} tone="green"/></div><Table cols={cols} rows={rows} tab={tab} onAction={onAction}/></article>;
  }
  const financeTabs: Tab[] = ["requisitions", "certificates", "disbursements", "drawdowns"];
  if (financeTabs.includes(tab)) {
    const amountKey = tab === "certificates" ? "net_payable" : "amount";
    const total = rows.reduce((sum,row) => sum + Number(row[amountKey] ?? 0),0);
    return <article className="data-panel finance-control-workspace">{header}<div className="finance-control-strip"><div><p>Financial control</p><strong>{cash.format(total)}</strong><small>Total visible value</small></div><div className="finance-ring" style={{"--ring": `${Math.min(100, rows.length ? rows.filter(row => ["approved","paid","disbursed"].includes(String(row.status))).length / rows.length * 100 : 0)}%`} as CSSProperties}><span>{rows.length}</span><small>records</small></div><WorkspaceStat label="Pending control" value={rows.filter(row => ["draft","submitted","pending","reviewed","document_review","valuation_review"].includes(String(row.status))).length} tone="amber"/><WorkspaceStat label="Completed" value={rows.filter(row => ["approved","paid","disbursed"].includes(String(row.status))).length} tone="green"/></div><Table cols={cols} rows={rows} tab={tab} onAction={onAction}/></article>;
  }
  if (tab === "documents" || tab === "document-versions") return <article className="data-panel document-workspace">{header}<div className="document-toolbar"><span><b>{rows.length}</b> controlled files</span><span>Immutable revision history</span><span>Organization scoped</span></div>{rows.length ? <div className="document-card-grid">{rows.map((row,index) => <article className="document-card" key={String(row.id ?? index)}><div className="file-icon">{String(row.file_format ?? row.doc_type ?? "DOC").slice(0,4).toUpperCase()}</div><div><p>{String(row.discipline ?? row.project_name ?? "Project document")}</p><strong>{String(row.title ?? row.document_title ?? "Controlled document")}</strong>{tab === "document-versions" ? <small><span>{String(row.revision_number ?? "Revision")}</span> · version {String(row.version ?? "—")}</small> : <small>{String(row.doc_type ?? "Document")}</small>}</div><div className="document-meta"><Status value={String(row.file_format ?? row.doc_type ?? "file")}/><small>{String(row.uploaded_at ?? row.created_at ?? "")}</small></div></article>)}</div> : <Empty/>}</article>;
  if (tab === "reports") return <article className="data-panel reports-workspace">{header}<div className="report-hero"><div><p>Construction intelligence</p><h3>Progress and control reporting</h3><span>Export auditable project evidence or review reporting periods below.</span></div><div><strong>{rows.length}</strong><small>reporting periods</small></div></div><div className="report-cards"><button onClick={() => downloadReport("boq")}><span>▤</span><strong>Bill of quantities</strong><small>Commercial baseline and item status</small></button><button onClick={() => downloadReport("cost")}><span>◈</span><strong>Cost report</strong><small>Budget, commitments and exposure</small></button><button onClick={() => downloadReport("milestones")}><span>◷</span><strong>Progress evidence</strong><small>Verified milestone submissions</small></button></div><Table cols={cols} rows={rows}/></article>;
  if (tab === "notifications" || tab === "chat") return <article className="data-panel collaboration-workspace">{header}<div className="collaboration-layout"><div className="collaboration-feed">{rows.length ? rows.map((row,index) => <article key={String(row.id ?? index)}><span className="feed-avatar">{String(row.sender_name ?? row.type ?? "CE").slice(0,2).toUpperCase()}</span><div><p>{String(row.sender_name ?? row.title ?? "System notification")}</p><strong>{String(row.body ?? "No message body")}</strong><small>{String(row.channel ?? row.created_at ?? "")}</small></div>{tab === "notifications" && <Status value={row.read_at ? "read" : "unread"}/>}</article>) : <Empty/>}</div><aside><h3>Team collaboration</h3><p>Messages and notifications remain connected to the active organization and project evidence.</p><span><b>{rows.length}</b> visible records</span><span><b>{rows.filter(row => !row.read_at).length}</b> requiring attention</span></aside></div></article>;
  return <article className="data-panel">{header}<Table cols={cols} rows={rows} tab={tab} onAction={onAction}/></article>;
}

function WorkspaceStat({ label, value, tone }: { label: string; value: string | number; tone: "blue" | "red" | "amber" | "green" }) { return <span className={`workspace-stat ${tone}`}><small>{label}</small><strong>{value}</strong><i/></span>; }

function Kpi({ label, value, note, onClick }: { label: string; value: string; note: string; onClick: () => void }) { return <button className="kpi-card" onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{note}</small><i>Open register →</i></button>; }
function PanelTitle({ title, onClick }: { title: string; onClick: () => void }) { return <header className="panel-title"><h2>{title}</h2><button onClick={onClick}>View all →</button></header>; }
function Status({ value }: { value: string }) { return <span className={`data-status status-${value}`}>{value.replaceAll("_", " ")}</span>; }
function Empty() { return <div className="empty-state">No records requiring attention.</div>; }
function Table({ cols, rows, tab, onAction }: { cols: { key: string; label: string; kind?: "money" | "status" | "progress" }[]; rows: Row[]; tab?: Tab; onAction?: (row: Row, action: string) => void }) {
  const controlled = tab && ["variations", "requisitions", "disbursements", "drawdowns", "provisional-sums", "contingency-drawdowns", "advance-payments"].includes(tab);
  return rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{cols.map(col => <th key={col.key}>{col.label}</th>)}{controlled && <th>Actions</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{cols.map(col => <td key={col.key}>{col.kind === "money" ? cash.format(Number(row[col.key] ?? 0)) : col.kind === "status" ? <Status value={String(row[col.key] ?? "unknown")}/> : col.kind === "progress" ? <span className="progress-cell"><i style={{width:`${Math.min(100, Number(row[col.key] ?? 0))}%`}}/><b>{Number(row[col.key] ?? 0)}%</b></span> : typeof row[col.key] === "boolean" ? (row[col.key] ? "Yes" : "No") : Array.isArray(row[col.key]) ? (row[col.key] as string[]).join(", ") : String(row[col.key] ?? "—")}</td>)}{controlled && <td><WorkflowButtons tab={tab} row={row} act={actionName => onAction?.(row, actionName)}/></td>}</tr>)}</tbody></table></div> : <Empty/>;
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
