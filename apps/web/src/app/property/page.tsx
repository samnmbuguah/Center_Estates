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
type Invoice = { id: string; number: string; tenant_id: string; tenant_name: string; due_on: string; amount: string; balance: string; status: string };
type Expense = { id: string; supplier: string; property_name: string; category: string; incurred_on: string; amount: string; status: string };
type Receipt = { id: string; number: string; tenant_name: string; received_on: string; amount: string; payment_method: string; external_reference: string };
type Allocation = { id: string; receipt_number: string; invoice_number: string; tenant_name: string; amount: string };
type CreditNote = { id: string; number: string; invoice_number: string; tenant_name: string; issued_on: string; amount: string; reason: string; status: string };
type TenantDocument = { id: string; tenant_name: string; document_type: string; document_number: string; expires_on: string; status: string };
type RentSchedule = { id: string; lease_reference: string; tenant_name: string; period_start: string; period_end: string; due_on: string; total: string; status: string };
type Budget = { id: string; property: string; year: number; category: string; amount: string };
type ServiceCharge = { id: string; property: string; name: string; method: string; annual_budget: string; starts_on: string; is_active: boolean };
type CollectionRow = Property | Tenant | Lease | Invoice | Expense | Receipt | Allocation | CreditNote | TenantDocument | RentSchedule | Budget | ServiceCharge;
type Tab = "overview" | "properties" | "tenants" | "tenant-documents" | "leases" | "rent-schedules" | "rent" | "receipts" | "receipt-allocations" | "credit-notes" | "service-charges" | "budgets" | "expenses";

const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const labels: Record<Tab, string> = { overview: "Overview", properties: "Properties", tenants: "Tenants", "tenant-documents": "Tenant documents", leases: "Leases", "rent-schedules": "Rent schedules", rent: "Rent & invoices", receipts: "Receipts", "receipt-allocations": "Allocations", "credit-notes": "Credit notes", "service-charges": "Service charge", budgets: "Budgets", expenses: "Expenses" };

export default function PropertyManagementPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState("");

  const endpoint = useMemo(() => ({ properties: "properties", tenants: "tenants", "tenant-documents": "tenant-documents", leases: "leases", "rent-schedules": "rent-schedules", rent: "invoices", receipts: "receipts", "receipt-allocations": "receipt-allocations", "credit-notes": "credit-notes", "service-charges": "service-charges", budgets: "budgets", expenses: "expenses" } as Partial<Record<Tab, string>>)[tab], [tab]);

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
  useEffect(() => {
    if (!showReceipt || !organizationId) return;
    apiFetch("/property/invoices/", {}, organizationId).then((response) => response.ok ? response.json() : []).then((items: Invoice[]) => {
      const open = items.filter((item) => Number(item.balance) > 0 && item.status !== "void");
      setOpenInvoices(open); setSelectedInvoice(open[0]?.id ?? "");
    });
  }, [organizationId, showReceipt]);

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

  async function recordReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invoice = openInvoices.find((item) => item.id === selectedInvoice);
    if (!invoice) { setError("Select an open invoice."); return; }
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    payload.invoice = invoice.id; payload.tenant = invoice.tenant_id;
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/property/receipts/", {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload),
    }, organizationId);
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.amount?.[0] ?? "Receipt could not be posted."); return; }
    setShowReceipt(false); setTab("receipt-allocations"); await load();
  }

  const kpis = dashboard?.kpis;
  return <div className="page-wrap property-app">
    <section className="property-heading">
      <div><p className="eyebrow">Portfolio workspace</p><h1>Property Management</h1><p>Occupancy, leases, rent collections and operating costs in one view.</p></div>
      <div className="heading-actions"><button onClick={() => setShowReceipt(true)}>Record receipt</button><button className="primary-action" onClick={() => setShowCreate(true)}>+ Add property</button></div>
    </section>
    <nav className="module-tabs" aria-label="Property management sections">
      {(Object.keys(labels) as Tab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => { setSearch(""); setRows([]); setTab(item); }}>{labels[item]}</button>)}
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
    {showReceipt && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowReceipt(false)}><div className="form-modal" role="dialog" aria-modal="true" aria-labelledby="record-receipt" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><p className="eyebrow">Rent collection</p><h2 id="record-receipt">Record and allocate receipt</h2></div><button aria-label="Close" onClick={() => setShowReceipt(false)}>×</button></div>
      <form onSubmit={recordReceipt}><label>Open invoice<select required value={selectedInvoice} onChange={(event) => setSelectedInvoice(event.target.value)}><option value="" disabled>Select invoice</option>{openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} — {invoice.tenant_name} — {money.format(Number(invoice.balance))}</option>)}</select></label><div className="form-row"><label>Receipt number<input required name="number" placeholder="RCT-2026-0419" /></label><label>Received on<input required type="date" name="received_on" /></label></div><div className="form-row"><label>Amount<input required type="number" min="0.01" step="0.01" name="amount" max={openInvoices.find((item) => item.id === selectedInvoice)?.balance} /></label><label>Method<select name="payment_method" defaultValue="bank_transfer"><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="cash">Cash</option><option value="cheque">Cheque</option></select></label></div><label>External reference<input name="external_reference" placeholder="Bank or M-Pesa reference" /></label><div className="form-actions"><button type="button" onClick={() => setShowReceipt(false)}>Cancel</button><button className="primary-action">Post receipt</button></div></form>
    </div></div>}
  </div>;
}

function Kpi({ label, value, note, onClick, warning = false }: { label: string; value: string; note: string; onClick: () => void; warning?: boolean }) { return <button className={`kpi-card ${warning ? "warning" : ""}`} onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{note}</small><i>View details →</i></button>; }
function PanelTitle({ title, action, onClick }: { title: string; action: string; onClick: () => void }) { return <header className="panel-title"><h2>{title}</h2><button onClick={onClick}>{action} →</button></header>; }
function Status({ value }: { value?: string }) { const safe = value || "unknown"; return <span className={`data-status status-${safe}`}>{safe.replaceAll("_", " ")}</span>; }
function Empty({ text }: { text: string }) { return <div className="empty-state">{text}</div>; }
function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) { return rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table></div> : <Empty text="No matching records found." />; }

function Collection({ tab, rows, search, onSearch }: { tab: Tab; rows: CollectionRow[]; search: string; onSearch: (value: string) => void }) {
  let headers: string[] = [], values: React.ReactNode[][] = [];
  if (tab === "properties") { headers = ["Code", "Property", "Type", "City", "Units", "Status"]; values = (rows as Property[]).map((r) => [r.code, r.name, r.property_type || "—", r.city || "—", r.units_count, <Status key={r.id} value={r.status} />]); }
  if (tab === "tenants") { headers = ["Code", "Tenant", "Email", "Phone", "Status"]; values = (rows as Tenant[]).map((r) => [r.code, r.name, r.email || "—", r.phone || "—", <Status key={r.id} value={r.status} />]); }
  if (tab === "leases") { headers = ["Reference", "Tenant", "Property / unit", "Start", "End", "Rent", "Status"]; values = (rows as Lease[]).map((r) => [r.reference, r.tenant_name, `${r.property_name} · ${r.unit_code}`, r.starts_on, r.ends_on, money.format(Number(r.monthly_rent)), <Status key={r.id} value={r.status} />]); }
  if (tab === "rent") { headers = ["Invoice", "Tenant", "Due date", "Amount", "Balance", "Status"]; values = (rows as Invoice[]).map((r) => [r.number, r.tenant_name, r.due_on, money.format(Number(r.amount)), money.format(Number(r.balance)), <Status key={r.id} value={r.status} />]); }
  if (tab === "expenses") { headers = ["Date", "Supplier", "Property", "Category", "Amount", "Status"]; values = (rows as Expense[]).map((r) => [r.incurred_on, r.supplier, r.property_name, r.category, money.format(Number(r.amount)), <Status key={r.id} value={r.status} />]); }
  if (tab === "receipts") { headers = ["Receipt", "Tenant", "Received", "Amount", "Method", "Reference"]; values = (rows as Receipt[]).map((r) => [r.number, r.tenant_name, r.received_on, money.format(Number(r.amount)), r.payment_method.replaceAll("_", " "), r.external_reference || "—"]); }
  if (tab === "receipt-allocations") { headers = ["Receipt", "Invoice", "Tenant", "Allocated"]; values = (rows as Allocation[]).map((r) => [r.receipt_number, r.invoice_number, r.tenant_name, money.format(Number(r.amount))]); }
  if (tab === "credit-notes") { headers = ["Credit note", "Invoice", "Tenant", "Issued", "Amount", "Reason", "Status"]; values = (rows as CreditNote[]).map((r) => [r.number, r.invoice_number, r.tenant_name, r.issued_on, money.format(Number(r.amount)), r.reason, <Status key={r.id} value={r.status} />]); }
  if (tab === "tenant-documents") { headers = ["Tenant", "Document", "Number", "Expires", "Status"]; values = (rows as TenantDocument[]).map((r) => [r.tenant_name, r.document_type.replaceAll("_", " "), r.document_number || "—", r.expires_on || "—", <Status key={r.id} value={r.status} />]); }
  if (tab === "rent-schedules") { headers = ["Lease", "Tenant", "Period start", "Period end", "Due", "Total", "Status"]; values = (rows as RentSchedule[]).map((r) => [r.lease_reference, r.tenant_name, r.period_start, r.period_end, r.due_on, money.format(Number(r.total)), <Status key={r.id} value={r.status} />]); }
  if (tab === "budgets") { headers = ["Year", "Property ID", "Category", "Budget"]; values = (rows as Budget[]).map((r) => [r.year, r.property, r.category, money.format(Number(r.amount))]); }
  if (tab === "service-charges") { headers = ["Scheme", "Property ID", "Method", "Annual budget", "Starts", "Active"]; values = (rows as ServiceCharge[]).map((r) => [r.name, r.property, r.method, money.format(Number(r.annual_budget)), r.starts_on, r.is_active ? "Yes" : "No"]); }
  return <article className="data-panel collection-panel"><header className="collection-title"><div><p className="eyebrow">Live records</p><h2>{labels[tab]}</h2></div><input aria-label={`Search ${labels[tab]}`} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search records…" /></header><DataTable headers={headers} rows={values} /></article>;
}
