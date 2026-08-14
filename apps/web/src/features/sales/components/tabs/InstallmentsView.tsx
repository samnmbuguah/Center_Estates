"use client";

import { useState } from "react";
import { EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { Row, Tone } from "../../types/sales.types";
import { countBy, fmtDate, fmtMoney } from "../../utils/sales.utils";
import { DataTable, FilterChips, RefText, TableChrome } from "../SalesUiComponents";

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
  const overdue = countBy(rows, ["overdue"]);
  const outstanding = rows.reduce((s, r) => s + (Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)), 0);
  const [clipNotice, setClipNotice] = useState("");

  function copyLink(r: Row) {
    const url = `${window.location.origin}/sales/pay?installment=${String(r.id)}`;
    navigator.clipboard?.writeText(url).then(
      () => setClipNotice(`Payment link copied for ${String(r.sale_reference ?? "installment")}.`),
      () => setClipNotice("Could not copy the payment link."),
    );
  }

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🗓️" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Installments" value={number.format(rows.length)} sub="Across all sales" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Paid" value={number.format(countBy(rows, ["paid"]))} sub="Settled in full" onClick={() => setStatus(status === "paid" ? "" : "paid")} />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Pending" value={number.format(countBy(rows, ["upcoming", "due", "partial"]))} sub="Due or partly paid" onClick={() => setStatus(status === "due" ? "" : "due")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value={number.format(overdue)} sub="Past due date" onClick={() => setStatus(status === "overdue" ? "" : "overdue")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Outstanding" value={fmtMoney(outstanding)} sub="Total unpaid balance" />
      </KpiStrip>

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
