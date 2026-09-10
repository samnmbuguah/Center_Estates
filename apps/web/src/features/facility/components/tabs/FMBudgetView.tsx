"use client";

import React, { useState } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";

function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="fc-kpi-card" style={{ textAlign: "left" }}>
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub && <span className="fc-kpi-sub">{sub}</span>}
    </div>
  );
}

export function FMBudgetView({
  rows,
  organizationId,
}: {
  rows: Row[];
  organizationId: string | null;
}) {
  const [selectedYear, setSelectedYear] = useState("2026");

  const budgetCategories = rows;

  const fld = (b: Record<string, unknown>, base: string) => Number(b[`${base}_amount`] ?? b[base] ?? 0);
  const totalAllocated = budgetCategories.reduce((s, b) => s + fld(b as Record<string, unknown>, "allocated"), 0);
  const totalCommitted = budgetCategories.reduce((s, b) => s + fld(b as Record<string, unknown>, "committed"), 0);
  const totalActual = budgetCategories.reduce((s, b) => s + fld(b as Record<string, unknown>, "actual"), 0);
  const totalSpentAndCommitted = totalActual + totalCommitted;
  const availableReserve = Math.max(0, totalAllocated - totalSpentAndCommitted);
  const utilizationPct = totalAllocated ? ((totalSpentAndCommitted / totalAllocated) * 100).toFixed(1) : "0.0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Budget KPIs */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="💰" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Annual FM Budget" value={money.format(totalAllocated)} sub={`Financial Year ${selectedYear}`} />
        <FcKpiCard icon="💳" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Invoiced Actual Spend" value={money.format(totalActual)} sub="Approved invoices paid" />
        <FcKpiCard icon="🔒" iconBg="var(--color-amber-bg)" iconColor="var(--color-amber-deep)" label="Committed Spend (POs)" value={money.format(totalCommitted)} sub="Reserved on open work orders" />
        <FcKpiCard icon="📊" iconBg="var(--color-blue-bg)" iconColor="var(--color-info)" label="Budget Utilization" value={`${utilizationPct}%`} sub={totalAllocated ? "Actual plus committed spend" : "No approved budget yet"} />
        <FcKpiCard icon="🛡️" iconBg="#fdf4ff" iconColor="var(--color-purple)" label="Available Reserve" value={money.format(availableReserve)} sub="Remaining uncommitted float" />
      </div>

      {/* Main Budget & Commitment Control Table */}
      <article className="data-panel">
        <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
              Facility Cost Center Budgeting & Commitment Control
            </h2>
            <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
              Tracks PO reserves prior to invoice matching to prevent budget overruns (Cost / m²: KES 501 / m²)
            </small>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="fc-toolbar-btn" onClick={() => exportCsv(budgetCategories, "budget-variance.csv")}>
              ↓ Export Budget Variance
            </button>
          </div>
        </header>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>SERVICE COST CATEGORY</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>ALLOCATED BUDGET</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>COMMITTED (OPEN POs)</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>INVOICED ACTUALS</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>TOTAL ENCUMBERED</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>REMAINING VARIANCE</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>UTILIZATION %</th>
              </tr>
            </thead>
            <tbody>
              {budgetCategories.map((b) => {
                const brow = b as Record<string, unknown>;
                const encumbered = fld(brow, "actual") + fld(brow, "committed");
                const remaining = fld(brow, "allocated") - encumbered;
                const allocatedNum = fld(brow, "allocated");
                const pct = allocatedNum ? Math.round((encumbered / allocatedNum) * 100) : 0;
                return (
                  <tr key={String(b.id)} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 13, color: "var(--text-primary)" }}>
                      {String(b.category)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 700 }}>
                      {money.format(fld(b as Record<string, unknown>, "allocated"))}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, color: "var(--color-amber-deep)" }}>
                      {money.format(fld(b as Record<string, unknown>, "committed"))}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, color: "var(--color-info)" }}>
                      {money.format(fld(b as Record<string, unknown>, "actual"))}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 800 }}>
                      {money.format(encumbered)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 800, color: remaining >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                      {money.format(remaining)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          background: pct <= 85 ? "var(--color-green-bg)" : pct <= 95 ? "var(--color-amber-bg)" : "var(--color-red-bg)",
                          color: pct <= 85 ? "var(--color-green-text)" : pct <= 95 ? "var(--color-amber-strong)" : "var(--color-danger-deep)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
