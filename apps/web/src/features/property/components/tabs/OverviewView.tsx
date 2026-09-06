"use client";

import React, { useMemo, useState } from "react";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  money, number,
} from "@/components/module-ui";
import {
  PropertyTab, Row, PropertyRow, BuildingRow, UnitRow,
  TenantRow, LeaseRow, InvoiceRow, ReceiptRow, ReminderRow,
  DashboardData,
} from "../../types/property.types";
import {
  kM, kN, fmtDate, overdueLabel, pct,
} from "../../utils/property.utils";

export function OverviewView({
  dashboard,
  loading,
  setTab,
  canOperate,
  canLease,
  canFinance,
}: {
  dashboard: DashboardData | null;
  loading: boolean;
  setTab: (t: PropertyTab) => void;
  canOperate: boolean;
  canLease: boolean;
  canFinance: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (loading && !dashboard) return <LoadingState rows={8} />;
  if (!dashboard) {
    return (
      <EmptyState
        icon="🏢"
        title="Dashboard unavailable"
        description="Add units and leases to this property to unlock collection and occupancy analytics."
      />
    );
  }

  const k = dashboard.kpis ?? {};
  const units = Number(k.units ?? 0);
  const occupied = Number(k.occupiedUnits ?? 0);
  const vacant = Math.max(units - occupied, 0);
  const occupancyRate = Number(k.occupancyRate ?? (units > 0 ? Math.round((occupied / units) * 100) : 0));
  const outstanding = Number(k.outstanding ?? 0);
  const collected = Number(k.collectedYtd ?? 0);
  const billedTotal = collected + outstanding;
  const collectionRate = billedTotal > 0 ? Math.round((collected / billedTotal) * 100) : 0;
  const currentProperty = dashboard.propertySummary ?? dashboard.portfolio?.[0];
  const monthlyRent = Number(currentProperty?.monthlyRent ?? 0);
  const trend = dashboard.collectionTrend ?? [];
  const leaseExpiry = dashboard.leaseExpiry ?? [];
  const aging = dashboard.aging ?? [];
  const overdue = dashboard.overdueInvoices ?? [];

  const trendExpected = trend.reduce((sum, point) => sum + Number(point.expected ?? point.billed ?? 0), 0);
  const trendActual = trend.reduce((sum, point) => sum + Number(point.actual ?? point.collected ?? 0), 0);
  const trendVariance = trendActual - trendExpected;
  const trendCollectionRate = trendExpected > 0 ? Math.round((trendActual / trendExpected) * 1000) / 10 : 0;

  const rawTrendMax = Math.max(
    ...trend.flatMap((point) => [
      Number(point.expected ?? point.billed ?? 0),
      Number(point.actual ?? point.collected ?? 0),
    ]),
    0,
  );
  // Default to a realistic scaling benchmark if data is zero
  const trendMax = rawTrendMax > 0 ? rawTrendMax : 100000;
  const hasRealTrendData = rawTrendMax > 0;

  const expiryMax = Math.max(...leaseExpiry.map((e) => Number(e.count ?? 0)), 1);
  const agingTotal = aging.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const donut = billedTotal > 0
    ? `conic-gradient(#16a34a 0% ${collectionRate}%, #ef4444 ${collectionRate}% 100%)`
    : "conic-gradient(#e2e8f0 0% 100%)";

  return (
    <div className="module-page-stack">
          {/* ═══ EXECUTIVE HERO HEADER ════════════════════════════════════ */}
      <div className="module-context-header prominent">
        <div className="module-context-copy">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(37, 99, 235, 0.08)",
              border: "1.5px solid rgba(37, 99, 235, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            🏢
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: "-0.01em", color: "var(--text-primary, #0f172a)" }}>
                {String(currentProperty?.name ?? "Property Overview")}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "3px 9px",
                  borderRadius: 6,
                  background: occupancyRate >= 80 ? "rgba(34, 197, 94, 0.12)" : "rgba(245, 158, 11, 0.12)",
                  color: occupancyRate >= 80 ? "#16a34a" : "#d97706",
                  border: occupancyRate >= 80 ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                }}
              >
                {occupancyRate}% OCCUPIED
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary, #64748b)", marginTop: 4 }}>
              Commercial & Residential Operations · <strong style={{ color: "var(--text-primary, #0f172a)" }}>{units} Units</strong> ({occupied} active, {vacant} vacant)
            </div>
          </div>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="module-action-group">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setTab("tenants")}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            👥 Tenants ({kN(k.activeLeases ?? occupied)})
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setTab("billing")}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            🧾 Billing Pipeline
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setTab("rent")}
            style={{ fontWeight: 700, fontSize: 12 }}
          >
            📄 Invoices & Receipts
          </button>
          <button
            type="button"
            className="btn primary sm"
            onClick={() => setTab("properties")}
            style={{ fontWeight: 800, fontSize: 12 }}
          >
            ⚙️ Property Config
          </button>
        </div>
      </div>

      {/* ═══ MODERN EXECUTIVE KPI STRIP ═══════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        
        {/* Card 1: Monthly Scheduled Rent */}
        <div
          onClick={() => setTab("rent")}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 18px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Monthly Target Rent
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text)", marginTop: 6 }}>
                {kM(monthlyRent)}
              </div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(37, 99, 235, 0.1)", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              💵
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12 }}>
            <span style={{ color: "var(--faint)" }}>Current property roll</span>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>View Rent Ledger →</span>
          </div>
        </div>

        {/* Card 2: Collection Rate & Performance */}
        <div
          onClick={() => setTab("rent")}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 18px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Collection Rate (YTD)
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: collectionRate >= 90 ? "#16a34a" : "#d97706" }}>
                  {collectionRate}%
                </span>
                <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 600 }}>
                  ({kM(collected)} collected)
                </span>
              </div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(22, 163, 74, 0.1)", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              ◔
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12 }}>
            <span style={{ color: "var(--faint)" }}>Target: 95% threshold</span>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>View Collections →</span>
          </div>
        </div>

        {/* Card 3: Occupancy & Units */}
        <div
          onClick={() => setTab("units")}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 18px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Occupancy Rate
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#4f46e5" }}>
                  {occupancyRate}%
                </span>
                <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 600 }}>
                  ({occupied} / {units} units)
                </span>
              </div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(79, 70, 229, 0.1)", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              🔑
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12 }}>
            <span style={{ color: vacant > 0 ? "#ea580c" : "var(--faint)", fontWeight: 600 }}>
              {vacant} vacant units available
            </span>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>Manage Units →</span>
          </div>
        </div>

        {/* Card 4: Outstanding Arrears Balance */}
        <div
          onClick={() => setTab("arrears")}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 18px",
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Total Arrears Balance
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: outstanding > 0 ? "#dc2626" : "var(--text)", marginTop: 6 }}>
                {kM(outstanding)}
              </div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              ⚠️
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12 }}>
            <span style={{ color: "var(--faint)" }}>Aging debt balance</span>
            <span style={{ color: "var(--danger)", fontWeight: 700 }}>View Recovery →</span>
          </div>
        </div>

      </div>

      {/* ═══ MAIN 2-COLUMN ANALYTICS WORKBENCH ════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "2.1fr 1fr", gap: 20, width: "100%" }}>
        
        {/* LEFT COLUMN: Collection Trend Chart & Property Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          
          <Panel
            title="Monthly Rent Collection & Variance Trend"
            action={
              <button className="btn ghost sm" onClick={() => setTab("rent")} style={{ fontWeight: 800 }}>
                Collection Ledger →
              </button>
            }
          >
            <div style={{ padding: "18px 22px" }}>
              
              {/* Financial Metric Strip */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  { label: "Expected Billed", value: money.format(trendExpected), color: "var(--text)" },
                  { label: "Actual Received", value: money.format(trendActual), color: "#16a34a" },
                  { label: "Net Variance", value: money.format(trendVariance), color: trendVariance >= 0 ? "#16a34a" : "#dc2626" },
                  { label: "Period Efficiency", value: `${trendCollectionRate}%`, color: trendCollectionRate >= 90 ? "#16a34a" : "#d97706" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      background: "var(--surface-sunken)",
                    }}
                  >
                    <div style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {item.label}
                    </div>
                    <div style={{ color: item.color, fontSize: 15, fontWeight: 900, marginTop: 4 }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart Legend */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                    <i style={{ width: 14, height: 3, background: "var(--text)", borderRadius: 2, display: "inline-block" }} />
                    Expected Target (KES)
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
                    <i style={{ width: 14, height: 3, background: "#16a34a", borderRadius: 2, display: "inline-block" }} />
                    Actual Collected (KES)
                  </span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  Period Efficiency: <strong style={{ color: trendCollectionRate >= 90 ? "#16a34a" : "#d97706", fontWeight: 900 }}>{trendCollectionRate}%</strong>
                </span>
              </div>

              {/* Enhanced SVG Line Chart (Fixes 1,1,1,0 scale bug) */}
              {(() => {
                const svgW = 700;
                const svgH = 220;
                const pX = 55;
                const pY = 25;
                const cW = svgW - pX * 2;
                const cH = svgH - pY * 2;

                const expectedPoints = trend.map((b, i) => {
                  const x = pX + (i / Math.max(trend.length - 1, 1)) * cW;
                  const expected = Number(b.expected ?? b.billed ?? 0);
                  const y = pY + cH - (trendMax > 0 ? (expected / trendMax) * cH : 0);
                  return { x, y, val: expected, month: b.month };
                });

                const actualPoints = trend.map((b, i) => {
                  const x = pX + (i / Math.max(trend.length - 1, 1)) * cW;
                  const expected = Number(b.expected ?? b.billed ?? 0);
                  const actual = Number(b.actual ?? b.collected ?? 0);
                  const y = pY + cH - (trendMax > 0 ? (actual / trendMax) * cH : 0);
                  const rate = expected > 0 ? Math.round((actual / expected) * 100) : 0;
                  return { x, y, val: actual, month: b.month, rate };
                });

                const expectedPath = expectedPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
                const actualPath = actualPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
                const areaPath = `${actualPath} L ${actualPoints[actualPoints.length - 1]?.x ?? 0} ${pY + cH} L ${actualPoints[0]?.x ?? 0} ${pY + cH} Z`;

                // Distinct, properly formatted Y-axis ticks
                const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const y = pY + cH * (1 - pct);
                  const val = Math.round(trendMax * pct);
                  const label = !hasRealTrendData
                    ? pct === 0 ? "KES 0" : `${pct * 100}%`
                    : val >= 1000000
                    ? `${(val / 1000000).toFixed(1)}M`
                    : val >= 1000
                    ? `${Math.round(val / 1000)}k`
                    : `${val}`;
                  return { y, label };
                });

                return (
                  <div style={{ width: "100%", overflowX: "auto" }}>
                    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto", display: "block" }}>
                      <defs>
                        <linearGradient id="collGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines & Ticks */}
                      {yTicks.map((tick, idx) => (
                        <g key={idx}>
                          <line x1={pX} y1={tick.y} x2={pX + cW} y2={tick.y} stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
                          <text x={pX - 10} y={tick.y + 4} textAnchor="end" fontSize="10" fill="var(--faint)" fontWeight="600">
                            {tick.label}
                          </text>
                        </g>
                      ))}

                      {/* Area Fill */}
                      <path d={areaPath} fill="url(#collGradient)" />

                      {/* Expected Target Line */}
                      <path d={expectedPath} fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />

                      {/* Actual Collection Line */}
                      <path d={actualPath} fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Data Points */}
                      {actualPoints.map((pt, i) => {
                        const expectedPoint = expectedPoints[i];
                        const isHovered = hoveredIndex === i;
                        return (
                          <g
                            key={pt.month}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{ cursor: "pointer" }}
                          >
                            {/* Expected Point */}
                            <circle cx={expectedPoint.x} cy={expectedPoint.y} r="3.5" fill="var(--text-secondary)" opacity="0.8" />

                            {/* Actual Point */}
                            <circle cx={pt.x} cy={pt.y} r={isHovered ? 7 : 5} fill="#16a34a" stroke="#ffffff" strokeWidth="2" />

                            {/* Optional badge on hover or if actual > 0 */}
                            {(isHovered || pt.val > 0) && (
                              <g transform={`translate(${pt.x}, ${pt.y - 14})`}>
                                <rect x="-18" y="-10" width="36" height="15" rx="4" fill="#ffffff" stroke="#16a34a" strokeWidth="1" />
                                <text x="0" y="1" textAnchor="middle" fontSize="9" fontWeight="800" fill="#16a34a">
                                  {pt.rate}%
                                </text>
                              </g>
                            )}

                            {/* Month Label */}
                            <text x={pt.x} y={pY + cH + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">
                              {pt.month.toUpperCase()}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()}

            </div>
          </Panel>

          {/* Property Performance Metrics */}
          <Panel
            title="Property Capacity & Occupancy Breakdown"
            action={
              <button className="btn ghost sm" onClick={() => setTab("properties")} style={{ fontWeight: 800 }}>
                Property Details →
              </button>
            }
          >
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
              {[
                { label: "Total Units", value: kN(currentProperty?.units ?? units), sub: "Configured units" },
                { label: "Occupied Units", value: kN(currentProperty?.occupied ?? occupied), sub: "Active leases" },
                { label: "Vacant Units", value: kN(currentProperty?.vacant ?? vacant), sub: "Ready for tenant" },
                { label: "Occupancy Rate", value: `${occupancyRate}%`, sub: "Portfolio share" },
                { label: "Scheduled Rent", value: kM(monthlyRent), sub: "Monthly baseline" },
                { label: "Outstanding Due", value: kM(currentProperty?.outstanding ?? outstanding), sub: "Pending invoices" },
              ].map((card) => (
                <div key={card.label} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-sunken)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>{card.label}</div>
                  <strong style={{ display: "block", marginTop: 4, fontSize: 16, color: "var(--text)" }}>{card.value}</strong>
                  <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{card.sub}</div>
                </div>
              ))}
            </div>
          </Panel>

        </div>

        {/* RIGHT COLUMN: Collection Ring, Lease Expiries & AI Hub */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          
          {/* Rent Collection Ring */}
          <Panel
            title="Rent Collection Breakdown"
            action={
              <button className="btn ghost sm" onClick={() => setTab("rent")} style={{ fontWeight: 800 }}>
                Ledger →
              </button>
            }
          >
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div
                  style={{
                    background: donut,
                    width: 110,
                    height: 110,
                    borderRadius: "50%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    position: "relative",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: "50%",
                      background: "var(--surface)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <strong style={{ fontSize: 18, fontWeight: 900, color: "var(--text)" }}>{collectionRate}%</strong>
                    <span style={{ fontSize: 9, color: "var(--faint)", textTransform: "uppercase", fontWeight: 700 }}>Collected</span>
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                      <i style={{ width: 8, height: 8, borderRadius: 2, background: "#16a34a", display: "inline-block" }} />
                      Collected:
                    </span>
                    <strong style={{ color: "#16a34a" }}>{kM(collected)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                      <i style={{ width: 8, height: 8, borderRadius: 2, background: "#ef4444", display: "inline-block" }} />
                      Outstanding:
                    </span>
                    <strong style={{ color: "#ef4444" }}>{kM(outstanding)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                    <span style={{ color: "var(--faint)" }}>Total Billed:</span>
                    <strong style={{ color: "var(--text)" }}>{kM(billedTotal)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Lease Expiry Overview */}
          <Panel
            title="Lease Expiries & Renewals"
            action={
              <button className="btn ghost sm" onClick={() => setTab("leases")} style={{ fontWeight: 800 }}>
                Leases →
              </button>
            }
          >
            {leaseExpiry.length > 0 ? (
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                {leaseExpiry.map((e) => (
                  <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, width: 100, color: "var(--text-secondary)", fontWeight: 600 }}>
                      {e.label}
                    </span>
                    <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct(e.count, expiryMax)}%`,
                          height: "100%",
                          background: e.label.includes("90+") ? "#16a34a" : e.label.includes("0-30") ? "#ef4444" : "#f59e0b",
                        }}
                      />
                    </div>
                    <strong style={{ fontSize: 12, width: 28, textAlign: "right", color: "var(--text)" }}>
                      {kN(e.count)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "16px 20px", textAlign: "center", color: "var(--faint)", fontSize: 12 }}>
                No lease expiries recorded in the immediate 90-day window.
              </div>
            )}
          </Panel>

          {/* AI Intelligence & Predictive Tools */}
          <Panel title="🤖 AI Operations Assistant">
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
                Smart predictive debt recovery & document recognition.
              </p>
              <button
                type="button"
                className="btn primary sm"
                style={{ textAlign: "left", justifyContent: "flex-start", width: "100%", fontSize: 11, fontWeight: 700 }}
                onClick={() => setTab("arrears")}
              >
                📊 AI Arrears Risk Predictor →
              </button>
              <button
                type="button"
                className="btn ghost sm"
                style={{ textAlign: "left", justifyContent: "flex-start", width: "100%", fontSize: 11, fontWeight: 700 }}
                onClick={() => setTab("leases")}
              >
                📄 AI Lease Agreement OCR →
              </button>
            </div>
          </Panel>

        </div>

      </div>

      {/* ═══ BOTTOM SECTION: OVERDUE TENANTS & AGING HEATMAP ═══════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, width: "100%" }}>
        
        {/* Top Overdue Invoices Table */}
        <Panel
          title="Top Overdue Invoices & Arrears"
          action={
            <button className="btn ghost sm" onClick={() => setTab("arrears")} style={{ fontWeight: 800 }}>
              View All Arrears →
            </button>
          }
        >
          {overdue.length > 0 ? (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Tenant</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((inv) => (
                    <tr key={String(inv.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12, fontWeight: 700 }}>
                        {String(inv.number ?? "—")}
                      </td>
                      <td>
                        <strong style={{ fontSize: 12 }}>{String(inv.tenant_name ?? "—")}</strong>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {fmtDate(inv.due_on)}
                      </td>
                      <td>
                        <Badge tone="red">{overdueLabel(inv.due_on)}</Badge>
                      </td>
                      <td className="mono" style={{ color: "var(--danger)", fontWeight: 800, textAlign: "right" }}>
                        {kM(inv.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
              ✓ All property invoices and accounts are fully reconciled and up to date.
            </div>
          )}
        </Panel>

        {/* Rent Aging Heatmap */}
        <Panel
          title="Rent Aging Ledger Heatmap"
          action={
            <button className="btn ghost sm" onClick={() => setTab("arrears")} style={{ fontWeight: 800 }}>
              Aging Report →
            </button>
          }
        >
          {aging.length > 0 ? (
            <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {aging.map((a, idx) => {
                const colors = ["#16a34a", "#eab308", "#ea580c", "#dc2626"];
                const bgs = ["rgba(22,163,74,0.08)", "rgba(234,179,8,0.08)", "rgba(234,88,12,0.08)", "rgba(220,38,38,0.08)"];
                const color = colors[idx % colors.length];
                const bg = bgs[idx % bgs.length];
                return (
                  <div
                    key={a.label}
                    onClick={() => setTab("arrears")}
                    style={{
                      background: bg,
                      border: `1px solid ${color}40`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <small style={{ color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 700 }}>
                      {a.label}
                    </small>
                    <strong style={{ color, fontSize: "1.1rem", fontFamily: "monospace", fontWeight: 900 }}>
                      {kM(a.amount)}
                    </strong>
                    <div style={{ height: 4, borderRadius: 99, background: "var(--border)", overflow: "hidden", marginTop: 4 }}>
                      <div style={{ width: `${pct(a.amount, agingTotal)}%`, height: "100%", background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "24px 20px", textAlign: "center", color: "var(--faint)", fontSize: 13 }}>
              No outstanding debt balances in aging buckets.
            </div>
          )}
        </Panel>

      </div>

    </div>
  );
}
