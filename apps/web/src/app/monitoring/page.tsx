"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type Row = Record<string, string | number | boolean | null | string[]>;
type Tab = "overview" | "projects" | "milestones" | "daily-logs" | "risks" | "tickets" | "work-plan" | "boq" | "variations" | "quality-tests" | "rfis" | "safety-incidents" | "calendar" | "documents" | "approvals";
type Dashboard = {
  kpis: Record<string, string | number>;
  projects: Row[];
  projectStages: { stage: string; count: number }[];
  recentTickets: Row[];
  topRisks: Row[];
};

const labels: Record<Tab, string> = {
  overview: "Command center", projects: "Projects", milestones: "Progress",
  "daily-logs": "Daily logs", risks: "Risks", tickets: "Issues",
  "work-plan": "Programme", boq: "BoQ & cost", variations: "Variations",
  "quality-tests": "Quality", rfis: "RFIs", "safety-incidents": "Safety",
  calendar: "Calendar", documents: "Documents", approvals: "Approvals",
};
const columns: Record<Exclude<Tab, "overview">, { key: string; label: string; kind?: "money" | "status" | "progress" }[]> = {
  projects: [{key:"code",label:"Project"},{key:"name",label:"Name"},{key:"client_name",label:"Client"},{key:"location",label:"Location"},{key:"stage",label:"Stage",kind:"status"},{key:"budget",label:"Budget",kind:"money"},{key:"planned_completion_date",label:"Completion"}],
  milestones: [{key:"milestone_id",label:"Milestone"},{key:"project_id",label:"Project"},{key:"percent_complete",label:"Progress",kind:"progress"},{key:"required_certifying_role",label:"Certifier"},{key:"payment_value",label:"Value",kind:"money"},{key:"submitted_at",label:"Submitted"}],
  "daily-logs": [{key:"log_date",label:"Date"},{key:"project_id",label:"Project"},{key:"weather",label:"Weather"},{key:"labour_count",label:"Labour"},{key:"notes",label:"Site notes"},{key:"verified_at",label:"Verified"}],
  risks: [{key:"reference",label:"Risk"},{key:"description",label:"Description"},{key:"category",label:"Category"},{key:"likelihood",label:"Likelihood"},{key:"impact",label:"Impact"},{key:"mitigation",label:"Mitigation"},{key:"status",label:"Status",kind:"status"}],
  tickets: [{key:"title",label:"Issue"},{key:"priority",label:"Priority",kind:"status"},{key:"risk_level",label:"Risk",kind:"status"},{key:"due_date",label:"Due"},{key:"escalation_level",label:"Escalation"},{key:"status",label:"Status",kind:"status"}],
  "work-plan": [{key:"task_id",label:"WBS"},{key:"task_name",label:"Task"},{key:"responsible_party",label:"Owner"},{key:"start_date",label:"Start"},{key:"end_date",label:"Finish"},{key:"percent_complete",label:"Progress",kind:"progress"},{key:"status",label:"Status",kind:"status"}],
  boq: [{key:"section",label:"Section"},{key:"item_number",label:"Item"},{key:"description",label:"Description"},{key:"unit",label:"Unit"},{key:"quantity",label:"Qty"},{key:"rate",label:"Rate",kind:"money"},{key:"amount",label:"Amount",kind:"money"},{key:"cost_state",label:"State",kind:"status"}],
  variations: [{key:"variation_number",label:"Variation"},{key:"description",label:"Description"},{key:"variation_type",label:"Type"},{key:"amount",label:"Amount",kind:"money"},{key:"justification",label:"Justification"},{key:"status",label:"Status",kind:"status"}],
  "quality-tests": [{key:"sample_id",label:"Sample"},{key:"test_type",label:"Test"},{key:"location",label:"Location"},{key:"test_date",label:"Date"},{key:"result_value",label:"Result"},{key:"passed",label:"Passed"},{key:"notes",label:"Notes"}],
  rfis: [{key:"number",label:"RFI"},{key:"title",label:"Subject"},{key:"priority",label:"Priority",kind:"status"},{key:"category",label:"Category"},{key:"due_date",label:"Due"},{key:"status",label:"Status",kind:"status"}],
  "safety-incidents": [{key:"incident_date",label:"Date"},{key:"severity",label:"Severity",kind:"status"},{key:"description",label:"Incident"},{key:"action_taken",label:"Action taken"},{key:"verified_at",label:"Verified"}],
  calendar: [{key:"title",label:"Event"},{key:"event_type",label:"Type",kind:"status"},{key:"location",label:"Location"},{key:"start",label:"Start"},{key:"end",label:"End"},{key:"status",label:"Status",kind:"status"}],
  documents: [{key:"title",label:"Document"},{key:"doc_type",label:"Type",kind:"status"},{key:"discipline",label:"Discipline"},{key:"created_at",label:"Added"}],
  approvals: [{key:"approval_type",label:"Approval"},{key:"authority",label:"Authority"},{key:"reference",label:"Reference"},{key:"issue_date",label:"Issued"},{key:"status",label:"Status",kind:"status"}],
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

  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true); setError("");
    const path = tab === "overview" ? "/construction/dashboard/" : `/construction/${tab}/?search=${encodeURIComponent(search)}`;
    const response = await apiFetch(path, {}, organization);
    if (!response.ok) { setError("Construction monitoring data could not be loaded."); setLoading(false); return; }
    const data = await response.json();
    if (tab === "overview") setDashboard(data); else setRows(data);
    setLoading(false);
  }, [organization, search, tab]);
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

  const selectedColumns = useMemo(() => tab === "overview" ? [] : columns[tab], [tab]);
  const kpis = dashboard?.kpis;
  return <div className="page-wrap property-app monitoring-app">
    <section className="property-heading"><div><p className="eyebrow">Construction management</p><h1>Project monitoring</h1><p>Verified field evidence, programme, quality, commercial control and close-out.</p></div><button className="primary-action" onClick={() => setModal(true)}>+ Project workspace</button></section>
    <nav className="module-tabs" aria-label="Construction sections">{(Object.keys(labels) as Tab[]).map(item => <button className={tab === item ? "active" : ""} key={item} onClick={() => { setSearch(""); setTab(item); }}>{labels[item]}</button>)}</nav>
    {error && <div className="form-error">{error}<button onClick={load}>Retry</button></div>}
    {loading ? <div className="data-loading">Loading verified construction records…</div> : tab === "overview" && dashboard && kpis ? <>
      <section className="kpi-grid"><Kpi label="Active projects" value={String(kpis.activeProjects)} note={`${kpis.portfolioProjects} workspaces`} onClick={() => setTab("projects")}/><Kpi label="Open site issues" value={String(kpis.openTickets)} note="Tracked through resolution" onClick={() => setTab("tickets")}/><Kpi label="High exposure risks" value={String(kpis.highRisks)} note="Likelihood × impact ≥ 16" onClick={() => setTab("risks")}/><Kpi label="Approved variations" value={cash.format(Number(kpis.approvedVariations))} note={`${kpis.submittedMilestones} progress submissions`} onClick={() => setTab("variations")}/></section>
      <section className="dashboard-columns"><article className="data-panel"><PanelTitle title="Active construction portfolio" onClick={() => setTab("projects")}/><Table cols={columns.projects} rows={dashboard.projects}/></article><div className="facility-side-stack"><article className="data-panel"><PanelTitle title="Issues requiring action" onClick={() => setTab("tickets")}/>{dashboard.recentTickets.length ? dashboard.recentTickets.map(row => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("tickets")}><span><strong>{String(row.title)}</strong><small>{String(row.due_date || "No due date")} · escalation {String(row.escalation_level)}</small></span><Status value={String(row.priority)}/></button>) : <Empty/>}</article><article className="data-panel"><PanelTitle title="Risk watchlist" onClick={() => setTab("risks")}/>{dashboard.topRisks.length ? dashboard.topRisks.map(row => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("risks")}><span><strong>{String(row.reference || "Risk")}</strong><small>{String(row.description)}</small></span><b>{Number(row.likelihood) * Number(row.impact)}</b></button>) : <Empty/>}</article></div></section>
      <section className="summary-strip">{dashboard.projectStages.map(item => <button key={item.stage} onClick={() => setTab("projects")}><b>{item.count}</b>{item.stage.replaceAll("_", " ")}</button>)}</section>
    </> : <article className="data-panel"><header className="collection-title"><div><p className="eyebrow">Organization-scoped live register</p><h2>{labels[tab]}</h2></div><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records…"/></header><Table cols={selectedColumns} rows={rows}/></article>}
    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><div className="form-modal" onMouseDown={event => event.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">Unified hierarchy</p><h2>Create construction workspace</h2></div><button onClick={() => setModal(false)}>×</button></div><form onSubmit={createProject}><label>Shared portfolio project<select required name="portfolio_project" defaultValue=""><option disabled value="">Select project</option>{portfolioProjects.map(project => <option key={String(project.id)} value={String(project.id)}>{project.code} — {project.name}</option>)}</select></label><div className="form-row"><label>Construction code<input required name="code"/></label><label>Stage<select name="stage" defaultValue="planning"><option value="planning">Planning</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="complete">Complete</option></select></label></div><label>Workspace name<input required name="name"/></label><div className="form-row"><label>Client<input name="client_name"/></label><label>Location<input name="location"/></label></div><label>Description<textarea name="description" rows={3}/></label><div className="form-actions"><button type="button" onClick={() => setModal(false)}>Cancel</button><button className="primary-action">Create workspace</button></div></form></div></div>}
  </div>;
}

function Kpi({ label, value, note, onClick }: { label: string; value: string; note: string; onClick: () => void }) { return <button className="kpi-card" onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{note}</small><i>Open register →</i></button>; }
function PanelTitle({ title, onClick }: { title: string; onClick: () => void }) { return <header className="panel-title"><h2>{title}</h2><button onClick={onClick}>View all →</button></header>; }
function Status({ value }: { value: string }) { return <span className={`data-status status-${value}`}>{value.replaceAll("_", " ")}</span>; }
function Empty() { return <div className="empty-state">No records requiring attention.</div>; }
function Table({ cols, rows }: { cols: { key: string; label: string; kind?: "money" | "status" | "progress" }[]; rows: Row[] }) {
  return rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{cols.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{cols.map(col => <td key={col.key}>{col.kind === "money" ? cash.format(Number(row[col.key] ?? 0)) : col.kind === "status" ? <Status value={String(row[col.key] ?? "unknown")}/> : col.kind === "progress" ? <span className="progress-cell"><i style={{width:`${Math.min(100, Number(row[col.key] ?? 0))}%`}}/><b>{Number(row[col.key] ?? 0)}%</b></span> : typeof row[col.key] === "boolean" ? (row[col.key] ? "Yes" : "No") : Array.isArray(row[col.key]) ? (row[col.key] as string[]).join(", ") : String(row[col.key] ?? "—")}</td>)}</tr>)}</tbody></table></div> : <Empty/>;
}
