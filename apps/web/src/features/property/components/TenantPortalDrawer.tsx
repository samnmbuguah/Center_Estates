"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DetailDrawer, StatusPill, LoadingState, EmptyState, Panel } from "@/components/module-ui";
import { TenantRow, ID, Row, InvoiceRow, ReceiptRow } from "../types/property.types";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { fmtDate, kM } from "../utils/property.utils";

/* ─── Types ─── */

interface PaymentGateway {
  id: string;
  provider: string;
  display_name: string;
  property_id: string;
}

type StkStatus = "idle" | "sending" | "polling" | "paid" | "failed" | "cancelled";

/* ─── M-Pesa STK Push Modal ─── */

function MpesaStkPushModal({
  invoice,
  gateway,
  tenantPhone,
  organizationId,
  onClose,
  onPaid,
}: {
  invoice: InvoiceRow;
  gateway: PaymentGateway;
  tenantPhone: string;
  organizationId: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [phone, setPhone] = useState(tenantPhone);
  const [status, setStatus] = useState<StkStatus>("idle");
  const [message, setMessage] = useState("");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    pollCountRef.current = 0;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback((id: string) => {
    pollCountRef.current = 0;
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > 40) {
        // 40 × 3s = 2 minutes timeout
        stopPolling();
        setStatus("failed");
        setError("Payment timed out. The STK Push was not completed within 2 minutes. Please try again.");
        return;
      }
      try {
        const res = await apiFetch(`/property/payment-intents/${id}/`, {}, organizationId);
        if (!res.ok) return;
        const data = await res.json();
        const s = String(data.status ?? "");
        if (s === "paid") {
          stopPolling();
          setStatus("paid");
          setMessage("Payment confirmed! Your receipt has been generated.");
          setTimeout(onPaid, 1800);
        } else if (s === "failed" || s === "expired" || s === "cancelled") {
          stopPolling();
          setStatus(s === "cancelled" ? "cancelled" : "failed");
          setError(data.error_message || "Payment was not completed. Please try again.");
        }
        // "pending" → keep polling
      } catch {
        // network hiccup — keep polling
      }
    }, 3000);
  }, [organizationId, stopPolling, onPaid]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { setError("Enter the M-Pesa phone number."); return; }
    setError("");
    setStatus("sending");

    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        "/property/tenant-portal/payments/stk-push/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({ invoice: invoice.id, phone_number: phone.trim() }),
        },
        organizationId,
      );
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;

      if (res.ok) {
        setStatus("polling");
        setMessage(String(body.message ?? "STK Push sent — enter your M-Pesa PIN on your phone."));
        const id = String(body.intent_id ?? "");
        setIntentId(id);
        if (id) startPolling(id);
      } else {
        setStatus("failed");
        const errDetail = body.detail ?? body.non_field_errors ?? body.gateway ?? body.invoice;
        const errMsg = Array.isArray(errDetail) ? errDetail.join(" ") : String(errDetail ?? "Failed to initiate payment.");
        setError(errMsg);
      }
    } catch {
      setStatus("failed");
      setError("Network error. Check your connection and try again.");
    }
  }

  function handleRetry() {
    stopPolling();
    setStatus("idle");
    setError("");
    setMessage("");
    setIntentId(null);
  }

  const amount = Number(invoice.balance ?? invoice.amount ?? 0);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && status !== "polling") onClose(); }}
    >
      <div
        style={{
          background: "var(--surface, #fff)", borderRadius: 16, padding: 28,
          width: "100%", maxWidth: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          border: "1px solid var(--border, #e2e8f0)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, #00a651 0%, #007a3d 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, flexShrink: 0,
            }}
          >
            📱
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>M-Pesa STK Push</h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted, #64748b)" }}>{gateway.display_name}</p>
          </div>
          {status !== "polling" && (
            <button
              onClick={onClose}
              style={{
                marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
                fontSize: 20, color: "var(--muted, #64748b)", lineHeight: 1, padding: 4,
              }}
              aria-label="Close"
            >×</button>
          )}
        </div>

        {/* Invoice summary */}
        <div
          style={{
            background: "var(--surface-2, #f8fafc)", borderRadius: 10, padding: "12px 16px",
            marginBottom: 20, display: "grid", gridTemplateColumns: "1fr auto", gap: 4,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Invoice</div>
            <div style={{ fontWeight: 600, fontSize: 14, fontFamily: "monospace" }}>{String(invoice.number ?? "—")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Amount Due</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: "var(--primary, #17243B)" }}>KES {amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* States */}
        {status === "idle" && (
          <form onSubmit={(e) => void handleSend(e)}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              M-Pesa Phone Number
            </label>
            <input
              id="mpesa-phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0712345678 or 254712345678"
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
                border: "1.5px solid var(--border, #e2e8f0)", boxSizing: "border-box",
                fontFamily: "monospace", marginBottom: 16, outline: "none",
              }}
              autoFocus
            />
            {error && (
              <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>
                ⚠ {error}
              </div>
            )}
            <button
              id="mpesa-send-push-btn"
              type="submit"
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #00a651 0%, #007a3d 100%)",
                color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: 0.3,
              }}
            >
              Send STK Push →
            </button>
            <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
              A payment prompt will appear on the registered M-Pesa phone. Enter your PIN to complete payment.
            </p>
          </form>
        )}

        {status === "sending" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Initiating STK Push…</p>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Contacting Safaricom Daraja API</p>
          </div>
        )}

        {status === "polling" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }}>📲</div>
            <p style={{ fontWeight: 600, margin: "0 0 8px" }}>{message}</p>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px" }}>
              Waiting for confirmation… this can take up to 2 minutes.
            </p>
            <div
              style={{
                height: 4, background: "var(--border, #e2e8f0)", borderRadius: 2, overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%", width: "40%", background: "#00a651",
                  borderRadius: 2, animation: "slide 2s linear infinite",
                }}
              />
            </div>
            <style>{`
              @keyframes slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }
              @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
            `}</style>
            {intentId && (
              <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 12, fontFamily: "monospace" }}>
                Intent: {intentId.slice(0, 8)}…
              </p>
            )}
          </div>
        )}

        {status === "paid" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, margin: "0 0 4px", fontSize: 16, color: "#16a34a" }}>Payment Confirmed!</p>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{message}</p>
          </div>
        )}

        {(status === "failed" || status === "cancelled") && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>{status === "cancelled" ? "🚫" : "❌"}</div>
            <p style={{ fontWeight: 700, margin: "0 0 8px", color: "#dc2626", fontSize: 15 }}>
              {status === "cancelled" ? "Payment Cancelled" : "Payment Failed"}
            </p>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 20px" }}>{error}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={handleRetry}
                style={{
                  padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #00a651 0%, #007a3d 100%)",
                  color: "#fff", fontWeight: 600, fontSize: 14,
                }}
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 24px", borderRadius: 8,
                  border: "1.5px solid var(--border, #e2e8f0)",
                  background: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Tenant Portal Drawer ─── */

export function TenantPortalDrawer({ tenant, organizationId, onClose }: {
  tenant: TenantRow; organizationId: string | null; onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [tenantDetail, setTenantDetail] = useState<Row | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [statement, setStatement] = useState<Record<string, unknown> | null>(null);
  const [notices, setNotices] = useState<Row[]>([]);
  const [walletCredit, setWalletCredit] = useState(0);
  const [walletEntries, setWalletEntries] = useState<Row[]>([]);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [stkInvoice, setStkInvoice] = useState<InvoiceRow | null>(null);
  const [stkGateway, setStkGateway] = useState<PaymentGateway | null>(null);

  const loadPortal = useCallback(async (orgId: string) => {
    const tId = String(tenant.id);
    const tName = String(tenant.name ?? "");
    const [portalRes, tenantRes, invoiceRes, receiptRes] = await Promise.all([
      apiFetch(`/property/portal/${tId}/`, {}, orgId),
      apiFetch(`/property/tenants/${tId}/`, {}, orgId),
      apiFetch("/property/invoices/?search=", {}, orgId),
      apiFetch("/property/receipts/?search=", {}, orgId),
    ]);

    let portalInvoices: InvoiceRow[] = [];
    let portalReceipts: ReceiptRow[] = [];
    let portalStatement: Record<string, unknown> | null = null;
    let portalGateways: PaymentGateway[] = [];

    if (portalRes.ok) {
      const body = await portalRes.json().catch(() => null) as Record<string, unknown> | null;
      if (body && typeof body === "object") {
        if (Array.isArray(body.invoices)) portalInvoices = body.invoices as InvoiceRow[];
        if (Array.isArray(body.receipts)) portalReceipts = body.receipts as ReceiptRow[];
        if (body.statement && typeof body.statement === "object") portalStatement = body.statement as Record<string, unknown>;
        if (body.tenant && typeof body.tenant === "object") setTenantDetail(body.tenant as Row);
        if (Array.isArray(body.paymentGateways)) portalGateways = body.paymentGateways as PaymentGateway[];
        if (Array.isArray(body.notices)) setNotices(body.notices as Row[]);
        if (Array.isArray(body.walletEntries)) setWalletEntries(body.walletEntries as Row[]);
        setWalletCredit(Number(body.walletCredit || 0));
      }
    }
    if (tenantRes.ok) {
      const detail = await tenantRes.json().catch(() => null);
      if (detail && typeof detail === "object" && !tenantDetail) setTenantDetail(detail as Row);
    }
    if (portalInvoices.length === 0 && invoiceRes.ok) {
      const list = await invoiceRes.json().catch(() => []);
      const arr = Array.isArray(list) ? list as InvoiceRow[] : [];
      portalInvoices = arr.filter((i) => String(i.tenant_id ?? "") === tId || String(i.tenant ?? "") === tId || String(i.tenant_name ?? "") === tName);
    }
    if (portalReceipts.length === 0 && receiptRes.ok) {
      const list = await receiptRes.json().catch(() => []);
      const arr = Array.isArray(list) ? list as ReceiptRow[] : [];
      portalReceipts = arr.filter((r) => String(r.tenant ?? "") === tId || String(r.tenant_name ?? "") === tName);
    }

    setInvoices(portalInvoices);
    setReceipts(portalReceipts);
    setStatement(portalStatement);
    setGateways(portalGateways);
    setLoading(false);
  }, [tenant.id, tenant.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;
    if (!organizationId) { setLoading(false); return; }
    const orgId = organizationId;
    void loadPortal(orgId).then(() => { if (!active) return; }).catch(() => setLoading(false));
    return () => { active = false; };
  }, [tenant.id, organizationId, loadPortal]);

  const detail = tenantDetail ?? (tenant as unknown as Row);
  const outstanding = invoices.reduce((s, i) => s + Number(i.balance ?? 0), 0);
  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const totalPaid = receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const statementBalance = statement?.balance !== undefined ? Number(statement.balance) : outstanding;
  const statementBilled = statement?.total_billed !== undefined ? Number(statement.total_billed) : totalBilled;
  const statementPaid = statement?.total_paid !== undefined ? Number(statement.total_paid) : totalPaid;

  const mpesaGateway = gateways.find((g) => g.provider === "mpesa") ?? null;

  async function downloadStatement() {
    if (!organizationId) return;
    const response = await apiFetch(`/property/portal/statement.pdf?tenant=${tenant.id}`, {}, organizationId);
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const PAYABLE_STATUSES = new Set(["issued", "partial", "overdue"]);

  function openStkPush(inv: InvoiceRow) {
    if (!mpesaGateway) return;
    setStkInvoice(inv);
    setStkGateway(mpesaGateway);
  }

  function handlePaid() {
    setStkInvoice(null);
    setStkGateway(null);
    if (organizationId) {
      setLoading(true);
      void loadPortal(organizationId);
    }
  }

  return (
    <>
      <DetailDrawer title={`Tenant Portal — ${String(tenant.name ?? tenant.code ?? "Tenant")}`} onClose={onClose} width={540}>
        {loading ? <LoadingState rows={5} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Tenant info card */}
            <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span className="muted">Tenant</span><strong>{String(detail.name ?? tenant.name ?? "—")}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span className="muted">Code</span><strong className="mono">{String(detail.code ?? "—")}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span className="muted">Contact</span>
                <strong style={{ textAlign: "right" }}>
                  {String(detail.email ?? tenant.email ?? "—")}
                  {(detail.phone || tenant.phone) ? ` · ${String(detail.phone ?? tenant.phone)}` : ""}
                </strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span className="muted">Property / Unit</span>
                <strong>
                  {String(detail.property ?? tenant.property ?? "—")}
                  {(detail.unit || tenant.unit) ? ` · ${String(detail.unit ?? tenant.unit)}` : ""}
                </strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span className="muted">Status</span><StatusPill value={String(detail.status ?? tenant.status ?? "—")} />
              </div>
            </div>

            {/* Statement */}
            <Panel title="Statement">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: 10 }}>
                  <small className="muted" style={{ display: "block", fontSize: 11 }}>Total Billed</small>
                  <strong className="mono" style={{ fontSize: 13 }}>{kM(statementBilled)}</strong>
                </div>
                <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: 10 }}>
                  <small className="muted" style={{ display: "block", fontSize: 11 }}>Total Paid</small>
                  <strong className="mono" style={{ fontSize: 13, color: "#16a34a" }}>{kM(statementPaid)}</strong>
                </div>
                <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: 10 }}>
                  <small className="muted" style={{ display: "block", fontSize: 11 }}>Outstanding</small>
                  <strong className="mono" style={{ fontSize: 13, color: Number(statementBalance) > 0 ? "var(--danger)" : "#16a34a" }}>{kM(statementBalance)}</strong>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => void downloadStatement()}
                  style={{
                    padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)",
                    background: "var(--surface-2)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  📥 Download Statement PDF
                </button>
              </div>
            </Panel>

            <Panel title="Wallet & account credit" badge={walletEntries.length}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 10, borderRadius: 8, background: "#ecfdf5", marginBottom: walletEntries.length ? 10 : 0 }}>
                <span style={{ fontSize: 12, color: "#065f46", fontWeight: 700 }}>Available unapplied credit</span>
                <strong style={{ color: "#047857" }}>{kM(walletCredit)}</strong>
              </div>
              {walletEntries.length > 0 && walletEntries.slice(0, 8).map((entry) => (
                <div key={String(entry.id)} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 2px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12 }}>{String(entry.note || entry.entry_type || "Wallet transaction")}</span>
                  <strong style={{ fontSize: 12 }}>{kM(Number(entry.amount || 0))}</strong>
                </div>
              ))}
            </Panel>

            <Panel title="Messages & notices" badge={notices.length}>
              {notices.length > 0 ? notices.map((notice) => (
                <div key={String(notice.id)} style={{ padding: "10px 2px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 12 }}>{String(notice.title || "Notice")}</strong>
                    <span className="muted" style={{ fontSize: 10 }}>{fmtDate(notice.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-secondary)" }}>{String(notice.message || "")}</div>
                </div>
              )) : <EmptyState icon="🔔" title="No tenant notices" description="Only messages addressed to this tenant portal account appear here." />}
            </Panel>

            {/* M-Pesa availability banner */}
            {mpesaGateway && outstanding > 0 && (
              <div
                style={{
                  background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                  border: "1.5px solid #86efac", borderRadius: 10, padding: "10px 14px",
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <span style={{ fontSize: 22 }}>📱</span>
                <div style={{ flex: 1, fontSize: 12 }}>
                  <strong style={{ color: "#166534" }}>M-Pesa STK Push enabled ({mpesaGateway.display_name})</strong>
                  <span style={{ color: "#15803d", display: "block" }}>Click <em>Pay Now</em> on any unpaid invoice to pay directly via M-Pesa PIN prompt.</span>
                </div>
              </div>
            )}

            {/* Invoices */}
            <Panel title="Invoices" badge={invoices.length}>
              {invoices.length > 0 ? (
                <div className="table-scroll">
                  <table className="fc-data-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Due</th>
                        <th>Amount</th>
                        <th>Balance</th>
                        <th>Status</th>
                        <th style={{ width: 140, textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => {
                        const balance = Number(inv.balance ?? 0);
                        const canPay = mpesaGateway && balance > 0 && PAYABLE_STATUSES.has(String(inv.status ?? "").toLowerCase());
                        return (
                          <tr key={String(inv.id)}>
                            <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(inv.number ?? "—")}</td>
                            <td style={{ fontSize: 12 }}>{fmtDate(inv.due_on)}</td>
                            <td className="mono">{kM(inv.amount)}</td>
                            <td className="mono" style={{ color: balance > 0 ? "var(--danger)" : "#16a34a" }}>{kM(inv.balance)}</td>
                            <td><StatusPill value={String(inv.status ?? "—")} /></td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => window.open(`/api/v1/property/invoices/${inv.id}/pdf/`, "_blank")}
                                  title="View / Download Invoice PDF"
                                  style={{
                                    padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                                    background: "var(--surface)", cursor: "pointer", fontSize: 11, fontWeight: 600,
                                  }}
                                >
                                  📄 PDF
                                </button>
                                {canPay && (
                                  <button
                                    id={`pay-now-${String(inv.id)}`}
                                    onClick={() => openStkPush(inv)}
                                    style={{
                                      padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                                      background: "linear-gradient(135deg, #00a651 0%, #007a3d 100%)",
                                      color: "#fff", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                                    }}
                                  >
                                    Pay Now
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon="🧾" title="No invoices" description="Invoices for this tenant appear here once issued." />
              )}
            </Panel>

            {/* Receipts */}
            <Panel title="Receipts" badge={receipts.length}>
              {receipts.length > 0 ? (
                <div className="table-scroll">
                  <table className="fc-data-table">
                    <thead>
                      <tr>
                        <th>Receipt</th>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th style={{ width: 60, textAlign: "right" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipts.map((r) => (
                        <tr key={String(r.id)}>
                          <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(r.number ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{fmtDate(r.received_on)}</td>
                          <td style={{ fontSize: 12 }}>{String(r.payment_method ?? "—").replace(/_/g, " ")}</td>
                          <td className="mono">{kM(r.amount)}</td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => window.open(`/api/v1/property/receipts/${r.id}/pdf/`, "_blank")}
                              title="View / Download Receipt PDF"
                              style={{
                                padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                                background: "var(--surface)", cursor: "pointer", fontSize: 11, fontWeight: 600,
                              }}
                            >
                              📄 PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon="🧾" title="No receipts" description="Recorded payments for this tenant appear here." />
              )}
            </Panel>
          </div>
        )}
      </DetailDrawer>

      {/* STK Push Modal */}
      {stkInvoice && stkGateway && organizationId && (
        <MpesaStkPushModal
          invoice={stkInvoice}
          gateway={stkGateway}
          tenantPhone={String(detail?.phone ?? tenant.phone ?? "")}
          organizationId={organizationId}
          onClose={() => { setStkInvoice(null); setStkGateway(null); }}
          onPaid={handlePaid}
        />
      )}
    </>
  );
}
