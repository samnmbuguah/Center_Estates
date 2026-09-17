"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  Box, Button, Chip, MenuItem, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
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
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Building Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Building ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Location</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Floor Area m²</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Occupancy %</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Monthly Cost</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {buildings.map((b) => {
                  const area = (b.metadata as Record<string, unknown> | undefined)?.floor_area;
                  const occ = (b.metadata as Record<string, unknown> | undefined)?.occupancy;
                  const cost = (b.metadata as Record<string, unknown> | undefined)?.monthly_cost;
                  return (
                    <TableRow key={String(b.id)} hover>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(b.name ?? "—")}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "primary.main" }}>
                          {String(b.code ?? "—")}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{String((b.metadata as Record<string, unknown> | undefined)?.building_type ?? "—")}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{String(b.property_name ?? "—")}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
                          {area === undefined ? "—" : `${kN(area)}`}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{occ === undefined ? <Typography variant="caption" color="text.secondary">—</Typography> : <Badge tone={occupancyTone(Number(occ))}>{Number(occ)}%</Badge>}</TableCell>
                      <TableCell align="center"><StatusPill value="active" /></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
                          {cost === undefined ? "—" : kM(cost)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" onClick={() => setTab("units")} sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }}>
                          View Units
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
    </>
  );
}

/* ─── UNITS / OCCUPANCY ─── */

