"use client";

import { EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { Row, Tone } from "../../types/sales.types";
import { countBy, fmtMoney, sumBy } from "../../utils/sales.utils";
import { DataTable, FilterChips, RefText, TableChrome } from "../SalesUiComponents";

function toneForCommission(s: string): Tone {
  if (s === "paid" || s === "approved") return "green";
  if (s === "eligible") return "blue";
  if (s === "pending") return "yellow";
  if (s === "held") return "red";
  return "gray";
}

export function CommissionsView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  runCommissionAction,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  runCommissionAction: (row: Row, action: string) => void;
}) {
  const totalValue = sumBy(rows, "amount");

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Commissions" value={number.format(rows.length)} sub="All agent records" />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Pending" value={number.format(countBy(rows, ["pending"]))} sub="Waiting on gates" onClick={() => setStatus(status === "pending" ? "" : "pending")} />
        <KpiCard icon="🧪" iconBg="#e0f2fe" iconColor="#0284c7" label="Eligible" value={number.format(countBy(rows, ["eligible"]))} sub="Gates passed" onClick={() => setStatus(status === "eligible" ? "" : "eligible")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Approved" value={number.format(countBy(rows, ["approved"]))} sub="Approved for payout" onClick={() => setStatus(status === "approved" ? "" : "approved")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Value" value={fmtMoney(totalValue)} sub="Total commission value" />
      </KpiStrip>

      <Panel title="Agent Commissions" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search commission, agent, sale…"
          chips={<FilterChips options={[{ value: "pending", label: "Pending" }, { value: "eligible", label: "Eligible" }, { value: "approved", label: "Approved" }, { value: "paid", label: "Paid" }, { value: "held", label: "Held" }]} value={status as "pending" | "eligible" | "approved" | "paid" | "held" | ""} onChange={(v) => setStatus(v)} />}
        >
          {rows.length === 0 ? (
            <EmptyState icon="🧾" title="No commissions yet" description="Commissions are generated per sale and gated on verified payments and construction progress." />
          ) : (
            <DataTable headers={["Commission Ref", "Agent", "Sale", "Buyer", "Rate", "Amount", "Payment Gate", "Status", "Actions"]}>
              {rows.map((r) => {
                const st = String(r.status ?? "");
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={r.reference} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.agent_name ?? "—")}</strong></td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(r.sale_reference ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(r.rate_percent ?? "—")}%</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.amount)}</td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>≥ {String(r.required_paid_percent ?? 0)}% paid</td>
                    <td><StatusPill value={st} tone={toneForCommission(st)} /></td>
                    <td>
                      {st === "eligible" && <button className="btn ghost sm" onClick={() => runCommissionAction(r, "approve")}>Approve</button>}
                      {(st === "pending" || st === "eligible") && <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => runCommissionAction(r, "hold")}>Hold</button>}
                      {st === "approved" && <button className="btn primary sm" style={{ marginLeft: 6 }} onClick={() => runCommissionAction(r, "mark-paid")}>Mark Paid</button>}
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
