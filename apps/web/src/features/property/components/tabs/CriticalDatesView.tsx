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

type CriticalDateType = "lease" | "contract" | "inspection" | "billing";
type CriticalDate = {
  type: CriticalDateType;
  label: string;
  property: string;
  date: string;
  entity: Row;
  icon: string;
};

export function CriticalDatesView({ leases, contractors, inspections, serviceCharges, loading, setTab }: {
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
        <KpiCard icon="🔴" label="Next 7 Days" value={String(next7)} borderColor="var(--color-danger)" />
        <KpiCard icon="🟡" label="Next 30 Days" value={String(next30)} borderColor="var(--color-amber)" />
        <KpiCard icon="⚠️" label="Overdue" value={String(overdue)} borderColor="var(--color-danger)" />
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

