"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

  const selectedColumns = useMemo(() => tab === "overview" ? [] : columns[tab], [tab]);
  const kpis = dashboard?.kpis;
  return <div className="page-wrap property-app monitoring-app">
    <section className="property-heading"><div><p className="eyebrow">Construction management</p><h1>Project monitoring</h1><p>Verified field evidence, programme, quality, commercial control and close-out.</p></div><button className="primary-action" onClick={() => setModal(true)}>+ Project workspace</button></section>
    <nav className="module-tabs" aria-label="Construction sections">{(Object.keys(labels) as Tab[]).map(item => <button className={tab === item ? "active" : ""} key={item} onClick={() => { setRows([]); setSearch(""); setTab(item); }}>{labels[item]}</button>)}</nav>
    {error && <div className="form-error">{error}<button onClick={load}>Retry</button></div>}
    {loading ? <div className="data-loading">Loading verified construction records…</div> : tab === "overview" && dashboard && kpis ? <>
      <section className="kpi-grid"><Kpi label="Active projects" value={String(kpis.activeProjects)} note={`${kpis.portfolioProjects} workspaces`} onClick={() => setTab("projects")}/><Kpi label="Open site issues" value={String(kpis.openTickets)} note="Tracked through resolution" onClick={() => setTab("tickets")}/><Kpi label="High exposure risks" value={String(kpis.highRisks)} note="Likelihood × impact ≥ 16" onClick={() => setTab("risks")}/><Kpi label="Approved variations" value={cash.format(Number(kpis.approvedVariations))} note={`${kpis.submittedMilestones} progress submissions`} onClick={() => setTab("variations")}/><Kpi label="Certified value" value={cash.format(Number(kpis.certifiedValue))} note="Current non-void certificates" onClick={() => setTab("certificates")}/><Kpi label="Paid to date" value={cash.format(Number(kpis.paidValue))} note={`${kpis.budgetUtilization}% budget utilized`} onClick={() => setTab("disbursements")}/></section>
      <section className="dashboard-columns"><article className="data-panel"><PanelTitle title="Active construction portfolio" onClick={() => setTab("projects")}/><Table cols={columns.projects} rows={dashboard.projects}/></article><div className="facility-side-stack"><article className="data-panel"><PanelTitle title="Issues requiring action" onClick={() => setTab("tickets")}/>{dashboard.recentTickets.length ? dashboard.recentTickets.map(row => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("tickets")}><span><strong>{String(row.title)}</strong><small>{String(row.due_date || "No due date")} · escalation {String(row.escalation_level)}</small></span><Status value={String(row.priority)}/></button>) : <Empty/>}</article><article className="data-panel"><PanelTitle title="Risk watchlist" onClick={() => setTab("risks")}/>{dashboard.topRisks.length ? dashboard.topRisks.map(row => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("risks")}><span><strong>{String(row.reference || "Risk")}</strong><small>{String(row.description)}</small></span><b>{Number(row.likelihood) * Number(row.impact)}</b></button>) : <Empty/>}</article></div></section>
      <section className="summary-strip">{dashboard.projectStages.map(item => <button key={item.stage} onClick={() => setTab("projects")}><b>{item.count}</b>{item.stage.replaceAll("_", " ")}</button>)}</section>
    </> : <article className="data-panel"><header className="collection-title"><div><p className="eyebrow">Organization-scoped live register</p><h2>{labels[tab]}</h2></div><div className="collection-actions">{tab === "notifications" && <button className="secondary-action" onClick={markAllNotificationsRead}>Mark all read</button>}<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records…"/></div></header><Table cols={selectedColumns} rows={rows} tab={tab} onAction={runFinanceAction}/></article>}
    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><div className="form-modal" onMouseDown={event => event.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">Unified hierarchy</p><h2>Create construction workspace</h2></div><button onClick={() => setModal(false)}>×</button></div><form onSubmit={createProject}><label>Shared portfolio project<select required name="portfolio_project" defaultValue=""><option disabled value="">Select project</option>{portfolioProjects.map(project => <option key={String(project.id)} value={String(project.id)}>{project.code} — {project.name}</option>)}</select></label><div className="form-row"><label>Construction code<input required name="code"/></label><label>Stage<select name="stage" defaultValue="planning"><option value="planning">Planning</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="complete">Complete</option></select></label></div><label>Workspace name<input required name="name"/></label><div className="form-row"><label>Client<input name="client_name"/></label><label>Location<input name="location"/></label></div><label>Description<textarea name="description" rows={3}/></label><div className="form-actions"><button type="button" onClick={() => setModal(false)}>Cancel</button><button className="primary-action">Create workspace</button></div></form></div></div>}
  </div>;
}

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
