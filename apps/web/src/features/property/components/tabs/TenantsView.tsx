"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  Box, Button, Checkbox, Chip, MenuItem, Paper, Select, Stack,
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
        <KpiCard icon="👥" iconBg="var(--color-indigo-bg)" iconColor="var(--color-indigo)" label="Tenants" value={kN(tenants.length)} sub="Registered tenants" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="✓" iconBg="var(--color-green-bg)" iconColor="var(--color-success)" label="Active" value={kN(active)} sub="Active tenancies" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="◌" iconBg="var(--color-amber-bg)" iconColor="var(--color-warning)" label="Prospects" value={kN(prospects)} sub="Pending activation" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="⚠️" iconBg="var(--color-red-bg)" iconColor="var(--color-danger)" label="Outstanding" value={kM(outstanding)} sub="Combined arrears" link="View arrears" onClick={() => setTab("arrears")} />
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
            style={{ background: "var(--color-success)", borderColor: "var(--color-success-strong)", fontWeight: 800, display: "flex", alignItems: "center", gap: 5 }}
          >
            {activating ? "Activating…" : `⚡ Bulk Activate (${selectedIds.length})`}
          </button>
        )}
        {prospects > 0 && selectedIds.length === 0 && canLease && (
          <button
            className="fc-toolbar-btn success"
            onClick={() => void handleActivateAllProspects()}
            disabled={activating}
            title="Activate all pending prospect tenants and their draft leases"
          >
            ⚡ Activate All Prospects ({prospects})
          </button>
        )}
        <button className="fc-toolbar-btn" onClick={() => exportCsv(filtered, [
          { key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "tenant_type", label: "Type" },
          { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
          { key: "unit", label: "Unit" }, { key: "status", label: "Status" },
          { key: "outstanding", label: "Outstanding" }, { key: "created_at", label: "Registered" },
        ], "tenants.csv")}>Export CSV</button>
        <button className="fc-toolbar-btn" onClick={() => onUploadDoc()}>Upload Document</button>
        {canLease && (
          <button
            className="fc-toolbar-btn"
            onClick={() => onBulkUpload()}
            title="Upload multiple tenants at once using a CSV file"
          >
            ⬆ Upload Tenants (CSV)
          </button>
        )}
        <button className="fc-toolbar-btn primary" onClick={() => onAdd()}>+ Onboard Tenant</button>
      </ViewToolbar>

      {!search.trim() ? (
        <Panel title="Find a tenant account">
          <Box sx={{ py: { xs: 4, md: 7 }, px: 2, textAlign: "center", maxWidth: 680, mx: "auto" }}>
            <Typography sx={{ fontSize: 34, mb: 1 }} aria-hidden="true">⌕</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Search before opening a tenant record</Typography>
            <Typography variant="body2" color="text.secondary">
              Use the search box above with a tenant name, house or unit number, tenant code, phone number, or email. Matching accounts will appear here, then select one to review its profile, statement, invoices, receipts, wallet, and messages.
            </Typography>
          </Box>
        </Panel>
      ) : (
        <Panel title={`Search results ${selectedIds.length ? `(${selectedIds.length} selected)` : ''}`}>
          <ListState loading={loading} empty={filtered.length === 0} emptyTitle="No tenants found" emptyDesc="Register a tenant to link leases, invoices and documents.">
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  {canLease && (
                    <TableCell padding="checkbox" sx={{ width: 48, textAlign: "center" }}>
                      <Checkbox
                        size="small"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all visible tenants"
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Unit</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Lease Period</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Outstanding</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedRows.map((t) => {
                  const isSelected = selectedIds.includes(String(t.id));
                  return (
                    <TableRow
                      key={String(t.id)}
                      hover
                      selected={isSelected}
                      onClick={() => onSelectRow(t)}
                      sx={{ cursor: "pointer" }}
                    >
                      {canLease && (
                        <TableCell padding="checkbox" sx={{ textAlign: "center" }} onClick={(e) => toggleSelectOne(String(t.id), e)}>
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={() => {}}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(t.name ?? "—")}</Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: "ui-monospace, monospace",
                            fontWeight: 700,
                            bgcolor: "action.hover",
                            border: "1px solid",
                            borderColor: "divider",
                            px: 0.75,
                            py: 0.2,
                            borderRadius: 0.5,
                            display: "inline-block",
                            mt: 0.5,
                          }}
                        >
                          {String(t.code ?? "—")}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {(t as any).units && (t as any).units.length > 1 ? (
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "info.main" }}>
                              🏢 {(t as any).units.length} Units ({[...new Set((t as any).units.map((u: any) => u.floor).filter(Boolean))].map((f: any) => `Fl ${f}`).join(', ') || 'Multi-floor'})
                            </Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {(t as any).units.map((u: any, idx: number) => (
                                <Chip
                                  key={idx}
                                  size="small"
                                  variant="outlined"
                                  label={`${u.code}${u.floor ? ` (${u.floor})` : ''}`}
                                  sx={{ fontSize: 11, height: 20 }}
                                />
                              ))}
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(t.unit ?? "—")}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.email ? (
                          <Typography
                            component="a"
                            href={`mailto:${t.email}`}
                            onClick={(e) => e.stopPropagation()}
                            variant="body2"
                            sx={{ color: "primary.main", textDecoration: "none", fontWeight: 500, display: "block" }}
                          >
                            {String(t.email)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, fontWeight: 600 }}>
                          {t.phone ? String(t.phone) : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {t.lease_start ? (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmtDate(t.lease_start)}</Typography>
                            <Typography variant="caption" color="text.secondary">→ {t.lease_end ? fmtDate(t.lease_end) : "—"}</Typography>
                          </>
                        ) : (
                          <Typography variant="caption" color="text.secondary">No lease</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.status === "prospect" ? (
                          <Chip size="small" label="Pending Activation" color="warning" sx={{ fontWeight: 700, fontSize: 11 }} />
                        ) : (
                          <StatusPill value={String(t.status ?? "—")} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: Number(t.outstanding ?? 0) > 0 ? "error.main" : "text.secondary",
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          {t.outstanding === undefined ? "—" : kM(t.outstanding)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          {t.status === "prospect" && canLease && (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={(e) => { e.stopPropagation(); void onActivate(t); }}
                              title="Activate this tenant and all draft leases"
                              sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11, fontWeight: 800 }}
                            >
                              ⚡ Activate
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                            title="Edit tenant profile"
                            sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }}
                          >
                            ✏️ Edit
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="info"
                            data-testid="tenant-portal-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/tenant-portal?tenant=${t.id}`, "_blank", "noopener,noreferrer");
                            }}
                            title="Open tenant portal in a new tab"
                            sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }}
                          >
                            🌐 Portal ↗
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => { e.stopPropagation(); onUploadDoc(t); }}
                            title="Upload / view tenant documents"
                            sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }}
                          >
                            📁 Docs
                          </Button>
                          {canLease && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={(e) => { e.stopPropagation(); onDelete(t); }}
                              title="Delete duplicate or erroneous tenant"
                              sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: 11 }}
                            >
                              🗑️
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </ListState>
      </Panel>
      )}
    </>
  );
}

/* ─── TENANT DOCUMENTS ─── */
