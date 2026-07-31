"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type Tab = "overview" | "assets" | "work-orders" | "work-order-events" | "work-order-cost-items" | "work-order-attachments" | "planned-maintenance" | "inspections" | "service-requests" | "meters" | "contractors";
type Row = Record<string, string | number | boolean | null>;
type Dashboard = { kpis: Record<string, string | number>; recentWorkOrders: Row[]; urgentWorkOrders: Row[]; requestSummary: {status:string;count:number}[]; assetCategories:{category:string;count:number}[]; dueMaintenance:Row[] };
const labels: Record<Tab, string> = { overview: "Dashboard", assets: "Assets", "work-orders": "Work orders", "work-order-events": "Work history", "work-order-cost-items": "Labor & parts", "work-order-attachments": "Work media", "planned-maintenance": "Planned maintenance", inspections: "Inspections", "service-requests": "Service requests", meters: "Utilities", contractors: "Contractors" };
const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

const columns: Record<Exclude<Tab, "overview">, { key: string; label: string; format?: "money" | "status" }[]> = {
  assets: [{key:"code",label:"Asset ID"},{key:"name",label:"Asset"},{key:"category",label:"Category"},{key:"property_name",label:"Location"},{key:"condition",label:"Condition",format:"status"},{key:"purchase_value",label:"Value",format:"money"}],
  "work-orders": [{key:"number",label:"Work order"},{key:"title",label:"Issue"},{key:"property_name",label:"Property"},{key:"priority",label:"Priority",format:"status"},{key:"status",label:"Status",format:"status"},{key:"progress",label:"Progress"},{key:"total_cost",label:"Cost",format:"money"}],
  "work-order-events": [{key:"created_at",label:"Time"},{key:"work_order",label:"Work order ID"},{key:"event_type",label:"Event",format:"status"},{key:"from_status",label:"From",format:"status"},{key:"to_status",label:"To",format:"status"},{key:"actor_name",label:"Actor"},{key:"notes",label:"Notes"}],
  "work-order-cost-items": [{key:"work_order",label:"Work order ID"},{key:"kind",label:"Type",format:"status"},{key:"description",label:"Item"},{key:"quantity",label:"Quantity"},{key:"unit_cost",label:"Unit cost",format:"money"},{key:"total",label:"Total",format:"money"},{key:"supplier",label:"Supplier"}],
  "work-order-attachments": [{key:"work_order",label:"Work order ID"},{key:"file_name",label:"File"},{key:"media_type",label:"Type"},{key:"caption",label:"Caption"},{key:"uploaded_by_name",label:"Uploaded by"},{key:"created_at",label:"Uploaded"}],
  "planned-maintenance": [{key:"code",label:"Schedule"},{key:"name",label:"Maintenance"},{key:"asset_name",label:"Asset"},{key:"frequency",label:"Frequency"},{key:"next_due_on",label:"Next due"},{key:"is_active",label:"Active"}],
  inspections: [{key:"reference",label:"Reference"},{key:"title",label:"Inspection"},{key:"property_name",label:"Property"},{key:"scheduled_on",label:"Scheduled"},{key:"score",label:"Score"},{key:"violations",label:"Findings"},{key:"status",label:"Status",format:"status"}],
  "service-requests": [{key:"reference",label:"Request"},{key:"subject",label:"Subject"},{key:"tenant_name",label:"Requester"},{key:"property_name",label:"Property"},{key:"priority",label:"Priority",format:"status"},{key:"status",label:"Status",format:"status"},{key:"submitted_at",label:"Submitted"}],
  meters: [{key:"code",label:"Meter"},{key:"name",label:"Description"},{key:"property_name",label:"Property"},{key:"utility_type",label:"Utility",format:"status"},{key:"unit",label:"Unit"},{key:"tariff",label:"Tariff"}],
  contractors: [{key:"code",label:"Vendor ID"},{key:"name",label:"Contractor"},{key:"specialty",label:"Specialty"},{key:"contact_name",label:"Contact"},{key:"rating",label:"Rating"},{key:"insurance_expires_on",label:"Insurance expiry"},{key:"status",label:"Status",format:"status"}],
};

export default function FacilityPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [properties, setProperties] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    const path = tab === "overview" ? "/facility/dashboard/" : `/facility/${tab}/?search=${encodeURIComponent(search)}`;
    const response = await apiFetch(path, {}, organizationId);
    if (!response.ok) { setError("Facility data could not be loaded. Please retry."); setLoading(false); return; }
    const data = await response.json();
    if (tab === "overview") setDashboard(data); else setRows(data);
    setLoading(false);
  }, [organizationId, search, tab]);

  useEffect(() => { const timer = setTimeout(load, search ? 250 : 0); return () => clearTimeout(timer); }, [load, search]);
  useEffect(() => { if (showCreate && organizationId) apiFetch("/property/properties/", {}, organizationId).then((r) => r.ok ? r.json() : []).then(setProperties); }, [showCreate, organizationId]);

  async function createWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/work-orders/", { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), reported_at: new Date().toISOString(), progress: 0 }) }, organizationId);
    if (!response.ok) { setError("The work order could not be created. Check its number and required fields."); return; }
    setShowCreate(false); setTab("work-orders");
  }

  const kpi = dashboard?.kpis;
  const activeColumns = useMemo(() => tab === "overview" ? [] : columns[tab], [tab]);
  return <div className="page-wrap property-app">
    <section className="property-heading"><div><p className="eyebrow">Operations center</p><h1>Facility Management</h1><p>Assets, maintenance, compliance, services and utility performance.</p></div><button className="primary-action" onClick={() => setShowCreate(true)}>+ New work order</button></section>
    <nav className="module-tabs" aria-label="Facility sections">{(Object.keys(labels) as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => {setSearch("");setRows([]);setTab(item)}}>{labels[item]}</button>)}</nav>
    {error && <div className="form-error">{error}<button onClick={load}>Retry</button></div>}
    {loading ? <div className="data-loading">Loading facility operations…</div> : tab === "overview" && kpi ? <>
      <section className="kpi-grid facility-kpis">
        <Kpi label="Active assets" value={String(kpi.activeAssets)} note={`${money.format(Number(kpi.assetValue))} portfolio value`} action={() => setTab("assets")} />
        <Kpi label="Open work orders" value={String(kpi.openWorkOrders)} note={`${kpi.overdueWorkOrders} overdue`} action={() => setTab("work-orders")} warning />
        <Kpi label="PM compliance" value={`${kpi.maintenanceCompliance}%`} note="Preventive schedule completion" action={() => setTab("planned-maintenance")} />
        <Kpi label="Energy & utilities" value={`${Number(kpi.utilityConsumption).toLocaleString()} kWh`} note={`${money.format(Number(kpi.utilityCost))} YTD`} action={() => setTab("meters")} />
      </section>
      <section className="dashboard-columns">
        <article className="data-panel"><PanelTitle title="Recent work orders" action={() => setTab("work-orders")} />
          <SimpleTable columns={columns["work-orders"].slice(0, 6)} rows={dashboard.recentWorkOrders} />
        </article>
        <div className="facility-side-stack">
          <article className="data-panel"><PanelTitle title="Critical alerts" action={() => setTab("work-orders")} />{dashboard.urgentWorkOrders.length ? dashboard.urgentWorkOrders.map((row) => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("work-orders")}><span><strong>{row.title}</strong><small>{row.number} · {row.property_name}</small></span><Status value={String(row.priority)} /></button>) : <Empty />}</article>
          <article className="data-panel"><PanelTitle title="Maintenance due" action={() => setTab("planned-maintenance")} />{dashboard.dueMaintenance.length ? dashboard.dueMaintenance.map((row) => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("planned-maintenance")}><span><strong>{row.name}</strong><small>{row.asset_name}</small></span><b>{row.next_due_on}</b></button>) : <Empty />}</article>
        </div>
      </section>
      <section className="summary-strip"><span><b>{kpi.buildings}</b> Buildings</span><span><b>{kpi.openRequests}</b> Open service requests</span><span><b>{kpi.contractors}</b> Active contractors</span>{dashboard.assetCategories.slice(0,3).map((item) => <span key={item.category}><b>{item.count}</b> {item.category} assets</span>)}</section>
    </> : <article className="data-panel collection-panel"><header className="collection-title"><div><p className="eyebrow">Operations register</p><h2>{labels[tab]}</h2></div><input value={search} onChange={(e) => setSearch(e.target.value)} aria-label={`Search ${labels[tab]}`} placeholder="Search records…" /></header><SimpleTable columns={activeColumns} rows={rows} /></article>}
    {showCreate && <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}><div className="form-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">Corrective maintenance</p><h2>New work order</h2></div><button onClick={() => setShowCreate(false)}>×</button></div><form onSubmit={createWorkOrder}><div className="form-row"><label>Work order number<input name="number" required placeholder="WO-2026-1790" /></label><label>Priority<select name="priority" defaultValue="medium"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label></div><label>Issue title<input name="title" required placeholder="Describe the maintenance issue" /></label><div className="form-row"><label>Category<input name="category" required placeholder="Mechanical" /></label><label>Property<select name="property" required defaultValue=""><option value="" disabled>Select property</option>{properties.map((row) => <option key={String(row.id)} value={String(row.id)}>{row.name}</option>)}</select></label></div><label>Description<textarea name="description" rows={4} /></label><input type="hidden" name="status" value="open" /><div className="form-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-action">Create work order</button></div></form></div></div>}
  </div>;
}

function Kpi({label,value,note,action,warning=false}:{label:string;value:string;note:string;action:()=>void;warning?:boolean}) { return <button className={`kpi-card ${warning?"warning":""}`} onClick={action}><span>{label}</span><strong>{value}</strong><small>{note}</small><i>Open register →</i></button> }
function PanelTitle({title,action}:{title:string;action:()=>void}) { return <header className="panel-title"><h2>{title}</h2><button onClick={action}>View all →</button></header> }
function Status({value}:{value:string}) { return <span className={`data-status status-${value}`}>{value.replaceAll("_"," ")}</span> }
function Empty() { return <div className="empty-state">Nothing requiring attention.</div> }
function SimpleTable({columns,rows}:{columns:{key:string;label:string;format?:"money"|"status"}[];rows:Row[]}) { return rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map((c)=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={String(row.id??index)}>{columns.map((c)=><td key={c.key}>{c.format === "money" ? money.format(Number(row[c.key])) : c.format === "status" ? <Status value={String(row[c.key])} /> : typeof row[c.key] === "boolean" ? (row[c.key] ? "Yes" : "No") : String(row[c.key] ?? "—")}{c.key === "progress" ? "%" : ""}</td>)}</tr>)}</tbody></table></div> : <Empty/> }
