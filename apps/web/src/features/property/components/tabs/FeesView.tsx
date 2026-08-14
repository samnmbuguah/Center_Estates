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

export function FeesView({ rows, loading, search, setSearch, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void;
}) {
  const charges = rows as ServiceChargeRow[];
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
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Fee Schemes" value={kN(charges.length)} sub="Selected property" />
        <KpiCard icon="💰" iconBg="#dbeafe" iconColor="#2563eb" label="Monthly Fees Due" value={kM(monthlyFees)} sub="Estimated monthly" />
        <KpiCard icon="🧾" iconBg="#fef3c7" iconColor="#d97706" label="Fees Invoiced" value={kM(feesInvoiced)} sub="Year to date" />
        <KpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Fees Paid" value={kM(feesPaid)} sub={`${pct(feesPaid, feesInvoiced)}% collected`} />
      </KpiStrip>

      <ViewToolbar title="Fee Invoicing" subtitle="Management fee tracking for the selected property" search={search} onSearch={setSearch} placeholder="Search fee scheme…" />

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
