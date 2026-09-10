"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { Alert, Button, Chip, CircularProgress, Stack, TextField } from "@mui/material";
import {
  Building2, CreditCard, FileText, Gauge, ReceiptText, UserRound,
  CalendarDays, Download, Menu, X, ShoppingBag,
} from "lucide-react";
import Unit3DViewer from "@/components/sales-unit3d/Unit3DViewer";

type Row = Record<string, string | number | boolean | null>;
type Portal = {
  buyer: Row;
  currentSale: Row | null;
  sales: Row[];
  installments: Row[];
  payments: Row[];
  documents: Row[];
  availableUnits: Row[];
  kpis: { totalSales: number; outstanding: number; verifiedPayments: number };
};

type Tab = "overview" | "agreement" | "installments" | "payments" | "documents";
const labels: Record<Tab, string> = {
  overview: "Overview",
  agreement: "Sale Agreement",
  installments: "Installments",
  payments: "Payments",
  documents: "Documents",
};
const tabIcons: Record<Tab, React.ReactNode> = {
  overview: <Gauge size={17} />,
  agreement: <FileText size={17} />,
  installments: <CalendarDays size={17} />,
  payments: <CreditCard size={17} />,
  documents: <FileText size={17} />,
};
const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const friendlyDate = (value: unknown) => {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
};

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <nav className="portal-tabbar" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
      {(Object.keys(labels) as Tab[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setTab(item)}
          className={`btn sm ${tab === item ? "primary" : "ghost"}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: tab === item ? 800 : 500 }}
        >
          {tabIcons[item]} {labels[item]}
        </button>
      ))}
    </nav>
  );
}

export default function BuyerPortalPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [data, setData] = useState<Portal | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [record, setRecord] = useState({ sale: "", installment: "", amount: "", method: "bank", external_reference: "" });

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/sales/buyer-portal/", {}, organizationId);
      if (!res.ok) {
        setError(res.status === 403 ? "This account is not linked to a buyer portal profile." : await apiErrorMessage(res, "Your buyer account could not be loaded."));
        setLoading(false);
        return;
      }
      const json = (await res.json()) as Portal;
      setData(json);
      if (json.currentSale) setRecord((r) => ({ ...r, sale: String(json.currentSale!.id ?? ""), installment: String(json.installments?.[0]?.id ?? "") }));
    } catch {
      setError("Unable to load buyer portal data. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  async function submitPayment() {
    if (!record.amount || !record.external_reference.trim()) {
      setRecordError("Enter an amount and the bank/payment reference.");
      return;
    }
    setRecordBusy(true);
    setRecordError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/sales/buyer-portal/payments/record/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          sale: record.sale,
          installment: record.installment || null,
          amount: record.amount,
          method: record.method,
          external_reference: record.external_reference.trim(),
        }),
      }, organizationId);
      if (!res.ok) {
        setRecordError(await apiErrorMessage(res, "The payment could not be submitted."));
        return;
      }
      setRecordOpen(false);
      setRecord({ ...record, amount: "", external_reference: "" });
      await load();
      setTab("payments");
    } catch {
      setRecordError("The payment could not be submitted. Check your connection.");
    } finally {
      setRecordBusy(false);
    }
  }

  if (loading) return (
    <div className="page-wrap"><div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", padding: 60 }}><CircularProgress size={32} /><strong>Preparing your buyer account…</strong></div></div>
  );
  if (!data) return <div className="page-wrap"><div className="form-error">{error}</div></div>;

  const sale = data.currentSale;
  const selectedPanel = () => {
    if (tab === "overview") return <Overview data={data} setTab={setTab} onRecord={() => setRecordOpen(true)} />;
    if (tab === "installments") return <Installments data={data} />;
    if (tab === "payments") return <Payments data={data} onRecord={() => setRecordOpen(true)} />;
    if (tab === "documents") return <Documents data={data} />;
    return <Agreement sale={sale} data={data} />;
  };

  return (
    <div className="page-wrap tenant-portal-page">
      <div className="tenant-mobile-header">
        <div className="tenant-mobile-brand">
          <span className="tenant-portal-badge">Buyer</span>
          <span className="tenant-mobile-unit">{String(data.buyer?.full_name ?? "")}</span>
        </div>
      </div>
      <div className="tenant-portal-layout">
        <aside className="tenant-portal-sidebar">
          <div className="tenant-sidebar-profile">
            <div className="tenant-avatar-circle">{String(data.buyer?.full_name ?? "?").slice(0, 2).toUpperCase()}</div>
            <div className="tenant-sidebar-user-meta">
              <strong className="tenant-sidebar-name">{String(data.buyer?.full_name ?? "")}</strong>
              <span className="tenant-sidebar-code">Ref {String(data.buyer?.reference ?? "")}</span>
            </div>
          </div>
          <nav className="tenant-sidebar-nav">
            {(Object.keys(labels) as Tab[]).map((item) => (
              <button key={item} type="button" className={`tenant-sidebar-nav-item ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>
                <span className="tenant-nav-icon">{tabIcons[item]}</span>
                <span className="tenant-nav-label">{labels[item]}</span>
              </button>
            ))}
          </nav>
          <div className="tenant-sidebar-footer">
            <div className="tenant-support-card">
              <strong>Sales Accounting</strong>
              <p>Questions about your purchase plan or payments?</p>
              <button type="button" className="tenant-support-link" onClick={() => setTab("payments")}>Review payments →</button>
            </div>
          </div>
        </aside>
        <main className="tenant-portal-main">
          <section className="tenant-portal-hero">
            <div>
              <p className="eyebrow">Buyer self-service</p>
              <h1>Good day, {String(data.buyer?.full_name ?? "").split(" ")[0]}.</h1>
              <p>Your purchase agreement, installment plan and payments in one place.</p>
              {sale && <div className="tenant-premises"><Building2 size={16} /> {String(sale.project_name ?? "")} · Unit {String(sale.unit_code ?? "")} <Chip size="small" label={String(sale.status ?? "Draft")} color="success" /></div>}
            </div>
            <Button variant="contained" color="error" startIcon={<CreditCard size={17} />} onClick={() => setRecordOpen(true)}>Record a payment</Button>
          </section>
          {error && <div className="form-error">{error}</div>}
          <TabBar tab={tab} setTab={setTab} />
          {selectedPanel()}
        </main>
      </div>

      <RecordPaymentModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        busy={recordBusy}
        error={recordError}
        record={record}
        setRecord={setRecord}
        onSubmit={() => void submitPayment()}
        installments={data.installments}
      />
    </div>
  );
}

function Overview({ data, setTab, onRecord }: { data: Portal; setTab: (t: Tab) => void; onRecord: () => void }) {
  const k = data.kpis ?? { totalSales: 0, outstanding: 0, verifiedPayments: 0 };
  return (
    <>
      <section className="kpi-grid">
        <Kpi label="Active purchases" value={String(Number(k.totalSales))} note="Sales on this account" go={() => setTab("agreement")} />
        <Kpi label="Outstanding" value={cash.format(Number(k.outstanding))} note="On current agreements" go={() => setTab("installments")} />
        <Kpi label="Verified payments" value={cash.format(Number(k.verifiedPayments))} note="Confirmed by accounting" go={() => setTab("payments")} />
        <Kpi label="Documents" value={String(data.documents.length)} note="Purchase documents" go={() => setTab("documents")} />
      </section>
      <section className="data-panel" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Your latest agreement</h3>
        {data.currentSale ? (
          <div className="portal-lease">
            <strong>{String(data.currentSale.project_name ?? "")} · Unit {String(data.currentSale.unit_code ?? "")}</strong>
            <span>Ref {String(data.currentSale.reference ?? "")}</span>
            <span>Agreed price {cash.format(Number(data.currentSale.agreed_price ?? 0))}</span>
            <b>Status: {String(data.currentSale.status ?? "Draft")}</b>
          </div>
        ) : (
          <p style={{ margin: 0 }}>No active purchase agreement yet.</p>
        )}
      </section>
    </>
  );
}

function Agreement({ sale, data }: { sale: Row | null; data: Portal }) {
  if (!sale) return <div className="data-panel">No sale agreement found on this account.</div>;
  const renders = (sale.renders as unknown as { id: string; render_kind: string; title: string; caption: string; render_url: string; is_primary: boolean }[] | undefined) ?? [];
  return (
    <div className="data-panel">
      <h3 style={{ marginTop: 0 }}>Purchase agreement — {String(sale.reference ?? "")}</h3>

      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>3D unit showcase</div>
        <Unit3DViewer
          renders={renders}
          unitCode={String(sale.unit_code ?? "Unit")}
          unitType={String(sale.unit_type ?? "Unit")}
          area={Number(sale.unit_area ?? 0)}
          floor={String(sale.unit_floor ?? "")}
          height={360}
        />
      </div>

      <div className="portal-profile-grid">
        <div className="profile-card">
          <p>Project: <strong>{String(sale.project_name ?? "—")}</strong></p>
          <p>Unit: <strong>{String(sale.unit_code ?? "—")}</strong></p>
          <p>Agreed price: <strong>{cash.format(Number(sale.agreed_price ?? 0))}</strong></p>
          <p>Reservation fee: <strong>{cash.format(Number(sale.reservation_fee ?? 0))}</strong></p>
        </div>
        <div className="profile-card">
          <p>Verified paid: <strong>{cash.format(Number(sale.paid_amount ?? 0))}</strong></p>
          <p>Balance: <strong>{cash.format(Number(sale.agreed_price ?? 0) - Number(sale.paid_amount ?? 0))}</strong></p>
          <p>Status: <strong>{String(sale.status ?? "Draft")}</strong></p>
          <p>Buyer: <strong>{String(sale.buyer_name ?? data.buyer?.full_name ?? "—")}</strong></p>
        </div>
      </div>
    </div>
  );
}

function Installments({ data }: { data: Portal }) {
  if (!data.installments.length) return <div className="data-panel">No installment schedule has been set up yet.</div>;
  return (
    <div className="data-panel">
      <h3 style={{ marginTop: 0 }}>Payment milestones</h3>
      <div className="table-scroll">
        <table className="fc-data-table">
          <thead><tr><th>#</th><th>Milestone</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>
            {data.installments.map((r) => (
              <tr key={String(r.id)}>
                <td style={{ fontSize: 12 }}>{String(r.sequence ?? "")}</td>
                <td style={{ fontSize: 12 }}>{String(r.description ?? "")}</td>
                <td style={{ fontSize: 12 }}>{friendlyDate(r.due_on)}</td>
                <td className="mono" style={{ fontSize: 12 }}>{cash.format(Number(r.amount ?? 0))}</td>
                <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{cash.format(Number(r.paid_amount ?? 0))}</td>
                <td className="mono" style={{ fontSize: 12, color: Number(r.amount) - Number(r.paid_amount) > 0 ? "#d97706" : "#16a34a" }}>{cash.format(Number(r.amount ?? 0) - Number(r.paid_amount ?? 0))}</td>
                <td><Chip size="small" label={String(r.status ?? "")} color={String(r.status) === "paid" ? "success" : String(r.status) === "overdue" ? "error" : "default"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Payments({ data, onRecord }: { data: Portal; onRecord: () => void }) {
  if (!data.payments.length) return <div className="data-panel">No payments recorded yet. <button type="button" className="btn primary sm" onClick={onRecord}>Record a payment</button></div>;
  return (
    <div className="data-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Payment history</h3>
        <button type="button" className="btn primary sm" onClick={onRecord}>↑ Record payment</button>
      </div>
      <div className="table-scroll">
        <table className="fc-data-table">
          <thead><tr><th>Ref</th><th>Date</th><th>Amount</th><th>Method</th><th>External ref</th><th>Status</th></tr></thead>
          <tbody>
            {data.payments.map((r) => (
              <tr key={String(r.id)}>
                <td className="mono" style={{ fontSize: 12 }}>{String(r.reference ?? "")}</td>
                <td style={{ fontSize: 12 }}>{friendlyDate(r.paid_on)}</td>
                <td className="mono" style={{ fontSize: 12 }}>{cash.format(Number(r.amount ?? 0))}</td>
                <td style={{ fontSize: 12 }}>{String(r.method ?? "—")}</td>
                <td className="mono" style={{ fontSize: 12 }}>{String(r.external_reference ?? "—")}</td>
                <td><Chip size="small" label={String(r.status ?? "")} color={String(r.status) === "verified" ? "success" : String(r.status) === "rejected" ? "error" : "default"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Documents({ data }: { data: Portal }) {
  if (!data.documents.length) return <div className="data-panel">No purchase documents uploaded yet.</div>;
  return (
    <div className="data-panel">
      <h3 style={{ marginTop: 0 }}>Purchase documents</h3>
      <div className="table-scroll">
        <table className="fc-data-table">
          <thead><tr><th>Document</th><th>Type</th><th>Final</th><th>Action</th></tr></thead>
          <tbody>
            {data.documents.map((r) => (
              <tr key={String(r.id)}>
                <td style={{ fontSize: 12 }}>{String(r.title ?? "")}</td>
                <td style={{ fontSize: 12 }}>{String(r.document_type ?? "")}</td>
                <td style={{ fontSize: 12 }}>{r.is_final ? "Yes" : "Draft"}</td>
                <td style={{ fontSize: 12 }}>
                  {r.file_url ? <a href={String(r.file_url)} target="_blank" rel="noreferrer">View</a> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, note, go }: { label: string; value: string; note: string; go: () => void }) {
  return (
    <button type="button" className="tenant-kpi-card" onClick={go}>
      <span className="tenant-kpi-label">{label}</span>
      <strong className="tenant-kpi-value">{value}</strong>
      <span className="tenant-kpi-note">{note}</span>
    </button>
  );
}

function RecordPaymentModal({ open, onClose, busy, error, record, setRecord, onSubmit, installments }: {
  open: boolean; onClose: () => void; busy: boolean; error: string;
  record: { sale: string; installment: string; amount: string; method: string; external_reference: string };
  setRecord: (r: any) => void; onSubmit: () => void; installments: Row[];
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={!busy ? onClose : undefined}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><strong>Record a payment</strong><button type="button" aria-label="Close" onClick={onClose} disabled={busy}><X size={18} /></button></div>
        <div className="modal-body">
          <Stack spacing={2}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            <TextField select label="Installment" size="small" value={record.installment} onChange={(e) => setRecord({ ...record, installment: e.target.value })} fullWidth>
              {installments.map((r) => <option key={String(r.id)} value={String(r.id)}>{String(r.sequence ?? "")} · {String(r.description ?? "")} — {cash.format(Number(r.amount ?? 0))}</option>)}
            </TextField>
            <TextField label="Amount (KES)" type="number" size="small" value={record.amount} onChange={(e) => setRecord({ ...record, amount: e.target.value })} fullWidth />
            <TextField select label="Payment method" size="small" value={record.method} onChange={(e) => setRecord({ ...record, method: e.target.value })} fullWidth>
              <option value="bank">Bank transfer</option>
              <option value="paybill">Paybill</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online</option>
            </TextField>
            <TextField label="Bank / payment reference" size="small" value={record.external_reference} onChange={(e) => setRecord({ ...record, external_reference: e.target.value })} fullWidth placeholder="e.g. RTGS-000123" />
            <Alert severity="info" sx={{ borderRadius: 2 }}>Your payment is submitted for verification. An accountant confirms it before it reflects on your balance.</Alert>
          </Stack>
        </div>
        <div className="modal-footer">
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={onSubmit} disabled={busy}>{busy ? "Submitting…" : "Submit payment"}</Button>
        </div>
      </div>
    </div>
  );
}