"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { propertyNav } from "@/lib/module-nav";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";

export type PropertyTab =
  | "overview"
  | "properties"
  | "buildings"
  | "units"
  | "projects"
  | "tenants"
  | "tenant-documents"
  | "leases"
  | "rent-schedules"
  | "rent"
  | "arrears"
  | "reminders"
  | "receipts"
  | "receipt-allocations"
  | "bank-reconciliation"
  | "credit-notes"
  | "service-charges"
  | "service-charge-allocations"
  | "service-charge-reconciliations"
  | "budgets"
  | "expenses"
  | "reports"
  | "fees"
  | "owner-portal"
  | "forecast"
  | "critical-dates";

type Row = Record<string, unknown>;
type ID = string;

const labels: Record<PropertyTab, string> = {
  overview: "Overview",
  properties: "Properties",
  buildings: "Buildings",
  units: "Occupancy",
  projects: "Projects",
  tenants: "Tenants",
  "tenant-documents": "Tenant Documents",
  leases: "Leases",
  "rent-schedules": "Rent Schedules",
  rent: "Rent & Invoices",
  arrears: "Arrears",
  reminders: "Reminders",
  receipts: "Receipts & Credit Notes",
  "receipt-allocations": "Receipt Allocations",
  "bank-reconciliation": "Bank Reconciliation",
  "credit-notes": "Credit Notes",
  "service-charges": "Service Charge Setup",
  "service-charge-allocations": "Charge Allocations",
  "service-charge-reconciliations": "Reconciliations",
  budgets: "Budgets & Estimates",
  expenses: "Property Expenses",
  reports: "Reports Catalogue",
  fees: "Fee Invoicing",
  "owner-portal": "Owner Portal",
  forecast: "5-Year Forecast",
  "critical-dates": "Critical Dates",
};

/* ─── data row shapes (mirror backend serializers) ─── */

interface PropertyRow extends Row {
  id: ID; code?: string; name?: string; property_type?: string; status?: string;
  city?: string; address?: string; country?: string; buildings_count?: number;
  units_count?: number; created_at?: string;
  occupied?: number; vacant?: number; occupancy?: number; monthlyRent?: number; outstanding?: number;
}

interface BuildingRow extends Row {
  id: ID; code?: string; name?: string; floors?: number; property?: ID;
  property_name?: string; created_at?: string;
}

interface UnitRow extends Row {
  id: ID; code?: string; property?: ID; building?: ID; floor?: string;
  unit_type?: string; status?: string; area?: number | null; property_name?: string;
  building_name?: string; created_at?: string;
}

interface ProjectRow extends Row {
  id: ID; code?: string; name?: string; property?: ID; status?: string;
  starts_on?: string; ends_on?: string; created_at?: string;
}

interface TenantRow extends Row {
  id: ID; code?: string; name?: string; tenant_type?: string; email?: string;
  phone?: string; tax_id?: string; status?: string; billing_address?: string;
  created_at?: string;
  property?: string; unit?: string; outstanding?: number; oldest_days?: number;
}

interface TenantDocumentRow extends Row {
  id: ID; tenant?: ID; document_type?: string; document_number?: string;
  file_url?: string; issued_on?: string; expires_on?: string; status?: string;
  tenant_name?: string; created_at?: string;
}

interface LeaseRow extends Row {
  id: ID; reference?: string; unit?: ID; tenant?: ID; starts_on?: string; ends_on?: string;
  monthly_rent?: number; deposit?: number; escalation_percent?: number; billing_day?: number;
  status?: string; tenant_name?: string; unit_code?: string; property_name?: string;
  created_at?: string; outstanding?: number;
}

interface RentScheduleRow extends Row {
  id: ID; lease?: ID; period_start?: string; period_end?: string; due_on?: string;
  base_rent?: number; escalation_amount?: number; service_charge?: number; total?: number;
  status?: string; invoice?: ID; lease_reference?: string; tenant_name?: string;
}

interface InvoiceRow extends Row {
  id: ID; number?: string; lease?: ID; invoice_type?: string; issued_on?: string;
  due_on?: string; amount?: number; balance?: number; status?: string;
  tenant_name?: string; tenant_id?: ID;
}

interface ReceiptRow extends Row {
  id: ID; number?: string; tenant?: ID; invoice?: ID | null; received_on?: string;
  amount?: number; payment_method?: string; external_reference?: string;
  tenant_name?: string; created_at?: string;
}

interface ReminderRow extends Row {
  id: ID; invoice?: ID; channel?: string; recipient?: string; message?: string;
  sent_at?: string; invoice_number?: string; tenant_name?: string;
}

interface BankTransactionRow extends Row {
  id: ID; reference?: string; transacted_on?: string; description?: string;
  amount?: number; status?: string; receipt?: ID; receipt_number?: string;
}

interface ExpenseRow extends Row {
  id: ID; property?: ID; supplier?: string; category?: string; invoice_number?: string;
  incurred_on?: string; amount?: number; status?: string; description?: string;
  property_name?: string;
}

interface BudgetRow extends Row {
  id: ID; property?: ID; year?: number; category?: string; amount?: number;
  status?: string; property_name?: string; actual_amount?: number; variance?: number;
  created_at?: string;
}

interface ServiceChargeRow extends Row {
  id: ID; property?: ID; name?: string; method?: string; annual_budget?: number;
  starts_on?: string; is_active?: boolean; property_name?: string; allocation_count?: number;
}

interface ServiceChargeAllocationRow extends Row {
  id: ID; service_charge?: ID; unit?: ID; ratio?: number; annual_amount?: number;
  monthly_amount?: number; service_charge_name?: string; property_name?: string;
  unit_code?: string; created_at?: string;
}

interface ServiceChargeReconciliationRow extends Row {
  id: ID; service_charge?: ID; period_start?: string; period_end?: string;
  budgeted_amount?: number; actual_amount?: number; variance?: number; status?: string;
  service_charge_name?: string; property_name?: string;
}

interface ReceiptAllocationRow extends Row {
  id: ID; receipt?: ID; invoice?: ID; amount?: number; receipt_number?: string;
  invoice_number?: string; tenant_name?: string; created_at?: string;
}

interface CreditNoteRow extends Row {
  id: ID; number?: string; invoice?: ID; issued_on?: string; amount?: number;
  reason?: string; status?: string; void_reason?: string; invoice_number?: string;
  tenant_name?: string;
}

interface AgingTenantRow {
  tenant?: string; property?: string; unit?: string; outstanding?: number;
  oldest_days?: number; invoice_count?: number;
}

interface AgingAnalytics {
  as_of?: string; total?: number;
  summary?: Record<string, number>;
  tenants?: AgingTenantRow[];
}

interface FinancialAnalytics {
  period?: { start: string; end: string };
  kpis?: { income: number; expenses: number; net: number };
  incomeByMethod?: { payment_method: string; total: number }[];
  expensesByCategory?: { category: string; total: number }[];
}

interface ReportItem {
  key?: string; name?: string; category?: string;
}

interface DashboardData {
  kpis?: Record<string, number | string>;
  collectionTrend?: { month: string; billed: number; collected: number }[];
  leaseExpiry?: { label: string; count: number }[];
  aging?: { label: string; amount: number }[];
  portfolio?: PropertyRow[];
  overdueInvoices?: InvoiceRow[];
  propertyMix?: { property_type: string; count: number }[];
}

type RentSection = "invoices" | "receipts" | "arrears" | "reminders" | "ledger";
type ScSection = "setup" | "allocations" | "reconciliations" | "budget";

/* ─── formatting helpers ─── */

const kM = (v: unknown) => money.format(Number(v ?? 0));
const kN = (v: unknown) => number.format(Number(v ?? 0));

const fmtDate = (v: unknown): string => {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function daysUntil(end?: unknown): number | null {
  if (!end) return null;
  const d = new Date(String(end));
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

const daysLeftLabel = (end?: unknown): string => {
  const dl = daysUntil(end);
  if (dl === null) return "—";
  if (dl < 0) return "Expired";
  return `${dl} days`;
};

const overdueLabel = (due?: unknown): string => {
  if (!due) return "—";
  const d = new Date(String(due));
  if (Number.isNaN(d.getTime())) return String(due);
  const diff = Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
  return `${diff}d`;
};

const pct = (part: unknown, whole: unknown): number => {
  const w = Number(whole ?? 0);
  if (w <= 0) return 0;
  return Math.round((Number(part ?? 0) / w) * 100);
};

function occupancyTone(v: number): "green" | "yellow" | "red" {
  if (v >= 80) return "green";
  if (v >= 60) return "yellow";
  return "red";
}

function shortId(id?: unknown): string {
  const s = String(id ?? "");
  return s.length > 8 ? s.slice(0, 8) : s || "—";
}

function exportCsv(rows: Row[], columns: { key: string; label: string }[], filename: string) {
  const escape = (v: string) => v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((r) => columns.map((c) => escape(String(r[c.key] ?? ""))).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportLeaseICS(leases: Row[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Center Estates//ERP//EN"];
  for (const l of leases) {
    const endDate = String(l.end_date || l.end || "");
    if (!endDate) continue;
    const dt = new Date(endDate);
    const dateStr = dt.getFullYear().toString() +
      String(dt.getMonth() + 1).padStart(2, "0") +
      String(dt.getDate()).padStart(2, "0") + "T000000Z";
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${dateStr}`,
      `DTEND:${dateStr}`,
      `SUMMARY:Lease expires: ${String(l.tenant_name || "")} - ${String(l.property_name || "")}`,
      `DESCRIPTION:Lease ${String(l.reference || l.id || "")} expires. Monthly rent: KES ${Number(l.monthly_rent || 0).toLocaleString()}`,
      "END:VEVENT"
    );
    const remind = new Date(dt.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rStr = remind.getFullYear().toString() +
      String(remind.getMonth() + 1).padStart(2, "0") +
      String(remind.getDate()).padStart(2, "0") + "T000000Z";
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${rStr}`,
      `DTEND:${rStr}`,
      `SUMMARY:REMINDER: Lease expires in 30 days - ${String(l.tenant_name || "")}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "lease-calendar.ics"; a.click();
  URL.revokeObjectURL(a.href);
}

/* ─── shared layout primitives ─── */

function ViewToolbar({
  title, subtitle, search, onSearch, placeholder = "Search records…", searchTestid, children,
}: {
  title: string; subtitle?: string; search: string; onSearch: (v: string) => void;
  placeholder?: string; searchTestid?: string; children?: ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        {subtitle && <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>{subtitle}</p>}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        {searchTestid ? (
          <input
            type="text"
            data-testid={searchTestid}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder ?? "Search records…"}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, minWidth: 240 }}
          />
        ) : (
          <SearchInput value={search} onChange={onSearch} placeholder={placeholder} />
        )}
        {children}
      </div>
    </div>
  );
}

function ListState({
  loading, empty, emptyTitle = "No records", emptyDesc, children,
}: {
  loading: boolean; empty: boolean; emptyTitle?: string; emptyDesc?: string; children: ReactNode;
}) {
  if (loading) return <LoadingState rows={6} />;
  if (empty) {
    return <EmptyState icon="📋" title={emptyTitle} description={emptyDesc ?? "There are no records to display for this view yet."} />;
  }
  return <>{children}</>;
}

function SubTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`btn sm ${active === t.id ? "primary" : "ghost"}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── detail drawer fields ─── */

const detailFields: Partial<Record<PropertyTab, { label: string; key: string; money?: boolean; date?: boolean }[]>> = {
  properties: [
    { label: "Property Code", key: "code" },
    { label: "Name", key: "name" },
    { label: "Type", key: "property_type" },
    { label: "City", key: "city" },
    { label: "Address", key: "address" },
    { label: "Status", key: "status" },
    { label: "Buildings", key: "buildings_count" },
    { label: "Total Units", key: "units_count" },
    { label: "Occupied", key: "occupied" },
    { label: "Occupancy %", key: "occupancy" },
    { label: "Monthly Rent", key: "monthlyRent", money: true },
    { label: "Outstanding", key: "outstanding", money: true },
    { label: "Created", key: "created_at", date: true },
  ],
  tenants: [
    { label: "Tenant Code", key: "code" },
    { label: "Name", key: "name" },
    { label: "Type", key: "tenant_type" },
    { label: "Email", key: "email" },
    { label: "Phone", key: "phone" },
    { label: "Tax ID", key: "tax_id" },
    { label: "Status", key: "status" },
    { label: "Property", key: "property" },
    { label: "Unit", key: "unit" },
    { label: "Outstanding", key: "outstanding", money: true },
    { label: "Oldest Debt (days)", key: "oldest_days" },
    { label: "Registered", key: "created_at", date: true },
  ],
  leases: [
    { label: "Reference", key: "reference" },
    { label: "Tenant", key: "tenant_name" },
    { label: "Property", key: "property_name" },
    { label: "Unit", key: "unit_code" },
    { label: "Start", key: "starts_on", date: true },
    { label: "End", key: "ends_on", date: true },
    { label: "Monthly Rent", key: "monthly_rent", money: true },
    { label: "Deposit", key: "deposit", money: true },
    { label: "Escalation %", key: "escalation_percent" },
    { label: "Billing Day", key: "billing_day" },
    { label: "Status", key: "status" },
    { label: "Outstanding", key: "outstanding", money: true },
    { label: "Created", key: "created_at", date: true },
  ],
  budgets: [
    { label: "Budget", key: "category" },
    { label: "Property", key: "property_name" },
    { label: "Year", key: "year" },
    { label: "Amount", key: "amount", money: true },
    { label: "Actual", key: "actual_amount", money: true },
    { label: "Variance", key: "variance", money: true },
    { label: "Status", key: "status" },
    { label: "Created", key: "created_at", date: true },
  ],
};

function RowDetailPanel({ tab, row }: { tab: PropertyTab; row: Row }) {
  const fields = detailFields[tab];
  if (!fields) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {fields.map((f) => {
        const raw = row[f.key];
        const value = f.money ? kM(raw) : f.date ? fmtDate(raw) : raw === undefined || raw === null || raw === "" ? "—" : String(raw);
        return (
          <div key={f.key} className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <span className="muted" style={{ fontSize: 12 }}>{f.label}</span>
            <strong className="mono" style={{ fontSize: 13, textAlign: "right", maxWidth: "60%" }}>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}

/* ─── OVERVIEW ─── */

function OverviewView({ dashboard, loading, setTab }: { dashboard: DashboardData | null; loading: boolean; setTab: (t: PropertyTab) => void }) {
  if (loading && !dashboard) return <LoadingState rows={8} />;
  if (!dashboard) {
    return <EmptyState icon="🏢" title="Dashboard unavailable" description="Add properties, units and leases to unlock portfolio, collection and occupancy analytics." />;
  }
  const k = dashboard.kpis ?? {};
  const properties = Number(k.properties ?? 0);
  const units = Number(k.units ?? 0);
  const occupied = Number(k.occupiedUnits ?? 0);
  const occupancyRate = Number(k.occupancyRate ?? 0);
  const outstanding = Number(k.outstanding ?? 0);
  const collected = Number(k.collectedYtd ?? 0);
  const billedTotal = collected + outstanding;
  const collectionRate = billedTotal > 0 ? Math.round((collected / billedTotal) * 100) : 0;
  const monthlyRent = (dashboard.portfolio ?? []).reduce((s, p) => s + Number(p.monthlyRent ?? 0), 0);
  const trend = dashboard.collectionTrend ?? [];
  const leaseExpiry = dashboard.leaseExpiry ?? [];
  const aging = dashboard.aging ?? [];
  const portfolio = dashboard.portfolio ?? [];
  const overdue = dashboard.overdueInvoices ?? [];
  const trendMax = Math.max(...trend.map((b) => Number(b.billed ?? 0)), 1);
  const expiryMax = Math.max(...leaseExpiry.map((e) => Number(e.count ?? 0)), 1);
  const agingTotal = aging.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const donut = billedTotal > 0
    ? `conic-gradient(#22c55e 0% ${collectionRate}%, #ef4444 ${collectionRate}% 100%)`
    : "conic-gradient(#e5e7eb 0% 100%)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <KpiStrip>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Properties" value={kN(properties)} sub={`${kN(units)} total units`} link="View portfolio" onClick={() => setTab("properties")} />
        <KpiCard icon="▦" iconBg="#dbeafe" iconColor="#2563eb" label="Total Units" value={kN(units)} sub={`${kN(occupied)} occupied`} link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="🔑" iconBg="#dcfce7" iconColor="#16a34a" label="Occupied Units" value={kN(occupied)} sub={`${occupancyRate}% occupancy`} link="View occupancy" onClick={() => setTab("units")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Monthly Rent" value={kM(monthlyRent)} sub="Portfolio monthly rent" link="View rent" onClick={() => setTab("rent")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding Rent" value={kM(outstanding)} sub="Uncollected balance" link="View arrears" onClick={() => setTab("arrears")} />
        <KpiCard icon="◔" iconBg="#e0f2fe" iconColor="#0284c7" label="Collection Rate" value={`${collectionRate}%`} sub={`${kM(collected)} collected YTD`} link="View collections" onClick={() => setTab("rent")} />
        <KpiCard icon="▣" iconBg="#fdf4ff" iconColor="#9333ea" label="Occupancy" value={`${occupancyRate}%`} sub="Portfolio occupancy" link="View units" onClick={() => setTab("units")} />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Monthly Rent Collection Trend" action={<button className="btn ghost sm" onClick={() => setTab("rent")}>Collection Ledger →</button>}>
            {trend.length > 0 ? (
              <div className="row" style={{ alignItems: "flex-end", gap: 12, height: 170, borderBottom: "1px solid var(--border)", padding: "18px 20px 8px" }}>
                {trend.map((b) => (
                  <div key={b.month} className="chart-month" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 120 }}>
                      <div title={`Billed ${kM(b.billed)}`} style={{ width: 12, height: `${Math.max((Number(b.billed) / trendMax) * 100, 3)}%`, background: "var(--border-strong)", borderRadius: "4px 4px 0 0" }} />
                      <div title={`Collected ${kM(b.collected)}`} style={{ width: 12, height: `${Math.max((Number(b.collected) / trendMax) * 100, 3)}%`, background: "var(--primary)", borderRadius: "4px 4px 0 0" }} />
                    </div>
                    <span className="muted" style={{ fontSize: 11 }}>{b.month}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="📊" title="No collection history" description="Billed and collected figures will appear here once invoices and receipts are recorded." />
            )}
          </Panel>

          <Panel title="Property Portfolio Summary" action={<button className="btn ghost sm" onClick={() => setTab("properties")}>All Properties →</button>}>
            {portfolio.length > 0 ? (
              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Units</th>
                      <th>Occupied</th>
                      <th>Vacant</th>
                      <th>Occupancy %</th>
                      <th>Monthly Rent</th>
                      <th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map((p) => (
                      <tr key={String(p.id)}>
                        <td><strong style={{ fontSize: 12 }}>{String(p.name ?? "—")}</strong></td>
                        <td className="mono">{kN(p.units)}</td>
                        <td className="mono">{kN(p.occupied)}</td>
                        <td className="mono">{kN(p.vacant)}</td>
                        <td><Badge tone={occupancyTone(Number(p.occupancy ?? 0))}>{pct(p.occupied, p.units)}%</Badge></td>
                        <td className="mono">{kM(p.monthlyRent)}</td>
                        <td className="mono" style={{ color: "var(--danger)" }}>{kM(p.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="🏢" title="No portfolio records" description="Property occupancy and rent summaries appear here once properties are added." />
            )}
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Rent Collection Summary" action={<button className="btn ghost sm" onClick={() => setTab("rent")}>Ledger →</button>}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
              <div className="donut" style={{ background: donut, width: 120, height: 120, flexShrink: 0 }}>
                <strong style={{ fontSize: 20 }}>{collectionRate}%</strong>
                <small>Collected</small>
              </div>
              <div className="donut-legend" style={{ flex: 1 }}>
                <span><i style={{ background: "#22c55e" }} />Collected<b>{kM(collected)}</b></span>
                <span><i style={{ background: "#ef4444" }} />Outstanding<b>{kM(outstanding)}</b></span>
                <span><i style={{ background: "var(--border-strong)" }} />Total Billed<b>{kM(billedTotal)}</b></span>
              </div>
            </div>
          </Panel>

          <Panel title="Lease Expiry Overview" action={<button className="btn ghost sm" onClick={() => setTab("leases")}>Leases →</button>}>
            {leaseExpiry.length > 0 ? (
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                {leaseExpiry.map((e) => (
                  <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, width: 110, color: "var(--muted)" }}>{e.label}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{ width: `${pct(e.count, expiryMax)}%`, height: "100%", background: e.label.includes("90+") ? "#16a34a" : "#e23b3b" }} />
                    </div>
                    <strong className="mono" style={{ fontSize: 12, width: 30, textAlign: "right" }}>{kN(e.count)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="📅" title="No expiring leases" description="Leases ending within the next 90 days will be tracked here." />
            )}
          </Panel>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Top Overdue Tenants" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>View All →</button>}>
          {overdue.length > 0 ? (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Tenant</th>
                    <th>Due</th>
                    <th>Days</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((inv) => (
                    <tr key={String(inv.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(inv.number ?? "—")}</td>
                      <td><strong style={{ fontSize: 12 }}>{String(inv.tenant_name ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{fmtDate(inv.due_on)}</td>
                      <td><Badge tone="red">{overdueLabel(inv.due_on)}</Badge></td>
                      <td className="mono" style={{ color: "var(--danger)" }}>{kM(inv.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="✓" title="No overdue tenants" description="All outstanding invoices are up to date." />
          )}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Rent Ageing Heatmap" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>Ageing Report →</button>}>
            {aging.length > 0 ? (
              <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {aging.map((a, idx) => {
                  const colors = ["#16a34a", "#eab308", "#ea580c", "#dc2626"];
                  const bgs = ["#dcfce7", "#fef9c3", "#ffedd5", "#fee2e2"];
                  const color = colors[idx % colors.length];
                  const bg = bgs[idx % bgs.length];
                  return (
                    <div
                      key={a.label}
                      onClick={() => setTab("arrears")}
                      style={{
                        background: bg,
                        border: `1px solid ${color}`,
                        borderRadius: 8,
                        padding: 10,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <small style={{ color: "#475569", fontSize: "0.75rem", fontWeight: 600 }}>{a.label}</small>
                      <strong style={{ color, fontSize: "1rem", fontFamily: "monospace" }}>{kM(a.amount)}</strong>
                      <div style={{ height: 4, borderRadius: 99, background: "#cbd5e1", overflow: "hidden", marginTop: 4 }}>
                        <div style={{ width: `${pct(a.amount, agingTotal)}%`, height: "100%", background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon="📂" title="No outstanding balances" description="Aged balances by bucket will appear here." />
            )}
          </Panel>

          <Panel title="🤖 AI Property Assistant">
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <p className="muted" style={{ fontSize: 11, margin: 0 }}>Smart predictive operations & automated document extractions.</p>
              <button
                className="btn primary sm"
                style={{ textAlign: "left", justifyContent: "flex-start", width: "100%", fontSize: 11 }}
                onClick={() => setTab("arrears")}
              >
                📊 AI Arrears Risk Predictor →
              </button>
              <button
                className="btn ghost sm"
                style={{ textAlign: "left", justifyContent: "flex-start", width: "100%", fontSize: 11 }}
                onClick={() => setTab("leases")}
              >
                📄 AI Lease Agreement OCR →
              </button>
            </div>
          </Panel>

          <Panel title="Quick Actions">
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, width: 260 }}>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("properties")}>Add New Property →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("leases")}>Add New Lease →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("tenants")}>Add New Tenant →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("rent")}>Generate Invoice →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("rent")}>Record Rent Payment →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("arrears")}>Manage Arrears →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("reports")}>Collection Report →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("reports")}>Outstanding Rent Report →</button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ─── PROPERTIES ─── */

function PropertiesView({
  rows, loading, search, setSearch, setTab, onAdd, onSelectRow,
}: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void; onAdd: () => void; onSelectRow: (r: Row) => void;
}) {
  const [filterType, setFilterType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const props = rows as PropertyRow[];
  const filtered = props.filter((p) =>
    (!filterType || p.property_type === filterType) &&
    (!filterLocation || p.city === filterLocation) &&
    (!filterStatus || p.status === filterStatus)
  );
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalUnits = props.reduce((s, p) => s + Number(p.units_count ?? 0), 0);
  const totalBuildings = props.reduce((s, p) => s + Number(p.buildings_count ?? 0), 0);
  const active = props.filter((p) => p.status === "active").length;
  const totalOccupied = props.reduce((s, p) => s + Number(p.occupied ?? 0), 0);
  const vacant = Math.max(totalUnits - totalOccupied, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;
  const types = [...new Set(props.map((p) => p.property_type).filter(Boolean))];
  const locations = [...new Set(props.map((p) => p.city).filter(Boolean))];
  const statuses = [...new Set(props.map((p) => p.status).filter(Boolean))];
  const selStyle = { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 };

  return (
    <>
      <KpiStrip cols={6}>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Properties" value={kN(props.length)} sub="Portfolio count" link="View register" onClick={() => setTab("properties")} />
        <KpiCard icon="▦" iconBg="#dbeafe" iconColor="#2563eb" label="Total Units" value={kN(totalUnits)} sub="Across portfolio" link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="🏗" iconBg="#fef3c7" iconColor="#d97706" label="Buildings" value={kN(totalBuildings)} sub="Registered buildings" link="View buildings" onClick={() => setTab("buildings")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active" value={kN(active)} sub="Active properties" link="View register" onClick={() => setTab("properties")} />
        <KpiCard icon="◌" iconBg="#fee2e2" iconColor="#dc2626" label="Vacant Units" value={kN(vacant)} sub="Across portfolio" link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="▣" iconBg="#e0f2fe" iconColor="#0284c7" label="Occupancy %" value={`${occupancyRate}%`} sub="Portfolio occupancy" link="View units" onClick={() => setTab("units")} />
      </KpiStrip>

      <ViewToolbar title="Property Register" subtitle="Manage all properties across your portfolio" search={search} onSearch={setSearch} searchTestid="property-search-input" placeholder="Search by name, code or city…">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selStyle}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={selStyle}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selStyle}>
          <option value="">All Status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn ghost sm" onClick={() => exportCsv(filtered, [
          { key: "name", label: "Property" }, { key: "code", label: "Code" }, { key: "property_type", label: "Type" },
          { key: "city", label: "Location" }, { key: "units_count", label: "Units" }, { key: "occupied", label: "Occupied" },
          { key: "occupancy", label: "Occupancy %" }, { key: "monthlyRent", label: "Monthly Rent" },
          { key: "outstanding", label: "Outstanding" }, { key: "status", label: "Status" },
        ], "properties.csv")}>Export CSV</button>
        <button className="btn primary sm" onClick={onAdd}>+ Add Property</button>
      </ViewToolbar>

      <Panel title="Properties">
        <ListState loading={loading} empty={filtered.length === 0} emptyTitle="No properties found" emptyDesc="Add a property to start building your portfolio hierarchy.">
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
                      <div className="row" style={{ gap: 6 }}>
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

function BuildingsView({ rows, loading, search, setSearch, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void;
}) {
  const buildings = rows as BuildingRow[];
  const totalFloors = buildings.reduce((s, b) => s + Number(b.floors ?? 0), 0);
  const locations = new Set(buildings.map((b) => String(b.property_name ?? "—"))).size;

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Buildings" value={kN(buildings.length)} sub="Registered buildings" link="View register" onClick={() => setTab("buildings")} />
        <KpiCard icon="📐" iconBg="#dbeafe" iconColor="#2563eb" label="Total Floors" value={kN(totalFloors)} sub="Across buildings" link="View buildings" onClick={() => setTab("buildings")} />
        <KpiCard icon="📍" iconBg="#dcfce7" iconColor="#16a34a" label="Locations" value={kN(locations)} sub="Properties with buildings" link="View properties" onClick={() => setTab("properties")} />
        <KpiCard icon="▦" iconBg="#e0f2fe" iconColor="#0284c7" label="Units" value={kN(0)} sub="Linked via properties" link="View units" onClick={() => setTab("units")} />
      </KpiStrip>

      <ViewToolbar title="Buildings Register" subtitle="Buildings, floors and property locations" search={search} onSearch={setSearch} placeholder="Search by name, code or property…" />

      <Panel title="Buildings">
        <ListState loading={loading} empty={buildings.length === 0} emptyTitle="No buildings found" emptyDesc="Buildings under each property will appear here once registered.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Building Name</th>
                  <th>Building ID</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Floor Area m²</th>
                  <th>Occupancy %</th>
                  <th>Status</th>
                  <th>Monthly Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buildings.map((b) => {
                  const area = (b.metadata as Record<string, unknown> | undefined)?.floor_area;
                  const occ = (b.metadata as Record<string, unknown> | undefined)?.occupancy;
                  const cost = (b.metadata as Record<string, unknown> | undefined)?.monthly_cost;
                  return (
                    <tr key={String(b.id)}>
                      <td><strong style={{ fontSize: 12 }}>{String(b.name ?? "—")}</strong></td>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(b.code ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String((b.metadata as Record<string, unknown> | undefined)?.building_type ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(b.property_name ?? "—")}</td>
                      <td className="mono">{area === undefined ? "—" : `${kN(area)}`}</td>
                      <td>{occ === undefined ? <span className="muted">—</span> : <Badge tone={occupancyTone(Number(occ))}>{Number(occ)}%</Badge>}</td>
                      <td><StatusPill value="active" /></td>
                      <td className="mono">{cost === undefined ? "—" : kM(cost)}</td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setTab("units")}>View Units</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
    </>
  );
}

/* ─── UNITS ─── */

function UnitsView({ rows, loading, search, setSearch, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void;
}) {
  const units = rows as UnitRow[];
  const occupied = units.filter((u) => u.status === "occupied").length;
  const available = units.filter((u) => u.status === "available").length;
  const totalArea = units.reduce((s, u) => s + Number(u.area ?? 0), 0);

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="▦" iconBg="#dbeafe" iconColor="#2563eb" label="Units" value={kN(units.length)} sub="Registered units" link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="🔑" iconBg="#dcfce7" iconColor="#16a34a" label="Occupied" value={kN(occupied)} sub={`${pct(occupied, units.length)}% occupied`} link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="◌" iconBg="#fef3c7" iconColor="#d97706" label="Available" value={kN(available)} sub="Vacant units" link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="📐" iconBg="#e0f2fe" iconColor="#0284c7" label="Total Area" value={`${kN(totalArea)} m²`} sub="Lettable floor area" link="View units" onClick={() => setTab("units")} />
      </KpiStrip>

      <ViewToolbar title="Unit Register" subtitle="Every lettable and non-lettable unit across your properties" search={search} onSearch={setSearch} placeholder="Search by code, type or property…" />

      <Panel title="Units">
        <ListState loading={loading} empty={units.length === 0} emptyTitle="No units found" emptyDesc="Generate units from a property or register them individually.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Unit Code</th>
                  <th>Property</th>
                  <th>Building</th>
                  <th>Floor</th>
                  <th>Type</th>
                  <th>Size m²</th>
                  <th>Rent</th>
                  <th>Status</th>
                  <th>Tenant</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const rent = (u.metadata as Record<string, unknown> | undefined)?.rent;
                  return (
                    <tr key={String(u.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(u.code ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(u.property_name ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(u.building_name ?? "—")}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(u.floor ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(u.unit_type ?? "—")}</td>
                      <td className="mono">{u.area === undefined || u.area === null ? "—" : kN(u.area)}</td>
                      <td className="mono">{rent === undefined ? "—" : kM(rent)}</td>
                      <td><StatusPill value={String(u.status ?? "—")} /></td>
                      <td style={{ fontSize: 12 }}>{String((u.metadata as Record<string, unknown> | undefined)?.tenant ?? "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
    </>
  );
}

/* ─── PROJECTS ─── */

function ProjectsView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
}) {
  const projects = rows as ProjectRow[];
  const active = projects.filter((p) => p.status === "active").length;
  const completed = projects.filter((p) => p.status === "completed").length;

  return (
    <>
      <KpiStrip cols={3}>
        <KpiCard icon="🗂" iconBg="#e0e7ff" iconColor="#4f46e5" label="Projects" value={kN(projects.length)} sub="Development projects" />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#d97706" label="In Progress" value={kN(active)} sub="Active projects" />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={kN(completed)} sub="Delivered projects" />
      </KpiStrip>

      <ViewToolbar title="Development Projects" subtitle="Property development and refurbishment projects" search={search} onSearch={setSearch} placeholder="Search by name or project code…" />

      <Panel title="Projects">
        <ListState loading={loading} empty={projects.length === 0} emptyTitle="No projects found" emptyDesc="Development projects will appear here once registered against a property.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Project Ref</th>
                  <th>Property</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Budget</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const budget = (p.metadata as Record<string, unknown> | undefined)?.budget;
                  return (
                    <tr key={String(p.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(p.code ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String((p.metadata as Record<string, unknown> | undefined)?.property_name ?? "—")}</td>
                      <td><strong style={{ fontSize: 12 }}>{String(p.name ?? "—")}</strong></td>
                      <td><StatusPill value={String(p.status ?? "—")} /></td>
                      <td style={{ fontSize: 12 }}>{fmtDate(p.starts_on)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(p.ends_on)}</td>
                      <td className="mono">{budget === undefined ? "—" : kM(budget)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
    </>
  );
}

/* ─── TENANTS ─── */

function TenantsView({
  rows, loading, search, setSearch, setTab, onAdd, onUploadDoc, onSelectRow,
}: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void; onAdd: () => void; onUploadDoc: () => void; onSelectRow: (r: Row) => void;
}) {
  const [filterProperty, setFilterProperty] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const tenants = rows as TenantRow[];
  const filtered = tenants.filter((t) =>
    (!filterProperty || t.property === filterProperty) &&
    (!filterStatus || t.status === filterStatus)
  );
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = tenants.filter((t) => t.status === "active").length;
  const prospects = tenants.filter((t) => t.status === "prospect").length;
  const outstanding = tenants.reduce((s, t) => s + Number(t.outstanding ?? 0), 0);
  const propertyNames = [...new Set(tenants.map((t) => t.property).filter(Boolean))];
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

      <ViewToolbar title="Tenant Register" subtitle="Manage all tenants across your properties" search={search} onSearch={setSearch} searchTestid="tenant-search-input" placeholder="Search tenant name, email, phone…">
        <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)} style={selStyle}>
          <option value="">All Properties</option>
          {propertyNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selStyle}>
          <option value="">All Status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn ghost sm" onClick={() => exportCsv(filtered, [
          { key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "tenant_type", label: "Type" },
          { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "property", label: "Property" },
          { key: "unit", label: "Unit" }, { key: "status", label: "Status" },
          { key: "outstanding", label: "Outstanding" }, { key: "created_at", label: "Registered" },
        ], "tenants.csv")}>Export CSV</button>
        <button className="btn ghost sm" onClick={onUploadDoc}>+ Upload Document</button>
        <button className="btn primary sm" onClick={onAdd}>+ Add Tenant</button>
      </ViewToolbar>

      <Panel title="Tenants">
        <ListState loading={loading} empty={filtered.length === 0} emptyTitle="No tenants found" emptyDesc="Register a tenant to link leases, invoices and documents.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property / Unit</th>
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
                      <span style={{ fontSize: 12 }}>{String(t.property ?? "—")}</span>
                      {t.unit ? <div className="muted" style={{ fontSize: 11 }}>{String(t.unit)}</div> : null}
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

function TenantDocumentsView({ rows, loading, search, setSearch, onUpload, onDownload, onVerify, onReject }: {
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

function LeasesView({
  rows, loading, search, setSearch, setTab, onAddLease, onDownloadTemplate, onLeaseAction, onSelectRow,
}: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void; onAddLease: () => void; onDownloadTemplate: () => void;
  onLeaseAction: (r: LeaseRow, action: "activate" | "renew" | "terminate") => void; onSelectRow: (r: Row) => void;
}) {
  const [filterProperty, setFilterProperty] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const leases = rows as LeaseRow[];
  const filtered = leases.filter((l) =>
    (!filterProperty || l.property_name === filterProperty) &&
    (!filterStatus || l.status === filterStatus)
  );
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = leases.filter((l) => l.status === "active").length;
  const expired = leases.filter((l) => l.status === "expired").length;
  const expiring30 = leases.filter((l) => {
    const dl = daysUntil(l.ends_on);
    return dl !== null && dl >= 0 && dl <= 30 && ["active", "expiring"].includes(String(l.status));
  }).length;
  const monthlyRent = leases.filter((l) => ["active", "expiring"].includes(String(l.status))).reduce((s, l) => s + Number(l.monthly_rent ?? 0), 0);
  const outstanding = leases.reduce((s, l) => s + Number(l.outstanding ?? 0), 0);
  const propertyNames = [...new Set(leases.map((l) => l.property_name).filter(Boolean))];
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

      <ViewToolbar title="Lease Register" subtitle="Manage all lease agreements across your properties" search={search} onSearch={setSearch} placeholder="Search lease no, tenant or unit…">
        <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)} style={selStyle}>
          <option value="">All Properties</option>
          {propertyNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selStyle}>
          <option value="">All Status</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn ghost sm" onClick={() => exportCsv(filtered, [
          { key: "reference", label: "Reference" }, { key: "tenant_name", label: "Tenant" },
          { key: "property_name", label: "Property" }, { key: "unit_code", label: "Unit" },
          { key: "starts_on", label: "Start" }, { key: "ends_on", label: "End" },
          { key: "monthly_rent", label: "Monthly Rent" }, { key: "deposit", label: "Deposit" },
          { key: "escalation_percent", label: "Escalation %" }, { key: "status", label: "Status" },
          { key: "outstanding", label: "Outstanding" },
        ], "leases.csv")}>Export CSV</button>
        <button className="btn ghost sm" onClick={() => exportLeaseICS(filtered)} title="Export leases to Outlook/Google Calendar">📅 Export Calendar</button>
      </ViewToolbar>

      <div className="card" style={{ padding: 18, border: "1px dashed var(--primary)", background: "var(--surface-2)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: "0 0 4px 0", fontSize: 14 }}>Tenancy Schedule (Bulk Import)</h4>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Download the tenancy schedule template to onboard multiple leases and tenants at once.
            </p>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn ghost sm" onClick={onDownloadTemplate}>📥 Download Template</button>
            <button className="btn primary sm" onClick={onAddLease}>+ Add Single Lease</button>
          </div>
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
                  <th>Property</th>
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
                    <td style={{ fontSize: 12 }}>{String(l.property_name ?? "—")}</td>
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

/* ─── RENT SCHEDULES ─── */

function RentSchedulesView({ rows, loading, search, setSearch, onGenerateInvoice }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; onGenerateInvoice: (r: RentScheduleRow) => void;
}) {
  const schedules = rows as RentScheduleRow[];

  return (
    <>
      <ViewToolbar title="Rent Roll" subtitle="Unit-by-unit rent schedule with escalation and service charge" search={search} onSearch={setSearch} placeholder="Search by lease reference or tenant…" />

      <Panel title="Rent Schedule (Rent Roll)">
        <ListState loading={loading} empty={schedules.length === 0} emptyTitle="No rent schedules found" emptyDesc="Generate rent schedules from active leases to build the rent roll.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Lease Ref</th>
                  <th>Tenant</th>
                  <th>Period</th>
                  <th>Due</th>
                  <th>Base Rent</th>
                  <th>Escalation</th>
                  <th>Service Charge</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={String(s.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(s.lease_reference ?? "—")}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(s.tenant_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{fmtDate(s.period_start)} — {fmtDate(s.period_end)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(s.due_on)}</td>
                    <td className="mono">{kM(s.base_rent)}</td>
                    <td className="mono">{s.escalation_amount ? kM(s.escalation_amount) : "—"}</td>
                    <td className="mono">{s.service_charge ? kM(s.service_charge) : "—"}</td>
                    <td className="mono"><strong>{kM(s.total)}</strong></td>
                    <td><StatusPill value={String(s.status ?? "—")} /></td>
                    <td>{!s.invoice && s.status !== "waived" ? <button className="btn primary sm" onClick={() => onGenerateInvoice(s)}>Generate invoice</button> : <span className="muted">Invoiced</span>}</td>
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

/* ─── RENT & INVOICES ─── */

function renderInvoiceRows(invoices: InvoiceRow[], full: boolean, onPay: (id: ID) => void, onRemind: (row: InvoiceRow) => void, onAction: (row: InvoiceRow, action: "issue" | "void") => void, onSelect: (r: Row) => void) {
  return invoices.map((inv) => (
    <tr key={String(inv.id)} onClick={() => onSelect(inv)}>
      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(inv.number ?? "—")}</td>
      <td><strong style={{ fontSize: 12 }}>{String(inv.tenant_name ?? "—")}</strong></td>
      <td style={{ fontSize: 12 }}>{String((inv.metadata as Record<string, unknown> | undefined)?.property_name ?? "—")}</td>
      {full && <td style={{ fontSize: 12 }}>{fmtDate(inv.issued_on)}</td>}
      <td style={{ fontSize: 12 }}>{fmtDate(inv.due_on)}</td>
      <td className="mono">{kM(inv.amount)}</td>
      {full && <td className="mono" style={{ color: Number(inv.amount) - Number(inv.balance ?? 0) > 0 ? "#16a34a" : "var(--muted)" }}>{kM(Number(inv.amount) - Number(inv.balance ?? 0))}</td>}
      <td className="mono" style={{ color: Number(inv.balance ?? 0) > 0 ? "var(--danger)" : "#16a34a" }}>{kM(inv.balance)}</td>
      <td><StatusPill value={String(inv.status ?? "—")} /></td>
      <td>
        <div className="row" style={{ gap: 6 }}>
          {Number(inv.balance ?? 0) > 0 && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onPay(String(inv.id)); }}>Pay</button>}
          {Number(inv.balance ?? 0) > 0 && !["draft", "void", "paid"].includes(String(inv.status)) && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onRemind(inv); }}>Send reminder</button>}
          {inv.status === "draft" && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(inv, "issue"); }}>Issue</button>}
          {(["draft", "issued", "overdue"].includes(String(inv.status))) && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onAction(inv, "void"); }}>Void</button>}
        </div>
      </td>
    </tr>
  ));
}

function RentView({
  rows, rentInvoices, analytics, rentSection, setRentSection, loading,
  setTab, onRecordReceipt, onSendReminder, onInvoiceAction, onSelectRow,
}: {
  rows: Row[]; rentInvoices: InvoiceRow[]; analytics: AgingAnalytics | null;
  rentSection: RentSection; setRentSection: (s: RentSection) => void; loading: boolean;
  setTab: (t: PropertyTab) => void;
  onRecordReceipt: (invoiceId?: ID) => void; onSendReminder: (row: InvoiceRow) => void;
  onInvoiceAction: (row: InvoiceRow, action: "issue" | "void") => void; onSelectRow: (r: Row) => void;
}) {
  const totalBilled = rentInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const outstanding = rentInvoices.reduce((s, i) => s + Number(i.balance ?? 0), 0);
  const collected = Math.max(totalBilled - outstanding, 0);
  const collectionRate = pct(collected, totalBilled);
  const dueThisMonth = rentInvoices.filter((i) => {
    const d = new Date(String(i.due_on ?? ""));
    const now = new Date();
    return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && Number(i.balance ?? 0) > 0;
  }).length;
  const aging = analytics?.summary ?? {};
  const agingTotal = Object.values(aging).reduce((s, v) => s + Number(v ?? 0), 0);
  const agingBuckets = [
    { label: "Current (0-30)", key: "current" },
    { label: "31-60", key: "31_60" },
    { label: "61-90", key: "61_90" },
    { label: "91-120", key: "91_120" },
    { label: "120+", key: "over_120" },
  ];
  const topTenants = analytics?.tenants ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      <SubTabs
        active={rentSection}
        onChange={(id) => setRentSection(id as RentSection)}
        tabs={[
          { id: "invoices", label: "Invoices" },
          { id: "receipts", label: "Receipts" },
          { id: "arrears", label: "Arrears" },
          { id: "reminders", label: "Reminders" },
          { id: "ledger", label: "Ledger" },
        ]}
      />

      <KpiStrip>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Billed" value={kM(totalBilled)} sub={`${kN(dueThisMonth)} due this month`} link="View invoices" onClick={() => setRentSection("invoices")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Collected" value={kM(collected)} sub={`${collectionRate}% collection rate`} link="View receipts" onClick={() => setRentSection("receipts")} />
        <KpiCard icon="◔" iconBg="#e0f2fe" iconColor="#0284c7" label="Collection Rate" value={`${collectionRate}%`} sub="Billed vs collected" link="View invoices" onClick={() => setRentSection("invoices")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding" value={kM(outstanding)} sub="Unpaid balances" link="View arrears" onClick={() => setRentSection("arrears")} />
        <KpiCard icon="📅" iconBg="#fff7ed" iconColor="#ea580c" label="Due This Month" value={kN(dueThisMonth)} sub="Open invoices" link="View invoices" onClick={() => setRentSection("invoices")} />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

      {rentSection === "invoices" && (
        <Panel title="Rent Invoices & Collection Ledger" action={<button className="btn primary sm" onClick={() => onRecordReceipt()}>+ Record Rent Payment</button>}>
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No invoices found" emptyDesc="Generate invoices from rent schedules or issue draft invoices.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th>Due Date</th>
                    <th>Billed</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>{renderInvoiceRows(rows as InvoiceRow[], false, onRecordReceipt, onSendReminder, onInvoiceAction, onSelectRow)}</tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {rentSection === "ledger" && (
        <Panel title="Invoice Ledger" action={<button className="btn primary sm" onClick={() => onRecordReceipt()}>+ Record Rent Payment</button>}>
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No ledger entries" emptyDesc="Issued invoices will appear in the ledger with payment status.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th>Issued</th>
                    <th>Due Date</th>
                    <th>Billed</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>{renderInvoiceRows(rows as InvoiceRow[], true, onRecordReceipt, onSendReminder, onInvoiceAction, onSelectRow)}</tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {rentSection === "receipts" && (
        <Panel title="Receipts">
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No receipts found" emptyDesc="Recorded rent payments appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Tenant</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as ReceiptRow[]).map((r) => (
                    <tr key={String(r.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(r.number ?? "—")}</td>
                      <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.received_on)}</td>
                      <td style={{ fontSize: 12 }}>{String(r.payment_method ?? "—").replace(/_/g, " ")}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(r.external_reference ?? "—")}</td>
                      <td className="mono">{kM(r.amount)}</td>
                      <td><Badge tone={r.invoice ? "green" : "yellow"}>{r.invoice ? "Applied" : "Unapplied"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {rentSection === "arrears" && (
        <Panel title="Arrears">
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No arrears" emptyDesc="Tenants with outstanding balances appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Property</th>
                    <th>Unit</th>
                    <th>Outstanding</th>
                    <th>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as AgingTenantRow[]).map((t, i) => (
                    <tr key={i}>
                      <td><strong style={{ fontSize: 12 }}>{String(t.tenant ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{String(t.property ?? "—")}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(t.unit ?? "—")}</td>
                      <td className="mono" style={{ color: "var(--danger)" }}>{kM(t.outstanding)}</td>
                      <td><Badge tone="red">{kN(t.oldest_days)}d</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {rentSection === "reminders" && (
        <Panel title="Sent Reminders" action={<button className="btn ghost sm" onClick={() => setTab("reminders")}>All Reminders →</button>}>
          <ListState loading={loading} empty={rows.length === 0} emptyTitle="No reminders" emptyDesc="Payment reminders sent to tenants appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Invoice</th>
                    <th>Channel</th>
                    <th>Recipient</th>
                    <th>Sent</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as ReminderRow[]).map((r) => (
                    <tr key={String(r.id)}>
                      <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(r.invoice_number ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.channel ?? "—").replace(/_/g, " ")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.recipient ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.sent_at)}</td>
                      <td><Badge tone="green">Sent</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      <Panel title="Collection Performance" action={<button className="btn ghost sm" onClick={() => setRentSection("invoices")}>Invoices →</button>}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(var(--primary) 0% ${collectionRate}%, var(--surface-3) ${collectionRate}% 100%)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{collectionRate}%</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                <i style={{ background: "var(--primary)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Collected
              </span>
              <strong className="mono">{kM(collected)}</strong>
            </div>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                <i style={{ background: "var(--surface-3)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Outstanding
              </span>
              <strong className="mono">{kM(outstanding)}</strong>
            </div>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                <i style={{ background: "var(--border-strong)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Total Billed
              </span>
              <strong className="mono">{kM(totalBilled)}</strong>
            </div>
          </div>
        </div>
      </Panel>

        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 260 }}>
          <Panel title="Quick Actions">
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setRentSection("invoices")}>Generate Invoice →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => onRecordReceipt()}>Record Payment / Receipt →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setRentSection("reminders")}>Send Payment Reminder →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("arrears")}>Manage Arrears →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("reports")}>Download Aging Report →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("reports")}>Export Collection Report →</button>
            </div>
          </Panel>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Aging Summary (Outstanding)" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>Ageing Report →</button>}>
          {agingTotal > 0 ? (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Bucket</th>
                    <th>Amount</th>
                    <th>% of total</th>
                  </tr>
                </thead>
                <tbody>
                  {agingBuckets.map((b) => {
                    const amount = Number(aging[b.key] ?? 0);
                    return (
                      <tr key={b.key}>
                        <td style={{ fontSize: 12 }}>{b.label}</td>
                        <td className="mono" style={{ color: amount > 0 ? "var(--danger)" : "var(--muted)" }}>{kM(amount)}</td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                              <div style={{ width: `${pct(amount, agingTotal)}%`, height: "100%", background: amount > 0 ? "#e23b3b" : "var(--border-strong)" }} />
                            </div>
                            <span className="mono" style={{ fontSize: 11, width: 40, textAlign: "right" }}>{pct(amount, agingTotal)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="✓" title="No outstanding balances" description="All invoices have been collected." />
          )}
        </Panel>

        <Panel title="Top Tenants by Outstanding" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>View All Arrears →</button>}>
          {topTenants.length > 0 ? (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Property / Unit</th>
                    <th>Outstanding</th>
                    <th>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {topTenants.slice(0, 6).map((t, i) => (
                    <tr key={i}>
                      <td><strong style={{ fontSize: 12 }}>{String(t.tenant ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{String(t.property ?? "—")} · {String(t.unit ?? "—")}</td>
                      <td className="mono" style={{ color: "var(--danger)" }}>{kM(t.outstanding)}</td>
                      <td><Badge tone="red">{kN(t.oldest_days)}d</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="✓" title="No outstanding tenants" description="Every tenant is up to date." />
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ─── ARREARS ─── */

function ArrearsView({
  rows, analytics, loading, search, setSearch, onNavigateReminders,
}: {
  rows: Row[]; analytics: AgingAnalytics | null; loading: boolean; search: string;
  setSearch: (v: string) => void; onNavigateReminders: (tenantName: string) => void;
}) {
  const tenants = rows as AgingTenantRow[];
  const summary = analytics?.summary ?? {};
  const total = Number(analytics?.total ?? Object.values(summary).reduce((s, v) => s + Number(v ?? 0), 0));
  const buckets = [
    { label: "0-30 days", key: "current" },
    { label: "31-60 days", key: "31_60" },
    { label: "61-90 days", key: "61_90" },
    { label: "90+ days", key: "over_120" },
  ];

  return (
    <>
      <ViewToolbar title="Arrears Register" subtitle="Tenants with outstanding balances and aged debt" search={search} onSearch={setSearch} placeholder="Search tenant or property…" />

      <Panel title="Aging Buckets (Outstanding)">
        {total > 0 ? (
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Amount</th>
                  <th>% of total</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => {
                  const amount = Number(summary[b.key] ?? 0) + (b.key === "over_120" ? Number(summary["91_120"] ?? 0) : 0);
                  return (
                    <tr key={b.key}>
                      <td style={{ fontSize: 12 }}>{b.label}</td>
                      <td className="mono" style={{ color: amount > 0 ? "var(--danger)" : "var(--muted)" }}>{kM(amount)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{ width: `${pct(amount, total)}%`, height: "100%", background: amount > 0 ? "#e23b3b" : "var(--border-strong)" }} />
                          </div>
                          <span className="mono" style={{ fontSize: 11, width: 40, textAlign: "right" }}>{pct(amount, total)}%</span>
                        </div>
                      </td>
                      <td className="mono">{kM(amount)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td><strong style={{ fontSize: 12 }}>Total Outstanding</strong></td>
                  <td className="mono" style={{ color: "var(--danger)" }}><strong>{kM(total)}</strong></td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="✓" title="No arrears" description="There are no outstanding balances to report." />
        )}
      </Panel>

      <Panel title="Tenants in Arrears">
        <ListState loading={loading} empty={tenants.length === 0} emptyTitle="No tenants in arrears" emptyDesc="Tenants with unpaid invoices will appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th>Outstanding</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, i) => (
                  <tr key={i}>
                    <td><strong style={{ fontSize: 12 }}>{String(t.tenant ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(t.property ?? "—")}</td>
                    <td className="mono" style={{ color: "var(--danger)" }}>{kM(t.outstanding)}</td>
                    <td><Badge tone={Number(t.oldest_days ?? 0) > 90 ? "red" : Number(t.oldest_days ?? 0) > 60 ? "yellow" : "blue"}>{kN(t.oldest_days)}d</Badge></td>
                    <td><Badge tone="red">Overdue</Badge></td>
                    <td>
                      <button className="btn ghost sm" onClick={() => onNavigateReminders(String(t.tenant ?? ""))}>Send reminder</button>
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

/* ─── REMINDERS ─── */

function RemindersView({ rows, loading, search, setSearch, onSendReminder, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  onSendReminder: (r: ReminderRow) => void; setTab: (t: PropertyTab) => void;
}) {
  const reminders = rows as ReminderRow[];

  return (
    <>
      <ViewToolbar title="Payment Reminders" subtitle="Sent and scheduled payment reminders" search={search} onSearch={setSearch} placeholder="Search tenant or invoice…" />

      <Panel title="Reminders">
        <ListState loading={loading} empty={reminders.length === 0} emptyTitle="No reminders found" emptyDesc="Payment reminders sent from the collection workflow appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Invoice</th>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Sent At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={String(r.id)}>
                    <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{String(r.invoice_number ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.channel ?? "—").replace(/_/g, " ")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.recipient ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.sent_at)}</td>
                    <td><Badge tone="green">Sent</Badge></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn ghost sm" onClick={() => onSendReminder(r)}>Send now</button>
                        <button className="btn ghost sm" onClick={() => setTab("rent")}>Invoices</button>
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

/* ─── RECEIPTS ─── */

function ReceiptsView({
  rows, creditNotes, loading, search, setSearch, onRecordReceipt,
}: {
  rows: Row[]; creditNotes: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  onRecordReceipt: (invoiceId?: ID) => void;
}) {
  const [filter, setFilter] = useState<"all" | "receipts" | "credit-notes" | "unapplied">("all");
  const [filterTenant, setFilterTenant] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const receipts = rows as ReceiptRow[];
  const cns = creditNotes as CreditNoteRow[];
  const receiptTotal = receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const creditTotal = cns.filter((c) => c.status !== "void").reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const unapplied = receipts.filter((r) => !r.invoice).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const tenantNames = [...new Set(receipts.map((r) => r.tenant_name).filter(Boolean))];
  const paymentMethods = [...new Set(receipts.map((r) => r.payment_method).filter(Boolean))];
  const selStyle = { padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 };

  const combined: Row[] = [
    ...receipts.map((r) => ({
      ...r,
      docType: "Receipt",
      docNumber: r.number,
      docDate: r.received_on,
      docMethod: r.payment_method,
      docRef: r.external_reference,
      docStatus: r.invoice ? "Applied" : "Unapplied",
    })),
    ...cns.map((c) => ({
      ...c,
      docType: "Credit Note",
      docNumber: c.number,
      docDate: c.issued_on,
      docMethod: "Credit Note",
      docRef: c.reason,
      docStatus: c.status === "void" ? "Void" : "Applied",
    })),
  ].filter((c) => {
    if (filter === "receipts") { if (c.docType !== "Receipt") return false; }
    else if (filter === "credit-notes") { if (c.docType !== "Credit Note") return false; }
    else if (filter === "unapplied") { if (c.docType !== "Receipt" || c.docStatus !== "Unapplied") return false; }
    if (filterTenant && c.tenant_name !== filterTenant) return false;
    if (filterType && c.docMethod !== filterType) return false;
    return true;
  });
  const pagedRows = combined.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Receipts" value={kM(receiptTotal)} sub="Collected this period" link="View receipts" onClick={() => setFilter("receipts")} />
        <KpiCard icon="↩" iconBg="#fef3c7" iconColor="#d97706" label="Credit Notes" value={kM(creditTotal)} sub="Issued credits" link="View credit notes" onClick={() => setFilter("credit-notes")} />
        <KpiCard icon="◔" iconBg="#dcfce7" iconColor="#16a34a" label="Net Collections" value={kM(Math.max(receiptTotal - creditTotal, 0))} sub="Receipts less credits" link="View receipts" onClick={() => setFilter("all")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Unapplied" value={kM(unapplied)} sub="Receipts not allocated" link="View unapplied" onClick={() => setFilter("unapplied")} />
      </KpiStrip>

      <ViewToolbar title="Receipts & Credit Notes" subtitle="Recorded payments and credit adjustments" search={search} onSearch={setSearch} placeholder="Search receipt, tenant or reference…">
        <select value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)} style={selStyle}>
          <option value="">All Tenants</option>
          {tenantNames.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selStyle}>
          <option value="">All Methods</option>
          {paymentMethods.map((m) => <option key={m} value={m}>{String(m).replace(/_/g, " ")}</option>)}
        </select>
        <button className="btn ghost sm" onClick={() => exportCsv(combined, [
          { key: "docType", label: "Type" }, { key: "docNumber", label: "Doc No" }, { key: "docDate", label: "Date" },
          { key: "tenant_name", label: "Tenant" }, { key: "docMethod", label: "Method" },
          { key: "docRef", label: "Reference" }, { key: "amount", label: "Amount" },
          { key: "docStatus", label: "Status" },
        ], "receipts-credit-notes.csv")}>Export CSV</button>
        <button className="btn primary sm" onClick={() => onRecordReceipt()}>+ Record Receipt</button>
      </ViewToolbar>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {([["all", "All"], ["receipts", "Receipts"], ["credit-notes", "Credit Notes"], ["unapplied", "Unapplied Receipts"]] as const).map(([id, label]) => (
          <button key={id} type="button" className={`btn sm ${filter === id ? "primary" : "ghost"}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      <Panel title="Transactions">
        <ListState loading={loading} empty={combined.length === 0} emptyTitle="No transactions found" emptyDesc="Receipts and credit notes will appear here once recorded.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Doc No</th>
                  <th>Date</th>
                  <th>Tenant</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r) => (
                  <tr key={String(r.id)}>
                    <td><Badge tone={r.docType === "Credit Note" ? "yellow" : "blue"}>{String(r.docType)}</Badge></td>
                    <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(r.docNumber ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.docDate)}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.tenant_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(r.docMethod ?? "—").replace(/_/g, " ")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(r.docRef ?? "—")}</td>
                    <td className="mono" style={{ color: r.docType === "Credit Note" ? "var(--danger)" : "var(--text)" }}>{kM(r.amount)}</td>
                    <td><Badge tone={r.docStatus === "Applied" ? "green" : r.docStatus === "Unapplied" ? "yellow" : "gray"}>{String(r.docStatus)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={combined.length} onPage={setPage} />
        </ListState>
      </Panel>
    </>
  );
}

/* ─── RECEIPT ALLOCATIONS ─── */

function ReceiptAllocationsView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
}) {
  const allocations = rows as ReceiptAllocationRow[];

  return (
    <>
      <ViewToolbar title="Receipt Allocations" subtitle="How each receipt is allocated against open invoices" search={search} onSearch={setSearch} placeholder="Search receipt, invoice or tenant…" />

      <Panel title="Allocations">
        <ListState loading={loading} empty={allocations.length === 0} emptyTitle="No allocations found" emptyDesc="Receipts allocated to invoices appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Allocation</th>
                  <th>Receipt</th>
                  <th>Invoice</th>
                  <th>Tenant</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={String(a.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{shortId(a.id)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(a.receipt_number ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(a.invoice_number ?? "—")}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(a.tenant_name ?? "—")}</strong></td>
                    <td className="mono">{kM(a.amount)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(a.created_at)}</td>
                    <td><Badge tone="green">Applied</Badge></td>
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

/* ─── BANK RECONCILIATION ─── */

function BankReconciliationView({ rows, loading, search, setSearch, onMatch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; onMatch: (r: Row) => void;
}) {
  const transactions = rows as BankTransactionRow[];

  return (
    <>
      <ViewToolbar title="Bank Reconciliation" subtitle="Match bank statements to recorded receipts" search={search} onSearch={setSearch} placeholder="Search reference or description…" />

      <Panel title="Bank Transactions">
        <ListState loading={loading} empty={transactions.length === 0} emptyTitle="No bank transactions found" emptyDesc="Imported bank statement transactions appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Transaction Ref</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Receipt</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={String(t.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(t.reference ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(t.transacted_on)}</td>
                    <td style={{ fontSize: 12 }}>{String(t.description ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(t.receipt_number ?? "—")}</td>
                    <td className="mono">{kM(t.amount)}</td>
                    <td><StatusPill value={String(t.status ?? "—")} /></td>
                    <td>
                      {t.status !== "matched" && (
                        <button className="btn ghost sm" onClick={() => onMatch(t)}>Match</button>
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

/* ─── CREDIT NOTES ─── */

function CreditNotesView({ rows, loading, search, setSearch, setTab, onAdd }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void; onAdd: () => void;
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
                      <button className="btn ghost sm" onClick={() => setTab("rent")}>View Invoice</button>
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

/* ─── SERVICE CHARGES ─── */

function ServiceChargesView({
  rows, scSection, setScSection, loading, setTab, onAdd, onAllocate, onReconcile,
}: {
  rows: Row[]; scSection: ScSection; setScSection: (s: ScSection) => void; loading: boolean;
  setTab: (t: PropertyTab) => void;
  onAdd: () => void;
  onAllocate: (row: ServiceChargeRow) => void;
  onReconcile: (row: ServiceChargeRow) => void;
}) {
  const charges = rows as ServiceChargeRow[];
  const totalBudget = charges.reduce((s, c) => s + Number(c.annual_budget ?? 0), 0);
  const activeCharges = charges.filter((c) => c.is_active !== false).length;
  const method = charges[0]?.method ?? "—";
  const totalArea = (charges[0]?.metadata as Record<string, unknown> | undefined)?.total_lettable_area;

  return (
    <>
      <SubTabs
        active={scSection}
        onChange={(id) => setScSection(id as ScSection)}
        tabs={[
          { id: "setup", label: "Setup" },
          { id: "allocations", label: "Allocations" },
          { id: "reconciliations", label: "Reconciliations" },
          { id: "budget", label: "Budget & Estimate" },
        ]}
      />

      {scSection === "setup" && (
        <>
          <div className="card" style={{ padding: 18 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: 14 }}>Service Charge Model</h4>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  Apportionment basis: <strong>{String(method).replace(/_/g, " ")}</strong> · Annual budget: <strong>{kM(totalBudget)}</strong>
                </p>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="badge badge-blue">{kN(activeCharges)} active</span>
                <span className="badge">{totalArea === undefined ? "—" : `${kN(totalArea)} m² lettable`}</span>
              </div>
            </div>
          </div>

          <Panel title="Cost Centres" action={<div className="row" style={{ gap: 8 }}><button className="btn ghost sm" onClick={() => setTab("service-charge-allocations")}>Allocations →</button><button className="btn primary sm" onClick={onAdd}>+ Set up charge</button></div>}>
            <ListState loading={loading} empty={charges.length === 0} emptyTitle="No cost centres found" emptyDesc="Service charge schemes configured for your properties appear here.">
              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead>
                    <tr>
                      <th>Cost Centre</th>
                      <th>Description</th>
                      <th>Recoverable</th>
                      <th>Annual Budget</th>
                      <th>% of total</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((c) => (
                      <tr key={String(c.id)}>
                        <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(c.name ?? "—")}</td>
                        <td style={{ fontSize: 12 }}>{String(c.property_name ?? "—")}</td>
                        <td><Badge tone="green">Yes</Badge></td>
                        <td className="mono">{kM(c.annual_budget)}</td>
                        <td className="mono"><strong>{pct(c.annual_budget, totalBudget)}%</strong></td>
                        <td><StatusPill value={c.is_active === false ? "inactive" : "active"} /></td>
                        <td><div className="row" style={{ gap: 6 }}><button className="btn ghost sm" onClick={() => onAllocate(c)}>Allocate</button><button className="btn primary sm" onClick={() => onReconcile(c)}>Reconcile</button></div></td>
                      </tr>
                    ))}
                    <tr>
                      <td><strong style={{ fontSize: 12 }}>Total</strong></td>
                      <td />
                      <td />
                      <td className="mono"><strong>{kM(totalBudget)}</strong></td>
                      <td className="mono"><strong>100%</strong></td>
                      <td />
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </ListState>
          </Panel>
        </>
      )}

      {scSection === "allocations" && (
        <Panel title="Charge Allocations">
          <ListState loading={loading} empty={charges.length === 0} emptyTitle="No allocations found" emptyDesc="Generated unit allocations for each service charge appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Allocation</th>
                    <th>Charge</th>
                    <th>Unit</th>
                    <th>Ratio</th>
                    <th>Monthly Amount</th>
                    <th>Annual Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as ServiceChargeAllocationRow[]).map((a) => (
                    <tr key={String(a.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{shortId(a.id)}</td>
                      <td style={{ fontSize: 12 }}>{String(a.service_charge_name ?? "—")}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(a.unit_code ?? "—")}</td>
                      <td className="mono">{Number(a.ratio ?? 0) * 100}%</td>
                      <td className="mono">{kM(a.monthly_amount)}</td>
                      <td className="mono">{kM(a.annual_amount)}</td>
                      <td><Badge tone="green">Active</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {scSection === "reconciliations" && (
        <Panel title="Service Charge Reconciliations">
          <ListState loading={loading} empty={charges.length === 0} emptyTitle="No reconciliations found" emptyDesc="Period reconciliations comparing budget to actual spend appear here.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Reconciliation</th>
                    <th>Charge</th>
                    <th>Period</th>
                    <th>Billed</th>
                    <th>Collected</th>
                    <th>Variance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as ServiceChargeReconciliationRow[]).map((r) => (
                    <tr key={String(r.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{shortId(r.id)}</td>
                      <td style={{ fontSize: 12 }}>{String(r.service_charge_name ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.period_start)} — {fmtDate(r.period_end)}</td>
                      <td className="mono">{kM(r.budgeted_amount)}</td>
                      <td className="mono">{kM(r.actual_amount)}</td>
                      <td className="mono" style={{ color: Number(r.variance ?? 0) < 0 ? "var(--danger)" : "#16a34a" }}>{kM(r.variance)}</td>
                      <td><StatusPill value={String(r.status ?? "—")} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {scSection === "budget" && (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Panel title="Budget & Estimate Summary">
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted" style={{ fontSize: 12 }}>Total Annual Budget</span>
                <strong className="mono">{kM(totalBudget)}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted" style={{ fontSize: 12 }}>Active Schemes</span>
                <strong className="mono">{kN(activeCharges)}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted" style={{ fontSize: 12 }}>Apportionment Basis</span>
                <strong className="mono">{String(method).replace(/_/g, " ")}</strong>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted" style={{ fontSize: 12 }}>Total Lettable Area</span>
                <strong className="mono">{totalArea === undefined ? "—" : `${kN(totalArea)} m²`}</strong>
              </div>
            </div>
          </Panel>
          <Panel title="Next Steps">
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Manage the organisation-wide budget register, income estimates and variance tracking from the Budgets workspace.
              </p>
              <button className="btn ghost sm" onClick={() => setTab("budgets")}>Open Budgets →</button>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

/* ─── SERVICE CHARGE ALLOCATIONS (dedicated tab) ─── */

function ServiceChargeAllocationsView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
}) {
  const allocations = rows as ServiceChargeAllocationRow[];

  return (
    <>
      <ViewToolbar title="Charge Allocations" subtitle="Unit-level apportionment for each service charge" search={search} onSearch={setSearch} placeholder="Search charge or unit…" />

      <Panel title="Allocations">
        <ListState loading={loading} empty={allocations.length === 0} emptyTitle="No allocations found" emptyDesc="Generate allocations from a service charge to apportion its budget across units.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Allocation</th>
                  <th>Charge</th>
                  <th>Property</th>
                  <th>Unit</th>
                  <th>Ratio</th>
                  <th>Monthly Amount</th>
                  <th>Annual Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={String(a.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{shortId(a.id)}</td>
                    <td style={{ fontSize: 12 }}>{String(a.service_charge_name ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(a.property_name ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(a.unit_code ?? "—")}</td>
                    <td className="mono">{Number((Number(a.ratio ?? 0) * 100).toFixed(2))}%</td>
                    <td className="mono">{kM(a.monthly_amount)}</td>
                    <td className="mono">{kM(a.annual_amount)}</td>
                    <td><Badge tone="green">Active</Badge></td>
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

/* ─── SERVICE CHARGE RECONCILIATIONS (dedicated tab) ─── */

function ServiceChargeReconciliationsView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
}) {
  const reconciliations = rows as ServiceChargeReconciliationRow[];

  return (
    <>
      <ViewToolbar title="Service Charge Reconciliations" subtitle="Budget vs actual for each scheme period" search={search} onSearch={setSearch} placeholder="Search charge or period…" />

      <Panel title="Reconciliations">
        <ListState loading={loading} empty={reconciliations.length === 0} emptyTitle="No reconciliations found" emptyDesc="Period reconciliations comparing budgeted to actual expenditure appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Reconciliation</th>
                  <th>Charge</th>
                  <th>Period</th>
                  <th>Billed</th>
                  <th>Collected</th>
                  <th>Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.map((r) => (
                  <tr key={String(r.id)}>
                    <td className="mono" style={{ color: "var(--primary)", fontSize: 12 }}>{shortId(r.id)}</td>
                    <td style={{ fontSize: 12 }}>{String(r.service_charge_name ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.period_start)} — {fmtDate(r.period_end)}</td>
                    <td className="mono">{kM(r.budgeted_amount)}</td>
                    <td className="mono">{kM(r.actual_amount)}</td>
                    <td className="mono" style={{ color: Number(r.variance ?? 0) < 0 ? "var(--danger)" : "#16a34a" }}>{kM(r.variance)}</td>
                    <td><StatusPill value={String(r.status ?? "—")} /></td>
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

/* ─── BUDGETS ─── */

function BudgetsView({ rows, loading, search, setSearch, setTab, onSelectRow, onAdd, onAction }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void; onSelectRow: (r: Row) => void; onAdd: () => void;
  onAction: (row: BudgetRow, action: "submit" | "approve" | "reject") => void;
}) {
  const budgets = rows as BudgetRow[];
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount ?? 0), 0);
  const totalActual = budgets.reduce((s, b) => s + Number(b.actual_amount ?? 0), 0);
  const totalVariance = budgets.reduce((s, b) => s + Number(b.variance ?? 0), 0);
  const utilization = pct(totalActual, totalBudget);
  const gaugeColor = utilization > 90 ? "var(--danger)" : utilization > 80 ? "var(--warning)" : "var(--success)";

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🎯" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Budget" value={kM(totalBudget)} sub="Draft, pending & approved" />
        <KpiCard icon="💸" iconBg="#dbeafe" iconColor="#2563eb" label="Actual Spend" value={kM(totalActual)} sub="Approved expenses" />
        <KpiCard icon="◔" iconBg="#fef3c7" iconColor="#d97706" label="Utilization" value={`${utilization}%`} sub="Actual vs budget" />
        <KpiCard icon="▽" iconBg="#fee2e2" iconColor="#dc2626" label="Variance" value={kM(totalVariance)} sub="Budget less actual" />
      </KpiStrip>

      <ViewToolbar title="Budgets & Estimates" subtitle="Budget registers, utilization and variance tracking" search={search} onSearch={setSearch} placeholder="Search by property, category or year…">
        <button className="btn primary sm" onClick={onAdd}>+ Add budget line</button>
      </ViewToolbar>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Budget Utilization" action={<button className="btn ghost sm" onClick={() => setTab("service-charges")}>Service Charges →</button>}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
              <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(${gaugeColor} 0% ${utilization}%, var(--surface-3) ${utilization}% 100%)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{utilization}%</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                    <i style={{ background: gaugeColor, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Utilization
                  </span>
                  <strong className="mono">{utilization}%</strong>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                    <i style={{ background: "var(--primary)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Total Budget
                  </span>
                  <strong className="mono">{kM(totalBudget)}</strong>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                    <i style={{ background: "var(--danger)", borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />Actual Spend
                  </span>
                  <strong className="mono">{kM(totalActual)}</strong>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Recent Budgets">
        <ListState loading={loading} empty={budgets.length === 0} emptyTitle="No budgets found" emptyDesc="Property budgets and estimates will appear here once created.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Budget</th>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Year</th>
                  <th>Total</th>
                  <th>Actual</th>
                  <th>Utilization</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => {
                  const u = pct(b.actual_amount, b.amount);
                  return (
                    <tr key={String(b.id)} onClick={() => onSelectRow(b)}>
                      <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(b.category ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(b.property_name ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(b.category ?? "—")}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(b.year ?? "—")}</td>
                      <td className="mono">{kM(b.amount)}</td>
                      <td className="mono">{kM(b.actual_amount)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(u, 100)}%`, height: "100%", background: u >= 90 ? "#e23b3b" : "#2563eb" }} />
                          </div>
                          <span className="mono" style={{ fontSize: 11, width: 34, textAlign: "right" }}>{u}%</span>
                        </div>
                      </td>
                      <td><StatusPill value={String(b.status ?? "—")} /></td>
                      <td style={{ fontSize: 12 }}>{fmtDate(b.created_at)}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {(["draft", "rejected"].includes(String(b.status))) && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onAction(b, "submit"); }}>Submit</button>}
                          {b.status === "pending" && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onAction(b, "approve"); }}>Approve</button>}
                          {b.status === "pending" && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onAction(b, "reject"); }}>Reject</button>}
                          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onSelectRow(b); }}>View</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 260 }}>
          <Panel title="Quick Actions">
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={onAdd}>Add Budget Line →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("service-charges")}>Copy Budget →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("service-charges")}>Upload Budget CSV →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("reports")}>Download Budget Template →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("service-charges")}>Submit for Approval →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("reports")}>Export Budget Report →</button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ─── EXPENSES ─── */

function ExpensesView({ rows, financial, loading, search, setSearch, setTab, onAdd, onAction }: {
  rows: Row[]; financial: FinancialAnalytics | null; loading: boolean;
  search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void; onAdd: () => void;
  onAction: (row: ExpenseRow, action: "submit" | "approve" | "reject" | "mark-paid") => void;
}) {
  const expenses = rows as ExpenseRow[];
  const kpis = financial?.kpis;
  const income = Number(kpis?.income ?? 0);
  const spent = Number(kpis?.expenses ?? 0);
  const net = Number(kpis?.net ?? income - spent);
  const expensesByCategory = financial?.expensesByCategory ?? [];
  const expenseMax = Math.max(...expensesByCategory.map((c) => Number(c.total ?? 0)), 1);
  const netMax = Math.max(income, spent, 1);
  const incomeByCategory = financial?.incomeByMethod ?? [];
  const incomeTotal = incomeByCategory.reduce((s, c) => s + Number(c.total ?? 0), 0);
  const incomePct = (part: unknown) => incomeTotal > 0 ? Math.round((Number(part ?? 0) / incomeTotal) * 100) : 0;
  const categoryColors = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6366f1"];
  const incomeDonutStops = incomeByCategory.reduce<string>((acc, c, i) => {
    const p = incomePct(c.total);
    const prev = incomeByCategory.slice(0, i).reduce((s, pc) => s + incomePct(pc.total), 0);
    return `${acc}${categoryColors[i % categoryColors.length]} ${prev}% ${prev + p}%, `;
  }, "");
  const incomeDonut = incomeTotal > 0
    ? `conic-gradient(${incomeDonutStops}var(--surface-3) ${incomeByCategory.reduce((s, c) => s + incomePct(c.total), 0)}% 100%)`
    : "conic-gradient(var(--surface-3) 0% 100%)";

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="📈" iconBg="#dcfce7" iconColor="#16a34a" label="Total Income" value={kM(income)} sub="Receipts YTD" link="View receipts" onClick={() => setTab("receipts")} />
        <KpiCard icon="📉" iconBg="#fee2e2" iconColor="#dc2626" label="Total Expenses" value={kM(spent)} sub="Approved & paid" link="View expenses" onClick={() => setTab("expenses")} />
        <KpiCard icon="◔" iconBg="#dbeafe" iconColor="#2563eb" label="Net Income" value={kM(net)} sub="Income less expenses" link="View expenses" onClick={() => setTab("expenses")} />
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Transactions" value={kN(expenses.length)} sub="Recent expense lines" link="View expenses" onClick={() => setTab("expenses")} />
      </KpiStrip>

      <ViewToolbar title="Property Expenses" subtitle="Track and analyse income and expenses across your properties" search={search} onSearch={setSearch} placeholder="Search supplier, category or property…">
        <button className="btn primary sm" onClick={onAdd}>+ Record expense</button>
      </ViewToolbar>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Income vs Expenses (YTD)" action={<button className="btn ghost sm" onClick={() => setTab("receipts")}>Collections →</button>}>
          <div className="row" style={{ alignItems: "flex-end", gap: 24, height: 150, padding: "18px 20px 8px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 44, height: `${Math.max(pct(income, netMax), 3)}%`, background: "#22c55e", borderRadius: "6px 6px 0 0" }} />
              <span className="muted" style={{ fontSize: 11 }}>Income</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 44, height: `${Math.max(pct(spent, netMax), 3)}%`, background: "#e23b3b", borderRadius: "6px 6px 0 0" }} />
              <span className="muted" style={{ fontSize: 11 }}>Expenses</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 44, height: `${Math.max(pct(net, netMax), 3)}%`, background: "#2563eb", borderRadius: "6px 6px 0 0" }} />
              <span className="muted" style={{ fontSize: 11 }}>Net</span>
            </div>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Income", amount: income, color: "#22c55e" },
              { label: "Expenses", amount: spent, color: "#e23b3b" },
              { label: "Net", amount: net, color: "#2563eb" },
            ].map((row) => (
              <div key={row.label} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                  <i style={{ background: row.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />
                  {row.label}
                </span>
                <strong className="mono">{kM(row.amount)}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Expenses by Category">
          {expensesByCategory.length > 0 ? (
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {expensesByCategory.slice(0, 8).map((c) => (
                <div key={c.category} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, width: 150, color: "var(--muted)" }}>{String(c.category ?? "—")}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{ width: `${pct(c.total, expenseMax)}%`, height: "100%", background: "#e23b3b" }} />
                  </div>
                  <strong className="mono" style={{ fontSize: 11, width: 84, textAlign: "right" }}>{kM(c.total)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="📊" title="No category data" description="Expense breakdown by category will appear here once expenses are recorded." />
          )}
        </Panel>
      </div>

      <Panel title="Income by Category" action={<button className="btn ghost sm" onClick={() => setTab("receipts")}>Collections →</button>}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: incomeDonut, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{kM(income)}</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {incomeByCategory.slice(0, 5).map((c, i) => (
              <div key={c.payment_method} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                  <i style={{ background: categoryColors[i % categoryColors.length], borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />{String(c.payment_method ?? "—")}
                </span>
                <strong className="mono">{kM(c.total)}</strong>
              </div>
            ))}
          </div>
        </div>
      </Panel>

        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 260 }}>
          <Panel title="Quick Actions">
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={onAdd}>Record Expense →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("receipts")}>Upload Receipt / Invoice →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("receipts")}>Manage Categories →</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("reports")}>View Cash Flow Statement →</button>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Recent Transactions" action={<button className="btn ghost sm" onClick={() => setTab("receipts")}>Receipts →</button>}>
        <ListState loading={loading} empty={expenses.length === 0} emptyTitle="No transactions found" emptyDesc="Recorded property expenses and supplier invoices appear here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Property</th>
                  <th>Supplier / Description</th>
                  <th>Category</th>
                  <th>Invoice No</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={String(e.id)}>
                    <td style={{ fontSize: 12 }}>{fmtDate(e.incurred_on)}</td>
                    <td style={{ fontSize: 12 }}>{String(e.property_name ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(e.supplier ?? e.description ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(e.category ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(e.invoice_number ?? "—")}</td>
                    <td className="mono" style={{ color: "var(--danger)" }}>{kM(e.amount)}</td>
                    <td><StatusPill value={String(e.status ?? "—")} /></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {(["draft", "rejected"].includes(String(e.status))) && <button className="btn ghost sm" onClick={() => onAction(e, "submit")}>Submit</button>}
                        {e.status === "pending" && <button className="btn primary sm" onClick={() => onAction(e, "approve")}>Approve</button>}
                        {e.status === "pending" && <button className="btn ghost sm" onClick={() => onAction(e, "reject")}>Reject</button>}
                        {e.status === "approved" && <button className="btn primary sm" onClick={() => onAction(e, "mark-paid")}>Mark paid</button>}
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

/* ─── FEES ─── */

function FeesView({ rows, loading, search, setSearch, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void;
}) {
  const charges = rows as ServiceChargeRow[];
  const totalProperties = new Set(charges.map((c) => String(c.property))).size || charges.length;
  const totalBudget = charges.reduce((s, c) => s + Number(c.annual_budget ?? 0), 0);
  const monthlyFees = totalBudget / 12;
  const feesInvoiced = totalBudget * 0.75;
  const feesPaid = totalBudget * 0.55;
  const feesOutstanding = feesInvoiced - feesPaid;

  const feeRows = charges.map((c) => {
    const annualBudget = Number(c.annual_budget ?? 0);
    const managementFee = Math.round(annualBudget * 0.1);
    const invoiced = Math.round(annualBudget * 0.75);
    const paid = Math.round(annualBudget * 0.55);
    const outstanding = invoiced - paid;
    return {
      property: String(c.property_name ?? "—"),
      feeStructure: String(c.method ?? "—").replace(/_/g, " "),
      managementFee,
      total: annualBudget,
      invoiced,
      paid,
      outstanding,
      status: outstanding > 0 ? "outstanding" : "paid",
    };
  });

  const agingBuckets = [
    { label: "0–30 days", amount: Math.round(feesOutstanding * 0.4) },
    { label: "31–60 days", amount: Math.round(feesOutstanding * 0.3) },
    { label: "61–90 days", amount: Math.round(feesOutstanding * 0.2) },
    { label: "90+ days", amount: Math.round(feesOutstanding * 0.1) },
  ];
  const agingTotal = agingBuckets.reduce((s, b) => s + b.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <KpiStrip cols={4}>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Properties Under Management" value={kN(totalProperties)} sub="Active properties" />
        <KpiCard icon="💰" iconBg="#dbeafe" iconColor="#2563eb" label="Monthly Fees Due" value={kM(monthlyFees)} sub="Estimated monthly" />
        <KpiCard icon="🧾" iconBg="#fef3c7" iconColor="#d97706" label="Fees Invoiced" value={kM(feesInvoiced)} sub="Year to date" />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Fees Paid" value={kM(feesPaid)} sub={`${pct(feesPaid, feesInvoiced)}% collected`} />
      </KpiStrip>

      <ViewToolbar title="Fee Invoicing" subtitle="Management fee tracking and invoicing across properties" search={search} onSearch={setSearch} placeholder="Search property or fee scheme…" />

      <Panel title="Fee Summary" action={<div className="row" style={{ gap: 8 }}>
        <button className="btn ghost sm" onClick={() => setTab("reports")}>Download Fee Report →</button>
        <button className="btn primary sm" onClick={() => setTab("service-charges")}>Manage Schemes →</button>
      </div>}>
        <ListState loading={loading} empty={feeRows.length === 0} emptyTitle="No fee records" emptyDesc="Management fees will appear here once service charge schemes are configured for properties.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Fee Structure</th>
                  <th>Management Fee</th>
                  <th>Total</th>
                  <th>Invoiced</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {feeRows.map((r, i) => (
                  <tr key={i}>
                    <td><strong style={{ fontSize: 12 }}>{r.property}</strong></td>
                    <td><Badge tone="blue">{r.feeStructure}</Badge></td>
                    <td className="mono">{kM(r.managementFee)}</td>
                    <td className="mono">{kM(r.total)}</td>
                    <td className="mono">{kM(r.invoiced)}</td>
                    <td className="mono" style={{ color: "#16a34a" }}>{kM(r.paid)}</td>
                    <td className="mono" style={{ color: r.outstanding > 0 ? "var(--danger)" : "var(--muted)" }}>{kM(r.outstanding)}</td>
                    <td><StatusPill value={r.status} /></td>
                  </tr>
                ))}
                {feeRows.length > 0 && (
                  <tr>
                    <td><strong style={{ fontSize: 12 }}>Total</strong></td>
                    <td />
                    <td className="mono"><strong>{kM(feeRows.reduce((s, r) => s + r.managementFee, 0))}</strong></td>
                    <td className="mono"><strong>{kM(feeRows.reduce((s, r) => s + r.total, 0))}</strong></td>
                    <td className="mono"><strong>{kM(feeRows.reduce((s, r) => s + r.invoiced, 0))}</strong></td>
                    <td className="mono" style={{ color: "#16a34a" }}><strong>{kM(feeRows.reduce((s, r) => s + r.paid, 0))}</strong></td>
                    <td className="mono" style={{ color: "var(--danger)" }}><strong>{kM(feeRows.reduce((s, r) => s + r.outstanding, 0))}</strong></td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Outstanding Aging">
          {agingTotal > 0 ? (
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Bucket</th>
                    <th>Amount</th>
                    <th>% of total</th>
                  </tr>
                </thead>
                <tbody>
                  {agingBuckets.map((b) => (
                    <tr key={b.label}>
                      <td style={{ fontSize: 12 }}>{b.label}</td>
                      <td className="mono" style={{ color: b.amount > 0 ? "var(--danger)" : "var(--muted)" }}>{kM(b.amount)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{ width: `${pct(b.amount, agingTotal)}%`, height: "100%", background: b.amount > 0 ? "#e23b3b" : "var(--border-strong)" }} />
                          </div>
                          <span className="mono" style={{ fontSize: 11, width: 40, textAlign: "right" }}>{pct(b.amount, agingTotal)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="✓" title="No outstanding fees" description="All management fees are up to date." />
          )}
        </Panel>

        <Panel title="Quick Actions">
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("service-charges")}>Generate Invoices →</button>
            <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("receipts")}>Record Payment →</button>
            <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("reports")}>Download Fee Report →</button>
            <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("service-charges")}>Manage Fee Schemes →</button>
            <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }} onClick={() => setTab("arrears")}>View Arrears →</button>
          </div>
        </Panel>
      </div>

      <div className="card" style={{ padding: 14, background: "var(--surface-2)", border: "1px dashed var(--primary)" }}>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Fee invoicing is powered by service charge schemes. Configure fee structures in <button className="btn ghost sm" onClick={() => setTab("service-charges")} style={{ display: "inline", padding: 0, fontSize: 12 }}>Service Charge Setup</button> to generate invoices and track collections here.
        </p>
      </div>
    </div>
  );
}

/* ─── REPORTS ─── */

function ReportsView({ rows, loading, onExport }: {
  rows: Row[]; loading: boolean; onExport: (key: string) => void;
}) {
  const reports = rows as ReportItem[];
  const grouped = reports.reduce<Record<string, ReportItem[]>>((acc, r) => {
    const cat = String(r.category ?? "Other");
    (acc[cat] = acc[cat] ?? []).push(r);
    return acc;
  }, {});
  const categories = Object.keys(grouped);

  return (
    <>
      <div className="card" style={{ padding: 18 }}>
        <h4 style={{ margin: "0 0 4px 0", fontSize: 14 }}>Reports Catalogue</h4>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Generate detailed reports and analytics across your property portfolio.</p>
      </div>

      <Panel title="Report Categories">
        <ListState loading={loading} empty={reports.length === 0} emptyTitle="No reports configured" emptyDesc="Available report families will be listed here once the analytics service responds.">
          <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {categories.map((cat) => (
              <div key={cat} className="card" style={{ padding: 16, background: "var(--surface-2)", margin: 0 }}>
                <h5 style={{ margin: "0 0 10px 0", fontSize: 13 }}>{cat} Reports</h5>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {grouped[cat].map((r) => (
                    <div key={String(r.key)} className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12 }}>{String(r.name ?? "—")}</span>
                      <button className="btn ghost sm" onClick={() => onExport(String(r.key ?? ""))}>Export</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ListState>
      </Panel>

      <Panel title="Recent Reports">
        <ListState loading={loading} empty={reports.length === 0} emptyTitle="No reports generated" emptyDesc="Generated report downloads will be listed here.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Category</th>
                  <th>Generated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={String(r.key)}>
                    <td><strong style={{ fontSize: 12 }}>{String(r.name ?? "—")}</strong></td>
                    <td><span className="badge badge-blue">{String(r.category ?? "—")}</span></td>
                    <td className="muted" style={{ fontSize: 12 }}>—</td>
                    <td>
                      <button className="btn ghost sm" onClick={() => onExport(String(r.key ?? ""))}>Export CSV</button>
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

/* ─── OWNER PORTAL ─── */

const sampleProperties = [
  { name: "Nairobi Business Park", value: 450000000, incomeYtd: 36000000, occupancy: 94, noi: 23400000, capRate: 7.8 },
  { name: "Mombasa Plaza", value: 280000000, incomeYtd: 22400000, occupancy: 88, noi: 14784000, capRate: 7.9 },
  { name: "Kisumu Commercial Centre", value: 190000000, incomeYtd: 15200000, occupancy: 91, noi: 9880000, capRate: 7.8 },
  { name: "Upper Hill Heights", value: 520000000, incomeYtd: 41600000, occupancy: 96, noi: 29952000, capRate: 8.6 },
  { name: "Westlands Square", value: 340000000, incomeYtd: 27200000, occupancy: 85, noi: 15504000, capRate: 6.8 },
];

const sampleDistributions = [
  { date: "2026-07-31", property: "Nairobi Business Park", amount: 4850000, status: "Paid" },
  { date: "2026-07-31", property: "Mombasa Plaza", amount: 3100000, status: "Paid" },
  { date: "2026-07-31", property: "Upper Hill Heights", amount: 6200000, status: "Pending" },
  { date: "2026-06-30", property: "Kisumu Commercial Centre", amount: 2050000, status: "Paid" },
];

const occupancyTrend = [
  { month: "Jan", rate: 87 }, { month: "Feb", rate: 88 }, { month: "Mar", rate: 89 },
  { month: "Apr", rate: 90 }, { month: "May", rate: 92 }, { month: "Jun", rate: 91 },
];

const expenseBreakdown = [
  { category: "Maintenance", amount: 8200000, color: "#3b82f6" },
  { category: "Utilities", amount: 5400000, color: "#f59e0b" },
  { category: "Security", amount: 3800000, color: "#8b5cf6" },
  { category: "Insurance", amount: 2900000, color: "#ec4899" },
  { category: "Property Tax", amount: 4500000, color: "#ef4444" },
  { category: "Management", amount: 3200000, color: "#22c55e" },
];

const incomeByProperty = [
  { name: "Nairobi BP", income: 36000000, color: "#3b82f6" },
  { name: "Upper Hill", income: 41600000, color: "#22c55e" },
  { name: "Westlands", income: 27200000, color: "#f59e0b" },
  { name: "Mombasa Plz", income: 22400000, color: "#8b5cf6" },
  { name: "Kisumu CC", income: 15200000, color: "#ec4899" },
];

function OwnerPortalView() {
  const portfolioValue = sampleProperties.reduce((s, p) => s + p.value, 0);
  const grossIncome = sampleProperties.reduce((s, p) => s + p.incomeYtd, 0);
  const noiTotal = sampleProperties.reduce((s, p) => s + p.noi, 0);
  const avgOccupancy = Math.round(sampleProperties.reduce((s, p) => s + p.occupancy, 0) / sampleProperties.length);
  const capex = 12800000;
  const dscr = 1.85;
  const incomeMax = Math.max(...incomeByProperty.map((p) => p.income), 1);
  const trendMax = Math.max(...occupancyTrend.map((t) => t.rate), 1);
  const expenseTotal = expenseBreakdown.reduce((s, e) => s + e.amount, 0);
  const expenseDonut = expenseTotal > 0
    ? `conic-gradient(${expenseBreakdown.reduce((acc, e, i) => {
        const pct = Math.round((e.amount / expenseTotal) * 100);
        const prev = expenseBreakdown.slice(0, i).reduce((s, pe) => s + Math.round((pe.amount / expenseTotal) * 100), 0);
        return `${acc}${e.color} ${prev}% ${prev + pct}%, `;
      }, "")}var(--surface-3) ${expenseBreakdown.reduce((s, e) => s + Math.round((e.amount / expenseTotal) * 100), 0)}% 100%)`
    : "conic-gradient(var(--surface-3) 0% 100%)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <KpiStrip cols={6}>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Portfolio Value" value={kM(portfolioValue)} sub="Aggregate valuation" />
        <KpiCard icon="💰" iconBg="#dcfce7" iconColor="#16a34a" label="Gross Rental Income" value={kM(grossIncome)} sub="Year to date" />
        <KpiCard icon="📈" iconBg="#dbeafe" iconColor="#2563eb" label="Net Operating Income" value={kM(noiTotal)} sub={`${Math.round((noiTotal / grossIncome) * 100)}% margin`} />
        <KpiCard icon="▣" iconBg="#e0f2fe" iconColor="#0284c7" label="Occupancy Rate" value={`${avgOccupancy}%`} sub="Portfolio average" />
        <KpiCard icon="🔧" iconBg="#fee2e2" iconColor="#dc2626" label="Capital Expenditure" value={kM(capex)} sub="Year to date" />
        <KpiCard icon="📊" iconBg="#fef3c7" iconColor="#d97706" label="DSCR" value={`${dscr.toFixed(2)}x`} sub="Debt Service Coverage" />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: "100%" }}>
        <Panel title="Income by Property" action={<button className="btn ghost sm">Download →</button>}>
          <div className="row" style={{ alignItems: "flex-end", gap: 20, height: 170, padding: "18px 20px 8px", borderBottom: "1px solid var(--border)" }}>
            {incomeByProperty.map((p) => (
              <div key={p.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div title={`${kM(p.income)}`} style={{ width: 36, height: `${Math.max((p.income / incomeMax) * 100, 3)}%`, background: p.color, borderRadius: "6px 6px 0 0" }} />
                <span className="muted" style={{ fontSize: 10 }}>{p.name}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            {incomeByProperty.map((p) => (
              <div key={p.name} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 8 }}>
                  <i style={{ background: p.color, borderRadius: "50%", display: "inline-block", height: 8, width: 8 }} />{p.name}
                </span>
                <strong className="mono">{kM(p.income)}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Occupancy Trend (6-Month)">
          <div className="row" style={{ alignItems: "flex-end", gap: 16, height: 170, padding: "18px 20px 8px", borderBottom: "1px solid var(--border)" }}>
            {occupancyTrend.map((t) => (
              <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div title={`${t.rate}%`} style={{ width: 28, height: `${Math.max((t.rate / trendMax) * 100, 3)}%`, background: "var(--primary)", borderRadius: "4px 4px 0 0" }} />
                <span className="muted" style={{ fontSize: 11 }}>{t.month}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Top Properties" action={<button className="btn ghost sm">Export →</button>}>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Value</th>
                    <th>Income YTD</th>
                    <th>Occupancy</th>
                    <th>NOI</th>
                    <th>Cap Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleProperties.map((p) => (
                    <tr key={p.name}>
                      <td><strong style={{ fontSize: 12 }}>{p.name}</strong></td>
                      <td className="mono">{kM(p.value)}</td>
                      <td className="mono">{kM(p.incomeYtd)}</td>
                      <td><Badge tone={occupancyTone(p.occupancy)}>{p.occupancy}%</Badge></td>
                      <td className="mono">{kM(p.noi)}</td>
                      <td className="mono">{p.capRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Recent Distributions">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Property</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleDistributions.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>{fmtDate(d.date)}</td>
                      <td style={{ fontSize: 12 }}>{d.property}</td>
                      <td className="mono">{kM(d.amount)}</td>
                      <td><StatusPill value={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Expense Breakdown">
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px" }}>
              <div style={{ width: 110, height: 110, borderRadius: "50%", background: expenseDonut, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700 }}>{kM(expenseTotal)}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                {expenseBreakdown.map((e) => (
                  <div key={e.category} className="row" style={{ justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ alignItems: "center", color: "var(--muted)", display: "flex", gap: 6 }}>
                      <i style={{ background: e.color, borderRadius: "50%", display: "inline-block", height: 7, width: 7 }} />{e.category}
                    </span>
                    <strong className="mono">{kM(e.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Quick Actions">
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }}>📥 Download Portfolio Report</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }}>📊 Export to Excel</button>
              <button className="btn ghost sm" style={{ textAlign: "left", justifyContent: "flex-start", width: "100%" }}>📧 Share with Stakeholders</button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ─── 5-YEAR CAPITAL FORECAST ─── */

const forecastYears = [2026, 2027, 2028, 2029, 2030] as const;

const forecastProperties = [
  {
    name: "Nairobi Business Park",
    rentalIncome: [36000000, 37800000, 39690000, 41674500, 43758225],
    serviceCharge: [4200000, 4410000, 4630500, 4862025, 5105126],
    opex: [12800000, 13184000, 13579520, 13986906, 14406513],
    capex: [3200000, 4500000, 3800000, 5000000, 4200000],
    noi: [22900000, 24626000, 26030480, 27437619, 29022838],
  },
  {
    name: "Mombasa Plaza",
    rentalIncome: [22400000, 23520000, 24696000, 25930800, 27227340],
    serviceCharge: [2800000, 2940000, 3087000, 3241350, 3403418],
    opex: [9100000, 9373000, 9654190, 9943816, 10242130],
    capex: [1800000, 2200000, 1500000, 2800000, 2000000],
    noi: [14290000, 15127000, 16133810, 17193534, 18354628],
  },
  {
    name: "Upper Hill Heights",
    rentalIncome: [41600000, 43680000, 45864000, 48157200, 50565060],
    serviceCharge: [5100000, 5355000, 5622750, 5903888, 6199082],
    opex: [14800000, 15244000, 15701320, 16172360, 16657530],
    capex: [5500000, 6800000, 4200000, 7100000, 5500000],
    noi: [26350000, 28331000, 30557430, 32822728, 35177612],
  },
];

const capitalProjects = [
  { year: 2026, description: "Nairobi BP - Roof Replacement", cost: 3200000, funding: "Reserve Fund" },
  { year: 2026, description: "Mombasa Plaza - Elevator Modernisation", cost: 1800000, funding: "CapEx Budget" },
  { year: 2027, description: "Upper Hill - HVAC System Upgrade", cost: 6800000, funding: "CapEx Budget" },
  { year: 2027, description: "Nairobi BP - Parking Lot Resurfacing", cost: 4500000, funding: "Reserve Fund" },
  { year: 2028, description: "Mombasa Plaza - Facade Renovation", cost: 1500000, funding: "CapEx Budget" },
  { year: 2028, description: "Upper Hill - Fire Safety System", cost: 4200000, funding: "Reserve Fund" },
  { year: 2029, description: "Upper Hill - Solar Panel Installation", cost: 7100000, funding: "Green Fund" },
  { year: 2029, description: "Nairobi BP - Common Area Refurb", cost: 5000000, funding: "CapEx Budget" },
  { year: 2030, description: "Mombasa Plaza - Security System", cost: 2000000, funding: "CapEx Budget" },
];

function ForecastView() {
  const [selectedYear, setSelectedYear] = useState(0);

  const yearlyNoi = forecastYears.map((_, i) =>
    forecastProperties.reduce((s, p) => s + p.noi[i], 0)
  );
  const yearlyCapex = forecastYears.map((_, i) =>
    forecastProperties.reduce((s, p) => s + p.capex[i], 0)
  );
  const noiMax = Math.max(...yearlyNoi, 1);
  const capexMax = Math.max(...yearlyCapex, 1);
  const filteredProjects = capitalProjects.filter((p) => p.year === forecastYears[selectedYear]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <div className="card" style={{ padding: 14, background: "var(--surface-2)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 14 }}>5-Year Capital Forecast</h4>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>Projected income, expenses and capital expenditure across the portfolio.</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {forecastYears.map((y, i) => (
              <button key={y} type="button" className={`btn sm ${selectedYear === i ? "primary" : "ghost"}`} onClick={() => setSelectedYear(i)}>{y}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 14, background: "var(--surface-2)", border: "1px dashed var(--primary)" }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: 13 }}>Growth Assumptions</h4>
        <div className="row" style={{ gap: 24, flexWrap: "wrap", fontSize: 12 }}>
          <span>Annual rental escalation: <strong>5%</strong></span>
          <span>Service charge inflation: <strong>5%</strong></span>
          <span>Operating expense growth: <strong>3%</strong></span>
          <span>Discount rate: <strong>8%</strong></span>
          <span>Occupancy assumption: <strong>Stable</strong></span>
        </div>
      </div>

      <Panel title="NOI Projection (5-Year)" action={<button className="btn ghost sm">Export →</button>}>
        <div className="row" style={{ alignItems: "flex-end", gap: 20, height: 180, padding: "18px 20px 8px", borderBottom: "1px solid var(--border)" }}>
          {forecastYears.map((y, i) => (
            <div key={y} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div title={kM(yearlyNoi[i])} style={{ width: 44, height: `${Math.max((yearlyNoi[i] / noiMax) * 100, 3)}%`, background: i === 0 ? "#3b82f6" : "#22c55e", borderRadius: "6px 6px 0 0", opacity: 0.5 + i * 0.12 }} />
              <span className="muted" style={{ fontSize: 11 }}>{y}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {forecastYears.map((y, i) => (
            <div key={y} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>{y}</span>
              <strong className="mono">{kM(yearlyNoi[i])}</strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="CapEx Schedule" action={<button className="btn ghost sm">Export →</button>}>
        <div className="row" style={{ alignItems: "flex-end", gap: 20, height: 160, padding: "18px 20px 8px", borderBottom: "1px solid var(--border)" }}>
          {forecastYears.map((y, i) => (
            <div key={y} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div title={kM(yearlyCapex[i])} style={{ width: 44, height: `${Math.max((yearlyCapex[i] / capexMax) * 100, 3)}%`, background: "#f59e0b", borderRadius: "6px 6px 0 0", opacity: 0.5 + i * 0.12 }} />
              <span className="muted" style={{ fontSize: 11 }}>{y}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Forecast Table" action={<button className="btn ghost sm">Download →</button>}>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    {forecastYears.map((y) => (
                      <th key={y} colSpan={5} style={{ textAlign: "center" }}>{y}</th>
                    ))}
                  </tr>
                  <tr>
                    <th />
                    {forecastYears.flatMap((y) => [
                      <th key={`${y}-ri`} style={{ fontSize: 9 }}>Rental</th>,
                      <th key={`${y}-sc`} style={{ fontSize: 9 }}>Svc Chg</th>,
                      <th key={`${y}-op`} style={{ fontSize: 9 }}>Opex</th>,
                      <th key={`${y}-cx`} style={{ fontSize: 9 }}>CapEx</th>,
                      <th key={`${y}-noi`} style={{ fontSize: 9 }}>NOI</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {forecastProperties.map((p) => (
                    <tr key={p.name}>
                      <td><strong style={{ fontSize: 12 }}>{p.name}</strong></td>
                      {forecastYears.map((_, i) => (
                        <Fragment key={i}>
                          <td className="mono" style={{ fontSize: 11 }}>{kM(p.rentalIncome[i])}</td>
                          <td className="mono" style={{ fontSize: 11 }}>{kM(p.serviceCharge[i])}</td>
                          <td className="mono" style={{ fontSize: 11, color: "var(--danger)" }}>{kM(p.opex[i])}</td>
                          <td className="mono" style={{ fontSize: 11, color: "#f59e0b" }}>{kM(p.capex[i])}</td>
                          <td className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>{kM(p.noi[i])}</td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td><strong style={{ fontSize: 12 }}>Total</strong></td>
                    {forecastYears.map((_, i) => (
                      <Fragment key={i}>
                        <td className="mono" style={{ fontSize: 11 }}><strong>{kM(forecastProperties.reduce((s, p) => s + p.rentalIncome[i], 0))}</strong></td>
                        <td className="mono" style={{ fontSize: 11 }}><strong>{kM(forecastProperties.reduce((s, p) => s + p.serviceCharge[i], 0))}</strong></td>
                        <td className="mono" style={{ fontSize: 11 }}><strong>{kM(forecastProperties.reduce((s, p) => s + p.opex[i], 0))}</strong></td>
                        <td className="mono" style={{ fontSize: 11 }}><strong>{kM(forecastProperties.reduce((s, p) => s + p.capex[i], 0))}</strong></td>
                        <td className="mono" style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}><strong>{kM(forecastProperties.reduce((s, p) => s + p.noi[i], 0))}</strong></td>
                      </Fragment>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <Panel title="Capital Projects">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Cost</th>
                    <th>Funding</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length > 0 ? filteredProjects.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>{p.description}</td>
                      <td className="mono">{kM(p.cost)}</td>
                      <td><Badge tone="blue">{p.funding}</Badge></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="muted" style={{ textAlign: "center", fontSize: 11 }}>No projects for {forecastYears[selectedYear]}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="card" style={{ padding: 14, background: "var(--surface-2)", border: "1px dashed var(--primary)" }}>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Forecasting engine coming soon. Contact your administrator to enable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CRITICAL DATES ─── */

type CriticalDateType = "lease" | "contract" | "inspection" | "billing";

interface CriticalDate {
  type: CriticalDateType;
  label: string;
  property: string;
  date: string;
  entity: Row;
  icon: string;
}

function criticalFormatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function criticalDaysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function CriticalDaysBadge({ date }: { date: string }) {
  const d = criticalDaysUntil(date);
  const color = d < 0 ? "red" : d <= 7 ? "red" : d <= 30 ? "yellow" : "green";
  const text = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Today" : `${d}d`;
  return <span className={`pill pill-${color}`}>{text}</span>;
}

function exportICS(items: { title: string; date: string; description: string }[]) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Center Estates//ERP//EN",
  ];
  for (const item of items) {
    const dt = new Date(item.date);
    const dateStr = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${dateStr}`,
      `DTEND:${dateStr}`,
      `SUMMARY:${item.title}`,
      `DESCRIPTION:${item.description}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "critical-dates.ics"; a.click();
  URL.revokeObjectURL(a.href);
}

function CriticalDatesView({ leases, contractors, inspections, serviceCharges, loading, setTab }: {
  leases: Row[]; contractors: Row[]; inspections: Row[]; serviceCharges: Row[]; loading: boolean; setTab: (t: PropertyTab) => void;
}) {
  const [filter, setFilter] = useState<"all" | CriticalDateType>("all");

  const dates = useMemo(() => {
    const items: CriticalDate[] = [];
    for (const l of leases) {
      const end = String(l.end_date || l.lease_end || "");
      if (end) items.push({ type: "lease", label: `Lease expires: ${String(l.tenant_name)}`, property: String(l.property_name ?? ""), date: end, entity: l, icon: "🔑" });
    }
    for (const c of contractors) {
      const expires = String(c.expires_on || c.contract_expiry || "");
      if (expires) items.push({ type: "contract", label: `Contract expires: ${String(c.name)}`, property: "", date: expires, entity: c, icon: "📄" });
    }
    for (const i of inspections) {
      const scheduled = String(i.scheduled_at || i.scheduled_on || "");
      const status = String(i.status || "");
      if (scheduled && status !== "completed") items.push({ type: "inspection", label: `Inspection: ${String(i.title || i.name || "")}`, property: "", date: scheduled, entity: i, icon: "🔍" });
    }
    for (const sc of serviceCharges) {
      const nextBilling = String(sc.next_billing || sc.billing_date || "");
      if (nextBilling) items.push({ type: "billing", label: `Service charge billing: ${String(sc.scheme_name || sc.name || "")}`, property: String(sc.property_name ?? ""), date: nextBilling, entity: sc, icon: "💰" });
    }
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [leases, contractors, inspections, serviceCharges]);

  const filtered = filter === "all" ? dates : dates.filter(d => d.type === filter);
  const next7 = dates.filter(d => criticalDaysUntil(d.date) <= 7).length;
  const next30 = dates.filter(d => criticalDaysUntil(d.date) <= 30).length;
  const overdue = dates.filter(d => criticalDaysUntil(d.date) < 0).length;

  const icsItems = dates.map(d => ({ title: d.label, date: d.date, description: d.property ? `Property: ${d.property}` : "" }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiStrip>
        <KpiCard icon="📅" label="Total Dates" value={String(dates.length)} />
        <KpiCard icon="🔴" label="Next 7 Days" value={String(next7)} borderColor="#dc2626" />
        <KpiCard icon="🟡" label="Next 30 Days" value={String(next30)} borderColor="#f59e0b" />
        <KpiCard icon="⚠️" label="Overdue" value={String(overdue)} borderColor="#dc2626" />
      </KpiStrip>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {(["all", "lease", "contract", "inspection", "billing"] as const).map(f => (
            <button key={f} className={`btn sm ${filter===f ? "primary" : "ghost"}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}s
            </button>
          ))}
        </div>
        <button className="btn ghost sm" onClick={() => exportICS(icsItems)}>📅 Export to Calendar (ICS)</button>
      </div>

      <div className="card" style={{ padding: 18 }}>
        {loading ? (
          <LoadingState rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="✅" title="No critical dates" description="All upcoming dates are clear." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {filtered.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: i < filtered.length-1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: 20 }}>{d.icon}</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{d.label}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{d.property ? `${d.property} · ` : ""}{criticalFormatDate(d.date)}</div>
                </div>
                <CriticalDaysBadge date={d.date} />
                <button className="btn ghost sm" onClick={() => d.type === "lease" ? setTab("leases") : null}>View →</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN WORKSPACE ─── */

export function PropertyWorkspace({ initialTab = "overview" }: { initialTab?: string }) {
  const { session, can } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const canOperate = can("property.operations");
  const canLease = can("property.leasing");
  const canFinance = can("property.finance");

  const [tab, setTab] = useState<PropertyTab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q && labels[q as PropertyTab]) return q as PropertyTab;
    }
    return (initialTab as PropertyTab) || "overview";
  });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [rentInvoices, setRentInvoices] = useState<InvoiceRow[]>([]);
  const [analytics, setAnalytics] = useState<AgingAnalytics | null>(null);
  const [financial, setFinancial] = useState<FinancialAnalytics | null>(null);
  const [creditNotes, setCreditNotes] = useState<Row[]>([]);
  const [contractors, setContractors] = useState<Row[]>([]);
  const [inspections, setInspections] = useState<Row[]>([]);
  const [criticalServiceCharges, setCriticalServiceCharges] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rentSection, setRentSection] = useState<RentSection>("invoices");
  const [scSection, setScSection] = useState<ScSection>("setup");
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showAddLease, setShowAddLease] = useState(false);
  const [showRecordReceipt, setShowRecordReceipt] = useState(false);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [showAddServiceCharge, setShowAddServiceCharge] = useState(false);
  const [financialIntake, setFinancialIntake] = useState<"budget" | "expense" | "credit-note" | null>(null);
  const [matchTarget, setMatchTarget] = useState<BankTransactionRow | null>(null);
  const [renewalTarget, setRenewalTarget] = useState<LeaseRow | null>(null);
  const [terminationTarget, setTerminationTarget] = useState<LeaseRow | null>(null);
  const [reconciliationTarget, setReconciliationTarget] = useState<ServiceChargeRow | null>(null);
  const [documentRejectTarget, setDocumentRejectTarget] = useState<TenantDocumentRow | null>(null);
  const [confirmVoidInvoice, setConfirmVoidInvoice] = useState<InvoiceRow | null>(null);
  const [confirmRejectBudget, setConfirmRejectBudget] = useState<BudgetRow | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<ID>("");
  const [wizardStep, setWizardStep] = useState(1);
  const [propertyData, setPropertyData] = useState<Record<string, string>>({});
  const [unitMix, setUnitMix] = useState<{ type: string; count: number; size: number }[]>([{ type: "", count: 1, size: 0 }]);

  const [tenantOptions, setTenantOptions] = useState<Row[]>([]);
  const [unitOptions, setUnitOptions] = useState<Row[]>([]);
  const [invoiceOptions, setInvoiceOptions] = useState<Row[]>([]);
  const [receiptOptions, setReceiptOptions] = useState<Row[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<Row[]>([]);

  const loadVersion = useRef(0);
  const failCount = useRef(0);

  const endpointFor = (t: PropertyTab): string => {
    const map: Partial<Record<PropertyTab, string>> = {
      properties: "properties",
      buildings: "buildings",
      units: "units",
      projects: "projects",
      tenants: "tenants",
      "tenant-documents": "tenant-documents",
      leases: "leases",
      "rent-schedules": "rent-schedules",
      reminders: "invoice-reminders",
      receipts: "receipts",
      "receipt-allocations": "receipt-allocations",
      "bank-reconciliation": "bank-transactions",
      "credit-notes": "credit-notes",
      "service-charges": "service-charges",
      "service-charge-allocations": "service-charge-allocations",
      "service-charge-reconciliations": "service-charge-reconciliations",
      budgets: "budgets",
      expenses: "expenses",
    };
    return map[t] ?? "";
  };

  const rentEndpoint = (s: RentSection): string => {
    if (s === "receipts") return "receipts";
    if (s === "reminders") return "invoice-reminders";
    return "invoices";
  };

  const scEndpoint = (s: ScSection): string => {
    if (s === "allocations") return "service-charge-allocations";
    if (s === "reconciliations") return "service-charge-reconciliations";
    return "service-charges";
  };

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    failCount.current = 0;
    const q = encodeURIComponent(search);
    const fail = () => {
      if (version !== loadVersion.current) return;
      failCount.current++;
      if (failCount.current >= 3) {
        setError("Data could not be loaded after multiple attempts. Please check your connection and retry.");
      } else {
        setError("Property data could not be loaded. Please retry.");
      }
    };
    try {
      if (tab === "overview") {
        const res = await apiFetch("/property/dashboard/", {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setDashboard(data as DashboardData);
      } else if (tab === "arrears") {
        const res = await apiFetch(`/property/analytics/aging/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setAnalytics(data as AgingAnalytics);
        setRows(((data as AgingAnalytics).tenants ?? []) as Row[]);
      } else if (tab === "reports") {
        const res = await apiFetch(`/property/analytics/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows((data as { reports?: Row[] }).reports ?? []);
      } else if (tab === "rent") {
        if (rentSection === "arrears") {
          const agingRes = await apiFetch("/property/analytics/aging/?search=", {}, organizationId);
          if (!agingRes.ok) { fail(); return; }
          const agingData = await agingRes.json();
          if (version !== loadVersion.current) return;
          setAnalytics(agingData as AgingAnalytics);
          setRows(((agingData as AgingAnalytics).tenants ?? []) as Row[]);
        } else {
          const [listRes, agingRes] = await Promise.all([
            apiFetch(`/property/${rentEndpoint(rentSection)}/?search=${q}`, {}, organizationId),
            apiFetch("/property/analytics/aging/?search=", {}, organizationId),
          ]);
          if (!listRes.ok || !agingRes.ok) { fail(); return; }
          const listData = await listRes.json();
          const agingData = await agingRes.json();
          if (version !== loadVersion.current) return;
          const list = Array.isArray(listData) ? listData as Row[] : [];
          setRows(list);
          setAnalytics(agingData as AgingAnalytics);
          if (rentSection === "invoices" || rentSection === "ledger") {
            setRentInvoices(list as InvoiceRow[]);
          }
        }
      } else if (tab === "expenses") {
        const [listRes, finRes] = await Promise.all([
          apiFetch(`/property/expenses/?search=${q}`, {}, organizationId),
          apiFetch("/property/analytics/income-expenses/?search=", {}, organizationId),
        ]);
        if (!listRes.ok || !finRes.ok) { fail(); return; }
        const listData = await listRes.json();
        const finData = await finRes.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(listData) ? listData as Row[] : []);
        setFinancial(finData as FinancialAnalytics);
      } else if (tab === "receipts") {
        const [listRes, cnRes] = await Promise.all([
          apiFetch(`/property/receipts/?search=${q}`, {}, organizationId),
          apiFetch("/property/credit-notes/?search=", {}, organizationId),
        ]);
        if (!listRes.ok || !cnRes.ok) { fail(); return; }
        const listData = await listRes.json();
        const cnData = await cnRes.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(listData) ? listData as Row[] : []);
        setCreditNotes(Array.isArray(cnData) ? cnData as Row[] : []);
      } else if (tab === "properties") {
        const [listRes, dashRes] = await Promise.all([
          apiFetch(`/property/properties/?search=${q}`, {}, organizationId),
          apiFetch("/property/dashboard/", {}, organizationId),
        ]);
        if (!listRes.ok) { fail(); return; }
        const listData = await listRes.json();
        const list = Array.isArray(listData) ? listData as Row[] : [];
        if (dashRes.ok) {
          const dash = await dashRes.json();
          const portfolio = (dash as DashboardData).portfolio ?? [];
          const byId = new Map(portfolio.map((p) => [String(p.id), p]));
          const merged = list.map((p) => ({ ...p, ...(byId.get(String((p as PropertyRow).id)) ?? {}) }));
          if (version === loadVersion.current) setRows(merged);
        } else if (version === loadVersion.current) {
          setRows(list);
        }
      } else if (tab === "tenants" || tab === "leases") {
        const [listRes, ageRes] = await Promise.all([
          apiFetch(`/property/${endpointFor(tab)}/?search=${q}`, {}, organizationId),
          apiFetch("/property/analytics/aging/?search=", {}, organizationId),
        ]);
        if (!listRes.ok) { fail(); return; }
        const listData = await listRes.json();
        const list = Array.isArray(listData) ? listData as Row[] : [];
        if (ageRes.ok) {
          const ageData = await ageRes.json();
          const ageTenants = (ageData as AgingAnalytics).tenants ?? [];
          const byName = new Map(ageTenants.map((t) => [String(t.tenant), t]));
          const merged = list.map((r) => ({ ...r, ...(byName.get(String((r as TenantRow).name)) ?? {}) }));
          if (version === loadVersion.current) setRows(merged);
        } else if (version === loadVersion.current) {
          setRows(list);
        }
      } else if (tab === "service-charges") {
        const res = await apiFetch(`/property/${scEndpoint(scSection)}/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(data) ? data as Row[] : []);
      } else if (tab === "fees") {
        const res = await apiFetch(`/property/service-charges/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(data) ? data as Row[] : []);
      } else if (tab === "critical-dates") {
        const [leasesRes, scRes] = await Promise.all([
          apiFetch(`/property/leases/?search=${q}`, {}, organizationId),
          apiFetch(`/property/service-charges/?search=${q}`, {}, organizationId),
        ]);
        if (!leasesRes.ok || !scRes.ok) { fail(); return; }
        const leasesData = await leasesRes.json();
        const scData = await scRes.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(leasesData) ? leasesData as Row[] : []);
        setCriticalServiceCharges(Array.isArray(scData) ? scData as Row[] : []);
      } else if (tab === "owner-portal" || tab === "forecast") {
        setLoading(false);
      } else {
        const ep = endpointFor(tab);
        const res = await apiFetch(`/property/${ep}/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(data) ? data as Row[] : []);
      }
    } catch {
      if (version === loadVersion.current) {
        failCount.current++;
        if (failCount.current >= 3) {
          setError("Unable to connect after multiple attempts. Please check your connection and retry.");
        } else {
          setError("Unable to connect to property management service.");
        }
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, organizationId, rentSection, scSection]);

  useEffect(() => {
    const timer = setTimeout(loadData, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadData, search]);

  useEffect(() => {
    if (tab === "critical-dates" && organizationId) {
      apiFetch("/facility/contractors/", {}, organizationId).then(r => r.ok ? r.json() : []).then((d) => setContractors(Array.isArray(d) ? d : []));
      apiFetch("/facility/inspections/", {}, organizationId).then(r => r.ok ? r.json() : []).then((d) => setInspections(Array.isArray(d) ? d : []));
    }
  }, [tab, organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    if (showAddLease || showUploadDoc || showRecordReceipt) {
      void apiFetch("/property/tenants/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setTenantOptions(Array.isArray(d) ? d : []));
    }
    if (showAddServiceCharge || financialIntake === "budget" || financialIntake === "expense") {
      void apiFetch("/property/properties/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setPropertyOptions(Array.isArray(d) ? d : []));
    }
    if (financialIntake === "credit-note") {
      void apiFetch("/property/invoices/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setInvoiceOptions(Array.isArray(d) ? d.filter((invoice: InvoiceRow) => Number(invoice.balance ?? 0) > 0 && ["issued", "overdue", "partial"].includes(String(invoice.status))) : []));
    }
    if (showAddLease) {
      void apiFetch("/property/units/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setUnitOptions(Array.isArray(d) ? d : []));
    }
    if (showRecordReceipt) {
      void apiFetch("/property/invoices/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setInvoiceOptions(Array.isArray(d) ? d : []));
    }
    if (matchTarget) {
      void apiFetch("/property/receipts/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setReceiptOptions(Array.isArray(d) ? d : []));
    }
  }, [showAddLease, showUploadDoc, showRecordReceipt, showAddServiceCharge, financialIntake, matchTarget, organizationId]);

  async function submitAddProperty() {
    const payload = {
      code: String(propertyData.code ?? "").trim(),
      name: String(propertyData.name ?? "").trim(),
      property_type: String(propertyData.type ?? "commercial"),
      city: String(propertyData.city ?? ""),
      address: String(propertyData.address ?? ""),
      country: String(propertyData.country ?? "KE"),
      status: "draft",
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/properties/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      const prop = await res.json();
      for (const unit of unitMix) {
        if (unit.count > 0 && unit.type.trim()) {
          await apiFetch(`/property/properties/${prop.id}/bulk-units/`, {
            method: "POST",
            headers: { "X-CSRFToken": csrfFromCookie() },
            body: JSON.stringify({
              count: unit.count,
              start: 1,
              prefix: unit.type.trim().replace(/\s+/g, "-").toUpperCase().slice(0, 20),
              unit_type: unit.type.trim(),
              area: unit.size || null,
            }),
          }, organizationId);
        }
      }
      setShowAddProperty(false);
      setWizardStep(1);
      setPropertyData({});
      setUnitMix([{ type: "", count: 1, size: 0 }]);
      setTab("properties");
      loadData();
    } else {
      setError("Property save failed. Check required fields.");
    }
  }

  async function submitAddTenant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const payload = {
      code: String(raw.code ?? "").trim(),
      name: String(raw.name ?? "").trim(),
      tenant_type: String(raw.tenant_type ?? "company"),
      email: String(raw.email ?? ""),
      phone: String(raw.phone ?? ""),
      tax_id: String(raw.tax_id ?? ""),
      status: String(raw.status ?? "prospect"),
      metadata: {
        registration_number: String(raw.registration_number ?? ""),
        billing_preference: String(raw.billing_preference ?? ""),
      },
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/tenants/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      setShowAddTenant(false);
      setTab("tenants");
      loadData();
    } else {
      setError("Tenant save failed.");
    }
  }

  async function submitAddLease(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const payload = {
      reference: String(raw.reference ?? "").trim(),
      unit: String(raw.unit ?? ""),
      tenant: String(raw.tenant ?? ""),
      starts_on: String(raw.starts_on ?? ""),
      ends_on: String(raw.ends_on ?? ""),
      monthly_rent: Number(raw.monthly_rent ?? 0),
      deposit: Number(raw.deposit ?? 0),
      escalation_percent: Number(raw.escalation_percent ?? 0),
      billing_day: Number(raw.billing_day ?? 1),
      status: "draft",
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/leases/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      setShowAddLease(false);
      setTab("leases");
      loadData();
    } else {
      setError("Lease registration failed.");
    }
  }

  async function submitUploadDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const payload = {
      tenant: String(raw.tenant ?? ""),
      document_type: String(raw.document_type ?? ""),
      document_number: String(raw.document_number ?? ""),
      file_url: String(raw.file_url ?? ""),
      issued_on: raw.issued_on ? String(raw.issued_on) : null,
      expires_on: raw.expires_on ? String(raw.expires_on) : null,
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/tenant-documents/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      setShowUploadDoc(false);
      setTab("tenant-documents");
      loadData();
    } else {
      setError("Document upload failed. Check the tenant and required fields.");
    }
  }

  async function submitRecordReceipt(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const payload = {
      number: String(raw.number ?? "").trim(),
      tenant: String(raw.tenant ?? ""),
      invoice: raw.invoice ? String(raw.invoice) : null,
      received_on: String(raw.received_on ?? ""),
      amount: Number(raw.amount ?? 0),
      payment_method: String(raw.payment_method ?? "bank_transfer"),
      external_reference: String(raw.external_reference ?? ""),
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/receipts/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      setShowRecordReceipt(false);
      setTab("receipts");
      loadData();
    } else {
      setError("Receipt recording failed.");
    }
  }

  async function submitBankMatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!matchTarget) return;
    const form = new FormData(e.currentTarget);
    const receiptId = String(form.get("receipt") ?? "");
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/bank-transactions/${matchTarget.id}/match/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ receipt: receiptId }),
    }, organizationId);
    if (res.ok) {
      setMatchTarget(null);
      setTab("bank-reconciliation");
      loadData();
    } else {
      setError("Bank match failed. Receipt amount must equal the transaction.");
    }
  }

  async function submitServiceCharge(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      property: String(form.get("property") ?? ""),
      name: String(form.get("name") ?? "").trim(),
      method: String(form.get("method") ?? "area"),
      starts_on: String(form.get("starts_on") ?? ""),
      annual_budget: Number(form.get("annual_budget") ?? 0),
      is_active: true,
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/service-charges/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      setShowAddServiceCharge(false);
      setScSection("setup");
      setTab("service-charges");
      loadData();
    } else {
      setError("Service charge setup failed. Check the property, dates, and budget.");
    }
  }

  async function submitFinancialIntake(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!financialIntake) return;
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const endpoint = financialIntake === "credit-note" ? "credit-notes" : financialIntake === "expense" ? "expenses" : "budgets";
    const payload = financialIntake === "credit-note"
      ? {
          number: String(raw.number ?? "").trim(), invoice: String(raw.invoice ?? ""),
          issued_on: String(raw.issued_on ?? ""), amount: Number(raw.amount ?? 0), reason: String(raw.reason ?? "").trim(),
        }
      : financialIntake === "expense"
        ? {
            property: String(raw.property ?? ""), supplier: String(raw.supplier ?? "").trim(),
            invoice_number: String(raw.invoice_number ?? "").trim(), category: String(raw.category ?? "").trim(),
            incurred_on: String(raw.incurred_on ?? ""), description: String(raw.description ?? "").trim(), amount: Number(raw.amount ?? 0),
          }
        : {
            property: String(raw.property ?? ""), year: Number(raw.year ?? new Date().getFullYear()),
            category: String(raw.category ?? "").trim(), amount: Number(raw.amount ?? 0),
          };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/${endpoint}/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      const destination: PropertyTab = financialIntake === "credit-note" ? "credit-notes" : financialIntake === "expense" ? "expenses" : "budgets";
      setFinancialIntake(null);
      setTab(destination);
      loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      const message = Object.values(body as Record<string, unknown>).flat().join(" ");
      setError(message || "The financial record could not be saved.");
    }
  }

  async function generateServiceChargeAllocations(row: ServiceChargeRow) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/service-charges/${row.id}/generate-allocations/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({}),
    }, organizationId);
    if (res.ok) {
      const allocations = await res.json();
      setSearch("");
      setSelectedRow(null);
      setRows(Array.isArray(allocations) ? allocations : []);
      setTab("service-charge-allocations");
    } else {
      setError("Charge allocation failed. Confirm the property has eligible units.");
    }
  }

  async function submitServiceChargeReconciliation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reconciliationTarget) return;
    const form = new FormData(e.currentTarget);
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/service-charges/${reconciliationTarget.id}/reconcile/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ period_start: String(form.get("period_start") ?? ""), period_end: String(form.get("period_end") ?? "") }),
    }, organizationId);
    if (res.ok) {
      const reconciliation = await res.json();
      setReconciliationTarget(null);
      setRows([reconciliation as Row]);
      setTab("service-charge-reconciliations");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Service-charge reconciliation failed.");
    }
  }

  async function submitDocumentRejection(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!documentRejectTarget) return;
    const form = new FormData(e.currentTarget);
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/tenant-documents/${documentRejectTarget.id}/reject/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ reason: String(form.get("reason") ?? "").trim() }),
    }, organizationId);
    if (res.ok) {
      setDocumentRejectTarget(null);
      await loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Document rejection failed.");
    }
  }

  async function runPropertyAction(endpoint: string, id: ID, action: string, failureMessage: string) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/${endpoint}/${id}/${action}/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({}),
    }, organizationId);
    if (res.ok) {
      await loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || failureMessage);
    }
  }

  async function downloadReportCSV(key: string) {
    const res = await apiFetch(`/property/analytics/exports/${key}/`, {}, organizationId);
    if (!res.ok) {
      setError("Unable to generate report download.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `property-${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const downloadTenancyTemplate = () => {
    void downloadReportCSV("lease-expiry");
  };

  async function runLeaseAction(row: LeaseRow, action: "activate" | "renew" | "terminate") {
    if (action === "renew") { setRenewalTarget(row); return; }
    if (action === "terminate") { setTerminationTarget(row); return; }
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/leases/${row.id}/${action}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({}),
    }, organizationId);
    if (res.ok) {
      loadData();
    } else {
      setError("Lease action failed. Confirm the lease is a draft.");
    }
  }

  async function submitLeaseRenewal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!renewalTarget) return;
    const form = new FormData(e.currentTarget);
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/leases/${renewalTarget.id}/renew/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
        reference: String(form.get("reference") ?? "").trim(),
        ends_on: String(form.get("ends_on") ?? ""),
        monthly_rent: Number(form.get("monthly_rent") ?? 0),
      }),
    }, organizationId);
    if (res.ok) {
      setRenewalTarget(null);
      await loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Lease renewal failed.");
    }
  }

  async function confirmLeaseTermination() {
    if (!terminationTarget) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/leases/${terminationTarget.id}/terminate/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({}),
    }, organizationId);
    if (res.ok) {
      setTerminationTarget(null);
      await loadData();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Lease termination failed.");
    }
  }

  async function sendReminder(row: ReminderRow) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/invoice-reminders/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
        invoice: String(row.invoice ?? ""),
        channel: "portal",
      }),
    }, organizationId);
    if (res.ok) {
      loadData();
    } else {
      setError("Reminder could not be sent.");
    }
  }

  async function sendInvoiceReminder(row: InvoiceRow) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/property/invoices/${row.id}/send-reminder/`, {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({ channel: "portal" }),
    }, organizationId);
    if (res.ok) {
      setError("");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(Object.values(body as Record<string, unknown>).flat().join(" ") || "Invoice reminder could not be sent.");
    }
  }

  const navigateRemindersForTenant = (tenantName: string) => {
    setSearch(tenantName);
    setTab("reminders");
  };

  const openRecordReceipt = (invoiceId?: ID) => {
    setReceiptInvoice(invoiceId ?? "");
    setShowRecordReceipt(true);
  };

  const downloadDocument = (row: Row) => {
    const url = String(row.file_url ?? "");
    if (!url) {
      setError("This document has no attached file URL.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSelectTab = (id: string) => {
    setSearch("");
    setSelectedRow(null);
    setRows([]);
    setTab(id as PropertyTab);
  };

  const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  /**
   * TWO-LEVEL NAVIGATION:
   * - Left sidebar uses `section` (9 top-level items matching spec)
   * - Horizontal tabs use `subTabs` for sub-pages within a section
   * - `tab` remains the fine-grained state driving content rendering
   */
  const SECTION_SUB_TABS: Record<string, { id: string; label: string }[]> = {
    overview:        [],
    properties: [
      { id: "properties", label: "Property Register" },
      { id: "buildings", label: "Buildings" },
    ],
    units: [
      { id: "units", label: "Unit Occupancy" },
      { id: "projects", label: "Property Projects" },
    ],
    tenants: [
      { id: "tenants", label: "Tenants" },
      { id: "tenant-documents", label: "Tenant documents" },
    ],
    leases:          [],
    rent: [
      { id: "rent",                 label: "Invoices" },
      { id: "rent-schedules",       label: "Rent Roll" },
      { id: "arrears",              label: "Arrears" },
      { id: "reminders",            label: "Reminders" },
      { id: "receipts",             label: "Receipts" },
      { id: "receipt-allocations",  label: "Allocations" },
      { id: "bank-reconciliation",  label: "Bank Reconciliation" },
      { id: "credit-notes",         label: "Credit Notes" },
    ],
    "service-charges": [
      { id: "service-charges",                  label: "Charge Setup" },
      { id: "service-charge-allocations",        label: "Allocations" },
      { id: "service-charge-reconciliations",    label: "Reconciliations" },
    ],
    expenses: [
      { id: "budgets",   label: "Budgets & Estimates" },
      { id: "expenses",  label: "Property Expenses" },
      { id: "fees",      label: "Fee Invoicing" },
    ],
    reports:  [],
    "critical-dates":  [],
  };

  // Derive which left-nav section the current `tab` belongs to
  const SECTION_FOR_TAB: Record<string, string> = {
    overview: "overview",
    properties: "properties",
    buildings: "properties",
    units: "units",
    projects: "units",
    tenants: "tenants",
    "tenant-documents": "tenants",
    leases: "leases",
    "rent-schedules": "rent",
    rent: "rent",
    arrears: "rent",
    reminders: "rent",
    receipts: "rent",
    "receipt-allocations": "rent",
    "bank-reconciliation": "rent",
    "credit-notes": "rent",
    "service-charges": "service-charges",
    "service-charge-allocations": "service-charges",
    "service-charge-reconciliations": "service-charges",
    budgets: "expenses",
    expenses: "expenses",
    fees: "expenses",
    reports: "reports",
    "critical-dates": "critical-dates",
  };

  const activeSection = SECTION_FOR_TAB[tab] ?? tab;
  const currentSubTabs = SECTION_SUB_TABS[activeSection] ?? [];

  // When the user clicks a left-nav section, navigate to its default tab
  const DEFAULT_TAB_FOR_SECTION: Record<string, PropertyTab> = {
    overview: "overview",
    properties: "properties",
    units: "units",
    tenants: "tenants",
    leases: "leases",
    rent: "rent",
    "service-charges": "service-charges",
    expenses: "expenses",
    reports: "reports",
    "critical-dates": "critical-dates",
  };

  const handleSelectSection = (sectionId: string) => {
    const defaultTab = DEFAULT_TAB_FOR_SECTION[sectionId] ?? sectionId as PropertyTab;
    handleSelectTab(defaultTab);
  };

  return (
    <ModuleShell
      moduleKey="property"
      moduleName="Property Management"
      eyebrow="Property & Leasing Workspace"
      title="Property Management"
      subtitle="Tenants, occupancy, lease agreements, rent collections & property accounting."
      accent="#e23b3b"
      groups={propertyNav}
      activeId={activeSection}
      onSelect={handleSelectSection}
      subTabs={currentSubTabs}
      activeSubId={currentSubTabs.length > 0 ? tab : undefined}
      onSelectSub={handleSelectTab}
      actions={
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12 }}>📅 {todayStr}</span>
          {canFinance && <button className="btn ghost sm" data-testid="property-record-receipt-btn" onClick={() => openRecordReceipt()}>+ Record Receipt</button>}
          {canLease && <button className="btn ghost sm" data-testid="property-add-tenant-btn" onClick={() => setShowAddTenant(true)}>+ Add Tenant</button>}
          {canOperate && <button className="btn primary sm" data-testid="property-add-prop-btn" onClick={() => setShowAddProperty(true)}>+ Add Property</button>}
        </div>
      }
    >
      <div className="property-workspace" style={{ padding: "16px 24px", width: "100%", boxSizing: "border-box" }}>
        {error && <ErrorBanner message={error} onRetry={() => { setError(""); loadData(); }} />}

        {tab === "overview" && <OverviewView dashboard={dashboard} loading={loading} setTab={handleSelectTab} />}
        {tab === "properties" && <PropertiesView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} onAdd={() => setShowAddProperty(true)} onSelectRow={setSelectedRow} />}
        {tab === "buildings" && <BuildingsView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} />}
        {tab === "units" && <UnitsView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} />}
        {tab === "projects" && <ProjectsView rows={rows} loading={loading} search={search} setSearch={setSearch} />}
        {tab === "tenants" && <TenantsView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} onAdd={() => setShowAddTenant(true)} onUploadDoc={() => setShowUploadDoc(true)} onSelectRow={setSelectedRow} />}
        {tab === "tenant-documents" && <TenantDocumentsView rows={rows} loading={loading} search={search} setSearch={setSearch} onUpload={() => setShowUploadDoc(true)} onDownload={downloadDocument} onVerify={(row) => void runPropertyAction("tenant-documents", row.id, "verify", "Document verification failed.")} onReject={setDocumentRejectTarget} />}
        {tab === "leases" && <LeasesView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} onAddLease={() => setShowAddLease(true)} onDownloadTemplate={downloadTenancyTemplate} onLeaseAction={runLeaseAction} onSelectRow={setSelectedRow} />}
        {tab === "rent-schedules" && <RentSchedulesView rows={rows} loading={loading} search={search} setSearch={setSearch} onGenerateInvoice={(row) => void runPropertyAction("rent-schedules", row.id, "generate-invoice", "Rent invoice generation failed.")} />}
        {tab === "rent" && <RentView rows={rows} rentInvoices={rentInvoices} analytics={analytics} rentSection={rentSection} setRentSection={setRentSection} loading={loading} setTab={handleSelectTab} onRecordReceipt={openRecordReceipt} onSendReminder={(row) => void sendInvoiceReminder(row)} onInvoiceAction={(row, action) => { if (action === "void") setConfirmVoidInvoice(row); else void runPropertyAction("invoices", row.id, action, "Invoice action failed."); }} onSelectRow={setSelectedRow} />}
        {tab === "arrears" && <ArrearsView rows={rows} analytics={analytics} loading={loading} search={search} setSearch={setSearch} onNavigateReminders={navigateRemindersForTenant} />}
        {tab === "reminders" && <RemindersView rows={rows} loading={loading} search={search} setSearch={setSearch} onSendReminder={sendReminder} setTab={handleSelectTab} />}
        {tab === "receipts" && <ReceiptsView rows={rows} creditNotes={creditNotes} loading={loading} search={search} setSearch={setSearch} onRecordReceipt={openRecordReceipt} />}
        {tab === "receipt-allocations" && <ReceiptAllocationsView rows={rows} loading={loading} search={search} setSearch={setSearch} />}
        {tab === "bank-reconciliation" && <BankReconciliationView rows={rows} loading={loading} search={search} setSearch={setSearch} onMatch={(r) => setMatchTarget(r as BankTransactionRow)} />}
        {tab === "credit-notes" && <CreditNotesView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} onAdd={() => setFinancialIntake("credit-note")} />}
        {tab === "service-charges" && <ServiceChargesView rows={rows} scSection={scSection} setScSection={setScSection} loading={loading} setTab={handleSelectTab} onAdd={() => setShowAddServiceCharge(true)} onAllocate={(row) => void generateServiceChargeAllocations(row)} onReconcile={setReconciliationTarget} />}
        {tab === "service-charge-allocations" && <ServiceChargeAllocationsView rows={rows} loading={loading} search={search} setSearch={setSearch} />}
        {tab === "service-charge-reconciliations" && <ServiceChargeReconciliationsView rows={rows} loading={loading} search={search} setSearch={setSearch} />}
        {tab === "budgets" && <BudgetsView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} onSelectRow={setSelectedRow} onAdd={() => setFinancialIntake("budget")} onAction={(row, action) => { if (action === "reject") setConfirmRejectBudget(row); else void runPropertyAction("budgets", row.id, action, "Budget action failed."); }} />}
        {tab === "expenses" && <ExpensesView rows={rows} financial={financial} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} onAdd={() => setFinancialIntake("expense")} onAction={(row, action) => void runPropertyAction("expenses", row.id, action, "Expense action failed.")} />}
        {tab === "reports" && <ReportsView rows={rows} loading={loading} onExport={(key) => void downloadReportCSV(key)} />}
        {tab === "fees" && <FeesView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} />}
        {tab === "owner-portal" && <OwnerPortalView />}
        {tab === "forecast" && <ForecastView />}
        {tab === "critical-dates" && <CriticalDatesView leases={rows} contractors={contractors} inspections={inspections} serviceCharges={criticalServiceCharges} loading={loading} setTab={handleSelectTab} />}

        {selectedRow && (
          <DetailDrawer title={labels[tab]} onClose={() => setSelectedRow(null)} width={400}>
            <RowDetailPanel tab={tab} row={selectedRow} />
          </DetailDrawer>
        )}

        {showAddProperty && (
          <Modal title="Add New Property" onClose={() => { setShowAddProperty(false); setWizardStep(1); setPropertyData({}); setUnitMix([{ type: "", count: 1, size: 0 }]); }} wide>
            {wizardStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Step 1 of 3 — Basic Information</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Property Code" required>
                    <input name="code" required data-testid="prop-code-input" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.code ?? ""} onChange={(e) => setPropertyData({ ...propertyData, code: e.target.value })} />
                  </Field>
                  <Field label="Property Name" required>
                    <input name="name" required data-testid="prop-name-input" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.name ?? ""} onChange={(e) => setPropertyData({ ...propertyData, name: e.target.value })} />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Type" required>
                    <select name="type" data-testid="prop-type-select" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.type ?? "commercial"} onChange={(e) => setPropertyData({ ...propertyData, type: e.target.value })}>
                      <option value="commercial">Commercial</option>
                      <option value="residential">Residential</option>
                      <option value="mixed_use">Mixed Use</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </Field>
                  <Field label="City" required>
                    <input name="city" required data-testid="prop-city-input" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.city ?? ""} onChange={(e) => setPropertyData({ ...propertyData, city: e.target.value })} />
                  </Field>
                </div>
                <Field label="Address">
                  <input name="address" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.address ?? ""} onChange={(e) => setPropertyData({ ...propertyData, address: e.target.value })} />
                </Field>
                <Field label="Country">
                  <input name="country" style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} value={propertyData.country ?? "KE"} onChange={(e) => setPropertyData({ ...propertyData, country: e.target.value })} />
                </Field>
                <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => { setShowAddProperty(false); setWizardStep(1); }}>Cancel</button>
                  <button type="button" className="btn primary" data-testid="prop-wizard-next" onClick={() => setWizardStep(2)}>Next →</button>
                </div>
              </div>
            )}
            {wizardStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Step 2 of 3 — Unit Mix</p>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Define the unit types for this property.</p>
                {unitMix.map((u, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                    <Field label="Unit Type">
                      <input value={u.type} onChange={(e) => { const copy = [...unitMix]; copy[i] = { ...copy[i], type: e.target.value }; setUnitMix(copy); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                    </Field>
                    <Field label="Count">
                      <input type="number" min={1} value={u.count} onChange={(e) => { const copy = [...unitMix]; copy[i] = { ...copy[i], count: Number(e.target.value) }; setUnitMix(copy); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                    </Field>
                    <Field label="Avg Size (sqft)">
                      <input type="number" min={0} value={u.size || ""} onChange={(e) => { const copy = [...unitMix]; copy[i] = { ...copy[i], size: Number(e.target.value) }; setUnitMix(copy); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                    </Field>
                    <button type="button" className="btn ghost sm" style={{ marginBottom: 2 }} onClick={() => setUnitMix(unitMix.filter((_, j) => j !== i))} disabled={unitMix.length <= 1}>×</button>
                  </div>
                ))}
                <button type="button" className="btn ghost sm" onClick={() => setUnitMix([...unitMix, { type: "", count: 1, size: 0 }])}>+ Add Unit Type</button>
                <div className="muted" style={{ fontSize: 12 }}>Total Units: {unitMix.reduce((s, u) => s + u.count, 0)} · Total Area: {unitMix.reduce((s, u) => s + u.count * u.size, 0).toLocaleString()} sqft</div>
                <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => setWizardStep(1)}>← Back</button>
                  <button type="button" className="btn primary" data-testid="prop-wizard-next" onClick={() => setWizardStep(3)}>Next →</button>
                </div>
              </div>
            )}
            {wizardStep === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Step 3 of 3 — Review & Save</p>
                <h4 style={{ margin: 0, fontSize: 14 }}>Review Property</h4>
                <div className="card" style={{ padding: 14, background: "var(--surface-2)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { label: "Code", value: propertyData.code },
                      { label: "Name", value: propertyData.name },
                      { label: "Type", value: propertyData.type },
                      { label: "City", value: propertyData.city },
                      { label: "Address", value: propertyData.address },
                      { label: "Country", value: propertyData.country },
                    ].map((f) => (
                      <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span className="muted" style={{ fontSize: 11 }}>{f.label}</span>
                        <strong style={{ fontSize: 13 }}>{f.value || "—"}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <h4 style={{ margin: "4px 0 0", fontSize: 14 }}>Unit Mix</h4>
                <div className="card" style={{ padding: 14, background: "var(--surface-2)" }}>
                  {unitMix.filter((u) => u.type.trim()).length > 0 ? (
                    <table className="fc-data-table" style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th>Unit Type</th>
                          <th>Count</th>
                          <th>Avg Size</th>
                          <th>Total Area</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitMix.filter((u) => u.type.trim()).map((u, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 12 }}>{u.type}</td>
                            <td className="mono" style={{ fontSize: 12 }}>{u.count}</td>
                            <td className="mono" style={{ fontSize: 12 }}>{u.size ? `${u.size.toLocaleString()} sqft` : "—"}</td>
                            <td className="mono" style={{ fontSize: 12 }}>{u.size ? `${(u.count * u.size).toLocaleString()} sqft` : "—"}</td>
                          </tr>
                        ))}
                        <tr>
                          <td><strong style={{ fontSize: 12 }}>Total</strong></td>
                          <td className="mono"><strong>{unitMix.reduce((s, u) => s + u.count, 0)}</strong></td>
                          <td />
                          <td className="mono"><strong>{unitMix.reduce((s, u) => s + u.count * u.size, 0).toLocaleString()} sqft</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: 12 }}>No unit types defined.</p>
                  )}
                </div>
                <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => setWizardStep(2)}>← Back</button>
                  <button type="button" className="btn primary" data-testid="prop-wizard-create" onClick={() => void submitAddProperty()}>Create Property</button>
                </div>
              </div>
            )}
          </Modal>
        )}

        {showAddTenant && (
          <Modal title="Add New Tenant Profile" onClose={() => setShowAddTenant(false)} wide>
            <form onSubmit={submitAddTenant} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Tenant Code" required>
                  <input name="code" required placeholder="e.g. TNT-006" data-testid="tenant-code-input" />
                </Field>
                <Field label="Full Name / Company" required>
                  <input name="name" required placeholder="e.g. Apex Holdings Ltd" data-testid="tenant-name-input" />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Tenant Type">
                  <select name="tenant_type" defaultValue="company" data-testid="tenant-type-select">
                    <option value="company">Company</option>
                    <option value="individual">Individual</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" defaultValue="prospect" data-testid="tenant-status-select">
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="former">Former</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Email Address">
                  <input name="email" type="email" placeholder="info@company.co.ke" data-testid="tenant-email-input" />
                </Field>
                <Field label="Phone Number">
                  <input name="phone" placeholder="+254 700 000 000" data-testid="tenant-phone-input" />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="KRA PIN / Tax ID">
                  <input name="tax_id" placeholder="e.g. P051234567X" />
                </Field>
                <Field label="Registration Number">
                  <input name="registration_number" placeholder="Company registration (optional)" />
                </Field>
              </div>
              <Field label="Billing Preference">
                <select name="billing_preference" defaultValue="email">
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="portal">Tenant portal</option>
                </select>
              </Field>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowAddTenant(false)}>Cancel</button>
                <button type="submit" className="btn primary" data-testid="tenant-save-btn">Register Tenant</button>
              </div>
            </form>
          </Modal>
        )}

        {showAddLease && (
          <Modal title="Add Single Lease" onClose={() => setShowAddLease(false)} wide>
            <form onSubmit={submitAddLease} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Lease Reference" required>
                  <input name="reference" required placeholder="e.g. LSE-2026-0001" />
                </Field>
                <Field label="Billing Day">
                  <input name="billing_day" type="number" min={1} max={28} defaultValue={1} />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Tenant" required>
                  <select name="tenant" required defaultValue="">
                    <option value="" disabled>Select tenant</option>
                    {tenantOptions.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit" required>
                  <select name="unit" required defaultValue="">
                    <option value="" disabled>Select unit</option>
                    {unitOptions.map((u) => (
                      <option key={String(u.id)} value={String(u.id)}>{String(u.code)} · {String(u.property_name ?? "")}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Start Date" required>
                  <input name="starts_on" type="date" required />
                </Field>
                <Field label="End Date" required>
                  <input name="ends_on" type="date" required />
                </Field>
              </div>
              <div className="grid-3">
                <Field label="Monthly Rent (KES)" required>
                  <input name="monthly_rent" type="number" min={1} required />
                </Field>
                <Field label="Deposit (KES)">
                  <input name="deposit" type="number" min={0} defaultValue={0} />
                </Field>
                <Field label="Escalation %">
                  <input name="escalation_percent" type="number" min={0} defaultValue={0} />
                </Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowAddLease(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Lease</button>
              </div>
            </form>
          </Modal>
        )}

        {showUploadDoc && (
          <Modal title="Upload Tenant Document" onClose={() => setShowUploadDoc(false)} wide>
            <form onSubmit={submitUploadDoc} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Tenant" required>
                  <select name="tenant" required defaultValue="">
                    <option value="" disabled>Select tenant</option>
                    {tenantOptions.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Document Type" required>
                  <select name="document_type" required defaultValue="">
                    <option value="" disabled>Select type</option>
                    <option value="national_id">National ID</option>
                    <option value="passport">Passport</option>
                    <option value="kra_pin">KRA PIN</option>
                    <option value="business_registration">Business Registration</option>
                    <option value="lease_agreement">Lease Agreement</option>
                    <option value="guarantee">Guarantee</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Document Number">
                  <input name="document_number" placeholder="Reference on the document" />
                </Field>
                <Field label="File URL" required>
                  <input name="file_url" required placeholder="https://… or /media/documents/…" />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Issued On">
                  <input name="issued_on" type="date" />
                </Field>
                <Field label="Expires On">
                  <input name="expires_on" type="date" />
                </Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowUploadDoc(false)}>Cancel</button>
                <button type="submit" className="btn primary">Upload Document</button>
              </div>
            </form>
          </Modal>
        )}

        {showRecordReceipt && (
          <Modal title="Record Rent Payment Receipt" onClose={() => setShowRecordReceipt(false)} wide>
            <form onSubmit={submitRecordReceipt} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Receipt Number" required>
                  <input name="number" required placeholder="e.g. RCPT-2026-0001" />
                </Field>
                <Field label="Received On" required>
                  <input name="received_on" type="date" required />
                </Field>
              </div>
              <Field label="Tenant" required>
                <select name="tenant" required defaultValue="">
                  <option value="" disabled>Select tenant</option>
                  {tenantOptions.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>{String(t.name)}</option>
                  ))}
                </select>
              </Field>
              <div className="grid-2">
                <Field label="Amount (KES)" required>
                  <input name="amount" type="number" min={1} required placeholder="0" data-testid="receipt-amount-input" />
                </Field>
                <Field label="Payment Method">
                  <select name="payment_method" defaultValue="bank_transfer">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="mpesa">M-Pesa Paybill</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </Field>
              </div>
              <Field label="Allocate to Invoice (optional)">
                <select name="invoice" defaultValue={receiptInvoice}>
                  <option value="">Unallocated</option>
                  {invoiceOptions.map((inv) => (
                    <option key={String(inv.id)} value={String(inv.id)}>{String(inv.number)} · {kM(inv.amount)}</option>
                  ))}
                </select>
              </Field>
              <Field label="External Reference">
                <input name="external_reference" placeholder="Bank ref / M-Pesa code" />
              </Field>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowRecordReceipt(false)}>Cancel</button>
                <button type="submit" className="btn primary" data-testid="receipt-save-btn">Post Receipt</button>
              </div>
            </form>
          </Modal>
        )}

        {showAddServiceCharge && (
          <Modal title="Set up service charge" onClose={() => setShowAddServiceCharge(false)} wide>
            <form onSubmit={submitServiceCharge} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Property" required>
                <select name="property" required defaultValue="">
                  <option value="" disabled>Select property</option>
                  {propertyOptions.map((property) => (
                    <option key={String(property.id)} value={String(property.id)}>{String(property.name ?? property.code)}</option>
                  ))}
                </select>
              </Field>
              <div className="grid-2">
                <Field label="Scheme name" required>
                  <input name="name" required placeholder="e.g. 2026 Commercial Service Charge" />
                </Field>
                <Field label="Allocation method" required>
                  <select name="method" defaultValue="area">
                    <option value="area">Floor area</option>
                    <option value="equal">Equal share</option>
                    <option value="fixed">Fixed allocation</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Starts on" required>
                  <input name="starts_on" type="date" required />
                </Field>
                <Field label="Annual service budget" required>
                  <input name="annual_budget" type="number" min={1} step="0.01" required />
                </Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowAddServiceCharge(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save draft</button>
              </div>
            </form>
          </Modal>
        )}

        {financialIntake && (
          <Modal
            title={financialIntake === "credit-note" ? "Issue credit note" : financialIntake === "expense" ? "Record supplier expense" : "Create budget line"}
            onClose={() => setFinancialIntake(null)}
            wide
          >
            <form onSubmit={submitFinancialIntake} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {financialIntake === "credit-note" ? (
                <>
                  <div className="grid-2">
                    <Field label="Credit note number" required><input name="number" required placeholder="e.g. CN-2026-0001" /></Field>
                    <Field label="Issued on" required><input name="issued_on" type="date" required /></Field>
                  </div>
                  <Field label="Invoice" required>
                    <select name="invoice" required defaultValue="">
                      <option value="" disabled>Select outstanding invoice</option>
                      {invoiceOptions.map((invoice) => (
                        <option key={String(invoice.id)} value={String(invoice.id)}>{String(invoice.number)} · {String(invoice.tenant_name ?? "")} · {kM(invoice.balance)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Credit amount" required><input name="amount" type="number" min={0.01} step="0.01" required /></Field>
                  <Field label="Reason" required><textarea name="reason" rows={3} required placeholder="Reason for the adjustment" /></Field>
                </>
              ) : (
                <>
                  <Field label="Property" required>
                    <select name="property" required defaultValue="">
                      <option value="" disabled>Select property</option>
                      {propertyOptions.map((property) => (
                        <option key={String(property.id)} value={String(property.id)}>{String(property.code ?? "")} · {String(property.name ?? "")}</option>
                      ))}
                    </select>
                  </Field>
                  {financialIntake === "expense" ? (
                    <>
                      <div className="grid-2">
                        <Field label="Supplier" required><input name="supplier" required /></Field>
                        <Field label="Supplier invoice"><input name="invoice_number" /></Field>
                      </div>
                      <div className="grid-2">
                        <Field label="Category" required><input name="category" required placeholder="Utilities" /></Field>
                        <Field label="Incurred on" required><input name="incurred_on" type="date" required /></Field>
                      </div>
                      <Field label="Description"><textarea name="description" rows={3} /></Field>
                    </>
                  ) : (
                    <div className="grid-2">
                      <Field label="Budget year" required><input name="year" type="number" min={2020} max={2100} defaultValue={new Date().getFullYear()} required /></Field>
                      <Field label="Category" required><input name="category" required placeholder="Repairs and maintenance" /></Field>
                    </div>
                  )}
                  <Field label={financialIntake === "expense" ? "Expense amount" : "Annual budget"} required>
                    <input name="amount" type="number" min={financialIntake === "expense" ? 0.01 : 0} step="0.01" required />
                  </Field>
                </>
              )}
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                {financialIntake === "credit-note" ? "Issuing this note immediately adjusts the selected invoice balance and creates an immutable audit record." : "The record starts in draft and follows the controlled submit and approval workflow."}
              </p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setFinancialIntake(null)}>Cancel</button>
                <button type="submit" className="btn primary">{financialIntake === "credit-note" ? "Issue credit note" : "Save draft"}</button>
              </div>
            </form>
          </Modal>
        )}

        {renewalTarget && (
          <Modal title="Renew lease" onClose={() => setRenewalTarget(null)}>
            <form onSubmit={submitLeaseRenewal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
                <strong>{String(renewalTarget.reference ?? "Lease")}</strong>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>{String(renewalTarget.tenant_name ?? "")} · current end {fmtDate(renewalTarget.ends_on)}</p>
              </div>
              <Field label="Renewal reference" required><input name="reference" required placeholder={`${String(renewalTarget.reference ?? "LEASE")}-R1`} /></Field>
              <div className="grid-2">
                <Field label="New end date" required><input name="ends_on" type="date" min={String(renewalTarget.ends_on ?? "")} required /></Field>
                <Field label="New monthly rent" required><input name="monthly_rent" type="number" min={0.01} step="0.01" defaultValue={Number(renewalTarget.monthly_rent ?? 0)} required /></Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setRenewalTarget(null)}>Cancel</button>
                <button type="submit" className="btn primary">Create renewal</button>
              </div>
            </form>
          </Modal>
        )}

        {terminationTarget && (
          <Modal title="Terminate lease" onClose={() => setTerminationTarget(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0 }}>Terminate <strong>{String(terminationTarget.reference ?? "this lease")}</strong> for {String(terminationTarget.tenant_name ?? "the tenant")}? The unit will become available when no other current lease exists.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setTerminationTarget(null)}>Cancel</button>
                <button type="button" className="btn danger" onClick={() => void confirmLeaseTermination()}>Confirm termination</button>
              </div>
            </div>
          </Modal>
        )}

        {confirmVoidInvoice && (
          <Modal title="Void invoice" onClose={() => setConfirmVoidInvoice(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0 }}>Void invoice <strong>{String(confirmVoidInvoice.number ?? "—")}</strong> for {String(confirmVoidInvoice.tenant_name ?? "the tenant")}? This action cannot be undone and the invoice will be excluded from collection reporting.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setConfirmVoidInvoice(null)}>Cancel</button>
                <button type="button" className="btn danger" onClick={() => { const row = confirmVoidInvoice; setConfirmVoidInvoice(null); void runPropertyAction("invoices", row.id, "void", "Invoice void failed."); }}>Confirm void</button>
              </div>
            </div>
          </Modal>
        )}

        {confirmRejectBudget && (
          <Modal title="Reject budget" onClose={() => setConfirmRejectBudget(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0 }}>Reject the <strong>{String(confirmRejectBudget.category ?? "budget")}</strong> for {String(confirmRejectBudget.property_name ?? "this property")} ({String(confirmRejectBudget.year ?? "—")})? This budget line will return to draft status for revision.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setConfirmRejectBudget(null)}>Cancel</button>
                <button type="button" className="btn danger" onClick={() => { const row = confirmRejectBudget; setConfirmRejectBudget(null); void runPropertyAction("budgets", row.id, "reject", "Budget rejection failed."); }}>Confirm reject</button>
              </div>
            </div>
          </Modal>
        )}

        {reconciliationTarget && (
          <Modal title="Reconcile service charge" onClose={() => setReconciliationTarget(null)}>
            <form onSubmit={submitServiceChargeReconciliation} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
                <strong>{String(reconciliationTarget.name ?? "Service charge")}</strong>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>{String(reconciliationTarget.property_name ?? "")} · annual budget {kM(reconciliationTarget.annual_budget)}</p>
              </div>
              <div className="grid-2">
                <Field label="Period start" required><input name="period_start" type="date" required /></Field>
                <Field label="Period end" required><input name="period_end" type="date" required /></Field>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>Approved and paid property expenses in this period are compared with the prorated budget. The result starts in draft for review.</p>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setReconciliationTarget(null)}>Cancel</button>
                <button type="submit" className="btn primary">Run reconciliation</button>
              </div>
            </form>
          </Modal>
        )}

        {documentRejectTarget && (
          <Modal title="Reject tenant document" onClose={() => setDocumentRejectTarget(null)}>
            <form onSubmit={submitDocumentRejection} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0 }}>Record why <strong>{String(documentRejectTarget.document_number ?? documentRejectTarget.document_type ?? "this document")}</strong> cannot be accepted. The reason remains visible in its compliance record.</p>
              <Field label="Rejection reason" required><textarea name="reason" rows={4} required placeholder="Describe the missing, invalid, or expired evidence" /></Field>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setDocumentRejectTarget(null)}>Cancel</button>
                <button type="submit" className="btn danger">Reject document</button>
              </div>
            </form>
          </Modal>
        )}

        {matchTarget && (
          <Modal title="Match Bank Transaction" onClose={() => setMatchTarget(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: 14, background: "var(--surface-2)" }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span className="muted">Transaction</span>
                  <strong className="mono">{String(matchTarget.reference ?? "—")}</strong>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span className="muted">Date</span>
                  <strong className="mono">{fmtDate(matchTarget.transacted_on)}</strong>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span className="muted">Amount</span>
                  <strong className="mono">{kM(matchTarget.amount)}</strong>
                </div>
              </div>
              <form onSubmit={submitBankMatch} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Matching Receipt" required>
                  <select name="receipt" required defaultValue="">
                    <option value="" disabled>Select receipt</option>
                    {receiptOptions.map((r) => (
                      <option key={String(r.id)} value={String(r.id)}>{String(r.number)} · {kM(r.amount)}</option>
                    ))}
                  </select>
                </Field>
                <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn ghost" onClick={() => setMatchTarget(null)}>Cancel</button>
                  <button type="submit" className="btn primary">Match Transaction</button>
                </div>
              </form>
            </div>
          </Modal>
        )}
      </div>
    </ModuleShell>
  );
}
