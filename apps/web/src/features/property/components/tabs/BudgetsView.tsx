"use client";

import React, { useState } from "react";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";
import { ViewToolbar, ListState } from "../PropertyToolbar";
import {
  PropertyTab, Row, BudgetRow, ServiceChargeRow,
} from "../../types/property.types";
import {
  kM, kN, fmtDate, pct, shortId, exportCsv,
} from "../../utils/property.utils";

export function BudgetsView({
  rows,
  loading,
  search,
  setSearch,
  setTab,
  onSelectRow,
  onAdd,
  onAction,
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void;
  onSelectRow: (r: Row) => void;
  onAdd: () => void;
  onAction: (row: BudgetRow, action: "submit" | "approve" | "reject") => void;
}) {
  const [activeTab, setActiveTab] = useState<"budgets" | "service_charge_builder">("budgets");
  const [apportionmentMethod, setApportionmentMethod] = useState<"area" | "equal">("area");
  const [totalLettableSqft, setTotalLettableSqft] = useState(25000);

  const budgets = rows as BudgetRow[];
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount ?? 0), 0) || 12500000;
  const totalActual = budgets.reduce((s, b) => s + Number(b.actual_amount ?? 0), 0) || 10525000;
  const totalVariance = budgets.reduce((s, b) => s + Number(b.variance ?? 0), 0) || 1975000;
  const utilization = pct(totalActual, totalBudget);
  const gaugeColor = utilization > 90 ? "var(--danger)" : utilization > 80 ? "var(--warning)" : "var(--success)";

  // Standard Service Charge Budget Categories Breakdown
  const scCategories = [
    { category: "Security & Guarding Services", opex: 2400000, sinking: 0, desc: "24/7 manned security, CCTV monitoring & electric perimeter" },
    { category: "Housekeeping, Cleaning & Waste", opex: 1800000, sinking: 0, desc: "Daily common area cleaning, high-level facade glass & garbage collection" },
    { category: "Common Power & Generator Fuel", opex: 3200000, sinking: 0, desc: "Grid power for lobbies/elevators + diesel backup generator fuel" },
    { category: "Water Supply & Booster Pumps", opex: 950000, sinking: 0, desc: "Borehole treatment, municipal water top-up and pump servicing" },
    { category: "Lift Routine Service & AMC", opex: 1200000, sinking: 600000, desc: "OEM maintenance contract + Lift Sinking Fund for major rope overhaul" },
    { category: "HVAC & Chiller Routine PM", opex: 1500000, sinking: 800000, desc: "Quarterly filter/refrigerant service + Chiller Sinking Fund" },
    { category: "Fire Safety & Extinguishers", opex: 450000, sinking: 200000, desc: "Quarterly inspection, pump flow test + Sprinkler replacement reserve" },
    { category: "Facilities Management Fee (8%)", opex: 920000, sinking: 0, desc: "Professional FM supervisory and helpdesk management fee" },
  ];

  const totalOpexBudget = scCategories.reduce((s, c) => s + c.opex, 0);
  const totalSinkingFund = scCategories.reduce((s, c) => s + c.sinking, 0);
  const grandTotalSC = totalOpexBudget + totalSinkingFund;
  const ratePerSqftYear = totalLettableSqft ? (grandTotalSC / totalLettableSqft).toFixed(2) : "0.00";
  const ratePerSqftMonth = totalLettableSqft ? (grandTotalSC / totalLettableSqft / 12).toFixed(2) : "0.00";

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🎯" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total SC Budget" value={kM(grandTotalSC)} sub="Annual approved scheme" />
        <KpiCard icon="💸" iconBg="#dbeafe" iconColor="#2563eb" label="Operating Spend (OPEX)" value={kM(totalOpexBudget)} sub="Routine operational services" />
        <KpiCard icon="🛡️" iconBg="#dcfce7" iconColor="#16a34a" label="Sinking Fund Reserve" value={kM(totalSinkingFund)} sub="Capital renewal reserve" />
        <KpiCard icon="📐" iconBg="#fef3c7" iconColor="#d97706" label="Rate / sq.ft / month" value={`KES ${ratePerSqftMonth}`} sub={`KES ${ratePerSqftYear} / sq.ft / year`} />
      </KpiStrip>

      {/* Subtab Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "10px 16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setActiveTab("budgets")}
            style={{
              border: 0,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              background: activeTab === "budgets" ? "var(--surface-2)" : "transparent",
              color: activeTab === "budgets" ? "var(--primary)" : "var(--text-secondary)",
            }}
          >
            📊 Property Budgets & Performance
          </button>
          <button
            onClick={() => setActiveTab("service_charge_builder")}
            style={{
              border: 0,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: "0.82rem",
              fontWeight: 800,
              cursor: "pointer",
              background: activeTab === "service_charge_builder" ? "var(--surface-2)" : "transparent",
              color: activeTab === "service_charge_builder" ? "var(--primary)" : "var(--text-secondary)",
            }}
          >
            ⚙️ Service Charge Budgeting & Apportionment Engine
          </button>
        </div>
        <button className="btn primary sm" onClick={onAdd} style={{ fontWeight: 800 }}>+ Add Budget Line</button>
      </div>

      {activeTab === "budgets" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18, width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
            <Panel title="Budget Utilization & Variance" action={<button className="btn ghost sm" onClick={() => setTab("service-charges")}>Service Charges →</button>}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
                <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(${gaugeColor} 0% ${utilization}%, var(--surface-3) ${utilization}% 100%)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{utilization}%</div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                      <i style={{ background: gaugeColor, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Utilization Rate
                    </span>
                    <strong className="mono">{utilization}%</strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                      <i style={{ background: "var(--primary)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Total Budget
                    </span>
                    <strong className="mono">{kM(totalBudget)}</strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                      <i style={{ background: "var(--danger)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Actual Spend
                    </span>
                    <strong className="mono">{kM(totalActual)}</strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                      <i style={{ background: "#16a34a", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Remaining Variance
                    </span>
                    <strong className="mono" style={{ color: "#16a34a" }}>{kM(totalVariance)}</strong>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Annual Property Budgets">
              <ListState loading={loading} empty={budgets.length === 0} emptyTitle="No budgets found" emptyDesc="Property budgets and estimates will appear here once created.">
                <div className="table-scroll">
                  <table className="fc-data-table">
                    <thead>
                      <tr>
                        <th>Budget Line</th>
                        <th>Type</th>
                        <th>Year</th>
                        <th>Allocated</th>
                        <th>Actual</th>
                        <th>Utilization</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgets.map((b) => {
                        const u = pct(b.actual_amount, b.amount);
                        return (
                          <tr key={String(b.id)} onClick={() => onSelectRow(b)}>
                            <td>
                              <strong style={{ fontSize: 13 }}>{String(b.name ?? b.category ?? "General Budget")}</strong>
                              <div className="muted" style={{ fontSize: 11 }}>{String(b.property_name ?? "Property")}</div>
                            </td>
                            <td><Badge tone="blue">{String(b.type ?? "Operating")}</Badge></td>
                            <td className="mono">{String(b.year ?? "2026")}</td>
                            <td className="mono">{kM(b.amount)}</td>
                            <td className="mono">{kM(b.actual_amount)}</td>
                            <td>
                              <span style={{ fontWeight: 800, color: u > 90 ? "var(--danger)" : "#16a34a" }}>
                                {u}%
                              </span>
                            </td>
                            <td><StatusPill value={String(b.status ?? "approved")} /></td>
                            <td>
                              <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onSelectRow(b); }}>
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </ListState>
            </Panel>
          </div>

          {/* Right Rail: Quick Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Panel title="Service Charge Summary">
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                <div>
                  <span className="muted">Total Scheme Budget:</span>
                  <strong style={{ display: "block", fontSize: 14 }}>{kM(grandTotalSC)}</strong>
                </div>
                <div>
                  <span className="muted">OPEX Proportion:</span>
                  <strong style={{ display: "block", color: "#2563eb" }}>{kM(totalOpexBudget)} (87.2%)</strong>
                </div>
                <div>
                  <span className="muted">Sinking Fund Reserve:</span>
                  <strong style={{ display: "block", color: "#16a34a" }}>{kM(totalSinkingFund)} (12.8%)</strong>
                </div>
                <button
                  className="btn ghost sm"
                  onClick={() => setActiveTab("service_charge_builder")}
                  style={{ width: "100%", marginTop: 8 }}
                >
                  ⚙️ Open Apportionment Calculator →
                </button>
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        /* SERVICE CHARGE BUDGETING & APPORTIONMENT ENGINE */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="Service Charge Budget Breakdown (OPEX vs Sinking Fund Reserve)">
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Apportionment Settings */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: 14, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>Apportionment Methodology</label>
                  <select
                    value={apportionmentMethod}
                    onChange={(e) => setApportionmentMethod(e.target.value as "area" | "equal")}
                    style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                  >
                    <option value="area">Lettable Area ($m^2$ / sq.ft) Percentage (Standard)</option>
                    <option value="equal">Fixed Equal Share per Unit</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>Total Property Lettable Area (sq.ft)</label>
                  <input
                    type="number"
                    value={totalLettableSqft}
                    onChange={(e) => setTotalLettableSqft(Number(e.target.value) || 1)}
                    style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>Computed Rate / sq.ft / Month</label>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--primary)" }}>
                    KES {ratePerSqftMonth} <small style={{ fontSize: 11, color: "var(--muted)" }}>/ sq.ft</small>
                  </div>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead>
                    <tr>
                      <th>Service Category & Scope</th>
                      <th style={{ textAlign: "right" }}>Annual OPEX (KES)</th>
                      <th style={{ textAlign: "right" }}>Sinking Fund Reserve (KES)</th>
                      <th style={{ textAlign: "right" }}>Total Annual Cost</th>
                      <th style={{ textAlign: "right" }}>Cost / sq.ft / yr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scCategories.map((c) => {
                      const tot = c.opex + c.sinking;
                      const sqftCost = totalLettableSqft ? (tot / totalLettableSqft).toFixed(2) : "0.00";
                      return (
                        <tr key={c.category}>
                          <td>
                            <strong style={{ fontSize: 13 }}>{c.category}</strong>
                            <div className="muted" style={{ fontSize: 11 }}>{c.desc}</div>
                          </td>
                          <td className="mono" style={{ textAlign: "right" }}>{money.format(c.opex)}</td>
                          <td className="mono" style={{ textAlign: "right", color: c.sinking > 0 ? "#16a34a" : "inherit", fontWeight: c.sinking > 0 ? 800 : 400 }}>
                            {c.sinking > 0 ? money.format(c.sinking) : "—"}
                          </td>
                          <td className="mono" style={{ textAlign: "right", fontWeight: 800 }}>{money.format(tot)}</td>
                          <td className="mono" style={{ textAlign: "right" }}>KES {sqftCost}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "var(--surface-2)", fontWeight: 900 }}>
                      <td>TOTAL SERVICE CHARGE BUDGET</td>
                      <td className="mono" style={{ textAlign: "right" }}>{money.format(totalOpexBudget)}</td>
                      <td className="mono" style={{ textAlign: "right", color: "#16a34a" }}>{money.format(totalSinkingFund)}</td>
                      <td className="mono" style={{ textAlign: "right", color: "var(--primary)" }}>{money.format(grandTotalSC)}</td>
                      <td className="mono" style={{ textAlign: "right" }}>KES {ratePerSqftYear}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sample Unit Apportionment Calculation */}
              <div style={{ padding: 14, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
                  Sample Unit Apportionment: Unit 201 (1,500 sq.ft)
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 12 }}>
                  <div>
                    <span className="muted">Unit Share of Building:</span>
                    <strong style={{ display: "block" }}>{((1500 / totalLettableSqft) * 100).toFixed(2)}%</strong>
                  </div>
                  <div>
                    <span className="muted">Monthly Service Charge:</span>
                    <strong style={{ display: "block", color: "var(--primary)", fontSize: 14 }}>
                      KES {(1500 * Number(ratePerSqftMonth)).toLocaleString()} / month
                    </strong>
                  </div>
                  <div>
                    <span className="muted">Annual Sinking Fund Contribution:</span>
                    <strong style={{ display: "block", color: "#16a34a" }}>
                      KES {((1500 / totalLettableSqft) * totalSinkingFund).toLocaleString()} / year
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
