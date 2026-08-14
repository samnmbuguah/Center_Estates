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

export function ProjectsView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
}) {
  const projects = rows as ProjectRow[];
  const active = projects.filter((p) => p.status === "active").length;
  const completed = projects.filter((p) => p.status === "completed").length;

  return (
    <>
      <KpiStrip cols={3}>
        <KpiCard icon="🗂" iconBg="#e0e7ff" iconColor="#4f46e5" label="Projects" value={kN(projects.length)} sub="Development projects" />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#d97706" label="In Progress" value={kN(active)} sub="Active projects" />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={kN(completed)} sub="Delivered projects" />
      </KpiStrip>

      <ViewToolbar title="Development Projects" subtitle="Property development and refurbishment projects" search={search} onSearch={setSearch} placeholder="Search by name or project code…" />

      <Panel title="Projects">
        <ListState loading={loading} empty={projects.length === 0} emptyTitle="No projects found" emptyDesc="Development projects will appear here once registered against a property.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Project Ref</th>
                  <th>Property</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Budget</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const budget = (p.metadata as Record<string, unknown> | undefined)?.budget;
                  return (
                    <tr key={String(p.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(p.code ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String((p.metadata as Record<string, unknown> | undefined)?.property_name ?? "—")}</td>
                      <td><strong style={{ fontSize: 12 }}>{String(p.name ?? "—")}</strong></td>
                      <td><StatusPill value={String(p.status ?? "—")} /></td>
                      <td style={{ fontSize: 12 }}>{fmtDate(p.starts_on)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(p.ends_on)}</td>
                      <td className="mono">{budget === undefined ? "—" : kM(budget)}</td>
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

/* ─── TENANTS ─── */

