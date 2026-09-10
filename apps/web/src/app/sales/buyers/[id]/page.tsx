"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { salesNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";
import { Badge, ErrorBanner, KpiCard, KpiStrip, LoadingState, Panel, StatusPill, money } from "@/components/module-ui";

type Row = Record<string, unknown>;

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtMoney(v: unknown): string {
  return money.format(Number(v ?? 0));
}
function toneForBuyer(s: string): "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray" {
  if (s === "active" || s === "completed") return "green";
  if (s === "qualified") return "blue";
  if (s === "lead") return "yellow";
  if (s === "cancelled") return "red";
  return "gray";
}
function toneForStatus(s: string): "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray" {
  if (["completed", "paid", "verified", "active"].includes(s)) return "green";
  if (["cancelled", "rejected", "reversed", "overdue"].includes(s)) return "red";
  if (["pending", "reserved", "partial", "due", "upcoming"].includes(s)) return "yellow";
  if (["contracted"].includes(s)) return "blue";
  return "gray";
}

export default function SingleBuyerWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch(`/sales/buyers/${id}/profile/`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setData((await res.json()) as Row);
      })
      .catch(() => setError("Unable to load this buyer account."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const buyer = (data?.buyer ?? {}) as Row;
  const summary = (data?.summary ?? {}) as Row;
  const sales = (data?.sales ?? []) as Row[];
  const installments = (data?.installments ?? []) as Row[];
  const payments = (data?.payments ?? []) as Row[];
  const documents = (data?.documents ?? []) as Row[];
  const visits = (data?.visits ?? []) as Row[];
  const buyerName = String(buyer.full_name || buyer.reference || "Buyer Account");

  return (
    <ModuleShell
      moduleKey="sales"
      moduleName="Sales Management"
      eyebrow="Buyer 360°"
      title={buyerName}
      subtitle="Complete buyer account: purchase agreements, installment plan, payments, documents and site visits."
      accent="#ea580c"
      groups={salesNav}
      activeId="buyers"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/sales";
        else window.location.href = `/sales?tab=${tabId}`;
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <Link href="/sales/buyers" className="btn ghost sm" style={{ textDecoration: "none" }}>← Back to Buyer Directory</Link>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

        {loading ? (
          <LoadingState rows={4} />
        ) : data ? (
          <>
            <KpiStrip cols={5}>
              <KpiCard icon="🏠" iconBg="#e0e7ff" iconColor="#4f46e5" label="Active Purchases" value={String(Number(summary.activeSales ?? 0))} sub="Sale agreements" />
              <KpiCard icon="💼" iconBg="#fff7ed" iconColor="#ea580c" label="Contract Value" value={fmtMoney(summary.totalValue)} sub="Total agreed price" />
              <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Verified Paid" value={fmtMoney(summary.verifiedPaid)} sub={`${Number(summary.collectionRate ?? 0)}% collected`} />
              <KpiCard icon="📉" iconBg="#fee2e2" iconColor="#b91c1c" label="Outstanding" value={fmtMoney(summary.outstanding)} sub="Uncollected balance" />
              <KpiCard icon="⚠️" iconBg="#fef3c7" iconColor="#92400e" label="Overdue" value={fmtMoney(summary.overdueAmount)} sub={`${Number(summary.overdueCount ?? 0)} installment(s)`} />
            </KpiStrip>

            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <StatusPill value={String(buyer.status ?? "—")} tone={toneForBuyer(String(buyer.status ?? ""))} />
              <Badge tone={buyer.financing_type === "bank" ? "blue" : "green"}>{buyer.financing_type === "bank" ? "Bank-financed" : "Self-financed"}</Badge>
              {summary.nextDueOn ? <Badge tone="yellow">Next due {fmtDate(summary.nextDueOn)} · {fmtMoney(summary.nextDueAmount)}</Badge> : null}
            </div>

            <Panel title="Buyer Profile">
              <div className="grid-2" style={{ gap: 14 }}>
                <Field label="Full Name"><strong style={{ fontSize: 13 }}>{String(buyer.full_name ?? "—")}</strong></Field>
                <Field label="Reference"><span className="mono" style={{ fontSize: 13 }}>{String(buyer.reference ?? "—")}</span></Field>
                <Field label="Email"><span style={{ fontSize: 13 }}>{String(buyer.email ?? "—")}</span></Field>
                <Field label="Phone"><span style={{ fontSize: 13 }}>{String(buyer.phone ?? "—")}</span></Field>
                <Field label="National / Company ID"><span className="mono" style={{ fontSize: 13 }}>{String(buyer.id_number ?? "—")}</span></Field>
                <Field label="KRA PIN"><span className="mono" style={{ fontSize: 13 }}>{String(buyer.tax_number || "—")}</span></Field>
                <Field label="Financier"><span style={{ fontSize: 13 }}>{String(buyer.financier || "—")}</span></Field>
                <Field label="Assigned Agent"><span style={{ fontSize: 13 }}>{String(buyer.agent_name || "—")}</span></Field>
                <Field label="Confirmed On"><span style={{ fontSize: 13 }}>{buyer.confirmed_at ? fmtDateTime(buyer.confirmed_at) : "Not confirmed"}</span></Field>
              </div>
            </Panel>

            <Panel title="Purchase Agreements" badge={sales.length}>
              {sales.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No sale agreements on this account.</p>
              ) : (
                <div className="table-scroll">
                  <table className="fc-data-table">
                    <thead><tr><th>Sale Ref</th><th>Project / Unit</th><th>Agreed Price</th><th>Paid</th><th>Balance</th><th>Status</th><th>Contracted</th></tr></thead>
                    <tbody>
                      {sales.map((s) => {
                        const price = Number(s.agreed_price ?? 0);
                        const paid = Number(s.paid_amount ?? 0);
                        return (
                          <tr key={String(s.id)}>
                            <td className="mono" style={{ fontSize: 12 }}>{String(s.reference ?? "—")}</td>
                            <td style={{ fontSize: 12 }}>{String(s.project_name ?? "—")}{s.unit_code ? ` · ${String(s.unit_code)}` : ""}</td>
                            <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(price)}</td>
                            <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{fmtMoney(paid)}</td>
                            <td className="mono" style={{ fontSize: 12, color: paid >= price ? "#16a34a" : "#b91c1c" }}>{fmtMoney(price - paid)}</td>
                            <td><StatusPill value={String(s.status ?? "")} tone={toneForStatus(String(s.status ?? ""))} /></td>
                            <td style={{ fontSize: 12 }}>{fmtDate(s.contracted_on)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Installment Plan" badge={installments.length}>
              {installments.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No installment schedule has been set up.</p>
              ) : (
                <div className="table-scroll">
                  <table className="fc-data-table">
                    <thead><tr><th>#</th><th>Milestone</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                    <tbody>
                      {installments.map((r) => {
                        const amt = Number(r.amount ?? 0);
                        const paid = Number(r.paid_amount ?? 0);
                        return (
                          <tr key={String(r.id)}>
                            <td style={{ fontSize: 12 }}>{String(r.sequence ?? "")}</td>
                            <td style={{ fontSize: 12 }}>{String(r.description ?? "")}</td>
                            <td style={{ fontSize: 12 }}>{fmtDate(r.due_on)}</td>
                            <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(amt)}</td>
                            <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{fmtMoney(paid)}</td>
                            <td className="mono" style={{ fontSize: 12, color: paid >= amt ? "#16a34a" : "#b91c1c" }}>{fmtMoney(amt - paid)}</td>
                            <td><StatusPill value={String(r.status ?? "")} tone={toneForStatus(String(r.status ?? ""))} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Payment History" badge={payments.length}>
              {payments.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No payments recorded yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="fc-data-table">
                    <thead><tr><th>Ref</th><th>Sale</th><th>Date</th><th>Amount</th><th>Method</th><th>External Ref</th><th>Status</th></tr></thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={String(p.id)}>
                          <td className="mono" style={{ fontSize: 12 }}>{String(p.reference ?? "—")}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{String(p.sale_reference ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{fmtDate(p.paid_on)}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(p.amount)}</td>
                          <td style={{ fontSize: 12 }}>{String(p.method ?? "—")}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{String(p.external_reference ?? "—")}</td>
                          <td><StatusPill value={String(p.status ?? "")} tone={toneForStatus(String(p.status ?? ""))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <div className="grid-2" style={{ gap: 18, alignItems: "start" }}>
              <Panel title="Legal Documents" badge={documents.length}>
                {documents.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>No documents uploaded.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="fc-data-table">
                      <thead><tr><th>Document</th><th>Type</th><th>Final</th><th>Action</th></tr></thead>
                      <tbody>
                        {documents.map((d) => (
                          <tr key={String(d.id)}>
                            <td style={{ fontSize: 12 }}>{String(d.title ?? "—")}</td>
                            <td style={{ fontSize: 12 }}>{String(d.document_type ?? "—")}</td>
                            <td style={{ fontSize: 12 }}>{d.is_final ? "Yes" : "Draft"}</td>
                            <td style={{ fontSize: 12 }}>{d.file_url ? <a href={String(d.file_url)} target="_blank" rel="noreferrer">View</a> : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Site Visits" badge={visits.length}>
                {visits.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>No site visits attributed to this buyer.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="fc-data-table">
                      <thead><tr><th>Ref</th><th>Project</th><th>Interest</th><th>Visited</th></tr></thead>
                      <tbody>
                        {visits.map((v) => (
                          <tr key={String(v.id)}>
                            <td className="mono" style={{ fontSize: 12 }}>{String(v.reference ?? "—")}</td>
                            <td style={{ fontSize: 12 }}>{String(v.project_name ?? "—")}</td>
                            <td style={{ fontSize: 12 }}>{String(v.interested_unit_type ?? "—")}</td>
                            <td style={{ fontSize: 12 }}>{fmtDate(v.visited_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          </>
        ) : null}
      </div>
    </ModuleShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fc-detail-field" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
      <span>{children}</span>
    </div>
  );
}
