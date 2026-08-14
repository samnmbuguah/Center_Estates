"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, Modal, money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";

type LocalExpenditure = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  float_ref: string;
  status: string;
};

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "#8a96a7" }}>
      {message}
    </div>
  );
}

export function ExpenditureView({ rows, organizationId }: { rows: Row[]; organizationId: string | null }) {
  const storageKey = organizationId ? `facility-expenditures-${organizationId}` : "facility-expenditures";
  const floatKey = organizationId ? `facility-float-${organizationId}` : "facility-float";
  const defaultFloat = 5000000;

  const [localExpenditures, setLocalExpenditures] = useState<LocalExpenditure[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
      return Array.isArray(parsed) ? (parsed as LocalExpenditure[]) : [];
    } catch {
      return [];
    }
  });
  const [floatAllocated, setFloatAllocated] = useState<number>(() => {
    if (typeof window === "undefined") return defaultFloat;
    try {
      const stored = Number(window.localStorage.getItem(floatKey) ?? String(defaultFloat));
      return Number.isFinite(stored) && stored > 0 ? stored : defaultFloat;
    } catch {
      return defaultFloat;
    }
  });
  const [showRecord, setShowRecord] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(localExpenditures));
    } catch {
      /* storage unavailable */
    }
  }, [localExpenditures, storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(floatKey, String(floatAllocated));
    } catch {
      /* storage unavailable */
    }
  }, [floatAllocated, floatKey]);

  const costItemsSpent = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const localSpent = localExpenditures.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const spent = costItemsSpent + localSpent;
  const remaining = floatAllocated - spent;
  const spentPct = floatAllocated > 0 ? Math.max(0, Math.min(100, Math.round((spent / floatAllocated) * 100))) : 0;

  const expenditures: Row[] = [
    ...localExpenditures.map((e) => ({ id: e.id, date: e.date, category: e.category, description: e.description, amount: e.amount, float_ref: e.float_ref, status: e.status })),
    ...rows.map((r) => ({
      id: `cost-${String(r.id)}`,
      date: String(r.created_at ?? "—"),
      category: String(r.kind ?? "other").replace(/_/g, " "),
      description: String(r.description ?? "—"),
      amount: Number(r.total ?? 0),
      float_ref: String(r.reference ?? "—"),
      status: "approved",
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  async function recordExpenditure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entry: LocalExpenditure = {
      id: `exp-${Date.now()}`,
      date: String(form.get("date") ?? new Date().toISOString().slice(0, 10)),
      category: String(form.get("category") ?? "General"),
      description: String(form.get("description") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      float_ref: String(form.get("float_ref") ?? `FLT-${new Date().getFullYear()}`),
      status: "pending",
    };
    setLocalExpenditures((prev) => [...prev, entry]);
    setShowRecord(false);
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
        <button className="fc-toolbar-btn primary" onClick={() => setShowRecord(true)} style={{ fontWeight: 800 }}>+ Record Expenditure</button>
      </div>

      {/* Landlord Float balance card */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginBottom: 16 }}>
        <div className="data-panel" style={{ background: "linear-gradient(135deg, #0f2744, #1e3a5f)", border: 0 }}>
          <span style={{ color: "#ffffff", display: "block", fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: "0.04em" }}>LANDLORD FLOAT ALLOCATED</span>
          <strong style={{ color: "#fff", display: "block", fontSize: 26, fontWeight: 900 }}>{money.format(floatAllocated)}</strong>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
            <input
              type="number"
              min={0}
              step={1000}
              defaultValue={floatAllocated}
              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) setFloatAllocated(v); }}
              style={{ width: "100%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 700, padding: "6px 10px" }}
              aria-label="Float allocation amount"
            />
          </div>
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

      {/* Note about backend */}
      <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, color: "#92400e", fontSize: 13, fontWeight: 700, marginBottom: 16, padding: "12px 16px" }}>
        The backend has no dedicated <code>/facility/expenses/</code> endpoint, so this ledger is derived from{" "}
        <code>/facility/work-order-cost-items/</code> (approved spend) plus expenditures recorded locally in this browser. When a
        backend expenses model is added, point this view at it for organization-wide tracking.
      </div>

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
              </tr>
            </thead>
            <tbody>
              {expenditures.length > 0 ? expenditures.map((e) => (
                <tr key={String(e.id)}>
                  <td style={{ fontSize: 12, fontWeight: 750, color: "var(--text-primary)" }}>{e.date && (typeof e.date === "string" || typeof e.date === "number") ? new Date(e.date).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : String(e.date ?? "—")}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>{String(e.category ?? "—")}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{String(e.description ?? "—")}</td>
                  <td style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{money.format(Number(e.amount ?? 0))}</td>
                  <td style={{ fontSize: 12, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>{String(e.float_ref ?? "—")}</td>
                  <td><FcStatus value={String(e.status ?? "pending")} /></td>
                </tr>
              )) : (
                <tr><td colSpan={6}><EmptyState message="No expenditures recorded yet." /></td></tr>
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
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, color: "#92400e", fontSize: 12, padding: "8px 12px" }}>
              Recorded locally — no backend expenses endpoint exists yet.
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowRecord(false)}>Cancel</button>
              <button type="submit" className="btn primary">Record Expenditure</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
