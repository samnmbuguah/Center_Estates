"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type Row = Record<string, string | number | boolean | null>;
type Portal = {
  tenant: { name: string; code: string; email: string; phone: string };
  currentLease: null | { reference: string; property_name: string; unit_code: string; starts_on: string; ends_on: string; monthly_rent: string; status: string };
  balance: string; invoices: Row[]; receipts: Row[]; documents: Row[];
  serviceRequests: Row[]; notices: Row[];
};
type Tab = "overview" | "invoices" | "payments" | "maintenance" | "documents" | "notices" | "profile";
const labels: Record<Tab, string> = { overview: "Overview", invoices: "Invoices", payments: "Payments & receipts", maintenance: "Maintenance requests", documents: "Documents", notices: "Messages & notices", profile: "Profile & lease" };
const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function TenantPortalPage() {
  const { session } = useAuth(); const organizationId = session?.activeOrganizationId ?? null;
  const [data, setData] = useState<Portal | null>(null); const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [modal, setModal] = useState(false);
  const load = useCallback(async () => {
    if (!organizationId) return; setLoading(true); setError("");
    const response = await apiFetch("/property/portal/", {}, organizationId);
    if (!response.ok) { setError(response.status === 403 ? "This account is not linked to a tenant portal profile." : "Your tenant account could not be loaded."); setLoading(false); return; }
    setData(await response.json()); setLoading(false);
  }, [organizationId]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const payload = Object.fromEntries(new FormData(event.currentTarget).entries()); await apiFetch("/auth/csrf/");
    const response = await apiFetch("/property/portal/service-requests/", { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) }, organizationId);
    if (!response.ok) { setError("The maintenance request could not be submitted."); return; }
    setModal(false); setTab("maintenance"); await load();
  }
  if (loading) return <div className="page-wrap"><div className="data-loading">Loading your tenant account…</div></div>;
  if (!data) return <div className="page-wrap"><div className="form-error">{error}</div></div>;
  const lease = data.currentLease;
  return <div className="page-wrap property-app">
    <section className="property-heading"><div><p className="eyebrow">Tenant self-service</p><h1>Good morning, {data.tenant.name}.</h1><p>Invoices, receipts, lease information, documents and maintenance in one secure account.</p></div><button className="primary-action" onClick={() => setModal(true)}>Report an issue</button></section>
    <nav className="module-tabs" aria-label="Tenant portal sections">{(Object.keys(labels) as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{labels[item]}</button>)}</nav>
    {error && <div className="form-error">{error}</div>}
    {tab === "overview" && <><section className="kpi-grid"><Kpi label="Outstanding balance" value={cash.format(Number(data.balance))} note={data.invoices.find((row) => Number(row.balance) > 0)?.due_on ? `Next due ${data.invoices.find((row) => Number(row.balance) > 0)?.due_on}` : "Account up to date"} go={() => setTab("invoices")} /><Kpi label="Recent invoices" value={String(data.invoices.length)} note="Latest 12 billing records" go={() => setTab("invoices")} /><Kpi label="Payments" value={String(data.receipts.length)} note="Receipts available" go={() => setTab("payments")} /><Kpi label="Maintenance" value={String(data.serviceRequests.filter((row) => !["resolved", "closed"].includes(String(row.status))).length)} note="Open requests" go={() => setTab("maintenance")} /></section><section className="dashboard-columns"><article className="data-panel"><Title text="Current lease" go={() => setTab("profile")} />{lease ? <div className="portal-lease"><strong>{lease.property_name} · {lease.unit_code}</strong><span>{lease.reference}</span><span>{lease.starts_on} — {lease.ends_on}</span><b>{cash.format(Number(lease.monthly_rent))} / month</b></div> : <Empty />}</article><article className="data-panel"><Title text="Recent activity" go={() => setTab("notices")} /><PortalTable headers={["Notice", "Date"]} rows={data.notices.slice(0, 4).map((row) => [String(row.title), String(row.created_at).slice(0, 10)])} /></article></section></>}
    {tab === "invoices" && <Panel title="Invoices"><PortalTable headers={["Invoice", "Issued", "Due", "Amount", "Balance", "Status"]} rows={data.invoices.map((row) => [String(row.number), String(row.issued_on), String(row.due_on), cash.format(Number(row.amount)), cash.format(Number(row.balance)), <Status key={String(row.id)} value={String(row.status)} />])} /></Panel>}
    {tab === "payments" && <Panel title="Payments & receipts"><PortalTable headers={["Receipt", "Received", "Amount", "Method", "Reference"]} rows={data.receipts.map((row) => [String(row.number), String(row.received_on), cash.format(Number(row.amount)), String(row.payment_method).replaceAll("_", " "), String(row.external_reference || "—")])} /></Panel>}
    {tab === "maintenance" && <Panel title="Maintenance requests" action={<button className="primary-action" onClick={() => setModal(true)}>New request</button>}><PortalTable headers={["Reference", "Issue", "Category", "Priority", "Submitted", "Status"]} rows={data.serviceRequests.map((row) => [String(row.reference), String(row.subject), String(row.category), <Status key={`p-${row.id}`} value={String(row.priority)} />, String(row.submitted_at).slice(0, 10), <Status key={String(row.id)} value={String(row.status)} />])} /></Panel>}
    {tab === "documents" && <Panel title="Documents"><PortalTable headers={["Document", "Number", "Expires", "Status"]} rows={data.documents.map((row) => [String(row.document_type).replaceAll("_", " "), String(row.document_number || "—"), String(row.expires_on || "—"), <Status key={String(row.id)} value={String(row.status)} />])} /></Panel>}
    {tab === "notices" && <Panel title="Messages & notices"><PortalTable headers={["Notice", "Message", "Level", "Date"]} rows={data.notices.map((row) => [String(row.title), String(row.message), <Status key={String(row.id)} value={String(row.level)} />, String(row.created_at).slice(0, 10)])} /></Panel>}
    {tab === "profile" && <Panel title="Profile & lease"><div className="portal-profile"><span><small>Tenant</small><strong>{data.tenant.name}</strong></span><span><small>Account</small><strong>{data.tenant.code}</strong></span><span><small>Email</small><strong>{data.tenant.email || "—"}</strong></span><span><small>Phone</small><strong>{data.tenant.phone || "—"}</strong></span>{lease && <><span><small>Property / unit</small><strong>{lease.property_name} · {lease.unit_code}</strong></span><span><small>Lease term</small><strong>{lease.starts_on} — {lease.ends_on}</strong></span></>}</div></Panel>}
    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><div className="form-modal" role="dialog" aria-modal="true" aria-labelledby="portal-request-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><p className="eyebrow">Tenant maintenance</p><h2 id="portal-request-title">Report an issue</h2></div><button aria-label="Close" onClick={() => setModal(false)}>×</button></div><form onSubmit={submitRequest}><label>Subject<input name="subject" required placeholder="Leaking kitchen tap" /></label><div className="form-row"><label>Category<input name="category" required placeholder="Plumbing" /></label><label>Priority<select name="priority" defaultValue="medium"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label></div><label>Description<textarea name="description" required rows={4} /></label><div className="form-actions"><button type="button" onClick={() => setModal(false)}>Cancel</button><button className="primary-action">Submit request</button></div></form></div></div>}
  </div>;
}

function Kpi({ label, value, note, go }: { label: string; value: string; note: string; go: () => void }) { return <button className="kpi-card" onClick={go}><span>{label}</span><strong>{value}</strong><small>{note}</small><i>View details →</i></button>; }
function Title({ text, go }: { text: string; go: () => void }) { return <header className="panel-title"><h2>{text}</h2><button onClick={go}>View all →</button></header>; }
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <article className="data-panel collection-panel"><header className="collection-title"><div><p className="eyebrow">My account</p><h2>{title}</h2></div>{action}</header>{children}</article>; }
function Status({ value }: { value: string }) { return <span className={`data-status status-${value}`}>{value.replaceAll("_", " ")}</span>; }
function Empty() { return <div className="empty-state">No records are available.</div>; }
function PortalTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) { return rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, position) => <td key={position}>{cell}</td>)}</tr>)}</tbody></table></div> : <Empty />; }
