"use client";

import { useState } from "react";
import { DetailDrawer, EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { Row, Tone } from "../../types/sales.types";
import { countBy, fmtDate, fmtDateTime, fmtMoney, sumBy } from "../../utils/sales.utils";
import { DataTable, DField, FilterChips, RefText, TableChrome } from "../SalesUiComponents";
import { SaleAgreementView } from "./SaleAgreementView";

function toneForSale(s: string): Tone {
  if (s === "completed") return "green";
  if (s === "contracted") return "blue";
  if (s === "reserved") return "yellow";
  if (s === "draft") return "gray";
  if (s === "cancelled") return "red";
  return "gray";
}

export function SalesView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  canSell,
  openNewSale,
  transitionSale,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  canSell: boolean;
  openNewSale: () => void;
  transitionSale: (row: Row) => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [agreementRow, setAgreementRow] = useState<Row | null>(null);
  const pipelineValue = sumBy(rows, "agreed_price", ["draft", "reserved", "contracted"]);
  const pipelineDeals = countBy(rows, ["draft", "reserved", "contracted"]);

  if (agreementRow) {
    return <SaleAgreementView sale={agreementRow} onBack={() => setAgreementRow(null)} />;
  }

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Sales" value={number.format(rows.length)} sub="All pipeline records" />
        <KpiCard icon="💼" iconBg="#fff7ed" iconColor="#ea580c" label="Pipeline Value" value={fmtMoney(pipelineValue)} sub={`${number.format(pipelineDeals)} active deals`} />
        <KpiCard icon="🔒" iconBg="#fef3c7" iconColor="#92400e" label="Reserved" value={number.format(countBy(rows, ["reserved"]))} sub="Under reservation" onClick={() => setStatus(status === "reserved" ? "" : "reserved")} />
        <KpiCard icon="📝" iconBg="#e0f2fe" iconColor="#0284c7" label="Contracted" value={number.format(countBy(rows, ["contracted"]))} sub="Agreements signed" onClick={() => setStatus(status === "contracted" ? "" : "contracted")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={number.format(countBy(rows, ["completed"]))} sub="Fully paid & closed" onClick={() => setStatus(status === "completed" ? "" : "completed")} />
      </KpiStrip>

      <Panel title="Sales Pipeline" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search sale ref, buyer, unit…"
          chips={<FilterChips options={[{ value: "draft", label: "Draft" }, { value: "reserved", label: "Reserved" }, { value: "contracted", label: "Contracted" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} value={status as "draft" | "reserved" | "contracted" | "completed" | "cancelled" | ""} onChange={(v) => setStatus(v)} />}
          actions={canSell ? <button className="btn primary sm" onClick={openNewSale}>+ New Sale</button> : null}
        >
          {rows.length === 0 ? (
            <EmptyState icon="📋" title="No sales recorded" description="Register a sale to attach a buyer, unit and installment plan." action={canSell ? <button className="btn primary sm" onClick={openNewSale}>+ New Sale</button> : undefined} />
          ) : (
            <DataTable headers={["Sale Ref", "Buyer", "Project / Unit", "Price", "Paid", "Balance", "Plan", "Status", "Date", "Actions"]}>
              {rows.map((r) => {
                const price = Number(r.agreed_price ?? 0);
                const paid = Number(r.paid_amount ?? 0);
                return (
                  <tr key={String(r.id)} onClick={() => setAgreementRow(r)}>
                    <td><RefText value={r.reference} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12, color: "#6b7890" }}>
                      {String(r.project_name ?? "—")}
                      {r.unit_code ? <div className="mono" style={{ fontSize: 10 }}>{String(r.unit_code)}</div> : null}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(price)}</td>
                    <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{fmtMoney(paid)}</td>
                    <td className="mono" style={{ fontSize: 12, color: paid >= price ? "#16a34a" : "#b91c1c" }}>{fmtMoney(price - paid)}</td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{price ? `${Math.round((paid / price) * 100)}% paid` : "—"}</td>
                    <td><StatusPill value={String(r.status ?? "")} tone={toneForSale(String(r.status ?? ""))} /></td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{fmtDate(r.contracted_on ?? r.reserved_at ?? r.created_at)}</td>
                    <td>
                      <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setAgreementRow(r); }}>Agreement</button>
                      <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={(e) => { e.stopPropagation(); transitionSale(r); }}>Transition</button>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>

      {selected && (
        <DetailDrawer title={`Sale ${String(selected.reference ?? "—")}`} onClose={() => setSelected(null)} width={400}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span className="fc-detail-thumb-placeholder" style={{ height: 44, width: 44, fontSize: 20 }}>🏷️</span>
            <div className="fc-detail-meta">
              <strong style={{ fontSize: 14 }}>{String(selected.buyer_name ?? "—")}</strong>
              <small className="mono">{String(selected.reference ?? "—")}</small>
            </div>
            <StatusPill value={String(selected.status ?? "")} tone={toneForSale(String(selected.status ?? ""))} />
          </div>
          <div className="fc-detail-grid">
            <DField label="Project / Unit" value={`${String(selected.project_name ?? "—")} · ${String(selected.unit_code ?? "—")}`} />
            <DField label="Agreed Price" value={<span className="mono">{fmtMoney(selected.agreed_price)}</span>} />
            <DField label="Reservation Fee" value={<span className="mono">{fmtMoney(selected.reservation_fee)}</span>} />
            <DField label="Paid to Date" value={<span className="mono">{fmtMoney(selected.paid_amount)}</span>} />
            <DField label="Balance" value={<span className="mono">{fmtMoney(Number(selected.agreed_price ?? 0) - Number(selected.paid_amount ?? 0))}</span>} />
            <DField label="Reserved" value={selected.reserved_at ? fmtDateTime(selected.reserved_at) : "—"} />
            <DField label="Contracted" value={selected.contracted_on ? fmtDate(selected.contracted_on) : "—"} />
            <DField label="Expected Completion" value={selected.expected_completion_on ? fmtDate(selected.expected_completion_on) : "—"} />
            <DField label="Cancellation Reason" value={String(selected.cancellation_reason || "—")} />
          </div>
        </DetailDrawer>
      )}
    </>
  );
}
