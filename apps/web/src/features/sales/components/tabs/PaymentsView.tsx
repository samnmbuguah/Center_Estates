"use client";

import { EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { Row, Tone } from "../../types/sales.types";
import { countBy, fmtDate, fmtMoney, sumBy } from "../../utils/sales.utils";
import { DataTable, FilterChips, RefText, TableChrome } from "../SalesUiComponents";

function toneForPayment(s: string): Tone {
  if (s === "verified" || s === "partial") return "green";
  if (s === "pending") return "yellow";
  if (s === "rejected" || s === "reversed") return "red";
  return "gray";
}

export function PaymentsView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  openPaymentAction,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  openPaymentAction: (row: Row) => void;
}) {
  const verifiedTotal = sumBy(rows, "amount", ["verified", "partial"]);
  const pending = rows.filter((r) => String(r.status ?? "") === "pending");

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="⏳" iconBg="var(--color-amber-bg)" iconColor="var(--color-amber-strong)" label="Pending Verification" value={number.format(countBy(rows, ["pending"]))} sub="Awaiting approval" onClick={() => setStatus(status === "pending" ? "" : "pending")} />
        <KpiCard icon="✅" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Verified" value={number.format(countBy(rows, ["verified", "partial"]))} sub="Approved & applied" onClick={() => setStatus(status === "verified" ? "" : "verified")} />
        <KpiCard icon="✖️" iconBg="var(--color-red-bg)" iconColor="var(--color-danger-strong)" label="Rejected" value={number.format(countBy(rows, ["rejected"]))} sub="Needs resubmission" onClick={() => setStatus(status === "rejected" ? "" : "rejected")} />
        <KpiCard icon="💰" iconBg="var(--color-orange-bg)" iconColor="var(--color-orange)" label="Total Collected" value={fmtMoney(verifiedTotal)} sub="Verified amount" />
      </KpiStrip>

      {pending.length > 0 && (
        <Panel title="Verification Queue" badge={pending.length}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {pending.map((r) => (
              <article key={String(r.id)} style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--color-warning)", borderRadius: 10, padding: 12, background: "var(--surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{String(r.buyer_name ?? "—")}</strong>
                  <RefText value={r.reference} />
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 8px" }}>
                  {String(r.sale_reference ?? "—")} · {String(r.method ?? "—")}
                </div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 800 }}>{fmtMoney(r.amount)}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 10px" }}>{String(r.external_reference ?? "—")} · {fmtDate(r.paid_on)}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn primary sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => openPaymentAction(r)}>Verify</button>
                  <button className="btn ghost sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => openPaymentAction(r)}>Reject</button>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Payments & Verification" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search payment ref, buyer, external ref…"
          chips={<FilterChips options={[{ value: "pending", label: "Pending" }, { value: "verified", label: "Verified" }, { value: "partial", label: "Partial" }, { value: "rejected", label: "Rejected" }, { value: "reversed", label: "Reversed" }]} value={status as "pending" | "verified" | "partial" | "rejected" | "reversed" | ""} onChange={(v) => setStatus(v)} />}
        >
          {rows.length === 0 ? (
            <EmptyState icon="💳" title="No payments recorded" description="Buyer-submitted payments appear here for verification and reconciliation." />
          ) : (
            <DataTable headers={["Payment Ref", "Buyer", "Sale", "Method", "Amount", "Date", "External Ref", "Status", "Actions"]}>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><RefText value={r.reference} /></td>
                  <td><strong style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</strong></td>
                  <td style={{ fontSize: 12 }} className="mono">{String(r.sale_reference ?? "—")}</td>
                  <td style={{ fontSize: 12 }}>{String(r.method ?? "—")}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.amount)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(r.paid_on)}</td>
                  <td className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{String(r.external_reference ?? "—")}</td>
                  <td><StatusPill value={String(r.status ?? "")} tone={toneForPayment(String(r.status ?? ""))} /></td>
                  <td>
                    {["pending", "verified"].includes(String(r.status)) && (
                      <button className="btn ghost sm" onClick={() => openPaymentAction(r)}>{String(r.status) === "pending" ? "Verify" : "Reverse"}</button>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}
