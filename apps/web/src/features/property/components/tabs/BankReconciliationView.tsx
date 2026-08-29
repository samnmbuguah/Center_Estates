"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  Badge, ErrorBanner, Field, KpiCard, KpiStrip, Modal, Panel, StatusPill,
} from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import type { BankTransactionRow, Row } from "../../types/property.types";
import { fmtDate, kM, kN } from "../../utils/property.utils";

/**
 * A bank transaction is an independently sourced statement line.  It is never
 * a payment by itself: users reconcile it to an already-posted receipt so the
 * ledger cannot double-count a tenant payment.
 */
export function BankReconciliationView({
  rows,
  loading,
  search,
  setSearch,
  organizationId,
  canFinance = false,
  onMatch = () => {},
  onRecordReceipt = () => {},
  onRefresh = () => {},
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  organizationId?: string | null;
  canFinance?: boolean;
  onMatch?: (r: BankTransactionRow) => void;
  onRecordReceipt?: () => void;
  onRefresh?: () => void;
}) {
  const transactions = rows as BankTransactionRow[];
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    const unmatched = transactions.filter((t) => t.status === "unmatched");
    const matched = transactions.filter((t) => t.status === "matched");
    return {
      unmatched,
      matched,
      unmatchedTotal: unmatched.reduce((sum, t) => sum + Number(t.amount ?? 0), 0),
      matchedTotal: matched.reduce((sum, t) => sum + Number(t.amount ?? 0), 0),
    };
  }, [transactions]);

  async function addStatementLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiFetch("/auth/csrf/", {}, organizationId ?? undefined);
      const response = await apiFetch("/property/bank-transactions/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          reference: String(values.reference ?? "").trim(),
          transacted_on: String(values.transacted_on ?? ""),
          description: String(values.description ?? "").trim(),
          amount: Number(values.amount ?? 0),
        }),
      }, organizationId ?? undefined);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The statement line could not be saved."));
      setShowAdd(false);
      setFeedback({ type: "success", message: "Statement line added. Match it to the existing tenant receipt to complete reconciliation." });
      onRefresh();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "The statement line could not be saved." });
    } finally {
      setSubmitting(false);
    }
  }

  async function importStatement(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setFeedback(null);
    try {
      await apiFetch("/auth/csrf/", {}, organizationId ?? undefined);
      const data = new FormData();
      data.append("file", file);
      const response = await apiFetch("/property/bank-transactions/import-csv/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: data,
      }, organizationId ?? undefined);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The bank statement could not be imported."));
      const result = await response.json().catch(() => ({}));
      setFeedback({ type: "success", message: `${Number(result.created ?? 0)} statement line(s) imported. ${Number(result.skipped ?? 0)} duplicate line(s) were skipped.` });
      onRefresh();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "The bank statement could not be imported." });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {feedback?.type === "error" && <ErrorBanner message={feedback.message} onRetry={onRefresh} />}
      {feedback?.type === "success" && <div role="status" className="card" style={{ padding: "11px 14px", borderColor: "rgba(22, 163, 74, 0.35)", background: "rgba(22, 163, 74, 0.09)", color: "var(--text-primary)", fontWeight: 650 }}>✓ {feedback.message}</div>}

      <ViewToolbar
        title="Bank reconciliation"
        subtitle="Match external bank statement lines to receipts already posted in Center Estates."
        search={search}
        onSearch={setSearch}
        placeholder="Search bank reference, amount or description…"
      >
        {canFinance && <>
          <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={importStatement} />
          <button type="button" className="btn ghost sm" disabled={importing} onClick={() => fileInput.current?.click()}>
            {importing ? "Importing…" : "↑ Import statement CSV"}
          </button>
          <button type="button" className="btn primary sm" onClick={() => setShowAdd(true)}>+ Add statement line</button>
        </>}
      </ViewToolbar>

      <Panel title="How this works">
        <div className="grid-3" style={{ padding: 2 }}>
          <div><Badge tone="blue">1. Record</Badge><p style={{ margin: "8px 0 0", fontWeight: 700 }}>Post the tenant payment as a receipt.</p><p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>This updates the tenant and invoice balances.</p></div>
          <div><Badge tone="yellow">2. Import</Badge><p style={{ margin: "8px 0 0", fontWeight: 700 }}>Add or import the bank statement line.</p><p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>One unique bank reference becomes one statement line.</p></div>
          <div><Badge tone="green">3. Match</Badge><p style={{ margin: "8px 0 0", fontWeight: 700 }}>Match equal amounts and confirm.</p><p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>Reconciliation is proof of deposit; it never creates a second receipt.</p></div>
        </div>
      </Panel>

      <KpiStrip cols={4}>
        <KpiCard icon="🏦" iconBg="#fef3c7" iconColor="#b45309" label="Awaiting match" value={kN(summary.unmatched.length)} sub={kM(summary.unmatchedTotal)} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#15803d" label="Reconciled" value={kN(summary.matched.length)} sub={kM(summary.matchedTotal)} />
        <KpiCard icon="↔" iconBg="#dbeafe" iconColor="#1d4ed8" label="Statement lines" value={kN(transactions.length)} sub="Imported or entered" />
        <KpiCard icon="🧾" iconBg="#f3e8ff" iconColor="#7e22ce" label="Next action" value={summary.unmatched.length ? "Match" : "Up to date"} sub={summary.unmatched.length ? "Review unmatched deposits" : "No outstanding bank lines"} />
      </KpiStrip>

      <Panel title="Bank statement lines">
        <ListState
          loading={loading}
          empty={transactions.length === 0}
          emptyTitle="No bank statement lines yet"
          emptyDesc="Record a receipt when a tenant pays. Then import the bank statement or add its reference here to reconcile the deposit."
        >
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead><tr><th>Bank reference</th><th>Date</th><th>Description</th><th>Amount</th><th>Matched receipt</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{transactions.map((transaction) => (
                <tr key={String(transaction.id)}>
                  <td className="mono" style={{ color: "var(--primary)", fontWeight: 700 }}>{String(transaction.reference ?? "—")}</td>
                  <td>{fmtDate(transaction.transacted_on)}</td>
                  <td>{String(transaction.description ?? "—")}</td>
                  <td className="mono" style={{ fontWeight: 700 }}>{kM(transaction.amount)}</td>
                  <td className="mono">{String(transaction.receipt_number ?? "—")}</td>
                  <td><StatusPill value={String(transaction.status ?? "unmatched")} /></td>
                  <td>{transaction.status === "unmatched" && (canFinance ? <button className="btn primary sm" onClick={() => onMatch(transaction)}>Match receipt</button> : <span className="muted">Finance access required</span>)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </ListState>
        {transactions.length === 0 && canFinance && <div className="row" style={{ justifyContent: "center", gap: 8, paddingBottom: 12 }}><button className="btn ghost sm" onClick={onRecordReceipt}>Record a receipt</button><button className="btn primary sm" onClick={() => setShowAdd(true)}>Add statement line</button></div>}
      </Panel>

      {showAdd && <Modal title="Add bank statement line" onClose={() => setShowAdd(false)}>
        <form onSubmit={addStatementLine} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>This is an external deposit record only. It will not change a tenant balance until you match it with an existing receipt.</p>
          <Field label="Bank reference" required><input name="reference" required placeholder="e.g. KCB-TRX-123456" /></Field>
          <Field label="Transaction date" required><input name="transacted_on" type="date" required /></Field>
          <Field label="Amount (KES)" required><input name="amount" type="number" min="0.01" step="0.01" required /></Field>
          <Field label="Description"><textarea name="description" rows={3} placeholder="Narration from the bank statement" /></Field>
          <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}><button type="button" className="btn ghost" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn primary" disabled={submitting}>{submitting ? "Saving…" : "Save statement line"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
