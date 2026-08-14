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

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Pending Verification" value={number.format(countBy(rows, ["pending"]))} sub="Awaiting approval" onClick={() => setStatus(status === "pending" ? "" : "pending")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Verified" value={number.format(countBy(rows, ["verified", "partial"]))} sub="Approved & applied" onClick={() => setStatus(status === "verified" ? "" : "verified")} />
        <KpiCard icon="✖️" iconBg="#fee2e2" iconColor="#b91c1c" label="Rejected" value={number.format(countBy(rows, ["rejected"]))} sub="Needs resubmission" onClick={() => setStatus(status === "rejected" ? "" : "rejected")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Total Collected" value={fmtMoney(verifiedTotal)} sub="Verified amount" />
      </KpiStrip>

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
                  <td className="mono" style={{ fontSize: 11, color: "#6b7890" }}>{String(r.external_reference ?? "—")}</td>
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
