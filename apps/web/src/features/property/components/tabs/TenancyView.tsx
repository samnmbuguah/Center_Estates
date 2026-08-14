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
  occupancyTone, shortId, exportCsv, exportLeaseICS,
} from "../../utils/property.utils";
import { UnitsView } from "./UnitsView";
import { TenantsView } from "./TenantsView";
import { LeasesView } from "./LeasesView";
import { TenantDocumentsView } from "./TenantDocumentsView";

export function TenancyView({
  unitsRows = [],
  tenantsRows = [],
  leasesRows = [],
  tenantDocsRows = [],
  documentsRows = [],
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  onAddTenant = () => {},
  onUploadDoc = () => {},
  onAddLease = () => {},
  onDownloadTemplate = () => {},
  onLeaseAction = () => {},
  onSelectTenantRow = () => {},
  onSelectLeaseRow = () => {},
  onSelectRow = () => {},
  onDownloadDocument = () => {},
  onDownloadDoc = () => {},
  onVerifyDocument = () => {},
  onVerifyDoc = () => {},
  onRejectDocument = () => {},
  onRejectDoc = () => {},
  onOpenPortal = () => {},
  onDownloadStatement = () => {},
  onRenewLease = () => {},
  onTerminateLease = () => {},
  onRefresh = () => {},
  canLease = true,
  activeSection = "tenants",
  onSectionChange,
}: {
  unitsRows?: Row[];
  tenantsRows?: Row[];
  leasesRows?: Row[];
  tenantDocsRows?: Row[];
  documentsRows?: Row[];
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  onAddTenant?: () => void;
  onUploadDoc?: () => void;
  onAddLease?: () => void;
  onDownloadTemplate?: () => void;
  onLeaseAction?: (r: LeaseRow, action: "activate" | "renew" | "terminate") => void;
  onSelectTenantRow?: (r: Row) => void;
  onSelectLeaseRow?: (r: Row) => void;
  onSelectRow?: (r: Row) => void;
  onDownloadDocument?: (r: Row) => void;
  onDownloadDoc?: (r: Row) => void;
  onVerifyDocument?: (r: TenantDocumentRow) => void;
  onVerifyDoc?: (r: TenantDocumentRow) => void;
  onRejectDocument?: (r: TenantDocumentRow) => void;
  onRejectDoc?: (r: TenantDocumentRow) => void;
  onOpenPortal?: (r: Row) => void;
  onDownloadStatement?: (r: TenantRow) => void;
  onRenewLease?: (r: LeaseRow) => void;
  onTerminateLease?: (r: LeaseRow) => void;
  onRefresh?: () => void;
  canLease?: boolean;
  activeSection?: TenancySection;
  onSectionChange?: (s: TenancySection) => void;
  onUploadTenantDoc?: (t: Row) => void;
}) {
  const [localSection, setLocalSection] = useState<TenancySection>(activeSection || "tenants");
  const section = activeSection || localSection;
  const docs = documentsRows.length > 0 ? documentsRows : tenantDocsRows;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {section === "occupancy" && (
        <UnitsView rows={unitsRows} loading={loading} search={search} setSearch={setSearch} setTab={setTab} />
      )}
      {section === "tenants" && (
        <TenantsView rows={tenantsRows} loading={loading} search={search} setSearch={setSearch} setTab={setTab} onAdd={onAddTenant} onUploadDoc={onUploadDoc} onSelectRow={onSelectTenantRow} onOpenPortal={onOpenPortal} onDownloadStatement={onDownloadStatement} />
      )}
      {section === "leases" && (
        <LeasesView rows={leasesRows} loading={loading} search={search} setSearch={setSearch} setTab={setTab} onAddLease={onAddLease} onDownloadTemplate={onDownloadTemplate} onLeaseAction={onLeaseAction} onSelectRow={onSelectLeaseRow} />
      )}
      {section === "documents" && (
        <TenantDocumentsView rows={docs} loading={loading} search={search} setSearch={setSearch} onUpload={onUploadDoc} onDownload={onDownloadDoc || onDownloadDocument} onVerify={onVerifyDoc || onVerifyDocument} onReject={onRejectDoc || onRejectDocument} />
      )}
    </div>
  );
}

/* ─── TENANT PORTAL DRAWER ─── */

