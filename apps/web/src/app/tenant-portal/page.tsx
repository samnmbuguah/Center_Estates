"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type Row = Record<string, string | number | boolean | null>;
type Portal = {
  tenant: { name: string; code: string; email: string; phone: string };
  currentLease: null | {
    reference: string;
    property_name: string;
    unit_code: string;
    starts_on: string;
    ends_on: string;
    monthly_rent: string;
    status: string;
  };
  balance: string;
  invoices: Row[];
  receipts: Row[];
  documents: Row[];
  serviceRequests: Row[];
  notices: Row[];
  paymentGateways: {
    id: string;
    property_id: string;
    provider: string;
    display_name: string;
  }[];
};
type Tab =
  | "overview"
  | "invoices"
  | "payments"
  | "maintenance"
  | "documents"
  | "notices"
  | "profile";
const labels: Record<Tab, string> = {
  overview: "Overview",
  invoices: "Invoices",
  payments: "Payments & receipts",
  maintenance: "Maintenance requests",
  documents: "Documents",
  notices: "Messages & notices",
  profile: "Profile & lease",
};
const cash = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

export default function TenantPortalPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [data, setData] = useState<Portal | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    const tenantParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tenant") : null;
    const endpoint = tenantParam ? `/property/portal/${tenantParam}/` : "/property/portal/";
    const response = await apiFetch(endpoint, {}, organizationId);
    if (!response.ok) {
      setError(
        response.status === 403
          ? "This account is not linked to a tenant portal profile."
          : "Your tenant account could not be loaded.",
      );
      setLoading(false);
      return;
    }
    setData(await response.json());
    setLoading(false);
  }, [organizationId]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      "/property/portal/service-requests/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      organizationId,
    );
    if (!response.ok) {
      setError("The maintenance request could not be submitted.");
      return;
    }
    setModal(false);
    setTab("maintenance");
    await load();
  }
  async function downloadDocument(path: string, fallbackName: string) {
    setError("");
    const response = await apiFetch(path, {}, organizationId);
    if (!response.ok) {
      setError("The document could not be generated. Please try again.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fallbackName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const [stkNotice, setStkNotice] = useState<string | null>(null);

  async function payInvoice(invoice: Row) {
    const gateway = data?.paymentGateways?.[0];
    setPaymentBusy(String(invoice.id));
    setError("");
    setStkNotice(null);
    await apiFetch("/auth/csrf/");

    if (gateway?.provider === "mpesa" || !gateway) {
      const response = await apiFetch(
        "/property/portal/payments/stk-push/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            invoice: invoice.id,
            phone_number: data?.tenant?.phone || "",
          }),
        },
        organizationId
      );
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        detail?: string;
      };
      setPaymentBusy(null);
      if (response.ok) {
        setStkNotice(result.message || "M-Pesa STK Push prompt sent to your phone. Enter your PIN to complete payment.");
      } else {
        setError(result.detail || "M-Pesa STK Push could not be initiated. Please check your phone number or try again.");
      }
      return;
    }

    const response = await apiFetch(
      "/property/portal/payments/initiate/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          invoice: invoice.id,
          provider: gateway.provider,
        }),
      },
      organizationId,
    );
    const result = (await response.json().catch(() => ({}))) as {
      checkout_url?: string;
      detail?: string;
      provider?: string[];
    };
    if (!response.ok || !result.checkout_url) {
      setError(
        result.detail ||
          result.provider?.[0] ||
          "Payment could not be started. Please try again.",
      );
      setPaymentBusy(null);
      return;
    }
    window.location.assign(result.checkout_url);
  }
  if (loading)
    return (
      <div className="page-wrap">
        <div className="data-loading">Loading your tenant account...</div>
      </div>
    );
  if (!data)
    return (
      <div className="page-wrap">
        <div className="form-error">{error}</div>
      </div>
    );
  const lease = data.currentLease;
  return (
    <div className="page-wrap property-app">
      <section className="property-heading">
        <div>
          <p className="eyebrow">Tenant self-service</p>
          <h1>Good morning, {data.tenant.name}.</h1>
          <p>
            Invoices, receipts, lease information, documents and maintenance in
            one secure account.
          </p>
        </div>
        <button className="primary-action" onClick={() => setModal(true)}>
          Report an issue
        </button>
      </section>
      <nav className="module-tabs" aria-label="Tenant portal sections">
        {(Object.keys(labels) as Tab[]).map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {labels[item]}
          </button>
        ))}
      </nav>
      {error && <div className="form-error">{error}</div>}
      {stkNotice && (
        <div style={{ background: "#dcfce7", color: "#15803d", padding: "12px 16px", borderRadius: 8, fontWeight: 600, marginBottom: 16, border: "1px solid #bbf7d0" }}>
          [OK] {stkNotice}
        </div>
      )}
      {tab === "overview" && (
        <>
          <section className="kpi-grid">
            <Kpi
              label="Outstanding balance"
              value={cash.format(Number(data.balance))}
              note={
                data.invoices.find((row) => Number(row.balance) > 0)?.due_on
                  ? `Next due ${data.invoices.find((row) => Number(row.balance) > 0)?.due_on}`
                  : "Account up to date"
              }
              go={() => setTab("invoices")}
            />
            <Kpi
              label="Recent invoices"
              value={String(data.invoices.length)}
              note="Latest 12 billing records"
              go={() => setTab("invoices")}
            />
            <Kpi
              label="Payments"
              value={String(data.receipts.length)}
              note="Receipts available"
              go={() => setTab("payments")}
            />
            <Kpi
              label="Maintenance"
              value={String(
                data.serviceRequests.filter(
                  (row) => !["resolved", "closed"].includes(String(row.status)),
                ).length,
              )}
              note="Open requests"
              go={() => setTab("maintenance")}
            />
          </section>
          <section className="dashboard-columns">
            <article className="data-panel">
              <Title text="Current lease" go={() => setTab("profile")} />
              {lease ? (
                <div className="portal-lease">
                  <strong>
                    {lease.property_name} - {lease.unit_code}
                  </strong>
                  <span>{lease.reference}</span>
                  <span>
                    {lease.starts_on} to {lease.ends_on}
                  </span>
                  <b>{cash.format(Number(lease.monthly_rent))} / month</b>
                </div>
              ) : (
                <Empty />
              )}
            </article>
            <article className="data-panel">
              <Title text="Open maintenance tickets" go={() => setTab("maintenance")} />
              <PortalTable
                headers={["Subject", "Priority", "Status", "Created"]}
                rows={data.serviceRequests.slice(0, 5).map((row) => [
                  String(row.subject),
                  String(row.priority),
                  String(row.status),
                  String(row.created_at || row.updated_at || "-").slice(0, 10),
                ])}
              />
            </article>
          </section>
        </>
      )}
      {tab === "invoices" && (
        <Panel title="Billing & Invoices">
          <PortalTable
            headers={[
              "Invoice #",
              "Due Date",
              "Amount",
              "Paid",
              "Balance",
              "Status",
              "Action",
            ]}
            rows={data.invoices.map((row) => [
              String(row.number),
              String(row.due_on),
              cash.format(Number(row.total_amount)),
              cash.format(Number(row.paid_amount)),
              cash.format(Number(row.balance)),
              String(row.status),
              <span key={String(row.id)} className="portal-action-group">
                <button
                  type="button"
                  onClick={() => void downloadDocument(`/property/portal/invoices/${row.id}.pdf/`, `${row.number}.pdf`)}
                >
                  PDF
                </button>
                {Number(row.balance) > 0 &&
                  ["issued", "partial", "overdue"].includes(
                    String(row.status),
                  ) && (
                    <button
                      type="button"
                      className="primary-action"
                      disabled={paymentBusy === String(row.id)}
                      onClick={() => void payInvoice(row)}
                    >
                      {paymentBusy === String(row.id)
                        ? "Starting..."
                        : `Pay${data.paymentGateways?.[0] ? ` via ${data.paymentGateways[0].display_name}` : " online"}`}
                    </button>
                  )}
              </span>,
            ])}
          />
        </Panel>
      )}
      {tab === "payments" && (
        <Panel title="Payments & receipts" action={
          <button type="button" onClick={() => void downloadDocument("/property/portal/statement.pdf/", `Tenant-statement-${data.tenant.code}.pdf`)}>
            Download statement PDF
          </button>
        }>
          <PortalTable
            headers={[
              "Receipt #",
              "Date",
              "Method",
              "Amount",
              "Reference",
              "Action",
            ]}
            rows={data.receipts.map((row) => [
              String(row.receipt_number),
              String(row.payment_date),
              String(row.payment_method),
              cash.format(Number(row.amount_paid)),
              String(row.external_reference || "-"),
              <button
                key={String(row.id)}
                type="button"
                onClick={() => void downloadDocument(`/property/portal/receipts/${row.id}.pdf/`, `${row.receipt_number}.pdf`)}
              >
                PDF
              </button>,
            ])}
          />
        </Panel>
      )}
      {tab === "maintenance" && (
        <Panel
          title="Maintenance tickets"
          action={
            <button className="primary-action" onClick={() => setModal(true)}>
              Report issue
            </button>
          }
        >
          <PortalTable
            headers={["Subject", "Priority", "Status", "Created", "Last updated"]}
            rows={data.serviceRequests.map((row) => [
              String(row.subject),
              String(row.priority),
              String(row.status),
              String(row.created_at).slice(0, 16),
              String(row.updated_at).slice(0, 16),
            ])}
          />
        </Panel>
      )}
      {tab === "documents" && (
        <Panel title="Lease documents & notices">
          <PortalTable
            headers={[
              "Document name",
              "Category",
              "Document #",
              "Expires",
              "Action",
            ]}
            rows={data.documents.map((row) => [
              String(row.title),
              String(row.category),
              String(row.document_number || "-"),
              String(row.expires_on || "-"),
              row.file_url ? (
                <a
                  key={String(row.id)}
                  href={String(row.file_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              ) : (
                "None"
              ),
            ])}
          />
        </Panel>
      )}
      {tab === "profile" && (
        <Panel title="Tenant Profile & Lease">
          <div className="portal-profile-grid">
            <div className="profile-card">
              <h3>Account details</h3>
              <p>Name: <strong>{data.tenant.name}</strong></p>
              <p>Code: <strong>{data.tenant.code}</strong></p>
              <p>Email: <strong>{data.tenant.email || "-"}</strong></p>
              <p>Phone: <strong>{data.tenant.phone || "-"}</strong></p>
            </div>
            {lease && (
              <div className="profile-card">
                <h3>Lease agreement</h3>
                <p>Property: <strong>{lease.property_name} - {lease.unit_code}</strong></p>
                <p>Reference: <strong>{lease.reference}</strong></p>
                <p>Rent: <strong>{cash.format(Number(lease.monthly_rent))} / month</strong></p>
                <p>Term: <strong>{lease.starts_on} to {lease.ends_on}</strong></p>
              </div>
            )}
          </div>
        </Panel>
      )}
      {modal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Report Maintenance Issue</h2>
              <button onClick={() => setModal(false)}>x</button>
            </div>
            <form onSubmit={(e) => void submitRequest(e as any)}>
              <div className="form-group">
                <label>Subject</label>
                <input
                  name="subject"
                  required
                  placeholder="e.g. Leaking kitchen tap"
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select name="priority" defaultValue="normal">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Provide additional details..."
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-action">
                  Submit request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  go,
}: {
  label: string;
  value: string;
  note: string;
  go: () => void;
}) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-note">{note}</span>
      <button onClick={go}>View details -&gt;</button>
    </div>
  );
}
function Title({ text, go }: { text: string; go: () => void }) {
  return (
    <div className="panel-title">
      <h2>{text}</h2>
      <button onClick={go}>View all -&gt;</button>
    </div>
  );
}
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="data-panel collection-panel">
      <header className="collection-title">
        <div>
          <p className="eyebrow">My account</p>
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </article>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`data-status status-${value}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Empty() {
  return <div className="empty-state">No records are available.</div>;
}
function PortalTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return rows.length ? (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, position) => (
                <td key={position}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
