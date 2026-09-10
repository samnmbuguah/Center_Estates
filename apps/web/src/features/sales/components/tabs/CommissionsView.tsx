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

function GateBar({ achieved, required, label }: { achieved: number; required: number; label: string }) {
  const met = achieved >= required;
  const pct = required > 0 ? Math.min(100, Math.round((achieved / required) * 100)) : 100;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)" }}>
        <span>{label}</span>
        <span className="mono" style={{ color: met ? "#16a34a" : "#92400e", fontWeight: 700 }}>{achieved}% / {required}%</span>
      </div>
      <div style={{ background: "var(--surface-sunken, #eef2f7)", borderRadius: 99, height: 6, marginTop: 3, overflow: "hidden" }}>
        <i style={{ display: "block", height: "100%", width: `${pct}%`, background: met ? "#16a34a" : "#f59e0b" }} />
      </div>
    </div>
  );
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
  const eligible = rows.filter((r) => String(r.status ?? "") === "eligible");
  const awaiting = rows.filter((r) => String(r.status ?? "") === "pending");
  const approved = rows.filter((r) => String(r.status ?? "") === "approved");
  const payable = sumBy(approved, "amount");

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Commissions" value={number.format(rows.length)} sub="All agent records" />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Awaiting Gates" value={number.format(awaiting.length)} sub="Not yet eligible" onClick={() => setStatus(status === "pending" ? "" : "pending")} />
        <KpiCard icon="🧪" iconBg="#e0f2fe" iconColor="#0284c7" label="Ready to Approve" value={number.format(eligible.length)} sub="Gates passed" onClick={() => setStatus(status === "eligible" ? "" : "eligible")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Approved" value={number.format(approved.length)} sub="Approved for payout" onClick={() => setStatus(status === "approved" ? "" : "approved")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Payable" value={fmtMoney(payable)} sub={`of ${fmtMoney(totalValue)} total`} />
      </KpiStrip>

      {(eligible.length > 0 || awaiting.length > 0) && (
        <Panel title="Payout Workflow" badge={eligible.length + awaiting.length}>
          <div className="grid-2" style={{ gap: 18, alignItems: "start" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Ready for approval ({eligible.length})</div>
              {eligible.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>No commissions have cleared their gates yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {eligible.map((r) => (
                    <article key={String(r.id)} style={{ border: "1px solid var(--border)", borderLeft: "3px solid #2563eb", borderRadius: 10, padding: 12, background: "var(--surface)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ fontSize: 13 }}>{String(r.agent_name ?? "—")}</strong>
                        <span className="mono" style={{ fontSize: 14, fontWeight: 800 }}>{fmtMoney(r.amount)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0" }}>
                        {String(r.sale_reference ?? "—")} · {String(r.buyer_name ?? "—")} · {String(r.rate_percent ?? "—")}%
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button className="btn primary sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => runCommissionAction(r, "approve")}>Approve</button>
                        <button className="btn ghost sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => runCommissionAction(r, "hold")}>Hold</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Awaiting gates ({awaiting.length})</div>
              {awaiting.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>No commissions are waiting on gates.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {awaiting.map((r) => (
                    <article key={String(r.id)} style={{ border: "1px solid var(--border)", borderLeft: "3px solid #d97706", borderRadius: 10, padding: 12, background: "var(--surface)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ fontSize: 13 }}>{String(r.agent_name ?? "—")}</strong>
                        <span className="mono" style={{ fontSize: 13 }}>{fmtMoney(r.amount)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                        {String(r.sale_reference ?? "—")} · {String(r.buyer_name ?? "—")}
                      </div>
                      <GateBar achieved={Number(r.achieved_paid_percent ?? 0)} required={Number(r.required_paid_percent ?? 0)} label="Payments gate" />
                      <GateBar achieved={Number(r.achieved_construction_percent ?? 0)} required={Number(r.required_construction_percent ?? 0)} label="Construction gate" />
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

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
            <DataTable headers={["Commission Ref", "Agent", "Sale", "Buyer", "Rate", "Amount", "Gates", "Status", "Actions"]}>
              {rows.map((r) => {
                const st = String(r.status ?? "");
                const paidMet = Number(r.achieved_paid_percent ?? 0) >= Number(r.required_paid_percent ?? 0);
                const constructionMet = Number(r.achieved_construction_percent ?? 0) >= Number(r.required_construction_percent ?? 0);
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={r.reference} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.agent_name ?? "—")}</strong></td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(r.sale_reference ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(r.rate_percent ?? "—")}%</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.amount)}</td>
                    <td style={{ fontSize: 10, color: "#6b7890", whiteSpace: "nowrap" }}>
                      <span title={`Payments ${r.achieved_paid_percent ?? 0}% / ${r.required_paid_percent ?? 0}%`}>{paidMet ? "✅" : "⏳"} pay {String(r.achieved_paid_percent ?? 0)}/{String(r.required_paid_percent ?? 0)}%</span>
                      <br />
                      <span title={`Construction ${r.achieved_construction_percent ?? 0}% / ${r.required_construction_percent ?? 0}%`}>{constructionMet ? "✅" : "⏳"} constr {String(r.achieved_construction_percent ?? 0)}/{String(r.required_construction_percent ?? 0)}%</span>
                    </td>
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
