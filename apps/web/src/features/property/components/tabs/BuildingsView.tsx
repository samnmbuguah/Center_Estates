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

export function BuildingsView({ rows, loading, search, setSearch, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void;
}) {
  const buildings = rows as BuildingRow[];
  const totalFloors = buildings.reduce((s, b) => s + Number(b.floors ?? 0), 0);
  const locations = new Set(buildings.map((b) => String(b.property_name ?? "—"))).size;

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🏢" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Buildings" value={kN(buildings.length)} sub="Registered buildings" link="View register" onClick={() => setTab("buildings")} />
        <KpiCard icon="📐" iconBg="var(--color-blue-bg)" iconColor="var(--color-info)" label="Total Floors" value={kN(totalFloors)} sub="Across buildings" link="View buildings" onClick={() => setTab("buildings")} />
        <KpiCard icon="📍" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Locations" value={kN(locations)} sub="Properties with buildings" link="View properties" onClick={() => setTab("properties")} />
        <KpiCard icon="▦" iconBg="var(--color-sky-bg)" iconColor="var(--color-sky)" label="Units" value={kN(0)} sub="Linked via properties" link="View units" onClick={() => setTab("units")} />
      </KpiStrip>

      <ViewToolbar title="Buildings Register" subtitle="Buildings, floors and property locations" search={search} onSearch={setSearch} placeholder="Search by name, code or property…" />

      <Panel title="Buildings">
        <ListState loading={loading} empty={buildings.length === 0} emptyTitle="No buildings found" emptyDesc="Buildings under each property will appear here once registered.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Building Name</th>
                  <th>Building ID</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Floor Area m²</th>
                  <th>Occupancy %</th>
                  <th>Status</th>
                  <th>Monthly Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buildings.map((b) => {
                  const area = (b.metadata as Record<string, unknown> | undefined)?.floor_area;
                  const occ = (b.metadata as Record<string, unknown> | undefined)?.occupancy;
                  const cost = (b.metadata as Record<string, unknown> | undefined)?.monthly_cost;
                  return (
                    <tr key={String(b.id)}>
                      <td><strong style={{ fontSize: 12 }}>{String(b.name ?? "—")}</strong></td>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(b.code ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String((b.metadata as Record<string, unknown> | undefined)?.building_type ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(b.property_name ?? "—")}</td>
                      <td className="mono">{area === undefined ? "—" : `${kN(area)}`}</td>
                      <td>{occ === undefined ? <span className="muted">—</span> : <Badge tone={occupancyTone(Number(occ))}>{Number(occ)}%</Badge>}</td>
                      <td><StatusPill value="active" /></td>
                      <td className="mono">{cost === undefined ? "—" : kM(cost)}</td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setTab("units")}>View Units</button>
                      </td>
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

/* ─── UNITS / OCCUPANCY ─── */

