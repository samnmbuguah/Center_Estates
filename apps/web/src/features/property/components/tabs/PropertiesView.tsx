"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Chip, MenuItem, TextField, Typography, Grid } from "@mui/material";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";
import { ViewToolbar, ListState, SubTabs } from "../PropertyToolbar";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { InteractiveDashboard } from "@/components/interactive-dashboard";
import { BreadcrumbNavigation } from "@/components/breadcrumb-navigation";
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
import { Building2, DollarSign, Users, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

export function PropertiesView({
  rows, loading, search, setSearch, setTab, onAdd, onSelectRow,
}: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void; onAdd: () => void; onSelectRow: (r: Row) => void;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const props = rows as PropertyRow[];
  const filtered = props;
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalUnits = props.reduce((s, p) => s + Number(p.units_count ?? 0), 0);
  const totalBuildings = props.reduce((s, p) => s + Number(p.buildings_count ?? 0), 0);
  const active = props.filter((p) => p.status === "active").length;
  const totalOccupied = props.reduce((s, p) => s + Number(p.occupied ?? 0), 0);
  const vacant = Math.max(totalUnits - totalOccupied, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

  return (
    <>
      <BreadcrumbNavigation />
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "#4f46e5", color: "white",
            textAlign: "center"
          }}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{props.length}</Typography>
            <Typography variant="caption">Properties</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "#2563eb", color: "white",
            textAlign: "center"
          }}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{kN(totalUnits)}</Typography>
            <Typography variant="caption">Total Units</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "#d97706", color: "white",
            textAlign: "center"
          }}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{kN(totalBuildings)}</Typography>
            <Typography variant="caption">Buildings</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "#16a34a", color: "white",
            textAlign: "center"
          }}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{occupancyRate}%</Typography>
            <Typography variant="caption">Occupancy</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "#22c55e", color: "white",
            textAlign: "center"
          }}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              KES {props.reduce((sum, p) => sum + Number(p.monthly_rent || 0), 0).toLocaleString()}
            </Typography>
            <Typography variant="caption">Monthly Revenue</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: active ? "#16a34a" : "#ef4444", color: "white",
            textAlign: "center"
          }}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{active ? "Active" : "Inactive"}</Typography>
            <Typography variant="caption">Status</Typography>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Property Portfolio
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<Building2 size={16} />}
          onClick={onAdd}
          sx={{ bgcolor: "#d92d2d", "&:hover": { bgcolor: "#b91c1c" } }}
        >
          Add Property
        </Button>
      </Box>

      <Panel title="Selected Property">
        <ListState loading={loading} empty={filtered.length === 0} emptyTitle="No property selected" emptyDesc="Choose a property from the selector at the top of the workspace.">
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
                      <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); router.push(`/property-onboarding?edit=${p.id}`); }}>Edit</button>
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
