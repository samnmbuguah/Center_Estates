"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { Row, Tone } from "../../types/sales.types";
import { countBy, fmtDate, fmtMoney } from "../../utils/sales.utils";
import { DataTable, FilterChips, RefText, TableChrome } from "../SalesUiComponents";

type AgingBucket = { key: string; label: string; amount: number; count: number };
type Aging = {
  asOf: string;
  totals: { expected: number; collected: number; outstanding: number; overdue: number; collectionRate: number };
  buckets: AgingBucket[];
  topExposures: { sale: string; buyer: string; project: string; outstanding: number; oldest_days: number }[];
};

const BUCKET_COLORS: Record<string, string> = {
  current: "#16a34a",
  d1_30: "#f59e0b",
  d31_60: "#f97316",
  d61_90: "#ef4444",
  d90_plus: "#991b1b",
};

function toneForInstallment(s: string): Tone {
  if (s === "paid") return "green";
  if (s === "partial") return "yellow";
  if (s === "overdue") return "red";
  if (s === "due") return "blue";
  return "gray";
}

export function InstallmentsView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
}) {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [aging, setAging] = useState<Aging | null>(null);
  const overdue = countBy(rows, ["overdue"]);
  const outstanding = rows.reduce((s, r) => s + (Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)), 0);
  const [clipNotice, setClipNotice] = useState("");

  const loadAging = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await apiFetch("/sales/installments/aging/", {}, organizationId);
      if (res.ok) setAging((await res.json()) as Aging);
    } catch {
      /* non-blocking: the table below still works without the cockpit */
    }
  }, [organizationId]);

  useEffect(() => { void loadAging(); }, [loadAging]);

  function copyLink(r: Row) {
    const url = `${window.location.origin}/sales/pay?installment=${String(r.id)}`;
    navigator.clipboard?.writeText(url).then(
      () => setClipNotice(`Payment link copied for ${String(r.sale_reference ?? "installment")}.`),
      () => setClipNotice("Could not copy the payment link."),
    );
  }

  const bucketTotal = aging ? aging.buckets.reduce((s, b) => s + Number(b.amount ?? 0), 0) : 0;

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🗓️" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Installments" value={number.format(rows.length)} sub="Across all sales" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Paid" value={number.format(countBy(rows, ["paid"]))} sub="Settled in full" onClick={() => setStatus(status === "paid" ? "" : "paid")} />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Pending" value={number.format(countBy(rows, ["upcoming", "due", "partial"]))} sub="Due or partly paid" onClick={() => setStatus(status === "due" ? "" : "due")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value={number.format(overdue)} sub="Past due date" onClick={() => setStatus(status === "overdue" ? "" : "overdue")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Outstanding" value={fmtMoney(outstanding)} sub="Total unpaid balance" />
      </KpiStrip>

      {aging && (
        <Panel title="Collections & Aging" action={<span style={{ fontSize: 11, color: "var(--muted)" }}>As of {fmtDate(aging.asOf)}</span>}>
          <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: 20, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="row" style={{ gap: 20, flexWrap: "wrap" }}>
                <Metric label="Expected" value={fmtMoney(aging.totals.expected)} />
                <Metric label="Collected" value={fmtMoney(aging.totals.collected)} tone="#16a34a" />
                <Metric label="Outstanding" value={fmtMoney(aging.totals.outstanding)} tone="#b91c1c" />
                <Metric label="Overdue" value={fmtMoney(aging.totals.overdue)} tone="#92400e" />
                <Metric label="Collection rate" value={`${aging.totals.collectionRate}%`} tone="#4f46e5" />
              </div>

              <div>
                <div style={{ display: "flex", height: 16, borderRadius: 99, overflow: "hidden", background: "var(--surface-sunken, #eef2f7)" }}>
                  {aging.buckets.map((b) => (
                    <i
                      key={b.key}
                      title={`${b.label}: ${fmtMoney(b.amount)}`}
                      style={{ display: "block", height: "100%", width: bucketTotal > 0 ? `${(Number(b.amount) / bucketTotal) * 100}%` : "0%", background: BUCKET_COLORS[b.key] ?? "#94a3b8" }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
                  {aging.buckets.map((b) => (
                    <span key={b.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                      <i style={{ width: 9, height: 9, borderRadius: "50%", background: BUCKET_COLORS[b.key] ?? "#94a3b8", display: "inline-block" }} />
                      {b.label}
                      <b className="mono">{fmtMoney(b.amount)}</b>
                      <span style={{ color: "var(--muted)" }}>({b.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Top exposures</div>
              {aging.topExposures.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>No overdue exposure. All installments are current.</p>
              ) : (
                <div className="table-scroll">
                  <table className="fc-data-table">
                    <thead><tr><th>Sale</th><th>Buyer</th><th>Project</th><th>Outstanding</th><th>Oldest</th></tr></thead>
                    <tbody>
                      {aging.topExposures.map((e) => (
                        <tr key={e.sale}>
                          <td className="mono" style={{ fontSize: 12 }}>{e.sale}</td>
                          <td style={{ fontSize: 12 }}>{e.buyer}</td>
                          <td style={{ fontSize: 12 }}>{e.project || "—"}</td>
                          <td className="mono" style={{ fontSize: 12, color: "#b91c1c" }}>{fmtMoney(e.outstanding)}</td>
                          <td style={{ fontSize: 12 }}>
                            <StatusPill value={`${e.oldest_days}d`} tone={e.oldest_days > 90 ? "red" : e.oldest_days > 30 ? "yellow" : "gray"} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {clipNotice && (
        <div className="card" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)", padding: "10px 14px", marginBottom: 0 }}>
          <span style={{ color: "#15803d", fontSize: 13 }}>✓ {clipNotice}</span>
        </div>
      )}

      <Panel title="Installment Schedules" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search sale ref, buyer, milestone…"
          chips={<FilterChips options={[{ value: "paid", label: "Paid" }, { value: "partial", label: "Partial" }, { value: "due", label: "Due" }, { value: "upcoming", label: "Upcoming" }, { value: "overdue", label: "Overdue" }]} value={status as "paid" | "partial" | "due" | "upcoming" | "overdue" | ""} onChange={(v) => setStatus(v)} />}
        >
          {rows.length === 0 ? (
            <EmptyState icon="🗓️" title="No installment schedules" description="Installments are generated against a sale's payment plan." />
          ) : (
            <DataTable headers={["Installment", "Sale", "Buyer", "Due Date", "Amount", "Paid", "Balance", "Status", "Actions"]}>
              {rows.map((r) => {
                const amt = Number(r.amount ?? 0);
                const paid = Number(r.paid_amount ?? 0);
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={`${String(r.sale_reference ?? "—")} · ${String(r.sequence ?? "—")}`} /></td>
                    <td style={{ fontSize: 12 }}>{String(r.description ?? "—")}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.due_on)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(amt)}</td>
                    <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{fmtMoney(paid)}</td>
                    <td className="mono" style={{ fontSize: 12, color: paid >= amt ? "#16a34a" : "#b91c1c" }}>{fmtMoney(amt - paid)}</td>
                    <td><StatusPill value={String(r.status ?? "")} tone={toneForInstallment(String(r.status ?? ""))} /></td>
                    <td>
                      <button className="btn ghost sm" onClick={() => copyLink(r)}>Copy Link</button>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)" }}>{label}</span>
      <strong className="mono" style={{ fontSize: 15, color: tone ?? "inherit" }}>{value}</strong>
    </div>
  );
}
