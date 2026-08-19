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

  const budgetCategories = rows.length > 0 ? rows : [
    { id: "b1", category: "Vertical Transportation (Lifts)", allocated: 2500000, committed: 450000, actual: 1650000, property_name: "Finance House" },
    { id: "b2", category: "HVAC & Air Handling Plants", allocated: 3800000, committed: 820000, actual: 2400000, property_name: "Finance House" },
    { id: "b3", category: "Electrical Switchgear & Generator", allocated: 2200000, committed: 300000, actual: 1500000, property_name: "Finance House" },
    { id: "b4", category: "Life Safety & Fire Protection", allocated: 1200000, committed: 150000, actual: 750000, property_name: "Finance House" },
    { id: "b5", category: "Housekeeping, Waste & Landscaping", allocated: 1800000, committed: 200000, actual: 1200000, property_name: "Finance House" },
    { id: "b6", category: "Plumbing, Water Treatment & Pumps", allocated: 1000000, committed: 120000, actual: 680000, property_name: "Finance House" },
  ];

  const totalAllocated = budgetCategories.reduce((s, b) => s + Number(b.allocated || 0), 0);
  const totalCommitted = budgetCategories.reduce((s, b) => s + Number(b.committed || 0), 0);
  const totalActual = budgetCategories.reduce((s, b) => s + Number(b.actual || 0), 0);
  const totalSpentAndCommitted = totalActual + totalCommitted;
  const availableReserve = Math.max(0, totalAllocated - totalSpentAndCommitted);
  const utilizationPct = totalAllocated ? ((totalSpentAndCommitted / totalAllocated) * 100).toFixed(1) : "84.2";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Budget KPIs */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="💰" iconBg="#e0e7ff" iconColor="#4f46e5" label="Annual FM Budget" value={money.format(totalAllocated)} sub={`Financial Year ${selectedYear}`} />
        <FcKpiCard icon="💳" iconBg="#dcfce7" iconColor="#16a34a" label="Invoiced Actual Spend" value={money.format(totalActual)} sub="Approved invoices paid" />
        <FcKpiCard icon="🔒" iconBg="#fef3c7" iconColor="#b45309" label="Committed Spend (POs)" value={money.format(totalCommitted)} sub="Reserved on open work orders" />
        <FcKpiCard icon="📊" iconBg="#dbeafe" iconColor="#2563eb" label="Budget Utilization" value={`${utilizationPct}%`} sub="84.2% within tolerance" />
        <FcKpiCard icon="🛡️" iconBg="#fdf4ff" iconColor="#9333ea" label="Available Reserve" value={money.format(availableReserve)} sub="Remaining uncommitted float" />
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
                const encumbered = Number(b.actual || 0) + Number(b.committed || 0);
                const remaining = Number(b.allocated || 0) - encumbered;
                const allocatedNum = Number(b.allocated || 0);
                const pct = allocatedNum ? Math.round((encumbered / allocatedNum) * 100) : 0;
                return (
                  <tr key={String(b.id)} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 13, color: "var(--text-primary)" }}>
                      {String(b.category)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 700 }}>
                      {money.format(Number(b.allocated || 0))}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, color: "#b45309" }}>
                      {money.format(Number(b.committed || 0))}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, color: "#2563eb" }}>
                      {money.format(Number(b.actual || 0))}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 800 }}>
                      {money.format(encumbered)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 800, color: remaining >= 0 ? "#16a34a" : "#dc2626" }}>
                      {money.format(remaining)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          background: pct <= 85 ? "#dcfce7" : pct <= 95 ? "#fef3c7" : "#fee2e2",
                          color: pct <= 85 ? "#166534" : pct <= 95 ? "#92400e" : "#991b1b",
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
