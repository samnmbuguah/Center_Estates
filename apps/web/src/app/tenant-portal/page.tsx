"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Rating, TextField, Typography } from "@mui/material";

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
  offerLetter: null | {
    reference: string;
    version: number;
    status: "issued" | "accepted" | "rejected";
    issued_at?: string;
    accepted_at?: string;
    accepted_by?: string;
    terms: {
      property_name: string;
      unit_code: string;
      starts_on: string;
      ends_on: string;
      monthly_rent: string;
      billing_day: number;
      escalation_percent: string;
      escalation_interval_months: number;
    };
  };
  balance: string;
  walletCredit?: string;
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
  | "offer"
  | "notices"
  | "profile";
const labels: Record<Tab, string> = {
  overview: "Overview",
  invoices: "Invoices",
  payments: "Payments & receipts",
  maintenance: "Maintenance requests",
  documents: "Documents",
  offer: "Offer & acceptance",
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
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");
  const [paymentBusy, setPaymentBusy] = useState<string | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [confirmationRequest, setConfirmationRequest] = useState<Row | null>(null);
  const [confirmationMode, setConfirmationMode] = useState<"confirm" | "reopen">("confirm");
  const [satisfactionScore, setSatisfactionScore] = useState<number | null>(5);
  const [reopenReason, setReopenReason] = useState("");
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [previewTenants, setPreviewTenants] = useState<{ id: string; name: string; code: string }[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [offerAcceptedBy, setOfferAcceptedBy] = useState("");
  const [offerConfirmed, setOfferConfirmed] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerError, setOfferError] = useState("");

  const load = useCallback(async (selectedTenantId?: string) => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const urlTenantParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tenant") : null;
      const targetTenantId = selectedTenantId || urlTenantParam || activeTenantId;
      const endpoint = targetTenantId ? `/property/portal/${targetTenantId}/` : "/property/portal/";
      const response = await apiFetch(endpoint, {}, organizationId);
      if (!response.ok) {
        if (response.status === 403 && !targetTenantId) {
          // Check if current user is admin/staff who can preview tenant portals
          try {
            const tenantsRes = await apiFetch("/property/tenants/", {}, organizationId);
            if (tenantsRes.ok) {
              const tenantsList = await tenantsRes.json();
              const results: { id: string; name: string; code: string }[] = Array.isArray(tenantsList)
                ? tenantsList
                : (tenantsList?.results || []);
              if (results.length > 0) {
                setPreviewTenants(results);
                setActiveTenantId(results[0].id);
                const previewRes = await apiFetch(`/property/portal/${results[0].id}/`, {}, organizationId);
                if (previewRes.ok) {
                  const json = await previewRes.json();
                  setData(json);
                  setLoading(false);
                  return;
                }
              }
            }
          } catch { /* ignore and fallback to error */ }
        }
        let errMessage = response.status === 403
          ? "This account is not linked to a tenant portal profile."
          : "Your tenant account could not be loaded.";
        try {
          const body = await response.json();
          if (body?.detail) errMessage = String(body.detail);
        } catch { /* ignore non-JSON */ }
        setError(errMessage);
        setLoading(false);
        return;
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error("Tenant portal load error:", err);
      setError("Unable to load tenant portal data. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, activeTenantId]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestBusy) return;
    setRequestBusy(true);
    setRequestError("");
    const payload = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch(
        "/property/portal/service-requests/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify(payload),
        },
        organizationId,
      );
      if (!response.ok) {
        setRequestError(await apiErrorMessage(response, "The maintenance request could not be submitted."));
        return;
      }
      const created = await response.json().catch(() => ({}));
      setModal(false);
      setRequestSuccess(`Request ${created.reference || ""} was submitted successfully. The maintenance team can now track it.`);
      setTab("maintenance");
      await load();
    } catch {
      setRequestError("The maintenance request could not be submitted. Check your connection and try again.");
    } finally {
      setRequestBusy(false);
    }
  }
  async function submitResolutionDecision() {
    if (!confirmationRequest) return;
    if (confirmationMode === "reopen" && !reopenReason.trim()) {
      setError("Tell the maintenance team what remains unresolved.");
      return;
    }
    if (confirmationMode === "confirm" && !satisfactionScore) {
      setError("Rate the completed work before closing this request.");
      return;
    }
    setConfirmationBusy(true);
    setError("");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      `/facility/portal/service-requests/${confirmationRequest.id}/${confirmationMode}/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(
          confirmationMode === "confirm"
            ? { satisfaction_score: satisfactionScore }
            : { reason: reopenReason.trim() },
        ),
      },
      organizationId,
    );
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    setConfirmationBusy(false);
    if (!response.ok) {
      setError(String(result.detail || result.status || result.reason || "The request could not be updated."));
      return;
    }
    setConfirmationRequest(null);
    setReopenReason("");
    await load();
  }
  async function acceptOfferLetter() {
    if (!offerAcceptedBy.trim() || !offerConfirmed) {
      setOfferError("Enter the authorised signatory's name and confirm acceptance before continuing.");
      return;
    }
    setOfferBusy(true);
    setOfferError("");
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch("/property/portal/offer-letter/accept/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ accepted_by: offerAcceptedBy.trim(), confirmed: true }),
      }, organizationId);
      if (!response.ok) {
        setOfferError(await apiErrorMessage(response, "The offer could not be accepted. Please try again."));
        return;
      }
      setRequestSuccess("Tenancy offer accepted. Billing can proceed when the first charge is due.");
      await load();
    } catch {
      setOfferError("The offer could not be accepted. Check your connection and try again.");
    } finally {
      setOfferBusy(false);
    }
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
  const [stkPhone, setStkPhone] = useState("");
  const [pendingPayInvoices, setPendingPayInvoices] = useState<Row[] | null>(null);

  async function payInvoice(invoice: Row) {
    await payInvoices([invoice]);
  }

  async function payInvoices(invoices: Row[]) {
    if (!invoices.length) return;
    const gateway = data?.paymentGateways?.[0];
    const tenantPhone = data?.tenant?.phone || "";

    // If M-Pesa and no phone stored, prompt for it first
    if ((gateway?.provider === "mpesa" || !gateway) && !tenantPhone) {
      setStkPhone("");
      setPendingPayInvoices(invoices);
      return;
    }

    await _executePayment(invoices, tenantPhone, gateway);
  }

  async function _executePayment(
    invoices: Row[],
    phone: string,
    gateway: typeof data extends null ? never : NonNullable<typeof data>["paymentGateways"][0] | undefined
  ) {
    const paymentKey = invoices.length === 1 ? String(invoices[0].id) : "selected";
    setPaymentBusy(paymentKey);
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
            invoices: invoices.map(invoice => invoice.id),
            phone_number: phone,
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
          invoices: invoices.map(invoice => invoice.id),
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
  const isImpersonating = typeof window !== "undefined" && Boolean(new URLSearchParams(window.location.search).get("tenant"));
  const isPreviewMode = isImpersonating || previewTenants.length > 0;

  return (
    <div className="page-wrap property-app">
      {isPreviewMode && (
        <div style={{ background: "linear-gradient(90deg, #1e3a8a, #2563eb)", color: "#fff", padding: "12px 18px", borderRadius: 10, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Staff Preview Mode: Viewing Portal as {data.tenant.name} ({data.tenant.code})</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>Administrative preview active. All invoices, receipts, and service requests reflect this tenant&apos;s live view.</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {previewTenants.length > 1 && (
              <select
                style={{ background: "#ffffff", color: "#1e293b", padding: "6px 12px", borderRadius: 6, fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}
                value={activeTenantId || data.tenant.code}
                onChange={(e) => {
                  setActiveTenantId(e.target.value);
                  void load(e.target.value);
                }}
              >
                {previewTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    Switch Tenant: {t.name} ({t.code})
                  </option>
                ))}
              </select>
            )}
            {isImpersonating && (
              <button
                className="btn sm"
                style={{ background: "rgba(255, 255, 255, 0.2)", color: "#fff", border: "1px solid rgba(255, 255, 255, 0.4)", borderRadius: 6, fontWeight: 700, padding: "6px 12px", cursor: "pointer" }}
                onClick={() => window.close()}
              >
                Close Support View ✕
              </button>
            )}
          </div>
        </div>
      )}
      <section className="property-heading">
        <div>
          <p className="eyebrow">Tenant self-service</p>
          <h1>Good morning, {data.tenant.name}.</h1>
          <p>
            Invoices, receipts, lease information, documents and maintenance in
            one secure account.
          </p>
        </div>
        <button className="primary-action" onClick={() => { setRequestError(""); setModal(true); }}>
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
      {requestSuccess && <Alert severity="success" onClose={() => setRequestSuccess("")} sx={{ mb: 2 }}>{requestSuccess}</Alert>}
      {pendingPayInvoices && (
        <div style={{ background: "#eff6ff", color: "#1e40af", padding: "16px", borderRadius: 8, marginBottom: 16, border: "1px solid #bfdbfe" }}>
          <strong style={{ display: "block", marginBottom: 8 }}>📲 Enter your M-Pesa phone number to pay {pendingPayInvoices.length} invoice{pendingPayInvoices.length === 1 ? "" : "s"}</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="tel"
              placeholder="e.g. 0712 345 678"
              value={stkPhone}
              onChange={(e) => setStkPhone(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #93c5fd", fontSize: 14, flex: 1, minWidth: 180 }}
            />
            <button
              className="primary-action"
              disabled={!stkPhone.trim() || paymentBusy !== null}
              onClick={async () => {
                const invoices = pendingPayInvoices;
                const gw = data?.paymentGateways?.[0];
                setPendingPayInvoices(null);
                await _executePayment(invoices, stkPhone.trim(), gw);
              }}
            >
              {paymentBusy ? "Starting…" : "Send STK Push"}
            </button>
            <button onClick={() => setPendingPayInvoices(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}
      {stkNotice && (
        <div style={{ background: "#dcfce7", color: "#15803d", padding: "12px 16px", borderRadius: 8, fontWeight: 600, marginBottom: 16, border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 8 }}>
          <span>✅</span> {stkNotice}
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
            {Number(data.walletCredit || 0) > 0 && (
              <Kpi
                label="Available credit"
                value={cash.format(Number(data.walletCredit))}
                note="Applied automatically to your next invoice"
                go={() => setTab("invoices")}
              />
            )}
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
            {data.offerLetter?.status === "issued" && (
              <Kpi
                label="Action required"
                value="Offer pending"
                note="Accept tenancy terms to enable first billing"
                go={() => setTab("offer")}
              />
            )}
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
        <Panel title="Billing & Invoices" action={selectedInvoiceIds.length > 0 ? (
          <button
            type="button" className="primary-action" disabled={paymentBusy !== null}
            onClick={() => void payInvoices(data.invoices.filter(invoice => selectedInvoiceIds.includes(String(invoice.id))))}
          >
            Pay selected ({selectedInvoiceIds.length}) · {cash.format(data.invoices.filter(invoice => selectedInvoiceIds.includes(String(invoice.id))).reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0))}
          </button>
        ) : data.invoices.some(invoice => Number(invoice.balance) > 0 && ["issued", "partial", "overdue"].includes(String(invoice.status))) ? (
          <button type="button" className="primary-action" disabled={paymentBusy !== null} onClick={() => void payInvoices(data.invoices.filter(invoice => Number(invoice.balance) > 0 && ["issued", "partial", "overdue"].includes(String(invoice.status))))}>Pay all outstanding</button>
        ) : undefined}>
          <PortalTable
            headers={[
              "Select",
              "Invoice #",
              "Charge",
              "Due Date",
              "Amount",
              "Paid",
              "Balance",
              "Status",
              "Action",
            ]}
            rows={data.invoices.map((row) => [
              Number(row.balance) > 0 && ["issued", "partial", "overdue"].includes(String(row.status)) ? (
                <input
                  key={String(row.id)} type="checkbox" aria-label={`Select invoice ${String(row.number)}`}
                  checked={selectedInvoiceIds.includes(String(row.id))}
                  onChange={(event) => setSelectedInvoiceIds(current => event.target.checked ? [...current, String(row.id)] : current.filter(id => id !== String(row.id)))}
                />
              ) : null,
              String(row.number),
              String(row.invoice_type || "charge").replaceAll("_", " "),
              String(row.due_on),
              cash.format(Number(row.amount || row.total_amount || 0)),
              cash.format(Number(row.amount || row.total_amount || 0) - Number(row.balance || 0)),
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
              String(row.number ?? row.receipt_number ?? "—"),
              String(row.received_on ?? row.payment_date ?? "—"),
              String(row.payment_method ?? "—").replace(/_/g, " "),
              cash.format(Number(row.amount ?? row.amount_paid ?? 0)),
              String(row.external_reference || "—"),
              <button
                key={String(row.id)}
                type="button"
                onClick={() => void downloadDocument(`/property/portal/receipts/${row.id}.pdf/`, `${String(row.number ?? row.receipt_number ?? row.id)}.pdf`)}
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
            headers={["Subject", "Priority", "Status", "Created", "Resolution confirmation"]}
            rows={data.serviceRequests.map((row) => [
              String(row.subject),
              String(row.priority),
              String(row.status),
              String(row.submitted_at || "").slice(0, 16),
              String(row.status) === "resolved" ? (
                <span key={String(row.id)} style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => { setConfirmationMode("confirm"); setConfirmationRequest(row); }}>Confirm & close</button>
                  <button type="button" onClick={() => { setConfirmationMode("reopen"); setConfirmationRequest(row); }}>Reopen</button>
                </span>
              ) : String(row.status) === "closed" ? `Closed · ${row.satisfaction_score || "—"}/5` : "Awaiting maintenance",
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
      {tab === "offer" && (
        <Panel title="Tenancy offer & acceptance">
          {!data.offerLetter ? <Empty /> : (
            <div className="portal-profile-grid">
              <div className="profile-card">
                <h3>{data.offerLetter.reference} · Version {data.offerLetter.version}</h3>
                <p>Status: <strong>{data.offerLetter.status === "accepted" ? "Accepted" : "Awaiting acceptance"}</strong></p>
                <p>Premises: <strong>{data.offerLetter.terms.property_name} — {data.offerLetter.terms.unit_code}</strong></p>
                <p>Term: <strong>{data.offerLetter.terms.starts_on} to {data.offerLetter.terms.ends_on}</strong></p>
                <p>Rent: <strong>{cash.format(Number(data.offerLetter.terms.monthly_rent))} / month</strong></p>
                <p>Billing date: <strong>Day {data.offerLetter.terms.billing_day} of each billing cycle</strong></p>
                {Number(data.offerLetter.terms.escalation_percent) > 0 && <p>Escalation: <strong>{data.offerLetter.terms.escalation_percent}% every {data.offerLetter.terms.escalation_interval_months} months</strong></p>}
              </div>
              <div className="profile-card">
                {data.offerLetter.status === "accepted" ? <>
                  <h3>Acceptance recorded</h3>
                  <p>Accepted by <strong>{data.offerLetter.accepted_by || "Authorised signatory"}</strong>.</p>
                  <p>Recorded {data.offerLetter.accepted_at ? new Date(data.offerLetter.accepted_at).toLocaleString() : "—"}.</p>
                  <Alert severity="success">The accepted offer is attached to the tenancy audit trail.</Alert>
                </> : isPreviewMode ? <>
                  <h3>Awaiting tenant acceptance</h3>
                  <Alert severity="info">This is a staff preview. The tenant must sign in to their own portal account to accept the offer.</Alert>
                </> : <>
                  <h3>Accept this offer</h3>
                  <p>Review the tenancy details before accepting. This confirmation is recorded against your tenancy and enables first billing.</p>
                  {offerError && <Alert severity="error" sx={{ mb: 1 }}>{offerError}</Alert>}
                  <TextField fullWidth label="Authorised signatory name" value={offerAcceptedBy} onChange={(event) => setOfferAcceptedBy(event.target.value)} sx={{ mb: 1.5 }} />
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 16 }}>
                    <input type="checkbox" checked={offerConfirmed} onChange={(event) => setOfferConfirmed(event.target.checked)} />
                    <span>I confirm I am authorised to accept this tenancy offer and agree to the stated terms.</span>
                  </label>
                  <Button variant="contained" disabled={offerBusy} onClick={() => void acceptOfferLetter()}>{offerBusy ? "Recording acceptance…" : "Accept tenancy offer"}</Button>
                </>}
              </div>
            </div>
          )}
        </Panel>
      )}
      <Dialog open={Boolean(confirmationRequest)} onClose={() => !confirmationBusy && setConfirmationRequest(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirmationMode === "confirm" ? "Confirm completed work" : "Reopen maintenance request"}</DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          {confirmationMode === "confirm" ? (
            <>
              <p>Confirm that <strong>{String(confirmationRequest?.subject || "this issue")}</strong> has been resolved. This closes the request.</p>
              <Rating value={satisfactionScore} onChange={(_event, value) => setSatisfactionScore(value)} aria-label="Satisfaction score" />
            </>
          ) : (
            <TextField
              autoFocus fullWidth multiline minRows={4} label="What remains unresolved?"
              value={reopenReason} onChange={(event) => setReopenReason(event.target.value)}
              helperText="Your reason is sent to the assigned maintenance team."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmationRequest(null)} disabled={confirmationBusy}>Cancel</Button>
          <Button variant="contained" color={confirmationMode === "confirm" ? "success" : "warning"} onClick={() => void submitResolutionDecision()} disabled={confirmationBusy}>
            {confirmationBusy ? "Saving…" : confirmationMode === "confirm" ? "Confirm & close" : "Reopen request"}
          </Button>
        </DialogActions>
      </Dialog>
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
      <Dialog open={modal} onClose={requestBusy ? undefined : () => setModal(false)} fullWidth maxWidth="sm">
        <form onSubmit={submitRequest}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="overline" color="error.main" sx={{ fontWeight: 800, letterSpacing: 1.5 }}>Tenant maintenance</Typography>
          <Typography variant="h5" component="div" sx={{ fontWeight: 800 }}>Report an issue</Typography>
          <Typography variant="body2" color="text.secondary">Tell the property team what happened and how urgently it needs attention.</Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ display: "grid", gap: 2, pt: 2.5 }}>
          {requestError && <Alert severity="error">{requestError}</Alert>}
          <TextField autoFocus required fullWidth name="subject" label="Issue summary" placeholder="e.g. Leaking kitchen tap" slotProps={{ htmlInput: { maxLength: 160 } }} />
          <TextField select required fullWidth name="category" label="Category" defaultValue="">
            <MenuItem value="" disabled>Select the closest category</MenuItem>
            {['Plumbing', 'Electrical', 'Air conditioning', 'Lift / elevator', 'Access & security', 'Cleaning', 'Fire & safety', 'Building fabric', 'Pest control', 'Other'].map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
          </TextField>
          <TextField select required fullWidth name="priority" label="Priority" defaultValue="medium" helperText="Choose critical only where there is immediate danger or major service loss.">
            <MenuItem value="low">Low — can be scheduled</MenuItem>
            <MenuItem value="medium">Medium — normal response</MenuItem>
            <MenuItem value="high">High — significantly disruptive</MenuItem>
            <MenuItem value="critical">Critical — safety or major service failure</MenuItem>
          </TextField>
          <TextField required fullWidth multiline minRows={4} name="description" label="Description" placeholder="Describe where the issue is, when it started and how it affects the unit…" slotProps={{ htmlInput: { maxLength: 2000 } }} />
          <Alert severity="info">This request will be linked automatically to {data.currentLease?.property_name || "your property"}, Unit {data.currentLease?.unit_code || "—"}.</Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setModal(false)} disabled={requestBusy}>Cancel</Button>
          <Button type="submit" variant="contained" color="error" disabled={requestBusy}>{requestBusy ? "Submitting…" : "Submit maintenance request"}</Button>
        </DialogActions>
        </form>
      </Dialog>
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
