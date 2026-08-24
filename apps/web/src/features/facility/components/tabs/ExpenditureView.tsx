"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, Modal, money } from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
      {message}
    </div>
  );
}

export function ExpenditureView({ rows, organizationId, propertyId, canApprove, reload }: {
  rows: Row[];
  organizationId: string | null;
  propertyId: string | null;
  canApprove: boolean;
  reload: () => Promise<void>;
}) {
  const [floatAllocated, setFloatAllocated] = useState(0);
  const [showRecord, setShowRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{ row: Row; action: "approve" | "reject" } | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    apiFetch("/facility/budgets/", {}, organizationId)
      .then(async (response) => response.ok ? response.json() : [])
      .then((budgets: Row[]) => setFloatAllocated(
        budgets.reduce((total, budget) => total + Number(budget.allocated_amount ?? 0), 0),
      ))
      .catch(() => setFloatAllocated(0));
  }, [organizationId, propertyId]);

  const spent = rows.filter((row) => row.status === "approved").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const remaining = floatAllocated - spent;
  const spentPct = floatAllocated > 0 ? Math.max(0, Math.min(100, Math.round((spent / floatAllocated) * 100))) : 0;

  const expenditures = rows;

  async function recordExpenditure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !propertyId) {
      setFormError("Select a property before recording expenditure.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setFormError("");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/expenses/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
      property: propertyId,
      spent_on: String(form.get("date") ?? new Date().toISOString().slice(0, 10)),
      category: String(form.get("category") ?? "General"),
      description: String(form.get("description") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      float_reference: String(form.get("float_ref") ?? ""),
      supplier: String(form.get("supplier") ?? ""),
      receipt_reference: String(form.get("receipt_reference") ?? ""),
      }),
    }, organizationId);
    setSaving(false);
    if (!response.ok) {
      setFormError(await apiErrorMessage(response, "The expenditure could not be saved."));
      return;
    }
    setShowRecord(false);
    await reload();
  }

  async function decideExpense(row: Row, action: "approve" | "reject", notes = "") {
    if (!organizationId || !row.id) return;
    setActionId(String(row.id));
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(`/facility/expenses/${row.id}/${action}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ notes }),
    }, organizationId);
    setActionId(null);
    if (!response.ok) {
      setFormError(await apiErrorMessage(response, `The expense could not be ${action}d.`));
      return;
    }
    setDecisionTarget(null);
    await reload();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", margin: 0, letterSpacing: "-.02em" }}>Expenditure & Landlord Floats</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 750, margin: "4px 0 0" }}>
            Track the landlord float cash-flow advance against facilities expenditure.
          </p>
        </div>
        <button className="fc-toolbar-btn primary" onClick={() => { setFormError(""); setShowRecord(true); }} style={{ fontWeight: 800 }}>+ Record Expenditure</button>
      </div>

      {/* Landlord Float balance card */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginBottom: 16 }}>
        <div className="data-panel" style={{ padding: 18, border: "1.5px solid #2563eb", background: "rgba(37, 99, 235, 0.05)" }}>
          <span style={{ color: "#2563eb", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: "0.04em" }}>LANDLORD FLOAT ALLOCATED</span>
          <strong style={{ color: "var(--text-primary)", display: "block", fontSize: 26, fontWeight: 900 }}>{money.format(floatAllocated)}</strong>
          <small style={{ color: "var(--text-secondary)", display: "block", fontWeight: 700, marginTop: 10 }}>From the approved FM budget for this property</small>
        </div>
        <div className="data-panel" style={{ padding: 18 }}>
          <span style={{ color: "var(--text-primary)", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: "0.04em" }}>SPENT</span>
          <strong style={{ display: "block", fontSize: 26, color: "#b91c1c", fontWeight: 900 }}>{money.format(spent)}</strong>
          <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }}>{spentPct}% of allocated float</span>
        </div>
        <div className="data-panel" style={{ padding: 18 }}>
          <span style={{ color: "var(--text-primary)", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: "0.04em" }}>REMAINING BALANCE</span>
          <strong style={{ display: "block", fontSize: 26, color: remaining < 0 ? "#b91c1c" : "#15803d", fontWeight: 900 }}>{money.format(Math.max(remaining, 0))}</strong>
          {remaining < 0 && <span style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>Float exceeded by {money.format(Math.abs(remaining))}</span>}
        </div>
        <div className="data-panel" style={{ padding: 18 }}>
          <span style={{ color: "var(--text-primary)", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: "0.04em" }}>FLOAT UTILIZATION</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <div style={{ background: "#edf0f5", borderRadius: 99, flex: 1, height: 10, overflow: "hidden" }}>
              <i style={{ background: spentPct >= 100 ? "#ef4444" : spentPct >= 75 ? "#f59e0b" : "#22c55e", borderRadius: "inherit", display: "block", height: "100%", width: `${spentPct}%` }} />
            </div>
            <strong style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{spentPct}%</strong>
          </div>
          <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }}>remaining = float − sum(spent)</span>
        </div>
      </div>

      {formError && <div className="form-error" role="alert" style={{ marginBottom: 16 }}>{formError}</div>}

      {/* Expenditure table */}
      <div className="data-panel">
        <div className="fc-table-toolbar">
          <div className="fc-table-toolbar-left">
            <span style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: 14 }}>Expenditures ({expenditures.length})</span>
          </div>
          <div className="fc-table-toolbar-right">
            <button className="fc-toolbar-btn" onClick={() => exportCsv(expenditures, "facility-expenditures.csv")} style={{ fontWeight: 800 }}>↓ Export</button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Float Reference</th>
                <th>Status</th>
                {canApprove && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {expenditures.length > 0 ? expenditures.map((e) => (
                <tr key={String(e.id)}>
                  <td style={{ fontSize: 12, fontWeight: 750, color: "var(--text-primary)" }}>{e.spent_on ? new Date(String(e.spent_on)).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>{String(e.category ?? "—")}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{String(e.description ?? "—")}</td>
                  <td style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{money.format(Number(e.amount ?? 0))}</td>
                  <td style={{ fontSize: 12, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>{String(e.float_reference ?? "—")}</td>
                  <td><FcStatus value={String(e.status ?? "pending")} /></td>
                  {canApprove && <td>
                    {e.status === "pending" ? <div className="table-actions">
                      <button disabled={actionId === String(e.id)} onClick={() => { setFormError(""); setDecisionTarget({ row: e, action: "approve" }); }}>Approve</button>
                      <button disabled={actionId === String(e.id)} onClick={() => { setFormError(""); setDecisionTarget({ row: e, action: "reject" }); }}>Reject</button>
                    </div> : <span className="muted">Reviewed</span>}
                  </td>}
                </tr>
              )) : (
                <tr><td colSpan={canApprove ? 7 : 6}><EmptyState message="No expenditures recorded yet." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record expenditure modal */}
      {showRecord && (
        <Modal title="Record Expenditure" onClose={() => setShowRecord(false)}>
          <form onSubmit={recordExpenditure} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Date" required>
                <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </Field>
              <Field label="Category" required>
                <select name="category" defaultValue="General">
                  <option value="Repairs">Repairs</option>
                  <option value="Parts">Parts / Materials</option>
                  <option value="Labor">Labor</option>
                  <option value="Utilities">Utilities</option>
                  <option value="General">General</option>
                </select>
              </Field>
            </div>
            <Field label="Description" required>
              <input name="description" required placeholder="e.g. Generator oil top-up" />
            </Field>
            <div className="grid-2">
              <Field label="Amount" required>
                <input name="amount" type="number" min={0} step={1} required placeholder="0" />
              </Field>
              <Field label="Float reference">
                <input name="float_ref" placeholder={`FLT-${new Date().getFullYear()}`} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Supplier / payee"><input name="supplier" autoComplete="organization" /></Field>
              <Field label="Receipt reference"><input name="receipt_reference" autoComplete="off" /></Field>
            </div>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowRecord(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving…" : "Record Expenditure"}</button>
            </div>
          </form>
        </Modal>
      )}
      {decisionTarget && (
        <Modal title={`${decisionTarget.action === "approve" ? "Approve" : "Reject"} Expenditure`} onClose={() => setDecisionTarget(null)}>
          <form onSubmit={(event) => {
            event.preventDefault();
            const notes = String(new FormData(event.currentTarget).get("notes") ?? "");
            void decideExpense(decisionTarget.row, decisionTarget.action, notes);
          }} style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              {String(decisionTarget.row.description ?? "Expense")} · {money.format(Number(decisionTarget.row.amount ?? 0))}
            </p>
            <Field label="Decision notes" required={decisionTarget.action === "reject"}>
              <textarea name="notes" rows={4} required={decisionTarget.action === "reject"} placeholder={decisionTarget.action === "reject" ? "Explain why this expense is rejected" : "Optional verification note"} />
            </Field>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setDecisionTarget(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={actionId === String(decisionTarget.row.id)}>
                {actionId === String(decisionTarget.row.id) ? "Saving…" : decisionTarget.action === "approve" ? "Approve expense" : "Reject expense"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
