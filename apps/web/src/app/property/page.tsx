"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type Dashboard = {
  kpis: { properties: number; units: number; occupiedUnits: number; occupancyRate: number; activeLeases: number; activeTenants: number; outstanding: string; collectedYtd: string; expensesYtd: string };
  recentLeases: Lease[];
  overdueInvoices: Invoice[];
  propertyMix: { property_type: string; count: number }[];
};
type Property = { id: string; code: string; name: string; property_type: string; city: string; status: string; units_count: number };
type Tenant = { id: string; code: string; name: string; email: string; phone: string; status: string };
type Lease = { id: string; reference: string; tenant_name: string; unit_code: string; property_name: string; starts_on: string; ends_on: string; monthly_rent: string; status: string };
type Invoice = { id: string; number: string; tenant_name: string; due_on: string; amount: string; balance: string; status: string };
type Expense = { id: string; supplier: string; property_name: string; category: string; incurred_on: string; amount: string; status: string };
type Tab = "overview" | "properties" | "tenants" | "leases" | "rent" | "expenses";

const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const labels: Record<Tab, string> = { overview: "Overview", properties: "Properties", tenants: "Tenants", leases: "Leases", rent: "Rent & invoices", expenses: "Expenses" };

export default function PropertyManagementPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<Property[] | Tenant[] | Lease[] | Invoice[] | Expense[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const endpoint = useMemo(() => ({ properties: "properties", tenants: "tenants", leases: "leases", rent: "invoices", expenses: "expenses" } as Partial<Record<Tab, string>>)[tab], [tab]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    const path = tab === "overview" ? "/property/dashboard/" : `/property/${endpoint}/?search=${encodeURIComponent(search)}`;
    const response = await apiFetch(path, {}, organizationId);
    if (!response.ok) { setError("Property data could not be loaded. Please try again."); setLoading(false); return; }
    const data = await response.json();
    if (tab === "overview") setDashboard(data as Dashboard); else setRows(data);
    setLoading(false);
  }, [endpoint, organizationId, search, tab]);

  useEffect(() => { const delay = setTimeout(load, search ? 250 : 0); return () => clearTimeout(delay); }, [load, search]);

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/property/properties/", {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    }, organizationId);
    if (!response.ok) { setError("The property could not be saved. Check the required fields and unique code."); return; }
    setShowCreate(false); setTab("properties"); await load();
  }

  const kpis = dashboard?.kpis;
  return <div className="page-wrap property-app">
    <section className="property-heading">
      <div><p className="eyebrow">Portfolio workspace</p><h1>Property Management</h1><p>Occupancy, leases, rent collections and operating costs in one view.</p></div>
      <button className="primary-action" onClick={() => setShowCreate(true)}>+ Add property</button>
    </section>
    <nav className="module-tabs" aria-label="Property management sections">
      {(Object.keys(labels) as Tab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => { setSearch(""); setTab(item); }}>{labels[item]}</button>)}
    </nav>
    {error && <div className="form-error">{error} <button onClick={load}>Retry</button></div>}
    {loading ? <div className="data-loading">Loading live portfolio data…</div> : tab === "overview" && kpis ? <>
      <section className="kpi-grid">
        <Kpi label="Properties" value={String(kpis.properties)} note={`${kpis.units} total units`} onClick={() => setTab("properties")} />
        <Kpi label="Occupancy" value={`${kpis.occupancyRate}%`} note={`${kpis.occupiedUnits} occupied units`} onClick={() => setTab("leases")} />
        <Kpi label="Active tenants" value={String(kpis.activeTenants)} note={`${kpis.activeLeases} active leases`} onClick={() => setTab("tenants")} />
        <Kpi label="Outstanding rent" value={money.format(Number(kpis.outstanding))} note={`${money.format(Number(kpis.collectedYtd))} collected YTD`} warning onClick={() => setTab("rent")} />
      </section>
      <section className="dashboard-columns">
        <article className="data-panel"><PanelTitle title="Recent leases" action="View leases" onClick={() => setTab("leases")} />
          <DataTable headers={["Reference", "Tenant", "Property / unit", "Monthly rent", "Status"]} rows={dashboard.recentLeases.map((item) => [item.reference, item.tenant_name, `${item.property_name} · ${item.unit_code}`, money.format(Number(item.monthly_rent)), <Status key={item.id} value={item.status} />])} />
        </article>
        <article className="data-panel"><PanelTitle title="Overdue invoices" action="View invoices" onClick={() => setTab("rent")} />
          {dashboard.overdueInvoices.length ? dashboard.overdueInvoices.map((item) => <button className="invoice-alert" key={item.id} onClick={() => setTab("rent")}><span><strong>{item.tenant_name}</strong><small>{item.number} · due {item.due_on}</small></span><b>{money.format(Number(item.balance))}</b></button>) : <Empty text="No overdue invoices." />}
          <div className="cost-summary"><span>Operating expenses YTD</span><strong>{money.format(Number(kpis.expensesYtd))}</strong><button onClick={() => setTab("expenses")}>Review expenses →</button></div>
        </article>
      </section>
    </> : <Collection tab={tab} rows={rows} search={search} onSearch={setSearch} />}
    {showCreate && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}><div className="form-modal" role="dialog" aria-modal="true" aria-labelledby="new-property" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><p className="eyebrow">New portfolio record</p><h2 id="new-property">Add property</h2></div><button aria-label="Close" onClick={() => setShowCreate(false)}>×</button></div>
      <form onSubmit={createProperty}><label>Property code<input name="code" required placeholder="CE-NRB-002" /></label><label>Property name<input name="name" required placeholder="Riverside Apartments" /></label><div className="form-row"><label>Type<input name="property_type" placeholder="Residential" /></label><label>City<input name="city" placeholder="Nairobi" /></label></div><label>Status<select name="status" defaultValue="active"><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select></label><label>Address<textarea name="address" rows={3} /></label><div className="form-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-action" type="submit">Save property</button></div></form>
    </div></div>}
  </div>;
}

function Kpi({ label, value, note, onClick, warning = false }: { label: string; value: string; note: string; onClick: () => void; warning?: boolean }) { return <button className={`kpi-card ${warning ? "warning" : ""}`} onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{note}</small><i>View details →</i></button>; }
function PanelTitle({ title, action, onClick }: { title: string; action: string; onClick: () => void }) { return <header className="panel-title"><h2>{title}</h2><button onClick={onClick}>{action} →</button></header>; }
function Status({ value }: { value: string }) { return <span className={`data-status status-${value}`}>{value.replace("_", " ")}</span>; }
function Empty({ text }: { text: string }) { return <div className="empty-state">{text}</div>; }
function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) { return rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table></div> : <Empty text="No matching records found." />; }

function Collection({ tab, rows, search, onSearch }: { tab: Tab; rows: Property[] | Tenant[] | Lease[] | Invoice[] | Expense[]; search: string; onSearch: (value: string) => void }) {
  let headers: string[] = [], values: React.ReactNode[][] = [];
  if (tab === "properties") { headers = ["Code", "Property", "Type", "City", "Units", "Status"]; values = (rows as Property[]).map((r) => [r.code, r.name, r.property_type || "—", r.city || "—", r.units_count, <Status key={r.id} value={r.status} />]); }
  if (tab === "tenants") { headers = ["Code", "Tenant", "Email", "Phone", "Status"]; values = (rows as Tenant[]).map((r) => [r.code, r.name, r.email || "—", r.phone || "—", <Status key={r.id} value={r.status} />]); }
  if (tab === "leases") { headers = ["Reference", "Tenant", "Property / unit", "Start", "End", "Rent", "Status"]; values = (rows as Lease[]).map((r) => [r.reference, r.tenant_name, `${r.property_name} · ${r.unit_code}`, r.starts_on, r.ends_on, money.format(Number(r.monthly_rent)), <Status key={r.id} value={r.status} />]); }
  if (tab === "rent") { headers = ["Invoice", "Tenant", "Due date", "Amount", "Balance", "Status"]; values = (rows as Invoice[]).map((r) => [r.number, r.tenant_name, r.due_on, money.format(Number(r.amount)), money.format(Number(r.balance)), <Status key={r.id} value={r.status} />]); }
  if (tab === "expenses") { headers = ["Date", "Supplier", "Property", "Category", "Amount", "Status"]; values = (rows as Expense[]).map((r) => [r.incurred_on, r.supplier, r.property_name, r.category, money.format(Number(r.amount)), <Status key={r.id} value={r.status} />]); }
  return <article className="data-panel collection-panel"><header className="collection-title"><div><p className="eyebrow">Live records</p><h2>{labels[tab]}</h2></div><input aria-label={`Search ${labels[tab]}`} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search records…" /></header><DataTable headers={headers} rows={values} /></article>;
}
