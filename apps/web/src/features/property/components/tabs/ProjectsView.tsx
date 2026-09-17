"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  Box, Button, Chip, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
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

export function ProjectsView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
}) {
  const projects = rows as ProjectRow[];
  const active = projects.filter((p) => p.status === "active").length;
  const completed = projects.filter((p) => p.status === "completed").length;

  return (
    <>
      <KpiStrip cols={3}>
        <KpiCard icon="🗂" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Projects" value={kN(projects.length)} sub="Development projects" />
        <KpiCard icon="⏳" iconBg="var(--color-amber-bg)" iconColor="var(--color-warning)" label="In Progress" value={kN(active)} sub="Active projects" />
        <KpiCard icon="✓" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Completed" value={kN(completed)} sub="Delivered projects" />
      </KpiStrip>

      <ViewToolbar title="Development Projects" subtitle="Property development and refurbishment projects" search={search} onSearch={setSearch} placeholder="Search by name or project code…" />

      <Panel title="Projects">
        <ListState loading={loading} empty={projects.length === 0} emptyTitle="No projects found" emptyDesc="Development projects will appear here once registered against a property.">
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Project Ref</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Property</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Name</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Lifecycle</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Modules</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Start</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>End</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Budget</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((p) => {
                  const budget = (p.metadata as Record<string, unknown> | undefined)?.budget;
                  const stage = String((p as Record<string, unknown>).lifecycle_stage ?? "planning");
                  const modules = ((p as Record<string, unknown>).modules as string[] | undefined) ?? [];
                  return (
                    <TableRow key={String(p.id)} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main" }}>
                          {String(p.code ?? "—")}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{String((p.metadata as Record<string, unknown> | undefined)?.property_name ?? "—")}</Typography></TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(p.name ?? "—")}</Typography></TableCell>
                      <TableCell align="center"><StatusPill value={String(p.status ?? "—")} /></TableCell>
                      <TableCell><Typography variant="body2">{stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</Typography></TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                          {modules.length === 0 ? (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          ) : (
                            modules.map((m) => <Chip key={m} size="small" label={m} variant="outlined" sx={{ height: 20, fontSize: 10 }} />)
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell><Typography variant="body2">{fmtDate(p.starts_on)}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{fmtDate(p.ends_on)}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
                          {budget === undefined ? "—" : kM(budget)}
                        </Typography>
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

/* ─── TENANTS ─── */

