"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type Dashboard = {
  kpis: { properties: number; units: number; occupiedUnits: number; occupancyRate: number; activeLeases: number; activeTenants: number; outstanding: string; collectedYtd: string; expensesYtd: string };
  recentLeases: Lease[];
  overdueInvoices: Invoice[];
  propertyMix: { property_type: string; count: number }[];
};
type Property = { id: string; code: string; name: string; property_type: string; city: string; status: string; units_count: number };
type Building = { id: string; code: string; name: string; property_name: string; floors: number };
type Unit = { id: string; code: string; property_name: string; building_name: string; floor: string; unit_type: string; area: string; status: string };
type Project = { id: string; code: string; name: string; status: string; starts_on: string; ends_on: string };
type Tenant = { id: string; code: string; name: string; email: string; phone: string; status: string };
type Lease = { id: string; reference: string; tenant_name: string; unit_code: string; property_name: string; starts_on: string; ends_on: string; monthly_rent: string; status: string };
type Invoice = { id: string; number: string; tenant_id: string; tenant_name: string; due_on: string; amount: string; balance: string; status: string };
type Expense = { id: string; supplier: string; property_name: string; category: string; invoice_number: string; incurred_on: string; amount: string; status: string };
type Receipt = { id: string; number: string; tenant_name: string; received_on: string; amount: string; payment_method: string; external_reference: string };
type Allocation = { id: string; receipt_number: string; invoice_number: string; tenant_name: string; amount: string };
type CreditNote = { id: string; number: string; invoice_number: string; tenant_name: string; issued_on: string; amount: string; reason: string; status: string };
type TenantDocument = { id: string; tenant_name: string; document_type: string; document_number: string; expires_on: string; status: string };
type RentSchedule = { id: string; lease_reference: string; tenant_name: string; period_start: string; period_end: string; due_on: string; total: string; status: string };
type Budget = { id: string; property: string; property_name: string; year: number; category: string; amount: string; actual_amount: string; variance: string; status: string };
type ServiceCharge = { id: string; property: string; name: string; method: string; annual_budget: string; starts_on: string; is_active: boolean };
type ServiceChargeAllocation = { id: string; service_charge_name: string; property_name: string; unit_code: string; ratio: string; annual_amount: string; monthly_amount: string };
type Reconciliation = { id: string; service_charge_name: string; property_name: string; period_start: string; period_end: string; budgeted_amount: string; actual_amount: string; variance: string; status: string };
type Arrears = { tenant: string; property: string; unit: string; outstanding: string; oldest_days: number; invoice_count: number };
type Report = { key: string; name: string; category: string };
type Reminder = { id: string; invoice_number: string; tenant_name: string; channel: string; recipient: string; message: string; sent_at: string };
type BankTransaction = { id: string; reference: string; transacted_on: string; description: string; amount: string; status: string; receipt_number: string };
type CollectionRow = Property | Building | Unit | Project | Tenant | Lease | Invoice | Expense | Receipt | Allocation | CreditNote | TenantDocument | RentSchedule | Budget | ServiceCharge | ServiceChargeAllocation | Reconciliation | Arrears | Report | Reminder | BankTransaction;
type Tab = "overview" | "properties" | "buildings" | "units" | "projects" | "tenants" | "tenant-documents" | "leases" | "rent-schedules" | "rent" | "arrears" | "reminders" | "receipts" | "receipt-allocations" | "bank-reconciliation" | "credit-notes" | "service-charges" | "service-charge-allocations" | "service-charge-reconciliations" | "budgets" | "expenses" | "reports";

const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const labels: Record<Tab, string> = { overview: "Overview", properties: "Properties", buildings: "Buildings", units: "Units", projects: "Projects", tenants: "Tenants", "tenant-documents": "Tenant documents", leases: "Leases", "rent-schedules": "Rent schedules", rent: "Rent & invoices", arrears: "Arrears", reminders: "Reminders", receipts: "Receipts", "receipt-allocations": "Receipt allocations", "bank-reconciliation": "Bank reconciliation", "credit-notes": "Credit notes", "service-charges": "Service charge", "service-charge-allocations": "Charge allocations", "service-charge-reconciliations": "Reconciliations", budgets: "Budgets", expenses: "Expenses", reports: "Reports" };

export default function PropertyManagementPage() {
  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const canOperate = can("property.operations") || can("property.manage");
  const canLease = can("property.leasing") || can("property.manage");
  const canFinance = can("property.finance") || can("property.manage");
  const canApprove = can("property.approve");
  const canReport = can("property.report");
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
  const loadVersion = useRef(0);
  const tabRef = useRef(tab);

  const endpoint = useMemo(() => ({ properties: "properties", buildings: "buildings", units: "units", projects: "projects", tenants: "tenants", "tenant-documents": "tenant-documents", leases: "leases", "rent-schedules": "rent-schedules", rent: "invoices", arrears: "analytics/aging", reminders: "invoice-reminders", receipts: "receipts", "receipt-allocations": "receipt-allocations", "bank-reconciliation": "bank-transactions", "credit-notes": "credit-notes", "service-charges": "service-charges", "service-charge-allocations": "service-charge-allocations", "service-charge-reconciliations": "service-charge-reconciliations", budgets: "budgets", expenses: "expenses", reports: "analytics" } as Partial<Record<Tab, string>>)[tab], [tab]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const version = ++loadVersion.current;
    setLoading(true); setError("");
    const path = tab === "overview" ? "/property/dashboard/" : `/property/${endpoint}/?search=${encodeURIComponent(search)}`;
    const response = await apiFetch(path, {}, organizationId);
    if (!response.ok) { setError("Property data could not be loaded. Please try again."); setLoading(false); return; }
    const data = await response.json();
    if (version !== loadVersion.current) return;
    if (tab === "overview") setDashboard(data as Dashboard);
    else if (tab === "arrears") setRows(data.tenants ?? []);
    else if (tab === "reports") setRows(data.reports ?? []);
    else setRows(data);
    setLoading(false);
  }, [endpoint, organizationId, search, tab]);

  useEffect(() => { const delay = setTimeout(load, search ? 250 : 0); return () => clearTimeout(delay); }, [load, search]);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => {
    if (!showReceipt || !organizationId) return;
    apiFetch("/property/invoices/", {}, organizationId).then((response) => response.ok ? response.json() : []).then((items: Invoice[]) => {
      const open = items.filter((item) => Number(item.balance) > 0 && ["issued", "partial", "overdue"].includes(item.status));
      setOpenInvoices(open); setSelectedInvoice(open[0]?.id ?? "");
    });
  }, [organizationId, showReceipt]);

  async function createProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const unitCount = Number(payload.unit_count || 0);
    const unitPayload = { count: unitCount, start: Number(payload.unit_start || 1), prefix: payload.unit_prefix, floor: payload.unit_floor, unit_type: payload.unit_type, area: payload.unit_area };
    for (const key of ["unit_count", "unit_start", "unit_prefix", "unit_floor", "unit_type", "unit_area"]) delete payload[key];
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/property/properties/", {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (!response.ok) { setError("The property could not be saved. Check the required fields and unique code."); return; }
    const property = await response.json();
    if (unitCount > 0) {
      const unitsResponse = await apiFetch(`/property/properties/${property.id}/bulk-units/`, { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(unitPayload) }, organizationId);
      if (!unitsResponse.ok) { setError("The property was saved, but its unit mix could not be generated."); setShowCreate(false); setTab("properties"); await load(); return; }
    }
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

  async function runAction(path: string) {
    const actionTab = tab;
    setError("");
    await apiFetch("/auth/csrf/");
    let payload: Record<string, string> = path.endsWith("/reconcile/") ? { period_start: `${new Date().getFullYear()}-01-01`, period_end: new Date().toISOString().slice(0, 10) } : {};
    if (path.endsWith("/send-reminder/")) payload = { channel: "portal" };
    if (path.endsWith("/renew/")) {
      const lease = (rows as Lease[]).find((row) => path.includes(row.id));
      if (!lease) return;
      const reference = window.prompt("Renewal reference", `${lease.reference}-R1`); if (!reference) return;
      const suggestedEnd = new Date(lease.ends_on); suggestedEnd.setFullYear(suggestedEnd.getFullYear() + 1);
      const endsOn = window.prompt("New lease end date", suggestedEnd.toISOString().slice(0, 10)); if (!endsOn) return;
      const monthlyRent = window.prompt("New monthly rent", lease.monthly_rent); if (!monthlyRent) return;
      payload = { reference, ends_on: endsOn, monthly_rent: monthlyRent };
    }
    const response = await apiFetch(`/property/${path}`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const detail = Object.values(body).flat().join(" ");
      setError(detail || "The workflow action could not be completed.");
      return;
    }
    if (tabRef.current === actionTab) await load();
  }

  async function downloadReport(kind: string) {
    const response = await apiFetch(`/property/analytics/exports/${kind}/`, {}, organizationId);
    if (!response.ok) { setError("The report could not be generated."); return; }
    const blob = await response.blob(); const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `property-${kind}.csv`; anchor.click();
    URL.revokeObjectURL(url);
  }

  const kpis = dashboard?.kpis;
  return <div className="page-wrap property-app">
    <section className="property-heading">
      <div><p className="eyebrow">Portfolio workspace</p><h1>Property Management</h1><p>Occupancy, leases, rent collections and operating costs in one view.</p></div>
      <div className="heading-actions">{canFinance && <button onClick={() => setShowReceipt(true)}>Record receipt</button>}{canOperate && <button className="primary-action" onClick={() => setShowCreate(true)}>+ Add property</button>}</div>
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
        <Kpi label="Outstanding rent" value={money.format(Number(kpis.outstanding))} note={`${money.format(Number(kpis.collectedYtd))} collected YTD`} warning onClick={() => setTab("arrears")} />
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
    </> : <Collection tab={tab} rows={rows} search={search} onSearch={setSearch} onAction={runAction} onDownload={downloadReport} permissions={{canLease, canFinance, canApprove, canReport}} />}
    {showCreate && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}><div className="form-modal" role="dialog" aria-modal="true" aria-labelledby="new-property" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><p className="eyebrow">New portfolio record</p><h2 id="new-property">Add property</h2></div><button aria-label="Close" onClick={() => setShowCreate(false)}>×</button></div>
      <form onSubmit={createProperty}><label>Property code<input name="code" required placeholder="CE-NRB-002" /></label><label>Property name<input name="name" required placeholder="Riverside Apartments" /></label><div className="form-row"><label>Type<input name="property_type" placeholder="Residential" /></label><label>City<input name="city" placeholder="Nairobi" /></label></div><label>Status<select name="status" defaultValue="active"><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select></label><label>Address<textarea name="address" rows={2} /></label><p className="eyebrow">Optional unit mix</p><div className="form-row"><label>Number of units<input name="unit_count" type="number" min="0" max="500" defaultValue="0" /></label><label>Starting number<input name="unit_start" type="number" min="1" defaultValue="1" /></label></div><div className="form-row"><label>Unit prefix<input name="unit_prefix" placeholder="A-" /></label><label>Unit type<input name="unit_type" placeholder="Apartment" /></label></div><div className="form-row"><label>Floor<input name="unit_floor" placeholder="1" /></label><label>Area per unit (m²)<input name="unit_area" type="number" min="0.01" step="0.01" /></label></div><div className="form-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary-action" type="submit">Save property</button></div></form>
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

function Collection({ tab, rows, search, onSearch, onAction, onDownload, permissions }: { tab: Tab; rows: CollectionRow[]; search: string; onSearch: (value: string) => void; onAction: (path: string) => Promise<void>; onDownload: (kind: string) => Promise<void>; permissions: {canLease:boolean;canFinance:boolean;canApprove:boolean;canReport:boolean} }) {
  const {canLease, canFinance, canApprove, canReport} = permissions;
  let headers: string[] = [], values: React.ReactNode[][] = [];
  if (tab === "properties") { headers = ["Code", "Property", "Type", "City", "Units", "Status"]; values = (rows as Property[]).map((r) => [r.code, r.name, r.property_type || "—", r.city || "—", r.units_count, <Status key={r.id} value={r.status} />]); }
  if (tab === "buildings") { headers = ["Code", "Building", "Property", "Floors"]; values = (rows as Building[]).map((r) => [r.code, r.name, r.property_name, r.floors]); }
  if (tab === "units") { headers = ["Unit", "Property", "Building", "Floor", "Type", "Area", "Status"]; values = (rows as Unit[]).map((r) => [r.code, r.property_name, r.building_name || "—", r.floor || "—", r.unit_type || "—", r.area || "—", <Status key={r.id} value={r.status} />]); }
  if (tab === "projects") { headers = ["Code", "Project", "Starts", "Ends", "Status"]; values = (rows as Project[]).map((r) => [r.code, r.name, r.starts_on || "—", r.ends_on || "—", <Status key={r.id} value={r.status} />]); }
  if (tab === "tenants") { headers = ["Code", "Tenant", "Email", "Phone", "Status"]; values = (rows as Tenant[]).map((r) => [r.code, r.name, r.email || "—", r.phone || "—", <Status key={r.id} value={r.status} />]); }
  if (tab === "leases") { headers = ["Reference", "Tenant", "Property / unit", "Start", "End", "Rent", "Status", "Actions"]; values = (rows as Lease[]).map((r) => [r.reference, r.tenant_name, `${r.property_name} · ${r.unit_code}`, r.starts_on, r.ends_on, money.format(Number(r.monthly_rent)), <Status key={r.id} value={r.status} />, <ActionButtons key={`a-${r.id}`} actions={!canLease ? [] : r.status === "draft" ? [["Activate", `leases/${r.id}/activate/`]] : ["active", "expiring"].includes(r.status) ? [["Renew", `leases/${r.id}/renew/`], ["Terminate", `leases/${r.id}/terminate/`]] : []} run={onAction} />]); }
  if (tab === "rent") { headers = ["Invoice", "Tenant", "Due date", "Amount", "Balance", "Status", "Actions"]; values = (rows as Invoice[]).map((r) => [r.number, r.tenant_name, r.due_on, money.format(Number(r.amount)), money.format(Number(r.balance)), <Status key={r.id} value={r.status} />, <ActionButtons key={`a-${r.id}`} actions={!canFinance ? [] : r.status === "draft" ? [["Issue", `invoices/${r.id}/issue/`]] : ["issued", "overdue", "partial"].includes(r.status) ? [["Send reminder", `invoices/${r.id}/send-reminder/`], ...(["issued", "overdue"].includes(r.status) && canApprove ? [["Void", `invoices/${r.id}/void/`]] : [])] : []} run={onAction} />]); }
  if (tab === "expenses") { headers = ["Date", "Invoice", "Supplier", "Property", "Category", "Amount", "Status", "Actions"]; values = (rows as Expense[]).map((r) => [r.incurred_on, r.invoice_number || "—", r.supplier, r.property_name, r.category, money.format(Number(r.amount)), <Status key={r.id} value={r.status} />, <ActionButtons key={`a-${r.id}`} actions={!canFinance ? [] : ["draft", "rejected"].includes(r.status) ? [["Submit", `expenses/${r.id}/submit/`]] : r.status === "pending" && canApprove ? [["Approve", `expenses/${r.id}/approve/`], ["Reject", `expenses/${r.id}/reject/`]] : r.status === "approved" && canApprove ? [["Mark paid", `expenses/${r.id}/mark-paid/`]] : []} run={onAction} />]); }
  if (tab === "receipts") { headers = ["Receipt", "Tenant", "Received", "Amount", "Method", "Reference"]; values = (rows as Receipt[]).map((r) => [r.number, r.tenant_name, r.received_on, money.format(Number(r.amount)), r.payment_method.replaceAll("_", " "), r.external_reference || "—"]); }
  if (tab === "receipt-allocations") { headers = ["Receipt", "Invoice", "Tenant", "Allocated"]; values = (rows as Allocation[]).map((r) => [r.receipt_number, r.invoice_number, r.tenant_name, money.format(Number(r.amount))]); }
  if (tab === "credit-notes") { headers = ["Credit note", "Invoice", "Tenant", "Issued", "Amount", "Reason", "Status"]; values = (rows as CreditNote[]).map((r) => [r.number, r.invoice_number, r.tenant_name, r.issued_on, money.format(Number(r.amount)), r.reason, <Status key={r.id} value={r.status} />]); }
  if (tab === "tenant-documents") { headers = ["Tenant", "Document", "Number", "Expires", "Status", "Actions"]; values = (rows as TenantDocument[]).map((r) => [r.tenant_name, r.document_type.replaceAll("_", " "), r.document_number || "—", r.expires_on || "—", <Status key={r.id} value={r.status} />, <ActionButtons key={`a-${r.id}`} actions={canLease && r.status === "pending" ? [["Verify", `tenant-documents/${r.id}/verify/`]] : []} run={onAction} />]); }
  if (tab === "rent-schedules") { headers = ["Lease", "Tenant", "Period start", "Period end", "Due", "Total", "Status", "Actions"]; values = (rows as RentSchedule[]).map((r) => [r.lease_reference, r.tenant_name, r.period_start, r.period_end, r.due_on, money.format(Number(r.total)), <Status key={r.id} value={r.status} />, <ActionButtons key={`a-${r.id}`} actions={canFinance && r.status === "upcoming" ? [["Generate invoice", `rent-schedules/${r.id}/generate-invoice/`]] : []} run={onAction} />]); }
  if (tab === "budgets") { headers = ["Year", "Property", "Category", "Budget", "Actual", "Variance", "Status", "Actions"]; values = (rows as Budget[]).map((r) => [r.year, r.property_name, r.category, money.format(Number(r.amount)), money.format(Number(r.actual_amount)), money.format(Number(r.variance)), <Status key={r.id} value={r.status} />, <ActionButtons key={`a-${r.id}`} actions={!canFinance ? [] : ["draft", "rejected"].includes(r.status) ? [["Submit", `budgets/${r.id}/submit/`]] : r.status === "pending" && canApprove ? [["Approve", `budgets/${r.id}/approve/`], ["Reject", `budgets/${r.id}/reject/`]] : []} run={onAction} />]); }
  if (tab === "service-charges") { headers = ["Scheme", "Property ID", "Method", "Annual budget", "Starts", "Active"]; values = (rows as ServiceCharge[]).map((r) => [r.name, r.property, r.method, money.format(Number(r.annual_budget)), r.starts_on, r.is_active ? "Yes" : "No"]); }
  if (tab === "service-charges") { headers.push("Actions"); values = (rows as ServiceCharge[]).map((r) => [r.name, r.property, r.method, money.format(Number(r.annual_budget)), r.starts_on, r.is_active ? "Yes" : "No", <ActionButtons key={`a-${r.id}`} actions={canFinance ? [["Allocate", `service-charges/${r.id}/generate-allocations/`], ["Reconcile YTD", `service-charges/${r.id}/reconcile/`]] : []} run={onAction} />]); }
  if (tab === "service-charge-allocations") { headers = ["Scheme", "Property", "Unit", "Ratio", "Annual", "Monthly"]; values = (rows as ServiceChargeAllocation[]).map((r) => [r.service_charge_name, r.property_name, r.unit_code, `${(Number(r.ratio) * 100).toFixed(2)}%`, money.format(Number(r.annual_amount)), money.format(Number(r.monthly_amount))]); }
  if (tab === "service-charge-reconciliations") { headers = ["Scheme", "Property", "Period start", "Period end", "Budget", "Actual", "Variance", "Status"]; values = (rows as Reconciliation[]).map((r) => [r.service_charge_name, r.property_name, r.period_start, r.period_end, money.format(Number(r.budgeted_amount)), money.format(Number(r.actual_amount)), money.format(Number(r.variance)), <Status key={r.id} value={r.status} />]); }
  if (tab === "arrears") { headers = ["Tenant", "Property", "Unit", "Invoices", "Outstanding", "Oldest debt"]; values = (rows as Arrears[]).map((r) => [r.tenant, r.property, r.unit, r.invoice_count, money.format(Number(r.outstanding)), `${r.oldest_days} days`]); }
  if (tab === "reports") { headers = ["Report", "Category", "Export"]; values = (rows as Report[]).map((r) => [r.name, r.category, canReport ? <button className="secondary-action" key={r.key} onClick={() => void onDownload(r.key)}>Download CSV</button> : "—"]); }
  if (tab === "reminders") { headers = ["Invoice", "Tenant", "Channel", "Recipient", "Message", "Sent"]; values = (rows as Reminder[]).map((r) => [r.invoice_number, r.tenant_name, r.channel, r.recipient, r.message, r.sent_at.slice(0, 16).replace("T", " ")]); }
  if (tab === "bank-reconciliation") { headers = ["Bank reference", "Date", "Description", "Amount", "Receipt", "Status"]; values = (rows as BankTransaction[]).map((r) => [r.reference, r.transacted_on, r.description || "—", money.format(Number(r.amount)), r.receipt_number || "—", <Status key={r.id} value={r.status} />]); }
  return <article className="data-panel collection-panel"><header className="collection-title"><div><p className="eyebrow">Live records</p><h2>{labels[tab]}</h2></div><input aria-label={`Search ${labels[tab]}`} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search records…" /></header><DataTable headers={headers} rows={values} /></article>;
}

function ActionButtons({ actions, run }: { actions: string[][]; run: (path: string) => Promise<void> }) {
  if (!actions.length) return <span>—</span>;
  return <div className="table-actions">{actions.map(([label, path]) => <button key={path} onClick={() => void run(path)}>{label}</button>)}</div>;
}
