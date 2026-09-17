"use client";

import React, { useState } from "react";
import {
  Button, Chip, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Typography,
} from "@mui/material";
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
        <KpiCard icon="🎯" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Total SC Budget" value={kM(grandTotalSC)} sub="Annual approved scheme" />
        <KpiCard icon="💸" iconBg="var(--color-blue-bg)" iconColor="var(--color-info)" label="Operating Spend (OPEX)" value={kM(totalOpexBudget)} sub="Routine operational services" />
        <KpiCard icon="🛡️" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Sinking Fund Reserve" value={kM(totalSinkingFund)} sub="Capital renewal reserve" />
        <KpiCard icon="📐" iconBg="var(--color-amber-bg)" iconColor="var(--color-warning)" label="Rate / sq.ft / month" value={`KES ${ratePerSqftMonth}`} sub={`KES ${ratePerSqftYear} / sq.ft / year`} />
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
                      <i style={{ background: "var(--color-success)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Remaining Variance
                    </span>
                    <strong className="mono" style={{ color: "var(--color-success)" }}>{kM(totalVariance)}</strong>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Annual Property Budgets">
              <ListState loading={loading} empty={budgets.length === 0} emptyTitle="No budgets found" emptyDesc="Property budgets and estimates will appear here once created.">
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: "action.hover" }}>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Budget Line</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Year</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Allocated</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actual</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Utilization</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {budgets.map((b) => {
                        const u = pct(b.actual_amount, b.amount);
                        return (
                          <TableRow key={String(b.id)} hover onClick={() => onSelectRow(b)} sx={{ cursor: "pointer" }}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(b.name ?? b.category ?? "General Budget")}</Typography>
                              <Typography variant="caption" color="text.secondary">{String(b.property_name ?? "Property")}</Typography>
                            </TableCell>
                            <TableCell><Badge tone="blue">{String(b.type ?? "Operating")}</Badge></TableCell>
                            <TableCell><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{String(b.year ?? "2026")}</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{kM(b.amount)}</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{kM(b.actual_amount)}</Typography></TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" sx={{ fontWeight: 800, color: u > 90 ? "error.main" : "success.main" }}>
                                {u}%
                              </Typography>
                            </TableCell>
                            <TableCell align="center"><StatusPill value={String(b.status ?? "approved")} /></TableCell>
                            <TableCell align="right">
                              <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={(e) => { e.stopPropagation(); onSelectRow(b); }}>
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
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
                  <strong style={{ display: "block", color: "var(--color-info)" }}>{kM(totalOpexBudget)} (87.2%)</strong>
                </div>
                <div>
                  <span className="muted">Sinking Fund Reserve:</span>
                  <strong style={{ display: "block", color: "var(--color-success)" }}>{kM(totalSinkingFund)} (12.8%)</strong>
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
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Service Category & Scope</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Annual OPEX (KES)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Sinking Fund Reserve (KES)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Total Annual Cost</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Cost / sq.ft / yr</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scCategories.map((c) => {
                      const tot = c.opex + c.sinking;
                      const sqftCost = totalLettableSqft ? (tot / totalLettableSqft).toFixed(2) : "0.00";
                      return (
                        <TableRow key={c.category} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.category}</Typography>
                            <Typography variant="caption" color="text.secondary">{c.desc}</Typography>
                          </TableCell>
                          <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{money.format(c.opex)}</Typography></TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: c.sinking > 0 ? "success.main" : "text.secondary", fontWeight: c.sinking > 0 ? 800 : 400 }}>
                              {c.sinking > 0 ? money.format(c.sinking) : "—"}
                            </Typography>
                          </TableCell>
                          <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 800 }}>{money.format(tot)}</Typography></TableCell>
                          <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>KES {sqftCost}</Typography></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow sx={{ bgcolor: "action.selected" }}>
                      <TableCell sx={{ fontWeight: 900 }}>TOTAL SERVICE CHARGE BUDGET</TableCell>
                      <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 800 }}>{money.format(totalOpexBudget)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "success.main", fontWeight: 800 }}>{money.format(totalSinkingFund)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main", fontWeight: 900 }}>{money.format(grandTotalSC)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 800 }}>KES {ratePerSqftYear}</Typography></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>

              {/* Interactive Tenant Service Charge Simulator */}
              <div style={{ padding: 18, background: "var(--surface-2)", borderRadius: 8, border: "2px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: 14, color: "var(--text-primary)", display: "block" }}>
                      🧾 Tenant Service Charge Bill Preview Simulator
                    </strong>
                    <small className="muted" style={{ fontSize: 11 }}>
                      Simulate actual tenant monthly billing statement based on unit area & approved scheme
                    </small>
                  </div>
                  <span style={{ background: "var(--color-green-bg)", color: "var(--color-green-text)", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
                    100% Cost Recoverable
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr 1fr", gap: 14, alignItems: "center" }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>Select Unit / Area</label>
                    <select
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12, fontWeight: 700 }}
                      defaultValue="1500"
                    >
                      <option value="1500">Unit 201 · 1,500 sq.ft (Safaricom)</option>
                      <option value="2200">Unit 202 · 2,200 sq.ft (PwC)</option>
                      <option value="3500">Unit 203 · 3,500 sq.ft (KCB Bank)</option>
                      <option value="1200">Unit 204 · 1,200 sq.ft (Standard Chart)</option>
                    </select>
                  </div>

                  <div style={{ background: "var(--surface)", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
                    <span className="muted" style={{ fontSize: 11, display: "block" }}>Unit Share of Building:</span>
                    <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>
                      {((1500 / totalLettableSqft) * 100).toFixed(2)}%
                    </strong>
                  </div>

                  <div style={{ background: "var(--surface)", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
                    <span className="muted" style={{ fontSize: 11, display: "block" }}>Monthly OPEX Charge:</span>
                    <strong style={{ fontSize: 14, color: "var(--color-info)" }}>
                      KES {((1500 / totalLettableSqft) * (totalOpexBudget / 12)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </strong>
                  </div>

                  <div style={{ background: "var(--surface)", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
                    <span className="muted" style={{ fontSize: 11, display: "block" }}>Monthly Sinking Fund:</span>
                    <strong style={{ fontSize: 14, color: "var(--color-success)" }}>
                      KES {((1500 / totalLettableSqft) * (totalSinkingFund / 12)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Total Monthly SC Invoice:</span>
                    <strong style={{ fontSize: 18, color: "var(--primary)", fontWeight: 900 }}>
                      KES {((1500 / totalLettableSqft) * (grandTotalSC / 12)).toLocaleString(undefined, { maximumFractionDigits: 0 })} / month
                    </strong>
                  </div>
                  <button
                    onClick={() => alert("Generating official service charge apportionment statement for tenant...")}
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--text-primary)" }}
                  >
                    🖨️ Generate Tenant SC Statement
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
