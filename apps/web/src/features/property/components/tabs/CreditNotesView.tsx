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
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>CN No</th>
                  <th>Date</th>
                  <th>Tenant</th>
                  <th>Invoice</th>
                  <th>Reason</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((c) => (
                  <tr key={String(c.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(c.number ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(c.issued_on)}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(c.tenant_name ?? "—")}</strong></td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(c.invoice_number ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(c.reason ?? "—")}</td>
                    <td className="mono" style={{ color: "var(--danger)" }}>{kM(c.amount)}</td>
                    <td><StatusPill value={String(c.status ?? "—")} /></td>
                    <td>
                      {c.status === "void" ? (
                        <span className="muted" style={{ fontSize: 12 }}>Voided</span>
                      ) : (
                        <div className="row" style={{ gap: 4 }}>
                          <button className="btn ghost sm" onClick={() => setTab("rent")}>View Invoice</button>
                          <button className="btn ghost sm" style={{ color: "var(--danger)" }} onClick={() => onVoid(c)}>Void</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
    </>
  );
}

/* ─── FINANCIALS (consolidated collection interfaces) ─── */

