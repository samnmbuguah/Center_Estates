"use client";

import { useState } from "react";
import { EmptyState, Field, KpiCard, KpiStrip, Modal, number, Panel, StatusPill } from "@/components/module-ui";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { Row } from "../../types/sales.types";
import { fmtDate, fmtMoney, sumBy } from "../../utils/sales.utils";
import { DataTable, ProgressBar, RefText, TableChrome } from "../SalesUiComponents";

export function BankReconciliationView({
  rows,
  search,
  setSearch,
  org,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  org: string | null;
}) {
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustRow, setAdjustRow] = useState<Row | null>(null);
  const [adjustReason, setAdjustReason] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const total = rows.length;
  const matched = rows.filter((r) => String(r.status) === "verified").length;
  const unmatched = rows.filter((r) => String(r.status) === "pending").length;
  const totalReconciled = sumBy(rows, "amount", ["verified", "partial"]);
  const matchedPct = total > 0 ? Math.round((matched / total) * 100) : 0;
  const unmatchedAmount = sumBy(rows, "amount", ["pending"]);

  function handleMatch(row: Row) {
    setAdjustRow(row);
    setAdjustReason("");
    setShowAdjustment(true);
  }

  async function submitAdjustment() {
    if (!adjustRow || !org || !adjustReason.trim()) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/payments/${adjustRow.id}/verify/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({}),
    }, org);
    if (res.ok) {
      setShowAdjustment(false);
      setAdjustRow(null);
    }
  }

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🏦" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Total Transactions" value={number.format(total)} sub="From payment records" />
        <KpiCard icon="✅" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Matched" value={number.format(matched)} sub="Verified & reconciled" />
        <KpiCard icon="⚠️" iconBg="var(--color-amber-bg)" iconColor="var(--color-amber-strong)" label="Unmatched" value={number.format(unmatched)} sub="Pending verification" />
        <KpiCard icon="💰" iconBg="var(--color-orange-bg)" iconColor="var(--color-orange)" label="Total Reconciled" value={fmtMoney(totalReconciled)} sub={`${matchedPct}% matched`} />
      </KpiStrip>

      <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <Panel title="Bank Statement Import">
          <div
            style={{
              border: `2px dashed ${dragOver ? "var(--color-orange)" : "var(--border)"}`,
              borderRadius: 10,
              padding: 36,
              textAlign: "center",
              background: dragOver ? "rgba(234,88,12,0.04)" : "var(--surface-2)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
            onClick={() => document.getElementById("bank-stmt-input")?.click()}
          >
            <input id="bank-stmt-input" type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={() => {}} />
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>📄</div>
            <strong style={{ fontSize: 13 }}>Drop bank statement here</strong>
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>or click to browse CSV/Excel files</p>
          </div>
        </Panel>

        <Panel title="Reconciliation Summary">
          <div style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Match Rate</span>
              <strong className="mono" style={{ fontSize: 13 }}>{matchedPct}%</strong>
            </div>
            <ProgressBar pct={matchedPct} color={matchedPct >= 80 ? "var(--color-success)" : matchedPct >= 50 ? "var(--color-amber)" : "var(--color-danger-strong)"} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Unmatched Amount</span>
              <strong className="mono" style={{ fontSize: 13, color: "var(--color-danger-strong)" }}>{fmtMoney(unmatchedAmount)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Total Reconciled</span>
              <strong className="mono" style={{ fontSize: 13, color: "var(--color-success)" }}>{fmtMoney(totalReconciled)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Transactions</span>
              <strong className="mono" style={{ fontSize: 13 }}>{number.format(total)}</strong>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Transaction Reconciliation" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search payment ref, buyer, external ref…"
        >
          {rows.length === 0 ? (
            <EmptyState icon="🏦" title="No transactions to reconcile" description="Import a bank statement or record payments to begin reconciliation." />
          ) : (
            <DataTable headers={["Payment Ref", "Date", "Description", "Amount", "System Match", "Actions"]}>
              {rows.map((r) => {
                const st = String(r.status ?? "");
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={r.reference} /></td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.paid_on)}</td>
                    <td style={{ fontSize: 12 }}>
                      {String(r.buyer_name ?? "—")}
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>{String(r.method ?? "")} · {String(r.external_reference ?? "")}</div>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.amount)}</td>
                    <td>
                      <StatusPill
                        value={st === "verified" ? "Matched" : st === "rejected" ? "Rejected" : "Unmatched"}
                        tone={st === "verified" ? "green" : st === "rejected" ? "red" : "yellow"}
                      />
                    </td>
                    <td>
                      {st === "pending" && (
                        <>
                          <button className="btn ghost sm" onClick={() => handleMatch(r)}>Match</button>
                          <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => { setAdjustRow(r); setAdjustReason("Adjustment needed"); setShowAdjustment(true); }}>Adjust</button>
                        </>
                      )}
                      {st === "verified" && <span style={{ fontSize: 11, color: "var(--color-success)" }}>✓ Reconciled</span>}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>

      {showAdjustment && adjustRow && (
        <Modal title="Record Adjustment" onClose={() => setShowAdjustment(false)}>
          <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Payment</span><span className="mono">{String(adjustRow.reference ?? "—")}</span></div>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Amount</span><strong className="mono">{fmtMoney(adjustRow.amount)}</strong></div>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Buyer</span><span>{String(adjustRow.buyer_name ?? "—")}</span></div>
          </div>
          <Field label="Adjustment Reason" required>
            <textarea rows={3} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Why does this transaction need adjustment?" />
          </Field>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setShowAdjustment(false)}>Cancel</button>
            <button className="btn primary" disabled={!adjustReason.trim()} onClick={submitAdjustment}>Confirm Match</button>
          </div>
        </Modal>
      )}
    </>
  );
}
