"use client";

import { FormEvent, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { propertyNav } from "@/lib/module-nav";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, money, number,
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
  | "reports";

type Row = Record<string, unknown>;
type ID = string;

const labels: Record<PropertyTab, string> = {
  overview: "Overview",
  properties: "Properties",
  buildings: "Buildings",
  units: "Units",
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

/* ─── shared layout primitives ─── */

function ViewToolbar({
  title, subtitle, search, onSearch, placeholder = "Search records…", children,
}: {
  title: string; subtitle?: string; search: string; onSearch: (v: string) => void;
  placeholder?: string; children?: ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        {subtitle && <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>{subtitle}</p>}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={onSearch} placeholder={placeholder} />
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
                  <div key={b.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
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

        <Panel title="Rent Ageing Summary" action={<button className="btn ghost sm" onClick={() => setTab("arrears")}>Ageing Report →</button>}>
          {aging.length > 0 ? (
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
                  {aging.map((a) => (
                    <tr key={a.label}>
                      <td style={{ fontSize: 12 }}>{a.label}</td>
                      <td className="mono" style={{ color: a.amount > 0 ? "var(--danger)" : "var(--muted)" }}>{kM(a.amount)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{ width: `${pct(a.amount, agingTotal)}%`, height: "100%", background: a.amount > 0 ? "#e23b3b" : "var(--border-strong)" }} />
                          </div>
                          <span className="mono" style={{ fontSize: 11, width: 40, textAlign: "right" }}>{pct(a.amount, agingTotal)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="📂" title="No outstanding balances" description="Aged balances by bucket will appear here." />
          )}
        </Panel>
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
  const props = rows as PropertyRow[];
  const totalUnits = props.reduce((s, p) => s + Number(p.units_count ?? 0), 0);
  const totalBuildings = props.reduce((s, p) => s + Number(p.buildings_count ?? 0), 0);
  const active = props.filter((p) => p.status === "active").length;

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Properties" value={kN(props.length)} sub="Portfolio count" link="View register" onClick={() => setTab("properties")} />
        <KpiCard icon="▦" iconBg="#dbeafe" iconColor="#2563eb" label="Total Units" value={kN(totalUnits)} sub="Across portfolio" link="View units" onClick={() => setTab("units")} />
        <KpiCard icon="🏗" iconBg="#fef3c7" iconColor="#d97706" label="Buildings" value={kN(totalBuildings)} sub="Registered buildings" link="View buildings" onClick={() => setTab("buildings")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active" value={kN(active)} sub="Active properties" link="View register" onClick={() => setTab("properties")} />
      </KpiStrip>

      <ViewToolbar title="Property Register" subtitle="Manage all properties across your portfolio" search={search} onSearch={setSearch} placeholder="Search by name, code or city…">
        <button className="btn primary sm" onClick={onAdd}>+ Add Property</button>
      </ViewToolbar>

      <Panel title="Properties">
        <ListState loading={loading} empty={props.length === 0} emptyTitle="No properties found" emptyDesc="Add a property to start building your portfolio hierarchy.">
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
                {props.map((p) => (
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
  const tenants = rows as TenantRow[];
  const active = tenants.filter((t) => t.status === "active").length;
  const prospects = tenants.filter((t) => t.status === "prospect").length;
  const outstanding = tenants.reduce((s, t) => s + Number(t.outstanding ?? 0), 0);

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="👥" iconBg="#e0e7ff" iconColor="#4f46e5" label="Tenants" value={kN(tenants.length)} sub="Registered tenants" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active" value={kN(active)} sub="Active tenancies" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="◌" iconBg="#fef3c7" iconColor="#d97706" label="Prospects" value={kN(prospects)} sub="Potential tenants" link="View tenants" onClick={() => setTab("tenants")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Outstanding" value={kM(outstanding)} sub="Combined arrears" link="View arrears" onClick={() => setTab("arrears")} />
      </KpiStrip>

      <ViewToolbar title="Tenant Register" subtitle="Manage all tenants across your properties" search={search} onSearch={setSearch} placeholder="Search tenant name, email, phone…">
        <button className="btn ghost sm" onClick={onUploadDoc}>+ Upload Document</button>
        <button className="btn primary sm" onClick={onAdd}>+ Add Tenant</button>
      </ViewToolbar>

      <Panel title="Tenants">
        <ListState loading={loading} empty={tenants.length === 0} emptyTitle="No tenants found" emptyDesc="Register a tenant to link leases, invoices and documents.">
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
                {tenants.map((t) => (
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
        </ListState>
      </Panel>
    </>
  );
}

/* ─── TENANT DOCUMENTS ─── */

function TenantDocumentsView({ rows, loading, search, setSearch, onUpload, onDownload }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  onUpload: () => void; onDownload: (r: Row) => void;
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
                      <button className="btn ghost sm" onClick={() => onDownload(d)}>Download</button>
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
  onLeaseAction: (r: LeaseRow, action: "activate") => void; onSelectRow: (r: Row) => void;
}) {
  const leases = rows as LeaseRow[];
  const active = leases.filter((l) => l.status === "active").length;
  const expired = leases.filter((l) => l.status === "expired").length;
  const expiring30 = leases.filter((l) => {
    const dl = daysUntil(l.ends_on);
    return dl !== null && dl >= 0 && dl <= 30 && ["active", "expiring"].includes(String(l.status));
  }).length;
  const monthlyRent = leases.filter((l) => ["active", "expiring"].includes(String(l.status))).reduce((s, l) => s + Number(l.monthly_rent ?? 0), 0);
  const outstanding = leases.reduce((s, l) => s + Number(l.outstanding ?? 0), 0);

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

      <ViewToolbar title="Lease Register" subtitle="Manage all lease agreements across your properties" search={search} onSearch={setSearch} placeholder="Search lease no, tenant or unit…" />

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
        <ListState loading={loading} empty={leases.length === 0} emptyTitle="No leases found" emptyDesc="Add a single lease or bulk import a tenancy schedule to populate the register.">
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
                {leases.map((l) => (
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
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("rent"); }}>Invoices</button>
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

/* ─── RENT SCHEDULES ─── */

function RentSchedulesView({ rows, loading, search, setSearch }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
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

function renderInvoiceRows(invoices: InvoiceRow[], full: boolean, onPay: (id: ID) => void, onSelect: (r: Row) => void) {
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
        {Number(inv.balance ?? 0) > 0 && (
          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onPay(String(inv.id)); }}>Pay</button>
        )}
      </td>
    </tr>
  ));
}

function RentView({
  rows, rentInvoices, analytics, rentSection, setRentSection, loading,
  setTab, onRecordReceipt, onSelectRow,
}: {
  rows: Row[]; rentInvoices: InvoiceRow[]; analytics: AgingAnalytics | null;
  rentSection: RentSection; setRentSection: (s: RentSection) => void; loading: boolean;
  setTab: (t: PropertyTab) => void;
  onRecordReceipt: (invoiceId?: ID) => void; onSelectRow: (r: Row) => void;
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
                <tbody>{renderInvoiceRows(rows as InvoiceRow[], false, onRecordReceipt, onSelectRow)}</tbody>
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
                <tbody>{renderInvoiceRows(rows as InvoiceRow[], true, onRecordReceipt, onSelectRow)}</tbody>
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
  const receipts = rows as ReceiptRow[];
  const cns = creditNotes as CreditNoteRow[];
  const receiptTotal = receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const creditTotal = cns.filter((c) => c.status !== "void").reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const unapplied = receipts.filter((r) => !r.invoice).reduce((s, r) => s + Number(r.amount ?? 0), 0);

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
    if (filter === "receipts") return c.docType === "Receipt";
    if (filter === "credit-notes") return c.docType === "Credit Note";
    if (filter === "unapplied") return c.docType === "Receipt" && c.docStatus === "Unapplied";
    return true;
  });

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Receipts" value={kM(receiptTotal)} sub="Collected this period" link="View receipts" onClick={() => setFilter("receipts")} />
        <KpiCard icon="↩" iconBg="#fef3c7" iconColor="#d97706" label="Credit Notes" value={kM(creditTotal)} sub="Issued credits" link="View credit notes" onClick={() => setFilter("credit-notes")} />
        <KpiCard icon="◔" iconBg="#dcfce7" iconColor="#16a34a" label="Net Collections" value={kM(Math.max(receiptTotal - creditTotal, 0))} sub="Receipts less credits" link="View receipts" onClick={() => setFilter("all")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#dc2626" label="Unapplied" value={kM(unapplied)} sub="Receipts not allocated" link="View unapplied" onClick={() => setFilter("unapplied")} />
      </KpiStrip>

      <ViewToolbar title="Receipts & Credit Notes" subtitle="Recorded payments and credit adjustments" search={search} onSearch={setSearch} placeholder="Search receipt, tenant or reference…">
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
                {combined.map((r) => (
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

function CreditNotesView({ rows, loading, search, setSearch, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void;
}) {
  const notes = rows as CreditNoteRow[];

  return (
    <>
      <ViewToolbar title="Credit Notes" subtitle="Issued credit adjustments against invoices" search={search} onSearch={setSearch} placeholder="Search credit note, invoice or tenant…" />

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
  rows, scSection, setScSection, loading, setTab,
}: {
  rows: Row[]; scSection: ScSection; setScSection: (s: ScSection) => void; loading: boolean;
  setTab: (t: PropertyTab) => void;
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

          <Panel title="Cost Centres" action={<button className="btn ghost sm" onClick={() => setTab("service-charge-allocations")}>Allocations →</button>}>
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
                      </tr>
                    ))}
                    <tr>
                      <td><strong style={{ fontSize: 12 }}>Total</strong></td>
                      <td />
                      <td />
                      <td className="mono"><strong>{kM(totalBudget)}</strong></td>
                      <td className="mono"><strong>100%</strong></td>
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

function BudgetsView({ rows, loading, search, setSearch, onSelectRow }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; onSelectRow: (r: Row) => void;
}) {
  const budgets = rows as BudgetRow[];
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount ?? 0), 0);
  const totalActual = budgets.reduce((s, b) => s + Number(b.actual_amount ?? 0), 0);
  const totalVariance = budgets.reduce((s, b) => s + Number(b.variance ?? 0), 0);
  const utilization = pct(totalActual, totalBudget);

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🎯" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Budget" value={kM(totalBudget)} sub="Draft, pending & approved" link="View budgets" onClick={() => {}} />
        <KpiCard icon="💸" iconBg="#dbeafe" iconColor="#2563eb" label="Actual Spend" value={kM(totalActual)} sub="Approved expenses" link="View budgets" onClick={() => {}} />
        <KpiCard icon="◔" iconBg="#fef3c7" iconColor="#d97706" label="Utilization" value={`${utilization}%`} sub="Actual vs budget" link="View budgets" onClick={() => {}} />
        <KpiCard icon="▽" iconBg="#fee2e2" iconColor="#dc2626" label="Variance" value={kM(totalVariance)} sub="Budget less actual" link="View budgets" onClick={() => {}} />
      </KpiStrip>

      <ViewToolbar title="Budgets & Estimates" subtitle="Budget registers, utilization and variance tracking" search={search} onSearch={setSearch} placeholder="Search by property, category or year…" />

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
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onSelectRow(b); }}>View</button>
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

/* ─── EXPENSES ─── */

function ExpensesView({ rows, financial, loading, search, setSearch, setTab }: {
  rows: Row[]; financial: FinancialAnalytics | null; loading: boolean;
  search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void;
}) {
  const expenses = rows as ExpenseRow[];
  const kpis = financial?.kpis;
  const income = Number(kpis?.income ?? 0);
  const spent = Number(kpis?.expenses ?? 0);
  const net = Number(kpis?.net ?? income - spent);
  const expensesByCategory = financial?.expensesByCategory ?? [];
  const expenseMax = Math.max(...expensesByCategory.map((c) => Number(c.total ?? 0)), 1);
  const netMax = Math.max(income, spent, 1);

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="📈" iconBg="#dcfce7" iconColor="#16a34a" label="Total Income" value={kM(income)} sub="Receipts YTD" link="View receipts" onClick={() => setTab("receipts")} />
        <KpiCard icon="📉" iconBg="#fee2e2" iconColor="#dc2626" label="Total Expenses" value={kM(spent)} sub="Approved & paid" link="View expenses" onClick={() => setTab("expenses")} />
        <KpiCard icon="◔" iconBg="#dbeafe" iconColor="#2563eb" label="Net Income" value={kM(net)} sub="Income less expenses" link="View expenses" onClick={() => setTab("expenses")} />
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Transactions" value={kN(expenses.length)} sub="Recent expense lines" link="View expenses" onClick={() => setTab("expenses")} />
      </KpiStrip>

      <ViewToolbar title="Property Expenses" subtitle="Track and analyse income and expenses across your properties" search={search} onSearch={setSearch} placeholder="Search supplier, category or property…" />

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

/* ─── MAIN WORKSPACE ─── */

export function PropertyWorkspace({ initialTab = "overview" }: { initialTab?: string }) {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;

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
  const [matchTarget, setMatchTarget] = useState<BankTransactionRow | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<ID>("");

  const [tenantOptions, setTenantOptions] = useState<Row[]>([]);
  const [unitOptions, setUnitOptions] = useState<Row[]>([]);
  const [invoiceOptions, setInvoiceOptions] = useState<Row[]>([]);
  const [receiptOptions, setReceiptOptions] = useState<Row[]>([]);

  const loadVersion = useRef(0);

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
    const q = encodeURIComponent(search);
    const fail = () => {
      if (version === loadVersion.current) setError("Property data could not be loaded. Please retry.");
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
          const list = Array.isArray(listData) ? listData : [];
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
        setRows(Array.isArray(listData) ? listData : []);
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
        setRows(Array.isArray(listData) ? listData : []);
        setCreditNotes(Array.isArray(cnData) ? cnData : []);
      } else if (tab === "properties") {
        const [listRes, dashRes] = await Promise.all([
          apiFetch(`/property/properties/?search=${q}`, {}, organizationId),
          apiFetch("/property/dashboard/", {}, organizationId),
        ]);
        if (!listRes.ok) { fail(); return; }
        const listData = await listRes.json();
        const list = Array.isArray(listData) ? listData : [];
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
        const list = Array.isArray(listData) ? listData : [];
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
        setRows(Array.isArray(data) ? data : []);
      } else {
        const ep = endpointFor(tab);
        const res = await apiFetch(`/property/${ep}/?search=${q}`, {}, organizationId);
        if (!res.ok) { fail(); return; }
        const data = await res.json();
        if (version !== loadVersion.current) return;
        setRows(Array.isArray(data) ? data : []);
      }
    } catch {
      if (version === loadVersion.current) setError("Unable to connect to property management service.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, organizationId, rentSection, scSection]);

  useEffect(() => {
    const timer = setTimeout(loadData, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadData, search]);

  useEffect(() => {
    if (!organizationId) return;
    if (showAddLease || showUploadDoc || showRecordReceipt) {
      void apiFetch("/property/tenants/?search=", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setTenantOptions(Array.isArray(d) ? d : []));
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
  }, [showAddLease, showUploadDoc, showRecordReceipt, matchTarget, organizationId]);

  async function submitAddProperty(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const payload = {
      code: String(raw.code ?? "").trim(),
      name: String(raw.name ?? "").trim(),
      property_type: String(raw.property_type ?? "commercial"),
      city: String(raw.city ?? ""),
      address: String(raw.address ?? ""),
      country: String(raw.country ?? "KE"),
      status: "draft",
    };
    const count = Number(raw.unit_count ?? 0);
    const unitPayload = {
      count,
      start: Number(raw.unit_start ?? 1),
      prefix: String(raw.unit_prefix ?? "").trim().toUpperCase(),
      floor: String(raw.unit_floor ?? ""),
      unit_type: String(raw.unit_type ?? ""),
      area: raw.unit_area ? Number(raw.unit_area) : null,
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/property/properties/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, organizationId);
    if (res.ok) {
      const prop = await res.json();
      if (count > 0) {
        await apiFetch(`/property/properties/${prop.id}/bulk-units/`, {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify(unitPayload),
        }, organizationId);
      }
      setShowAddProperty(false);
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

  async function runLeaseAction(row: LeaseRow, action: "activate") {
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

  return (
    <ModuleShell
      moduleKey="property"
      moduleName="Property Management"
      eyebrow="Property & Leasing Workspace"
      title="Property Management"
      subtitle="Tenants, occupancy, lease agreements, rent collections & property accounting."
      accent="#e23b3b"
      groups={propertyNav}
      activeId={tab}
      onSelect={handleSelectTab}
      contextLabel="View Scope"
      contextValue={labels[tab]}
      actions={
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12 }}>📅 {todayStr}</span>
          <button className="btn ghost sm" onClick={() => openRecordReceipt()}>+ Record Receipt</button>
          <button className="btn ghost sm" onClick={() => setShowAddTenant(true)}>+ Add Tenant</button>
          <button className="btn primary sm" onClick={() => setShowAddProperty(true)}>+ Add Property</button>
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
        {tab === "tenant-documents" && <TenantDocumentsView rows={rows} loading={loading} search={search} setSearch={setSearch} onUpload={() => setShowUploadDoc(true)} onDownload={downloadDocument} />}
        {tab === "leases" && <LeasesView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} onAddLease={() => setShowAddLease(true)} onDownloadTemplate={downloadTenancyTemplate} onLeaseAction={runLeaseAction} onSelectRow={setSelectedRow} />}
        {tab === "rent-schedules" && <RentSchedulesView rows={rows} loading={loading} search={search} setSearch={setSearch} />}
        {tab === "rent" && <RentView rows={rows} rentInvoices={rentInvoices} analytics={analytics} rentSection={rentSection} setRentSection={setRentSection} loading={loading} setTab={handleSelectTab} onRecordReceipt={openRecordReceipt} onSelectRow={setSelectedRow} />}
        {tab === "arrears" && <ArrearsView rows={rows} analytics={analytics} loading={loading} search={search} setSearch={setSearch} onNavigateReminders={navigateRemindersForTenant} />}
        {tab === "reminders" && <RemindersView rows={rows} loading={loading} search={search} setSearch={setSearch} onSendReminder={sendReminder} setTab={handleSelectTab} />}
        {tab === "receipts" && <ReceiptsView rows={rows} creditNotes={creditNotes} loading={loading} search={search} setSearch={setSearch} onRecordReceipt={openRecordReceipt} />}
        {tab === "receipt-allocations" && <ReceiptAllocationsView rows={rows} loading={loading} search={search} setSearch={setSearch} />}
        {tab === "bank-reconciliation" && <BankReconciliationView rows={rows} loading={loading} search={search} setSearch={setSearch} onMatch={(r) => setMatchTarget(r as BankTransactionRow)} />}
        {tab === "credit-notes" && <CreditNotesView rows={rows} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} />}
        {tab === "service-charges" && <ServiceChargesView rows={rows} scSection={scSection} setScSection={setScSection} loading={loading} setTab={handleSelectTab} />}
        {tab === "service-charge-allocations" && <ServiceChargeAllocationsView rows={rows} loading={loading} search={search} setSearch={setSearch} />}
        {tab === "service-charge-reconciliations" && <ServiceChargeReconciliationsView rows={rows} loading={loading} search={search} setSearch={setSearch} />}
        {tab === "budgets" && <BudgetsView rows={rows} loading={loading} search={search} setSearch={setSearch} onSelectRow={setSelectedRow} />}
        {tab === "expenses" && <ExpensesView rows={rows} financial={financial} loading={loading} search={search} setSearch={setSearch} setTab={handleSelectTab} />}
        {tab === "reports" && <ReportsView rows={rows} loading={loading} onExport={(key) => void downloadReportCSV(key)} />}

        {selectedRow && (
          <DetailDrawer title={labels[tab]} onClose={() => setSelectedRow(null)} width={400}>
            <RowDetailPanel tab={tab} row={selectedRow} />
          </DetailDrawer>
        )}

        {showAddProperty && (
          <Modal title="Add New Property Asset" onClose={() => setShowAddProperty(false)} wide>
            <form onSubmit={submitAddProperty} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Property Code" required>
                  <input name="code" required placeholder="e.g. CE-PRO-009" />
                </Field>
                <Field label="Property Name" required>
                  <input name="name" required placeholder="e.g. Riverside Towers" />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Type">
                  <select name="property_type" defaultValue="commercial">
                    <option value="commercial">Commercial</option>
                    <option value="residential">Residential</option>
                    <option value="mixed_use">Mixed Use</option>
                    <option value="industrial">Industrial</option>
                  </select>
                </Field>
                <Field label="City / Location">
                  <input name="city" placeholder="Nairobi CBD" />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Address">
                  <input name="address" placeholder="Street, area" />
                </Field>
                <Field label="Country">
                  <input name="country" defaultValue="KE" />
                </Field>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "4px 0" }} />
              <h4 style={{ margin: 0, fontSize: 14 }}>Unit Generator Mix</h4>
              <div className="grid-3">
                <Field label="Total Units">
                  <input name="unit_count" type="number" min={1} max={500} defaultValue={20} />
                </Field>
                <Field label="Prefix">
                  <input name="unit_prefix" defaultValue="UNIT-" />
                </Field>
                <Field label="Avg Area (sqm)">
                  <input name="unit_area" type="number" />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Floor">
                  <input name="unit_floor" placeholder="e.g. 1" />
                </Field>
                <Field label="Unit Type">
                  <input name="unit_type" placeholder="e.g. 2 Bedroom" />
                </Field>
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setShowAddProperty(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Property</button>
              </div>
            </form>
          </Modal>
        )}

        {showAddTenant && (
          <Modal title="Add New Tenant Profile" onClose={() => setShowAddTenant(false)} wide>
            <form onSubmit={submitAddTenant} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <Field label="Tenant Code" required>
                  <input name="code" required placeholder="e.g. TNT-006" />
                </Field>
                <Field label="Full Name / Company" required>
                  <input name="name" required placeholder="e.g. Apex Holdings Ltd" />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Tenant Type">
                  <select name="tenant_type" defaultValue="company">
                    <option value="company">Company</option>
                    <option value="individual">Individual</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" defaultValue="prospect">
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="former">Former</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Email Address">
                  <input name="email" type="email" placeholder="info@company.co.ke" />
                </Field>
                <Field label="Phone Number">
                  <input name="phone" placeholder="+254 700 000 000" />
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
                <button type="submit" className="btn primary">Register Tenant</button>
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
                  <input name="amount" type="number" min={1} required placeholder="0" />
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
                <button type="submit" className="btn primary">Post Receipt</button>
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
