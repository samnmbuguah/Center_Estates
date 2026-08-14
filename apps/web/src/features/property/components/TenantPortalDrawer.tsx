"use client";

import { useState, useEffect } from "react";
import { DetailDrawer, StatusPill, Field, LoadingState, EmptyState, Panel } from "@/components/module-ui";
import { TenantRow, ID, Row, InvoiceRow, ReceiptRow } from "../types/property.types";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { fmtDate, kM } from "../utils/property.utils";

export function TenantPortalDrawer({ tenant, organizationId, onClose }: {
  tenant: TenantRow; organizationId: string | null; onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [tenantDetail, setTenantDetail] = useState<Row | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [statement, setStatement] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!organizationId) { setLoading(false); return; }
      const tId = String(tenant.id);
      const tName = String(tenant.name ?? "");
      const [portalRes, tenantRes, invoiceRes, receiptRes] = await Promise.all([
        apiFetch(`/property/portal/${tId}/`, {}, organizationId),
        apiFetch(`/property/tenants/${tId}/`, {}, organizationId),
        apiFetch("/property/invoices/?search=", {}, organizationId),
        apiFetch("/property/receipts/?search=", {}, organizationId),
      ]);
      if (!active) return;

      let portalInvoices: InvoiceRow[] = [];
      let portalReceipts: ReceiptRow[] = [];
      let portalStatement: Record<string, unknown> | null = null;
      if (portalRes.ok) {
        const body = await portalRes.json().catch(() => null);
        if (body && typeof body === "object") {
          const b = body as { invoices?: unknown; receipts?: unknown; statement?: unknown; tenant?: unknown };
          if (Array.isArray(b.invoices)) portalInvoices = b.invoices as InvoiceRow[];
          if (Array.isArray(b.receipts)) portalReceipts = b.receipts as ReceiptRow[];
          if (b.statement && typeof b.statement === "object") portalStatement = b.statement as Record<string, unknown>;
          if (b.tenant && typeof b.tenant === "object") setTenantDetail(b.tenant as Row);
        }
      }
      if (tenantRes.ok && !tenantDetail) {
        const detail = await tenantRes.json().catch(() => null);
        if (detail && typeof detail === "object") setTenantDetail(detail as Row);
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
      if (active) {
        setInvoices(portalInvoices);
        setReceipts(portalReceipts);
        setStatement(portalStatement);
        setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [tenant.id, tenant.name, organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const detail = tenantDetail ?? (tenant as unknown as Row);
  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const totalPaid = receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const outstanding = invoices.reduce((s, i) => s + Number(i.balance ?? 0), 0);
  const statementBalance = statement?.balance !== undefined ? Number(statement.balance) : outstanding;
  const statementBilled = statement?.total_billed !== undefined ? Number(statement.total_billed) : totalBilled;
  const statementPaid = statement?.total_paid !== undefined ? Number(statement.total_paid) : totalPaid;

  return (
    <DetailDrawer title={`Tenant Portal — ${String(tenant.name ?? tenant.code ?? "Tenant")}`} onClose={onClose} width={520}>
      {loading ? <LoadingState rows={5} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="muted">Tenant</span><strong>{String(detail.name ?? tenant.name ?? "—")}</strong>
            </div>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="muted">Code</span><strong className="mono">{String(detail.code ?? "—")}</strong>
            </div>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="muted">Contact</span><strong style={{ textAlign: "right" }}>{String(detail.email ?? tenant.email ?? "—")} {detail.phone || tenant.phone ? `· ${String(detail.phone ?? tenant.phone)}` : ""}</strong>
            </div>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="muted">Property / Unit</span><strong>{String(detail.property ?? tenant.property ?? "—")}{detail.unit || tenant.unit ? ` · ${String(detail.unit ?? tenant.unit)}` : ""}</strong>
            </div>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="muted">Status</span><StatusPill value={String(detail.status ?? tenant.status ?? "—")} />
            </div>
          </div>

          <Panel title="Statement">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
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
          </Panel>

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
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={String(inv.id)}>
                        <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(inv.number ?? "—")}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(inv.due_on)}</td>
                        <td className="mono">{kM(inv.amount)}</td>
                        <td className="mono" style={{ color: Number(inv.balance ?? 0) > 0 ? "var(--danger)" : "#16a34a" }}>{kM(inv.balance)}</td>
                        <td><StatusPill value={String(inv.status ?? "—")} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="🧾" title="No invoices" description="Invoices for this tenant appear here once issued." />
            )}
          </Panel>

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
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((r) => (
                      <tr key={String(r.id)}>
                        <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(r.number ?? "—")}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(r.received_on)}</td>
                        <td style={{ fontSize: 12 }}>{String(r.payment_method ?? "—").replace(/_/g, " ")}</td>
                        <td className="mono">{kM(r.amount)}</td>
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
  );
}

/* ─── RENT SCHEDULES ─── */

