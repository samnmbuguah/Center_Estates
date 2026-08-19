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

export function LeasesView({
  rows,
  loading,
  search,
  setSearch,
  setTab,
  onAddLease,
  onAdd,
  onDownloadTemplate = () => {},
  onLeaseAction = () => {},
  onSelectRow = () => {},
  canLease = true,
  onRenew = () => {},
  onTerminate = () => {},
  onRefresh = () => {},
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void;
  onAddLease?: () => void;
  onAdd?: () => void;
  onDownloadTemplate?: () => void;
  onLeaseAction?: (r: LeaseRow, action: "activate" | "renew" | "terminate") => void;
  onSelectRow?: (r: Row) => void;
  canLease?: boolean;
  onRenew?: (r: LeaseRow) => void;
  onTerminate?: (r: LeaseRow) => void;
  onRefresh?: () => void;
}) {
  const handleAdd = onAdd || onAddLease || (() => {});
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const leases = rows as LeaseRow[];
  const filtered = leases.filter((l) => !filterStatus || l.status === filterStatus);
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = leases.filter((l) => l.status === "active").length;
  const expired = leases.filter((l) => l.status === "expired").length;
  const expiring30 = leases.filter((l) => {
    const dl = daysUntil(l.ends_on);
    return dl !== null && dl >= 0 && dl <= 30 && ["active", "expiring"].includes(String(l.status));
  }).length;
  const monthlyRent = leases.filter((l) => ["active", "expiring"].includes(String(l.status))).reduce((s, l) => s + Number(l.monthly_rent ?? 0), 0);
  const outstanding = leases.reduce((s, l) => s + Number(l.outstanding ?? 0), 0);
  const statuses = [...new Set(leases.map((l) => l.status).filter(Boolean))];
  const selStyle = { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 };

  return (
    <>
      <KpiStrip>
        <KpiCard icon="📑" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Leases" value={kN(leases.length)} sub="Registered agreements" link="View leases" onClick={() => setTab("leases")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active" value={kN(active)} sub="Current tenancies" link="View leases" onClick={() => setTab("leases")} />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#d97706" label="Expiring in 30 Days" value={kN(expiring30)} sub="Upcoming renewals" link="View leases" onClick={() => setTab("leases")} />
        <KpiCard icon="🚪" iconBg="#fee2e2" iconColor="#dc2626" label="Expired" value={kN(expired)} sub="Closed agreements" link="View leases" onClick={() => setTab("leases")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Monthly Rent" value={kM(monthlyRent)} sub="Active leases" link="View rent" onClick={() => setTab("rent")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding" value={kM(outstanding)} sub="Unpaid lease balances" link="View arrears" onClick={() => setTab("arrears")} />
      </KpiStrip>

      <ViewToolbar title="Lease Register" subtitle="Lease agreements for the selected property" search={search} onSearch={setSearch} placeholder="Search lease no, tenant or unit…">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selStyle}>
          <option value="">All Status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn ghost sm" onClick={() => exportCsv(filtered, [
          { key: "reference", label: "Reference" }, { key: "tenant_name", label: "Tenant" },
          { key: "unit_code", label: "Unit" },
          { key: "starts_on", label: "Start" }, { key: "ends_on", label: "End" },
          { key: "monthly_rent", label: "Monthly Rent" }, { key: "deposit", label: "Deposit" },
          { key: "escalation_percent", label: "Escalation %" }, { key: "status", label: "Status" },
          { key: "outstanding", label: "Outstanding" },
        ], "leases.csv")}>Export CSV</button>
        <button className="btn ghost sm" onClick={() => exportLeaseICS(filtered)} title="Export leases to Outlook/Google Calendar">📅 Export Calendar</button>
      </ViewToolbar>

      <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, border: "1px dashed var(--primary)", background: "var(--surface-2)" }}>
        <div>
          <h4 style={{ margin: "0 0 2px 0", fontSize: 14 }}>Quick Actions</h4>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>Add a lease to start billing and tracking occupancy.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary sm" data-testid="property-add-lease-btn" onClick={handleAdd}>+ Add Lease</button>
        </div>
      </div>

      <Panel title="Lease Register" action={<button className="btn ghost sm" onClick={() => setTab("rent")}>Invoices →</button>}>
        <ListState loading={loading} empty={filtered.length === 0} emptyTitle="No leases found" emptyDesc="Add a single lease or bulk import a tenancy schedule to populate the register.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Lease No</th>
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Monthly Rent</th>
                  <th>Status</th>
                  <th>Outstanding</th>
                  <th>Days Left</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((l) => (
                  <tr key={String(l.id)} onClick={() => onSelectRow(l)}>
                    <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(l.reference ?? "—")}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(l.tenant_name ?? "—")}</strong></td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(l.unit_code ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(l.starts_on)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(l.ends_on)}</td>
                    <td className="mono">{kM(l.monthly_rent)}</td>
                    <td><StatusPill value={String(l.status ?? "—")} /></td>
                    <td className="mono" style={{ color: Number(l.outstanding ?? 0) > 0 ? "var(--danger)" : "var(--muted)" }}>{l.outstanding === undefined ? "—" : kM(l.outstanding)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{daysLeftLabel(l.ends_on)}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {l.status === "draft" && (
                          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onLeaseAction(l, "activate"); }}>Activate</button>
                        )}
                        {(["active", "expiring"].includes(String(l.status))) && (
                          <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onLeaseAction(l, "renew"); }}>Renew</button>
                        )}
                        {(["active", "expiring"].includes(String(l.status))) && (
                          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onLeaseAction(l, "terminate"); }}>Terminate</button>
                        )}
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("rent"); }}>Invoices</button>
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

/* ─── TENANCY (consolidated Tenants / Leases / Documents) ─── */
