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

export function TenantsView({
  rows,
  loading,
  search,
  setSearch,
  setTab,
  onAdd = () => {},
  onUploadDoc = () => {},
  onSelectRow = () => {},
  onOpenPortal = () => {},
  onDownloadStatement = () => {},
  canLease = true,
  onRefresh = () => {},
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void;
  onAdd?: () => void;
  onUploadDoc?: (t?: Row) => void;
  onSelectRow?: (r: Row) => void;
  onOpenPortal?: (r: Row) => void;
  onDownloadStatement?: (r: TenantRow) => void;
  canLease?: boolean;
  onRefresh?: () => void;
}) {
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const tenants = rows as TenantRow[];
  const filtered = tenants.filter((t) => !filterStatus || t.status === filterStatus);
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = tenants.filter((t) => t.status === "active").length;
  const prospects = tenants.filter((t) => t.status === "prospect").length;
  const outstanding = tenants.reduce((s, t) => s + Number(t.outstanding ?? 0), 0);
  const statuses = [...new Set(tenants.map((t) => t.status).filter(Boolean))];
  const selStyle = { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 };

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="👥" iconBg="#e0e7ff" iconColor="#4f46e5" label="Tenants" value={kN(tenants.length)} sub="Registered tenants" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active" value={kN(active)} sub="Active tenancies" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="◌" iconBg="#fef3c7" iconColor="#d97706" label="Prospects" value={kN(prospects)} sub="Potential tenants" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding" value={kM(outstanding)} sub="Combined arrears" link="View arrears" onClick={() => setTab("arrears")} />
      </KpiStrip>

      <ViewToolbar title="Tenant Register" subtitle="Tenants and occupancy for the selected property" search={search} onSearch={setSearch} searchTestid="tenant-search-input" placeholder="Search tenant name, email, phone…">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selStyle}>
          <option value="">All Status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn ghost sm" onClick={() => exportCsv(filtered, [
          { key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "tenant_type", label: "Type" },
          { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
          { key: "unit", label: "Unit" }, { key: "status", label: "Status" },
          { key: "outstanding", label: "Outstanding" }, { key: "created_at", label: "Registered" },
        ], "tenants.csv")}>Export CSV</button>
        <button className="btn ghost sm" onClick={() => onUploadDoc()}>+ Upload Document</button>
        <button className="btn primary sm" onClick={() => onAdd()}>+ Add Tenant</button>
      </ViewToolbar>

      <Panel title="Tenants">
        <ListState loading={loading} empty={filtered.length === 0} emptyTitle="No tenants found" emptyDesc="Register a tenant to link leases, invoices and documents.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Contact</th>
                  <th>Lease Start</th>
                  <th>Lease End</th>
                  <th>Status</th>
                  <th>Outstanding</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((t) => (
                  <tr key={String(t.id)} onClick={() => onSelectRow(t)}>
                    <td>
                      <strong style={{ fontSize: 12 }}>{String(t.name ?? "—")}</strong>
                      <div className="mono" style={{ fontSize: 11, color: "var(--primary)" }}>{String(t.code ?? "—")}</div>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: 12 }}>{String(t.unit ?? "—")}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div>{t.email ? String(t.email) : "—"}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{t.phone ? String(t.phone) : "—"}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{t.lease_start ? fmtDate(t.lease_start) : "—"}</td>
                    <td style={{ fontSize: 12 }}>{t.lease_end ? fmtDate(t.lease_end) : "—"}</td>
                    <td><StatusPill value={String(t.status ?? "—")} /></td>
                    <td className="mono" style={{ color: Number(t.outstanding ?? 0) > 0 ? "var(--danger)" : "var(--muted)" }}>{t.outstanding === undefined ? "—" : kM(t.outstanding)}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn ghost sm" data-testid="tenant-portal-btn" onClick={(e) => { e.stopPropagation(); onOpenPortal(t); }}>Portal</button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onDownloadStatement(t); }}>Statement PDF</button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("leases"); }}>Leases</button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onUploadDoc(); }}>Docs</button>
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

/* ─── TENANT DOCUMENTS ─── */
