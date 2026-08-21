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
  occupancyTone, shortId, exportCsv, exportLeaseICS, exportICS,
  criticalFormatDate, criticalDaysUntil,
} from "../../utils/property.utils";

export function UnitsView({ rows, loading, search, setSearch, setTab, onSelectRow }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void; onSelectRow?: (r: Row) => void;
}) {
  const [view, setView] = useState<"commercial" | "residential" | "stacking">("residential");
  const units = rows as UnitRow[];
  const occupied = units.filter((u) => u.status === "occupied").length;
  const available = units.filter((u) => u.status === "available").length;
  const totalAreaSqft = units.reduce((s, u) => s + Number(u.area ?? 0), 0);
  const totalAreaM2 = totalAreaSqft / 10.7639;
  const typologyCounts = units.reduce<Record<string, number>>((acc, u) => {
    const t = String(u.unit_type ?? "").trim() || "—";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const typologyTotal = Object.values(typologyCounts).reduce((s, c) => s + c, 0);
  const areaCount = units.filter((u) => u.area !== undefined && u.area !== null).length;

  // Group units by floor for Stacking Plan
  const floorGroups = useMemo(() => {
    const map = new Map<string, UnitRow[]>();
    for (const u of units) {
      const f = String(u.floor ?? "1").trim() || "1";
      if (!map.has(f)) map.set(f, []);
      map.get(f)!.push(u);
    }
    // Sort floors descending (e.g. 5, 4, 3, 2, 1, G, B)
    return Array.from(map.entries()).sort((a, b) => {
      const na = Number(a[0]);
      const nb = Number(b[0]);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b[0].localeCompare(a[0]);
    });
  }, [units]);

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="▦" iconBg="#dbeafe" iconColor="#2563eb" label="Units" value={kN(units.length)} sub="Registered units" link="View occupancy" onClick={() => setTab("units")} />
        <KpiCard icon="🔑" iconBg="#dcfce7" iconColor="#16a34a" label="Occupied" value={kN(occupied)} sub={`${pct(occupied, units.length)}% occupied`} link="View occupancy" onClick={() => setTab("units")} />
        <KpiCard icon="◌" iconBg="#fef3c7" iconColor="#d97706" label="Available" value={kN(available)} sub="Vacant units" link="View occupancy" onClick={() => setTab("units")} />
        {view === "commercial" ? (
          <KpiCard icon="📐" iconBg="#e0f2fe" iconColor="#0284c7" label="Total Area" value={`${kN(totalAreaSqft)} sqft`} sub={`${kN(totalAreaM2)} m² lettable`} link="View occupancy" onClick={() => setTab("units")} />
        ) : (
          <KpiCard icon="🗂" iconBg="#e0f2fe" iconColor="#0284c7" label="Typologies" value={kN(Object.keys(typologyCounts).length)} sub={`${kN(typologyTotal)} units`} link="View occupancy" onClick={() => setTab("units")} />
        )}
      </KpiStrip>

      <ViewToolbar title="Occupancy Register" subtitle="Lettable and non-lettable units at the selected property" search={search} onSearch={setSearch} placeholder="Search by unit code, type or building…">
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className={`btn sm ${view === "residential" ? "primary" : "ghost"}`} data-testid="occupancy-residential-btn" onClick={() => setView("residential")}>Residential View</button>
          <button type="button" className={`btn sm ${view === "commercial" ? "primary" : "ghost"}`} data-testid="occupancy-commercial-btn" onClick={() => setView("commercial")}>Commercial View</button>
          <button type="button" className={`btn sm ${view === "stacking" ? "primary" : "ghost"}`} data-testid="occupancy-stacking-btn" onClick={() => setView("stacking")}>🏢 Stacking Plan</button>
        </div>
      </ViewToolbar>

      {view === "stacking" ? (
        <Panel title="Building Floor Elevation &amp; Stacking Plan">
          <ListState loading={loading} empty={units.length === 0} emptyTitle="No units available" emptyDesc="Register units with floor numbers to view the building stacking elevation.">
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#16a34a" }} /> Occupied
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#3b82f6" }} /> Available / Vacant
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#f59e0b" }} /> Reserved
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {floorGroups.map(([floor, floorUnits]) => {
                  const floorOccupied = floorUnits.filter(u => u.status === "occupied").length;
                  const floorArea = floorUnits.reduce((s, u) => s + Number(u.area ?? 0), 0);
                  return (
                    <div
                      key={floor}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px minmax(0, 1fr)",
                        gap: 12,
                        background: "var(--surface-2)",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        padding: 12,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ borderRight: "1px solid var(--border)", paddingRight: 8 }}>
                        <div style={{ fontWeight: 900, fontSize: 14, color: "var(--text-primary)" }}>Floor {floor}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{floorUnits.length} Unit{floorUnits.length !== 1 ? "s" : ""} · {pct(floorOccupied, floorUnits.length)}% occ.</div>
                        {floorArea > 0 && <div style={{ fontSize: 10, color: "var(--muted)" }}>{floorArea.toLocaleString()} sqft</div>}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                        {floorUnits.map((u) => {
                          const isOcc = u.status === "occupied";
                          const isRes = u.status === "reserved";
                          const borderCol = isOcc ? "#16a34a" : isRes ? "#f59e0b" : "#3b82f6";
                          const bgCol = isOcc ? "rgba(22, 163, 74, 0.08)" : isRes ? "rgba(245, 158, 11, 0.08)" : "rgba(59, 130, 246, 0.08)";
                          const rawTenant = (u.metadata as Record<string, unknown> | undefined)?.tenant;
                          const tenantName = rawTenant ? String(rawTenant) : null;
                          return (
                            <div
                              key={String(u.id)}
                              onClick={() => onSelectRow?.(u)}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: `1.5px solid ${borderCol}`,
                                background: bgCol,
                                cursor: "pointer",
                                transition: "transform 0.15s, box-shadow 0.15s",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span className="mono" style={{ fontWeight: 800, fontSize: 12 }}>{u.code}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "capitalize", color: borderCol }}>
                                  {u.status}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                {u.area ? `${u.area} sqft` : u.unit_type || "Unit"}
                              </div>
                              {Boolean(tenantName) && (
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  👤 {String(tenantName)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ListState>
        </Panel>
      ) : view === "residential" ? (
        <Panel title="Unit Typology Breakdown">
          {Object.keys(typologyCounts).length > 0 ? (
            <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
              {Object.entries(typologyCounts).map(([type, count]) => (
                <div key={type} className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
                  <strong style={{ fontSize: 18 }}>{kN(count)}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{type}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="🗂" title="No typology data" description="Unit type / typology (e.g. 1BD, 2BD, 3BD) will appear here once units are registered." />
          )}
        </Panel>
      ) : (
        <Panel title="Lettable Area Summary">
          <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <strong style={{ fontSize: 18 }}>{kN(totalAreaSqft)}</strong>
              <div className="muted" style={{ fontSize: 11 }}>Total area (sq.ft)</div>
            </div>
            <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <strong style={{ fontSize: 18 }}>{kN(totalAreaM2)}</strong>
              <div className="muted" style={{ fontSize: 11 }}>Total area (m²)</div>
            </div>
            <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <strong style={{ fontSize: 18 }}>{kN(areaCount)}</strong>
              <div className="muted" style={{ fontSize: 11 }}>Units with area</div>
            </div>
          </div>
        </Panel>
      )}

      {view !== "stacking" && (
        <Panel title={view === "commercial" ? "Commercial Units" : "Residential Units"}>
          <ListState loading={loading} empty={units.length === 0} emptyTitle="No units found" emptyDesc="Generate units from a property or register them individually.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Unit Code</th>
                    <th>Building</th>
                    <th>Floor</th>
                    {view === "commercial" ? (
                      <>
                        <th>Area (sq.ft)</th>
                        <th>Area (m²)</th>
                      </>
                    ) : (
                      <th>Typology</th>
                    )}
                    <th>Status</th>
                    <th>Tenant</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => {
                    const rent = (u.metadata as Record<string, unknown> | undefined)?.rent;
                    const area = u.area === undefined || u.area === null ? null : Number(u.area);
                    return (
                      <tr key={String(u.id)} onClick={() => onSelectRow?.(u)}>
                        <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(u.code ?? "—")}</td>
                        <td style={{ fontSize: 12 }}>{String(u.building_name ?? "—")}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{String(u.floor ?? "—")}</td>
                        {view === "commercial" ? (
                          <>
                            <td className="mono">{area === null ? "—" : kN(area)}</td>
                            <td className="mono">{area === null ? "—" : kN(area / 10.7639)}</td>
                          </>
                        ) : (
                          <td style={{ fontSize: 12 }}>{String(u.unit_type ?? "—")}</td>
                        )}
                        <td><StatusPill value={String(u.status ?? "—")} /></td>
                        <td style={{ fontSize: 12 }}>{String((u.metadata as Record<string, unknown> | undefined)?.tenant ?? "—")} {rent !== undefined ? <span className="muted" style={{ fontSize: 11 }}>· {kM(rent)}/mo</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}
    </>
  );
}

/* ─── PROJECTS ─── */
