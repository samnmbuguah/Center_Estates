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

export function PropertiesView({
  rows, loading, search, setSearch, setTab, onAdd, onSelectRow,
}: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void; onAdd: () => void; onSelectRow: (r: Row) => void;
}) {
  const [filterType, setFilterType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const props = rows as PropertyRow[];
  const filtered = props.filter((p) =>
    (!filterType || p.property_type === filterType) &&
    (!filterLocation || p.city === filterLocation) &&
    (!filterStatus || p.status === filterStatus)
  );
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalUnits = props.reduce((s, p) => s + Number(p.units_count ?? 0), 0);
  const totalBuildings = props.reduce((s, p) => s + Number(p.buildings_count ?? 0), 0);
  const active = props.filter((p) => p.status === "active").length;
  const totalOccupied = props.reduce((s, p) => s + Number(p.occupied ?? 0), 0);
  const vacant = Math.max(totalUnits - totalOccupied, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;
  const types = [...new Set(props.map((p) => p.property_type).filter(Boolean))];
  const locations = [...new Set(props.map((p) => p.city).filter(Boolean))];
  const statuses = [...new Set(props.map((p) => p.status).filter(Boolean))];
  const selStyle = { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 };

  return (
    <>
      <KpiStrip cols={6}>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Properties" value={kN(props.length)} sub="Portfolio count" link="View register" onClick={() => setTab("properties")} />
        <KpiCard icon="▦" iconBg="#dbeafe" iconColor="#2563eb" label="Total Units" value={kN(totalUnits)} sub="Across portfolio" link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="🏗" iconBg="#fef3c7" iconColor="#d97706" label="Buildings" value={kN(totalBuildings)} sub="Registered buildings" link="View buildings" onClick={() => setTab("buildings")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active" value={kN(active)} sub="Active properties" link="View register" onClick={() => setTab("properties")} />
        <KpiCard icon="◌" iconBg="#fee2e2" iconColor="#dc2626" label="Vacant Units" value={kN(vacant)} sub="Across portfolio" link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="▣" iconBg="#e0f2fe" iconColor="#0284c7" label="Occupancy %" value={`${occupancyRate}%`} sub="Portfolio occupancy" link="View units" onClick={() => setTab("units")} />
      </KpiStrip>

      <ViewToolbar title="Property Register" subtitle="Manage all properties across your portfolio" search={search} onSearch={setSearch} searchTestid="property-search-input" placeholder="Search by name, code or city…">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selStyle}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={selStyle}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selStyle}>
          <option value="">All Status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn ghost sm" onClick={() => exportCsv(filtered, [
          { key: "name", label: "Property" }, { key: "code", label: "Code" }, { key: "property_type", label: "Type" },
          { key: "city", label: "Location" }, { key: "units_count", label: "Units" }, { key: "occupied", label: "Occupied" },
          { key: "occupancy", label: "Occupancy %" }, { key: "monthlyRent", label: "Monthly Rent" },
          { key: "outstanding", label: "Outstanding" }, { key: "status", label: "Status" },
        ], "properties.csv")}>Export CSV</button>
      </ViewToolbar>

      <Panel title="Properties">
        <ListState loading={loading} empty={filtered.length === 0} emptyTitle="No properties found" emptyDesc="Add a property to start building your portfolio hierarchy.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Units</th>
                  <th>Occupied</th>
                  <th>Occupancy %</th>
                  <th>Monthly Rent</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((p) => (
                  <tr key={String(p.id)} onClick={() => onSelectRow(p)}>
                    <td>
                      <strong style={{ fontSize: 12 }}>{String(p.name ?? "—")}</strong>
                      <div className="mono" style={{ fontSize: 11, color: "var(--primary)" }}>{String(p.code ?? "—")}</div>
                    </td>
                    <td><span className="badge badge-blue">{String(p.property_type ?? "—")}</span></td>
                    <td style={{ fontSize: 12 }}>{String(p.city ?? "—")}</td>
                    <td className="mono">{kN(p.units_count)}</td>
                    <td className="mono">{p.occupied === undefined ? "—" : kN(p.occupied)}</td>
                    <td>{p.occupancy === undefined ? <span className="muted">—</span> : <Badge tone={occupancyTone(Number(p.occupancy))}>{pct(p.occupied, p.units_count)}%</Badge>}</td>
                    <td className="mono">{p.monthlyRent === undefined ? "—" : kM(p.monthlyRent)}</td>
                    <td className="mono" style={{ color: Number(p.outstanding ?? 0) > 0 ? "var(--danger)" : "var(--muted)" }}>{p.outstanding === undefined ? "—" : kM(p.outstanding)}</td>
                    <td><StatusPill value={String(p.status ?? "—")} /></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("units"); }}>Units</button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("tenants"); }}>Tenants</button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("rent"); }}>Rent</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </ListState>
      </Panel>
    </>
  );
}

/* ─── BUILDINGS ─── */

