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

export function UnitsView({ rows, loading, search, setSearch, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void;
}) {
  const [view, setView] = useState<"commercial" | "residential">("residential");
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

      <ViewToolbar title="Occupancy Register" subtitle="Lettable and non-lettable units with area and typology across your properties" search={search} onSearch={setSearch} placeholder="Search by code, type or property…">
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className={`btn sm ${view === "residential" ? "primary" : "ghost"}`} data-testid="occupancy-residential-btn" onClick={() => setView("residential")}>Residential View</button>
          <button type="button" className={`btn sm ${view === "commercial" ? "primary" : "ghost"}`} data-testid="occupancy-commercial-btn" onClick={() => setView("commercial")}>Commercial View</button>
        </div>
      </ViewToolbar>

      {view === "residential" ? (
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

      <Panel title={view === "commercial" ? "Commercial Units" : "Residential Units"}>
        <ListState loading={loading} empty={units.length === 0} emptyTitle="No units found" emptyDesc="Generate units from a property or register them individually.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Unit Code</th>
                  <th>Property</th>
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
                    <tr key={String(u.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(u.code ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(u.property_name ?? "—")}</td>
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
    </>
  );
}

/* ─── PROJECTS ─── */

