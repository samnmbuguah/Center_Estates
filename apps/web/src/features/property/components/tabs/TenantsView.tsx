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
  onBulkUpload = () => {},
  onUploadDoc = () => {},
  onSelectRow = () => {},
  onOpenPortal = () => {},
  onDownloadStatement = () => {},
  onEdit = () => {},
  onDelete = () => {},
  onActivate = () => {},
  onBulkActivate = () => {},
  canLease = true,
  onRefresh = () => {},
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void;
  onAdd?: () => void;
  onBulkUpload?: () => void;
  onUploadDoc?: (t?: Row) => void;
  onSelectRow?: (r: Row) => void;
  onOpenPortal?: (r: Row) => void;
  onDownloadStatement?: (r: TenantRow) => void;
  onEdit?: (r: Row) => void;
  onDelete?: (r: TenantRow) => void;
  onActivate?: (r: TenantRow) => void;
  onBulkActivate?: (ids: string[]) => void;
  canLease?: boolean;
  onRefresh?: () => void;
}) {
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activating, setActivating] = useState(false);
  const PAGE_SIZE = 20;
  const tenants = rows as TenantRow[];
  const filtered = tenants.filter((t) => !filterStatus || t.status === filterStatus);
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = tenants.filter((t) => t.status === "active").length;
  const prospects = tenants.filter((t) => t.status === "prospect").length;
  const outstanding = tenants.reduce((s, t) => s + Number(t.outstanding ?? 0), 0);
  const statuses = [...new Set(tenants.map((t) => t.status).filter(Boolean))];
  const selStyle = { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 };

  const allVisibleSelected = pagedRows.length > 0 && pagedRows.every((r) => selectedIds.includes(String(r.id)));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(pagedRows.map((r) => String(r.id)));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const visibleIds = pagedRows.map((r) => String(r.id));
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleRunBulkActivate = async () => {
    if (!selectedIds.length) return;
    setActivating(true);
    try {
      await onBulkActivate(selectedIds);
      setSelectedIds([]);
    } finally {
      setActivating(false);
    }
  };

  const handleActivateAllProspects = async () => {
    const prospectIds = tenants.filter(t => t.status === "prospect").map(t => String(t.id));
    if (!prospectIds.length) return;
    setActivating(true);
    try {
      await onBulkActivate(prospectIds);
      setSelectedIds([]);
    } finally {
      setActivating(false);
    }
  };

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="👥" iconBg="#e0e7ff" iconColor="#4f46e5" label="Tenants" value={kN(tenants.length)} sub="Registered tenants" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active" value={kN(active)} sub="Active tenancies" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="◌" iconBg="#fef3c7" iconColor="#d97706" label="Prospects" value={kN(prospects)} sub="Pending activation" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding" value={kM(outstanding)} sub="Combined arrears" link="View arrears" onClick={() => setTab("arrears")} />
      </KpiStrip>

      <ViewToolbar title="Tenant Register" subtitle="Tenants and occupancy for the selected property" search={search} onSearch={setSearch} searchTestid="tenant-search-input" placeholder="Search tenant name, email, phone…">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selStyle}>
          <option value="">All Status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {selectedIds.length > 0 && canLease && (
          <button
            className="btn primary sm"
            onClick={() => void handleRunBulkActivate()}
            disabled={activating}
            style={{ background: "#16a34a", borderColor: "#15803d", fontWeight: 800, display: "flex", alignItems: "center", gap: 5 }}
          >
            {activating ? "Activating…" : `⚡ Bulk Activate (${selectedIds.length})`}
          </button>
        )}
        {prospects > 0 && selectedIds.length === 0 && canLease && (
          <button
            className="btn ghost sm"
            onClick={() => void handleActivateAllProspects()}
            disabled={activating}
            style={{ color: "#16a34a", borderColor: "#86efac", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}
            title="Activate all pending prospect tenants and their draft leases"
          >
            ⚡ Activate All Prospects ({prospects})
          </button>
        )}
        <button className="btn ghost sm" onClick={() => exportCsv(filtered, [
          { key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "tenant_type", label: "Type" },
          { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
          { key: "unit", label: "Unit" }, { key: "status", label: "Status" },
          { key: "outstanding", label: "Outstanding" }, { key: "created_at", label: "Registered" },
        ], "tenants.csv")}>Export CSV</button>
        <button className="btn ghost sm" onClick={() => onUploadDoc()}>Upload Document</button>
        {canLease && (
          <button
            className="btn ghost sm"
            onClick={() => onBulkUpload()}
            title="Upload multiple tenants at once using a CSV file"
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            ⬆ Upload Tenants (CSV)
          </button>
        )}
        <button className="btn primary sm" onClick={() => onAdd()} style={{ fontWeight: 800 }}>+ Onboard Tenant</button>
      </ViewToolbar>

      <Panel title={`Tenants ${selectedIds.length ? `(${selectedIds.length} selected)` : ''}`}>
        <ListState loading={loading} empty={filtered.length === 0} emptyTitle="No tenants found" emptyDesc="Register a tenant to link leases, invoices and documents.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  {canLease && (
                    <th style={{ width: 36, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer" }}
                        title="Select visible"
                      />
                    </th>
                  )}
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Contact</th>
                  <th>Lease Period</th>
                  <th>Status</th>
                  <th>Outstanding</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((t) => {
                  const isSelected = selectedIds.includes(String(t.id));
                  return (
                    <tr
                      key={String(t.id)}
                      onClick={() => onSelectRow(t)}
                      style={{ background: isSelected ? "rgba(59, 130, 246, 0.06)" : undefined }}
                    >
                      {canLease && (
                        <td style={{ textAlign: "center" }} onClick={(e) => toggleSelectOne(String(t.id), e)}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                      )}
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{String(t.name ?? "—")}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 4, display: "inline-block", marginTop: 3 }}>
                          {String(t.code ?? "—")}
                        </span>
                      </td>
                      <td>
                        {(t as any).units && (t as any).units.length > 1 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>
                              🏢 {(t as any).units.length} Units ({[...new Set((t as any).units.map((u: any) => u.floor).filter(Boolean))].map((f: any) => `Fl ${f}`).join(', ') || 'Multi-floor'})
                            </span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {(t as any).units.map((u: any, idx: number) => (
                                <span key={idx} style={{ fontSize: 11, fontWeight: 600, background: "var(--surface-sunken)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                                  {u.code}{u.floor ? ` (${u.floor})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{String(t.unit ?? "—")}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <div>{t.email ? <a href={`mailto:${t.email}`} onClick={e => e.stopPropagation()} style={{ color: "#2563eb", fontSize: 12, fontWeight: 500, textDecoration: "none" }}>{String(t.email)}</a> : <span className="muted">—</span>}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, fontWeight: 600 }}>{t.phone ? String(t.phone) : "—"}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {t.lease_start ? (
                          <>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmtDate(t.lease_start)}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>→ {t.lease_end ? fmtDate(t.lease_end) : "—"}</div>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>No lease</span>
                        )}
                      </td>
                      <td>
                        {t.status === "prospect" ? (
                          <Badge tone="yellow">Pending Activation</Badge>
                        ) : (
                          <StatusPill value={String(t.status ?? "—")} />
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: Number(t.outstanding ?? 0) > 0 ? "#dc2626" : "var(--text-secondary)", fontWeight: 700 }}>
                        {t.outstanding === undefined ? "—" : kM(t.outstanding)}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 5, alignItems: "center", justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          {t.status === "prospect" && canLease && (
                            <button
                              className="fc-toolbar-btn primary"
                              onClick={(e) => { e.stopPropagation(); void onActivate(t); }}
                              style={{ background: "#16a34a", borderColor: "#15803d", color: "#fff", fontWeight: 700, padding: "4px 8px", fontSize: 11, borderRadius: 6 }}
                              title="Activate this tenant and all draft leases"
                            >
                              ⚡ Activate
                            </button>
                          )}
                          <button
                            className="fc-toolbar-btn"
                            onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                            style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "5px 9px", fontSize: 11, fontWeight: 600, borderRadius: 6, color: "var(--text-primary)" }}
                            title="Edit tenant profile"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="fc-toolbar-btn"
                            data-testid="tenant-portal-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/tenant-portal?tenant=${t.id}`, "_blank", "noopener,noreferrer");
                            }}
                            style={{
                              background: "rgba(37, 99, 235, 0.08)",
                              border: "1px solid rgba(37, 99, 235, 0.25)",
                              color: "#2563eb",
                              padding: "5px 9px",
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 6,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                            title="Open tenant portal in a new tab (impersonate tenant view)"
                          >
                            🌐 Portal ↗
                          </button>
                          <button
                            className="fc-toolbar-btn"
                            onClick={(e) => { e.stopPropagation(); onUploadDoc(t); }}
                            style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "5px 9px", fontSize: 11, fontWeight: 600, borderRadius: 6, color: "var(--text-primary)" }}
                            title="Upload / view tenant documents"
                          >
                            📁 Docs
                          </button>
                          {canLease && (
                            <button
                              className="fc-toolbar-btn"
                              onClick={(e) => { e.stopPropagation(); onDelete(t); }}
                              style={{ background: "var(--surface)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#dc2626", padding: "5px 8px", fontSize: 11, fontWeight: 600, borderRadius: 6 }}
                              title="Delete duplicate or erroneous tenant"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
