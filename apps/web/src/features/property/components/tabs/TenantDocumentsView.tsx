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

export function TenantDocumentsView({ rows, loading, search, setSearch, onUpload, onDownload, onVerify, onReject }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  onUpload: () => void; onDownload: (r: Row) => void; onVerify: (r: TenantDocumentRow) => void; onReject: (r: TenantDocumentRow) => void;
}) {
  const docs = rows as TenantDocumentRow[];

  return (
    <>
      <ViewToolbar title="Tenant Documents" subtitle="Uploaded identity, agreement and compliance documents" search={search} onSearch={setSearch} placeholder="Search by tenant, type or number…">
        <button className="btn primary sm" onClick={onUpload}>+ Upload</button>
      </ViewToolbar>

      <Panel title="Documents">
        <ListState loading={loading} empty={docs.length === 0} emptyTitle="No documents found" emptyDesc="Uploaded tenant documents such as IDs, KRA PINs and agreements appear here.">
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Document</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Number</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Uploaded</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Expires</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={String(d.id)} hover>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(d.document_type ?? "—")}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{String(d.tenant_name ?? "—")}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{String(d.document_type ?? "—")}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
                        {String(d.document_number ?? "—")}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{fmtDate(d.created_at)}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{fmtDate(d.expires_on)}</Typography></TableCell>
                    <TableCell align="center"><StatusPill value={String(d.status ?? "—")} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                        <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onDownload(d)}>Download</Button>
                        {d.status === "pending" && <Button size="small" variant="contained" color="success" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onVerify(d)}>Verify</Button>}
                        {d.status === "pending" && <Button size="small" variant="outlined" color="error" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onReject(d)}>Reject</Button>}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </ListState>
      </Panel>
    </>
  );
}

/* ─── LEASES ─── */

