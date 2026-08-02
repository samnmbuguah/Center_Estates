"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { facilityNav } from "@/lib/module-nav";

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
  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const canWork = can("facility.work") || can("facility.manage");
  const canInspect = can("facility.inspect") || can("facility.manage");
  const canAdminister = can("facility.administer") || can("facility.manage");
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

  async function runAction(row: Row, action: string) {
    await apiFetch("/auth/csrf/"); let path = ""; let payload: Record<string, string | number | boolean> = {};
    if (tab === "planned-maintenance") path = `/facility/planned-maintenance/${row.id}/${action}/`;
    if (tab === "service-requests") {
      path = `/facility/service-requests/${row.id}/${action}/`;
      if (action === "resolve") payload.satisfaction_score = Number(window.prompt("Satisfaction score (1-5):") ?? 0);
    }
    if (tab === "inspections") {
      path = `/facility/inspections/${row.id}/complete/`;
      const score = window.prompt("Inspection score (0-100):")?.trim(); if (!score) return;
      const violations = Number(window.prompt("Number of violations:") ?? 0);
      const findings = violations ? window.prompt("Record the inspection findings:")?.trim() : "";
      if (violations && !findings) return;
      payload = { score, violations, findings: findings ?? "", create_work_order: true };
    }
    const response = await apiFetch(path, { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) }, organizationId);
    if (!response.ok) { setError("The facility workflow action could not be completed."); return; }
    await load();
  }

  const kpi = dashboard?.kpis;
  const activeColumns = useMemo(() => tab === "overview" ? [] : columns[tab], [tab]);
  const openWorkOrders = Number(kpi?.openWorkOrders ?? 0);
  const overdueWorkOrders = Number(kpi?.overdueWorkOrders ?? 0);
  const compliance = Number(kpi?.maintenanceCompliance ?? 0);
  const requestSummary = dashboard?.requestSummary ?? [];
  const assetCategories = dashboard?.assetCategories ?? [];
  const totalAssets = assetCategories.reduce((sum, item) => sum + item.count, 0) || Number(kpi?.activeAssets ?? 0);
  const selectFacilityTab = (item: string) => { setSearch(""); setRows([]); setTab(item as Tab); };
  return (
    <ModuleShell
      moduleKey="facility"
      moduleName="Facility Management"
      eyebrow="Operations center"
      title="Facility Management"
      subtitle="Assets, maintenance, compliance, services and utility performance."
      accent="#16a34a"
      groups={facilityNav}
      activeId={tab}
      onSelect={selectFacilityTab}
      contextLabel="Section"
      contextValue={labels[tab]}
      actions={canWork ? <button className="primary-action" onClick={() => setShowCreate(true)}>+ New work order</button> : null}
    >
    <div className="property-app facility-app">
    {error && <div className="form-error">{error}<button onClick={load}>Retry</button></div>}
    {loading ? <div className="data-loading">Loading facility operations…</div> : tab === "overview" && kpi ? <>
      <section className="kpi-grid facility-kpis">
        <button className="icon-kpi" onClick={() => setTab("assets")}><span style={{background:"#e0e7ff",color:"#4f46e5"}}>🏢</span><div><small>Total Buildings</small><strong>{String(kpi.buildings)}</strong><b>Active locations</b></div></button>
        <button className="icon-kpi" onClick={() => setTab("assets")}><span style={{background:"#dcfce7",color:"#16a34a"}}>✓</span><div><small>Active Assets</small><strong>{String(kpi.activeAssets)}</strong><b>{money.format(Number(kpi.assetValue))} portfolio value</b></div></button>
        <button className="icon-kpi" onClick={() => setTab("work-orders")}><span style={{background:"#dbeafe",color:"#2563eb"}}>🔧</span><div><small>Open Work Orders</small><strong>{String(kpi.openWorkOrders)}</strong><b>{kpi.overdueWorkOrders} urgent / overdue</b></div></button>
        <button className="icon-kpi" onClick={() => setTab("planned-maintenance")}><span style={{background:"#ffedd5",color:"#ea580c"}}>📋</span><div><small>Preventive Maintenance</small><strong>{compliance}%</strong><b>Schedule compliance</b></div></button>
        <button className="icon-kpi" onClick={() => setTab("meters")}><span style={{background:"#e0f2fe",color:"#0284c7"}}>⚡</span><div><small>Energy Usage</small><strong>{Number(kpi.utilityConsumption).toLocaleString()} kWh</strong><b>{money.format(Number(kpi.utilityCost))} YTD</b></div></button>
      </section>
      <section className="facility-dashboard-grid">
        <div>
          <article className="data-panel">
            <PanelTitle title="Work Orders Overview" action={() => setTab("work-orders")} />
            <div className="donut-panel">
              <div className="donut" style={{background:`conic-gradient(#ef4444 0% ${openWorkOrders ? Math.min(100, overdueWorkOrders / Math.max(openWorkOrders,1) * 100) : 0}%, #3b82f6 ${openWorkOrders ? Math.min(100, overdueWorkOrders / Math.max(openWorkOrders,1) * 100) : 0}% 70%, #f59e0b 70% 88%, #22c55e 88% 100%)`}}>
                <strong>{openWorkOrders}</strong>
                <small>Total open</small>
              </div>
              <div className="donut-legend">
                <span><i style={{background:"#ef4444"}}/>Overdue <b>{overdueWorkOrders}</b></span>
                <span><i style={{background:"#3b82f6"}}/>In progress <b>{Math.max(openWorkOrders - overdueWorkOrders, 0)}</b></span>
                <span><i style={{background:"#f59e0b"}}/>Pending review</span>
                <span><i style={{background:"#22c55e"}}/>Completed today</span>
              </div>
            </div>
            <SimpleTable columns={columns["work-orders"].slice(0, 5)} rows={dashboard.recentWorkOrders} />
          </article>
          <div className="facility-charts-row">
            <article className="data-panel">
              <PanelTitle title="Assets by Category" action={() => setTab("assets")} />
              <div className="asset-category-list">
                {assetCategories.length ? assetCategories.map((item) => (
                  <div key={item.category}>
                    <span><small>{item.category || "Other"}</small><b>{item.count}</b></span>
                    <i><b style={{width:`${totalAssets ? (item.count / totalAssets) * 100 : 0}%`}}/></i>
                  </div>
                )) : <Empty />}
              </div>
            </article>
            <article className="data-panel">
              <PanelTitle title="Maintenance Compliance" action={() => setTab("planned-maintenance")} />
              <div className="compliance-gauge">
                <div className="donut" style={{background:`conic-gradient(#22c55e 0% ${Math.min(100, compliance)}%, #e5e7eb ${Math.min(100, compliance)}% 100%)`}}>
                  <strong>{compliance}%</strong>
                  <small>On track</small>
                </div>
                <p>Target 90% · Preventive schedule completion</p>
              </div>
            </article>
            <article className="data-panel">
              <PanelTitle title="Service Requests" action={() => setTab("service-requests")} />
              <div className="service-request-stats">
                <div><small>Open requests</small><b>{String(kpi.openRequests)}</b></div>
                {requestSummary.map((item) => <div key={item.status}><small>{item.status.replaceAll("_"," ")}</small><b>{item.count}</b></div>)}
              </div>
            </article>
          </div>
        </div>
        <div className="facility-side-stack">
          <article className="data-panel"><PanelTitle title="Critical Alerts" action={() => setTab("work-orders")} />{dashboard.urgentWorkOrders.length ? dashboard.urgentWorkOrders.map((row) => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("work-orders")}><span><strong>{row.title}</strong><small>{row.number} · {row.property_name}</small></span><Status value={String(row.priority)} /></button>) : <Empty />}</article>
          <article className="data-panel"><PanelTitle title="Maintenance due" action={() => setTab("planned-maintenance")} />{dashboard.dueMaintenance.length ? dashboard.dueMaintenance.map((row) => <button className="invoice-alert" key={String(row.id)} onClick={() => setTab("planned-maintenance")}><span><strong>{row.name}</strong><small>{row.asset_name}</small></span><b>{row.next_due_on}</b></button>) : <Empty />}</article>
          <article className="quick-actions-card">
            <header><h3>Quick Actions</h3></header>
            {canWork && <button onClick={() => setShowCreate(true)}><span style={{background:"#fee2e2"}}>＋</span>New Work Order</button>}
            <button onClick={() => setTab("service-requests")}><span style={{background:"#dbeafe"}}>📨</span>Service Requests</button>
            <button onClick={() => setTab("planned-maintenance")}><span style={{background:"#ffedd5"}}>📅</span>Schedule Maintenance</button>
            <button onClick={() => setTab("assets")}><span style={{background:"#dcfce7"}}>▣</span>Add / View Assets</button>
            <button onClick={() => setTab("contractors")}><span style={{background:"#ede9fe"}}>👷</span>Vendors & Contractors</button>
          </article>
        </div>
      </section>
      <section className="summary-strip"><span><b>{kpi.buildings}</b> Buildings</span><span><b>{kpi.openRequests}</b> Open service requests</span><span><b>{kpi.contractors}</b> Active contractors</span>{dashboard.assetCategories.slice(0,3).map((item) => <span key={item.category}><b>{item.count}</b> {item.category} assets</span>)}</section>
    </> : <article className="data-panel collection-panel"><header className="collection-title"><div><p className="eyebrow">Operations register</p><h2>{labels[tab]}</h2></div><input value={search} onChange={(e) => setSearch(e.target.value)} aria-label={`Search ${labels[tab]}`} placeholder="Search records…" /></header><SimpleTable columns={activeColumns} rows={rows} tab={tab} onAction={runAction} permissions={{canWork,canInspect,canAdminister}} /></article>}
    {showCreate && <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}><div className="form-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">Corrective maintenance</p><h2>New work order</h2></div><button onClick={() => setShowCreate(false)}>×</button></div><form onSubmit={createWorkOrder}><div className="form-row"><label>Work order number<input name="number" required placeholder="WO-2026-1790" /></label><label>Priority<select name="priority" defaultValue="medium"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label></div><label>Issue title<input name="title" required placeholder="Describe the maintenance issue" /></label><div className="form-row"><label>Category<input name="category" required placeholder="Mechanical" /></label><label>Property<select name="property" required defaultValue=""><option value="" disabled>Select property</option>{properties.map((row) => <option key={String(row.id)} value={String(row.id)}>{row.name}</option>)}</select></label></div><label>Description<textarea name="description" rows={4} /></label><input type="hidden" name="status" value="open" /><div className="form-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-action">Create work order</button></div></form></div></div>}
    </div>
    </ModuleShell>
  );
}
function PanelTitle({title,action}:{title:string;action:()=>void}) { return <header className="panel-title"><h2>{title}</h2><button onClick={action}>View all →</button></header> }
function Status({value}:{value:string}) { return <span className={`data-status status-${value}`}>{value.replaceAll("_"," ")}</span> }
function Empty() { return <div className="empty-state">Nothing requiring attention.</div> }
function SimpleTable({columns,rows,tab,onAction,permissions}:{columns:{key:string;label:string;format?:"money"|"status"}[];rows:Row[];tab?:Tab;onAction?:(row:Row,action:string)=>void;permissions?:{canWork:boolean;canInspect:boolean;canAdminister:boolean}}) { const controlled=tab&&["planned-maintenance","inspections","service-requests"].includes(tab); return rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map((c)=><th key={c.key}>{c.label}</th>)}{controlled&&<th>Actions</th>}</tr></thead><tbody>{rows.map((row,index)=><tr key={String(row.id??index)}>{columns.map((c)=><td key={c.key}>{c.format === "money" ? money.format(Number(row[c.key])) : c.format === "status" ? <Status value={String(row[c.key])} /> : typeof row[c.key] === "boolean" ? (row[c.key] ? "Yes" : "No") : String(row[c.key] ?? "—")}{c.key === "progress" ? "%" : ""}</td>)}{controlled&&<td><FacilityActions tab={tab} row={row} act={(action)=>onAction?.(row,action)} permissions={permissions}/></td>}</tr>)}</tbody></table></div> : <Empty/> }
function FacilityActions({tab,row,act,permissions}:{tab:Tab;row:Row;act:(action:string)=>void;permissions?:{canWork:boolean;canInspect:boolean;canAdminister:boolean}}) { let actions:[string,string][]=[]; if(tab==="planned-maintenance"&&permissions?.canAdminister&&row.is_active)actions=[["generate-work-order","Generate work order"],["complete","Mark complete"]]; if(tab==="inspections"&&permissions?.canInspect&&["scheduled","in_progress"].includes(String(row.status)))actions=[["complete","Complete inspection"]]; if(tab==="service-requests"&&permissions?.canWork&&!row.work_order)actions=[["convert","Create work order"]]; else if(tab==="service-requests"&&permissions?.canWork&&["assigned","in_progress"].includes(String(row.status)))actions=[["resolve","Resolve"]]; return actions.length?<div className="table-actions">{actions.map(([key,label])=><button key={key} onClick={()=>act(key)}>{label}</button>)}</div>:<span>—</span> }
