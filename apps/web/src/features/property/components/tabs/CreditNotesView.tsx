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

export function CreditNotesView({ rows, loading, search, setSearch, setTab, onAdd, onVoid }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void; onAdd: () => void; onVoid: (cn: CreditNoteRow) => void;
}) {
  const notes = rows as CreditNoteRow[];

  return (
    <>
      <ViewToolbar title="Credit Notes" subtitle="Issued credit adjustments against invoices" search={search} onSearch={setSearch} placeholder="Search credit note, invoice or tenant…">
        <button className="btn primary sm" onClick={onAdd}>+ Issue credit note</button>
      </ViewToolbar>

      <Panel title="Credit Notes">
        <ListState loading={loading} empty={notes.length === 0} emptyTitle="No credit notes found" emptyDesc="Credit notes issued against invoices appear here.">
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>CN No</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Invoice</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Reason</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Amount</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notes.map((c) => (
                  <TableRow key={String(c.id)} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main", fontWeight: 600 }}>
                        {String(c.number ?? "—")}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{fmtDate(c.issued_on)}</Typography></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{String(c.tenant_name ?? "—")}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
                        {String(c.invoice_number ?? "—")}
                      </Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{String(c.reason ?? "—")}</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "error.main", fontWeight: 700 }}>
                        {kM(c.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center"><StatusPill value={String(c.status ?? "—")} /></TableCell>
                    <TableCell align="right">
                      {c.status === "void" ? (
                        <Typography variant="caption" color="text.disabled">Voided</Typography>
                      ) : (
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                          <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => setTab("rent")}>
                            View Invoice
                          </Button>
                          <Button size="small" variant="outlined" color="error" sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }} onClick={() => onVoid(c)}>
                            Void
                          </Button>
                        </Stack>
                      )}
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

/* ─── FINANCIALS (consolidated collection interfaces) ─── */

