"use client";

import { useState } from "react";
import { DetailDrawer, EmptyState, KpiCard, KpiStrip, number, Panel, StatusPill } from "@/components/module-ui";
import { Row, Tone } from "../../types/sales.types";
import { countBy, fmtDate, fmtDateTime, fmtMoney, sumBy } from "../../utils/sales.utils";
import { DataTable, DField, FilterChips, RefText, TableChrome } from "../SalesUiComponents";
import { SaleAgreementView } from "./SaleAgreementView";
import { SavedViews } from "../SavedViews";

function toneForSale(s: string): Tone {
  if (s === "completed") return "green";
  if (s === "contracted") return "blue";
  if (s === "reserved") return "yellow";
  if (s === "draft") return "gray";
  if (s === "cancelled") return "red";
  return "gray";
}

const PIPELINE_STAGES: { key: string; label: string; color: string }[] = [
  { key: "draft", label: "Draft", color: "var(--text-faint)" },
  { key: "reserved", label: "Reserved", color: "var(--color-warning)" },
  { key: "contracted", label: "Contracted", color: "var(--color-info)" },
  { key: "completed", label: "Completed", color: "var(--color-success)" },
  { key: "cancelled", label: "Cancelled", color: "var(--color-danger-strong)" },
];

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
  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const pipelineValue = sumBy(rows, "agreed_price", ["draft", "reserved", "contracted"]);
  const pipelineDeals = countBy(rows, ["draft", "reserved", "contracted"]);

  if (agreementRow) {
    return <SaleAgreementView sale={agreementRow} onBack={() => setAgreementRow(null)} />;
  }

  const viewToggle = (
    <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <SavedViews scope="sales-pipeline" current={{ status, search }} onApply={(f) => { setStatus(f.status); setSearch(f.search); }} />
      <button className={`btn sm ${viewMode === "board" ? "primary" : "ghost"}`} onClick={() => setViewMode("board")}>Board</button>
      <button className={`btn sm ${viewMode === "table" ? "primary" : "ghost"}`} onClick={() => setViewMode("table")}>Table</button>
      {canSell ? <button className="btn primary sm" onClick={openNewSale}>+ New Sale</button> : null}
    </div>
  );

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="📋" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Total Sales" value={number.format(rows.length)} sub="All pipeline records" />
        <KpiCard icon="💼" iconBg="var(--color-orange-bg)" iconColor="var(--color-orange)" label="Pipeline Value" value={fmtMoney(pipelineValue)} sub={`${number.format(pipelineDeals)} active deals`} />
        <KpiCard icon="🔒" iconBg="var(--color-amber-bg)" iconColor="var(--color-amber-strong)" label="Reserved" value={number.format(countBy(rows, ["reserved"]))} sub="Under reservation" onClick={() => setStatus(status === "reserved" ? "" : "reserved")} />
        <KpiCard icon="📝" iconBg="var(--color-sky-bg)" iconColor="var(--color-sky)" label="Contracted" value={number.format(countBy(rows, ["contracted"]))} sub="Agreements signed" onClick={() => setStatus(status === "contracted" ? "" : "contracted")} />
        <KpiCard icon="✅" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Completed" value={number.format(countBy(rows, ["completed"]))} sub="Fully paid & closed" onClick={() => setStatus(status === "completed" ? "" : "completed")} />
      </KpiStrip>

      <Panel title="Sales Pipeline" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search sale ref, buyer, unit…"
          chips={<FilterChips options={[{ value: "draft", label: "Draft" }, { value: "reserved", label: "Reserved" }, { value: "contracted", label: "Contracted" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} value={status as "draft" | "reserved" | "contracted" | "completed" | "cancelled" | ""} onChange={(v) => setStatus(v)} />}
          actions={viewToggle}
        >
          {rows.length === 0 ? (
            <EmptyState icon="📋" title="No sales recorded" description="Register a sale to attach a buyer, unit and installment plan." action={canSell ? <button className="btn primary sm" onClick={openNewSale}>+ New Sale</button> : undefined} />
          ) : viewMode === "board" ? (
            <div className="kanban-scroll" style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
              {PIPELINE_STAGES.map((stage) => {
                const items = rows.filter((r) => String(r.status ?? "") === stage.key);
                const stageValue = items.reduce((s, r) => s + Number(r.agreed_price ?? 0), 0);
                return (
                  <div key={stage.key} style={{ minWidth: 264, flex: "0 0 264px", background: "var(--surface-2, var(--color-slate-50))", border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 12 }}>
                        <i style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block" }} />
                        {stage.label}
                        <span style={{ color: "var(--muted)", fontWeight: 600 }}>{items.length}</span>
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{fmtMoney(stageValue)}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 11, color: "var(--muted)", padding: "10px 4px", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 8 }}>No deals</div>
                      ) : items.map((r) => {
                        const price = Number(r.agreed_price ?? 0);
                        const paid = Number(r.paid_amount ?? 0);
                        const pct = price ? Math.min(100, Math.round((paid / price) * 100)) : 0;
                        return (
                          <article
                            key={String(r.id)}
                            onClick={() => setAgreementRow(r)}
                            style={{ background: "var(--surface, #fff)", border: "1px solid var(--border)", borderLeft: `3px solid ${stage.color}`, borderRadius: 10, padding: 10, cursor: "pointer" }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                              <strong style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</strong>
                              <RefText value={r.reference} />
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 6px" }}>
                              {String(r.project_name ?? "—")}{r.unit_code ? ` · ${String(r.unit_code)}` : ""}
                            </div>
                            <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{fmtMoney(price)}</div>
                            <div style={{ background: "var(--surface-sunken, var(--surface-sunken))", borderRadius: 99, height: 6, margin: "8px 0 4px", overflow: "hidden" }}>
                              <i style={{ display: "block", height: "100%", width: `${pct}%`, background: stage.color }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)" }}>
                              <span>{pct}% paid</span>
                              <span>{fmtMoney(price - paid)} balance</span>
                            </div>
                            {canSell && (
                              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                                <button className="btn ghost sm" style={{ fontSize: 10, padding: "2px 8px" }} onClick={(e) => { e.stopPropagation(); setAgreementRow(r); }}>Agreement</button>
                                <button className="btn ghost sm" style={{ fontSize: 10, padding: "2px 8px" }} onClick={(e) => { e.stopPropagation(); transitionSale(r); }}>Move</button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <DataTable headers={["Sale Ref", "Buyer", "Project / Unit", "Price", "Paid", "Balance", "Plan", "Status", "Date", "Actions"]}>
              {rows.map((r) => {
                const price = Number(r.agreed_price ?? 0);
                const paid = Number(r.paid_amount ?? 0);
                return (
                  <tr key={String(r.id)} onClick={() => setAgreementRow(r)}>
                    <td><RefText value={r.reference} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {String(r.project_name ?? "—")}
                      {r.unit_code ? <div className="mono" style={{ fontSize: 10 }}>{String(r.unit_code)}</div> : null}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(price)}</td>
                    <td className="mono" style={{ fontSize: 12, color: "var(--color-success)" }}>{fmtMoney(paid)}</td>
                    <td className="mono" style={{ fontSize: 12, color: paid >= price ? "var(--color-success)" : "var(--color-danger-strong)" }}>{fmtMoney(price - paid)}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{price ? `${Math.round((paid / price) * 100)}% paid` : "—"}</td>
                    <td><StatusPill value={String(r.status ?? "")} tone={toneForSale(String(r.status ?? ""))} /></td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(r.contracted_on ?? r.reserved_at ?? r.created_at)}</td>
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
