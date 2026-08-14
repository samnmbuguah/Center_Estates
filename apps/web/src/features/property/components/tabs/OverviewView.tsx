"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Box, Button, Chip, MenuItem, TextField, Typography } from "@mui/material";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";
import { ViewToolbar, ListState, SubTabs } from "../PropertyToolbar";
import {
  PropertyTab, Row, ID, PropertyRow, BuildingRow, UnitRow, ProjectRow,
  TenantRow, TenantDocumentRow, LeaseRow, RentScheduleRow, InvoiceRow,
  InvoicePreview, ReceiptRow, ReminderRow, BankTransactionRow, ExpenseRow,
  BudgetRow, ServiceChargeRow, ServiceChargeAllocationRow,
  ServiceChargeReconciliationRow, ReceiptAllocationRow, CreditNoteRow,
  AgingTenantRow, AgingAnalytics, FinancialAnalytics, ReportItem,
  DashboardData, RentSection, ScSection, TenancySection, FinancialsSection,
} from "../../types/property.types";
import {
  kM, kN, fmtDate, daysUntil, daysLeftLabel, overdueLabel, pct,
  occupancyTone, shortId, exportCsv, exportLeaseICS,
} from "../../utils/property.utils";
import { OwnerPortalView } from "./OwnerPortalView";

export function OverviewView({ dashboard, loading, setTab, canOperate, canLease, canFinance, isOwner = false }: { dashboard: DashboardData | null; loading: boolean; setTab: (t: PropertyTab) => void; canOperate: boolean; canLease: boolean; canFinance: boolean; isOwner?: boolean }) {
  const [overviewMode, setOverviewMode] = useState<"standard" | "owner">(isOwner ? "owner" : "standard");

  if (loading && !dashboard) return <LoadingState rows={8} />;
  if (!dashboard) {
    return <EmptyState icon="🏢" title="Dashboard unavailable" description="Add properties, units and leases to unlock portfolio, collection and occupancy analytics." />;
  }

  if (overviewMode === "owner") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", padding: "10px 16px", borderRadius: 12, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>👑</span>
            <strong style={{ fontSize: 14 }}>Owner & Portfolio Overview</strong>
          </div>
          <div style={{ display: "flex", gap: 6, background: "var(--surface-3)", padding: 4, borderRadius: 8 }}>
            <button className={`btn sm ${(overviewMode as string) === "standard" ? "primary" : "ghost"}`} onClick={() => setOverviewMode("standard")}>
              🏢 Operations
            </button>
            <button className={`btn sm ${(overviewMode as string) === "owner" ? "primary" : "ghost"}`} onClick={() => setOverviewMode("owner")}>
              👑 Owner Overview
            </button>
          </div>
        </div>
        <OwnerPortalView />
      </div>
    );
  }

  const k = dashboard.kpis ?? {};
  const properties = Number(k.properties ?? 0);
  const units = Number(k.units ?? 0);
  const occupied = Number(k.occupiedUnits ?? 0);
  const occupancyRate = Number(k.occupancyRate ?? 0);
  const outstanding = Number(k.outstanding ?? 0);
  const collected = Number(k.collectedYtd ?? 0);
  const billedTotal = collected + outstanding;
  const collectionRate = billedTotal > 0 ? Math.round((collected / billedTotal) * 100) : 0;
  const monthlyRent = (dashboard.portfolio ?? []).reduce((s, p) => s + Number(p.monthlyRent ?? 0), 0);
  const trend = dashboard.collectionTrend ?? [];
  const leaseExpiry = dashboard.leaseExpiry ?? [];
  const aging = dashboard.aging ?? [];
  const portfolio = dashboard.portfolio ?? [];
  const overdue = dashboard.overdueInvoices ?? [];
  const trendMax = Math.max(...trend.map((b) => Number(b.billed ?? 0)), 1);
  const expiryMax = Math.max(...leaseExpiry.map((e) => Number(e.count ?? 0)), 1);
  const agingTotal = aging.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const donut = billedTotal > 0
    ? `conic-gradient(#22c55e 0% ${collectionRate}%, #ef4444 ${collectionRate}% 100%)`
    : "conic-gradient(#e5e7eb 0% 100%)";

  // Role-specific KPI cards
  const getKpiCards = () => {
    if (canFinance) {
      // Finance dashboard - focus on collections and arrears
      return (
        <>
          <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Outstanding Rent" value={kM(outstanding)} sub="Uncollected balance" link="View arrears" onClick={() => setTab("arrears")} />
          <KpiCard icon="◔" iconBg="#e0f2fe" iconColor="#0284c7" label="Collection Rate" value={`${collectionRate}%`} sub={`${kM(collected)} collected YTD`} link="View collections" onClick={() => setTab("rent")} />
          <KpiCard icon="💵" iconBg="#dcfce7" iconColor="#16a34a" label="Monthly Rent" value={kM(monthlyRent)} sub="Portfolio monthly rent" link="View rent" onClick={() => setTab("rent")} />
          <KpiCard icon="📊" iconBg="#fef3c7" iconColor="#d97706" label="Arrears Aging" value={kM(agingTotal)} sub="Total arrears balance" link="View arrears" onClick={() => setTab("arrears")} />
        </>
      );
    }
    if (canLease) {
      // Leasing dashboard - focus on occupancy and leases
      return (
        <>
          <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Properties" value={kN(properties)} sub={`${kN(units)} total units`} link="View portfolio" onClick={() => setTab("properties")} />
          <KpiCard icon="🔑" iconBg="#dcfce7" iconColor="#16a34a" label="Occupied Units" value={kN(occupied)} sub={`${occupancyRate}% occupancy`} link="View occupancy" onClick={() => setTab("units")} />
          <KpiCard icon="▣" iconBg="#fdf4ff" iconColor="#9333ea" label="Occupancy Rate" value={`${occupancyRate}%`} sub="Portfolio occupancy" link="View units" onClick={() => setTab("units")} />
          <KpiCard icon="📋" iconBg="#dbeafe" iconColor="#2563eb" label="Active Leases" value={kN(k.activeLeases ?? 0)} sub="Lease agreements" link="View leases" onClick={() => setTab("leases")} />
        </>
      );
    }
    if (canOperate) {
      // Operations dashboard - focus on properties and units
      return (
        <>
          <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Properties" value={kN(properties)} sub={`${kN(units)} total units`} link="View portfolio" onClick={() => setTab("properties")} />
          <KpiCard icon="▦" iconBg="#dbeafe" iconColor="#2563eb" label="Total Units" value={kN(units)} sub={`${kN(occupied)} occupied`} link="View units" onClick={() => setTab("units")} />
          <KpiCard icon="🔑" iconBg="#dcfce7" iconColor="#16a34a" label="Occupied Units" value={kN(occupied)} sub={`${occupancyRate}% occupancy`} link="View occupancy" onClick={() => setTab("units")} />
          <KpiCard icon="📦" iconBg="#fef3c7" iconColor="#d97706" label="Vacant Units" value={kN(units - occupied)} sub="Available for lease" link="View units" onClick={() => setTab("units")} />
        </>
      );
    }
    // Default - show all KPIs
    return (
      <>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Properties" value={kN(properties)} sub={`${kN(units)} total units`} link="View portfolio" onClick={() => setTab("properties")} />
        <KpiCard icon="▦" iconBg="#dbeafe" iconColor="#2563eb" label="Total Units" value={kN(units)} sub={`${kN(occupied)} occupied`} link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="🔑" iconBg="#dcfce7" iconColor="#16a34a" label="Occupied Units" value={kN(occupied)} sub={`${occupancyRate}% occupancy`} link="View occupancy" onClick={() => setTab("units")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Monthly Rent" value={kM(monthlyRent)} sub="Portfolio monthly rent" link="View rent" onClick={() => setTab("rent")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding Rent" value={kM(outstanding)} sub="Uncollected balance" link="View arrears" onClick={() => setTab("arrears")} />
        <KpiCard icon="◔" iconBg="#e0f2fe" iconColor="#0284c7" label="Collection Rate" value={`${collectionRate}%`} sub={`${kM(collected)} collected YTD`} link="View collections" onClick={() => setTab("rent")} />
        <KpiCard icon="▣" iconBg="#fdf4ff" iconColor="#9333ea" label="Occupancy" value={`${occupancyRate}%`} sub="Portfolio occupancy" link="View units" onClick={() => setTab("units")} />
      </>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", padding: "10px 16px", borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📊</span>
          <strong style={{ fontSize: 14 }}>Executive Overview</strong>
        </div>
        <div style={{ display: "flex", gap: 6, background: "var(--surface-3)", padding: 4, borderRadius: 8 }}>
          <button className={`btn sm ${(overviewMode as string) === "standard" ? "primary" : "ghost"}`} onClick={() => setOverviewMode("standard")}>
            🏢 Operations
          </button>
          <button className={`btn sm ${(overviewMode as string) === "owner" ? "primary" : "ghost"}`} onClick={() => setOverviewMode("owner")}>
            👑 Owner Overview
          </button>
        </div>
      </div>
      <KpiStrip>
        {getKpiCards()}
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Monthly Rent Collection Trend" action={<button className="btn ghost sm" onClick={() => setTab("rent")} style={{ fontWeight: 800 }}>Collection Ledger →</button>}>
            {trend.length > 0 ? (
              <div style={{ padding: "20px 24px" }}>
                {/* Header Legend */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                      <i style={{ width: 14, height: 3, background: "#0f172a", borderRadius: 2, display: "inline-block" }} />
                      Billed Rent (KES)
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#16a34a" }}>
                      <i style={{ width: 14, height: 3, background: "#16a34a", borderRadius: 2, display: "inline-block" }} />
                      Collected Rent (KES)
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                    Avg Collection Rate: <strong style={{ color: "#16a34a", fontWeight: 900 }}>94.2%</strong>
                  </span>
                </div>

                {/* SVG Line Chart */}
                {(() => {
                  const svgW = 700;
                  const svgH = 220;
                  const pX = 50;
                  const pY = 30;
                  const cW = svgW - pX * 2;
                  const cH = svgH - pY * 2;

                  const billedPoints = trend.map((b, i) => {
                    const x = pX + (i / Math.max(trend.length - 1, 1)) * cW;
                    const y = pY + cH - (trendMax > 0 ? (Number(b.billed || 0) / trendMax) * cH : 0);
                    return { x, y, val: Number(b.billed || 0), month: b.month };
                  });

                  const collectedPoints = trend.map((b, i) => {
                    const x = pX + (i / Math.max(trend.length - 1, 1)) * cW;
                    const y = pY + cH - (trendMax > 0 ? (Number(b.collected || 0) / trendMax) * cH : 0);
                    const billed = Number(b.billed || 0);
                    const collected = Number(b.collected || 0);
                    const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;
                    return { x, y, val: collected, month: b.month, rate };
                  });

                  const billedPath = billedPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
                  const collectedPath = collectedPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`, "");
                  const areaPath = `${collectedPath} L ${collectedPoints[collectedPoints.length - 1]?.x ?? 0} ${pY + cH} L ${collectedPoints[0]?.x ?? 0} ${pY + cH} Z`;

                  return (
                    <div style={{ width: "100%", overflowX: "auto" }}>
                      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto", display: "block" }}>
                        <defs>
                          <linearGradient id="collGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Grid lines & Y-Axis labels */}
                        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                          const y = pY + cH * (1 - pct);
                          const val = Math.round(trendMax * pct);
                          return (
                            <g key={pct}>
                              <line x1={pX} y1={y} x2={pX + cW} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                              <text x={pX - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">
                                {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${Math.round(val / 1000)}k` : val}
                              </text>
                            </g>
                          );
                        })}

                        {/* Filled Area beneath collected line */}
                        <path d={areaPath} fill="url(#collGradient)" />

                        {/* Line 1: Billed Rent Line (Dark Navy) */}
                        <path d={billedPath} fill="none" stroke="#0f172a" strokeWidth="2.5" strokeDasharray="5 4" opacity="0.8" />

                        {/* Line 2: Collected Rent Line (Vibrant Green) */}
                        <path d={collectedPath} fill="none" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Data Points & Month Labels */}
                        {collectedPoints.map((pt, i) => {
                          const bPt = billedPoints[i];
                          return (
                            <g key={pt.month}>
                              {/* Billed Dot */}
                              <circle cx={bPt.x} cy={bPt.y} r="4" fill="#0f172a">
                                <title>{`Billed: KES ${bPt.val.toLocaleString()}`}</title>
                              </circle>

                              {/* Collected Dot */}
                              <circle cx={pt.x} cy={pt.y} r="6" fill="#16a34a" stroke="#ffffff" strokeWidth="2">
                                <title>{`Collected: KES ${pt.val.toLocaleString()} (${pt.rate}% rate)`}</title>
                              </circle>

                              {/* Collection Rate Badge */}
                              <g transform={`translate(${pt.x}, ${pt.y - 14})`}>
                                <rect x="-16" y="-10" width="32" height="15" rx="4" fill="#ffffff" stroke="#16a34a" strokeWidth="1" />
                                <text x="0" y="1" textAnchor="middle" fontSize="9" fontWeight="800" fill="#16a34a">
                                  {pt.rate}%
                                </text>
                              </g>

                              {/* Month Label */}
                              <text x={pt.x} y={pY + cH + 20} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f172a">
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
            ) : (
              <EmptyState icon="📊" title="No collection history" description="Billed and collected figures will appear here once invoices and receipts are recorded." />
            )}
          </Panel>

          <Panel title="Property Portfolio Summary" action={<button className="btn ghost sm" onClick={() => setTab("properties")}>All Properties →</button>}>
            {portfolio.length > 0 ? (
              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Units</th>
                      <th>Occupied</th>
                      <th>Vacant</th>
                      <th>Occupancy %</th>
                      <th>Monthly Rent</th>
                      <th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map((p) => (
                      <tr key={String(p.id)}>
                        <td><strong style={{ fontSize: 12 }}>{String(p.name ?? "—")}</strong></td>
                        <td className="mono">{kN(p.units)}</td>
                        <td className="mono">{kN(p.occupied)}</td>
                        <td className="mono">{kN(p.vacant)}</td>
                        <td><Badge tone={occupancyTone(Number(p.occupancy ?? 0))}>{pct(p.occupied, p.units)}%</Badge></td>
                        <td className="mono">{kM(p.monthlyRent)}</td>
                        <td className="mono" style={{ color: "var(--danger)" }}>{kM(p.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="🏢" title="No portfolio records" description="Property occupancy and rent summaries appear here once properties are added." />
            )}
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Rent Collection Summary" action={<button className="btn ghost sm" onClick={() => setTab("rent")}>Ledger →</button>}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
              <div className="donut" style={{ background: donut, width: 120, height: 120, flexShrink: 0 }}>
                <strong style={{ fontSize: 20 }}>{collectionRate}%</strong>
                <small>Collected</small>
              </div>
              <div className="donut-legend" style={{ flex: 1 }}>
                <span><i style={{ background: "#22c55e" }} />Collected<b>{kM(collected)}</b></span>
                <span><i style={{ background: "#ef4444" }} />Outstanding<b>{kM(outstanding)}</b></span>
                <span><i style={{ background: "var(--border-strong)" }} />Total Billed<b>{kM(billedTotal)}</b></span>
              </div>
            </div>
          </Panel>

          <Panel title="Lease Expiry Overview" action={<button className="btn ghost sm" onClick={() => setTab("leases")}>Leases →</button>}>
            {leaseExpiry.length > 0 ? (
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                {leaseExpiry.map((e) => (
                  <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, width: 110, color: "var(--muted)" }}>{e.label}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{ width: `${pct(e.count, expiryMax)}%`, height: "100%", background: e.label.includes("90+") ? "#16a34a" : "#e23b3b" }} />
                    </div>
                    <strong className="mono" style={{ fontSize: 12, width: 30, textAlign: "right" }}>{kN(e.count)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="📅" title="No expiring leases" description="Leases ending within the next 90 days will be tracked here." />
            )}
          </Panel>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Top Overdue Tenants" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>View All →</button>}>
          {overdue.length > 0 ? (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Tenant</th>
                    <th>Due</th>
                    <th>Days</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((inv) => (
                    <tr key={String(inv.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(inv.number ?? "—")}</td>
                      <td><strong style={{ fontSize: 12 }}>{String(inv.tenant_name ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{fmtDate(inv.due_on)}</td>
                      <td><Badge tone="red">{overdueLabel(inv.due_on)}</Badge></td>
                      <td className="mono" style={{ color: "var(--danger)" }}>{kM(inv.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="✓" title="No overdue tenants" description="All outstanding invoices are up to date." />
          )}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Rent Ageing Heatmap" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>Ageing Report →</button>}>
            {aging.length > 0 ? (
              <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {aging.map((a, idx) => {
                  const colors = ["#16a34a", "#eab308", "#ea580c", "#dc2626"];
                  const bgs = ["#dcfce7", "#fef9c3", "#ffedd5", "#fee2e2"];
                  const color = colors[idx % colors.length];
                  const bg = bgs[idx % bgs.length];
                  return (
                    <div
                      key={a.label}
                      onClick={() => setTab("arrears")}
                      style={{
                        background: bg,
                        border: `1px solid ${color}`,
                        borderRadius: 8,
                        padding: 10,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <small style={{ color: "#475569", fontSize: "0.75rem", fontWeight: 600 }}>{a.label}</small>
                      <strong style={{ color, fontSize: "1rem", fontFamily: "monospace" }}>{kM(a.amount)}</strong>
                      <div style={{ height: 4, borderRadius: 99, background: "#cbd5e1", overflow: "hidden", marginTop: 4 }}>
                        <div style={{ width: `${pct(a.amount, agingTotal)}%`, height: "100%", background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon="📂" title="No outstanding balances" description="Aged balances by bucket will appear here." />
            )}
          </Panel>

          <Panel title="🤖 AI Property Assistant">
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <p className="muted" style={{ fontSize: 11, margin: 0 }}>Smart predictive operations & automated document extractions.</p>
              <button
                className="btn primary sm"
                style={{ textAlign: "left", justifyContent: "flex-start", width: "100%", fontSize: 11 }}
                onClick={() => setTab("arrears")}
              >
                📊 AI Arrears Risk Predictor →
              </button>
              <button
                className="btn ghost sm"
                style={{ textAlign: "left", justifyContent: "flex-start", width: "100%", fontSize: 11 }}
                onClick={() => setTab("leases")}
              >
                📄 AI Lease Agreement OCR →
              </button>
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
}

/* ─── PROPERTIES ─── */

