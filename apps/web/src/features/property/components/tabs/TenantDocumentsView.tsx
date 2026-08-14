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
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Tenant</th>
                  <th>Type</th>
                  <th>Number</th>
                  <th>Uploaded</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={String(d.id)}>
                    <td><strong style={{ fontSize: 12 }}>{String(d.document_type ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(d.tenant_name ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(d.document_type ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(d.document_number ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(d.created_at)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(d.expires_on)}</td>
                    <td><StatusPill value={String(d.status ?? "—")} /></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn ghost sm" onClick={() => onDownload(d)}>Download</button>
                        {d.status === "pending" && <button className="btn primary sm" onClick={() => onVerify(d)}>Verify</button>}
                        {d.status === "pending" && <button className="btn ghost sm" onClick={() => onReject(d)}>Reject</button>}
                      </div>
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

/* ─── LEASES ─── */

