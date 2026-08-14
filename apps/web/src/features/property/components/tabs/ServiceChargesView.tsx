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

export function ServiceChargesView({
  rows = [],
  setupRows,
  allocationsRows = [],
  reconciliationsRows = [],
  budgetRows = [],
  scSection = "setup",
  activeSection,
  setScSection = () => {},
  onSectionChange,
  loading = false,
  search = "",
  setSearch = () => {},
  setTab = () => {},
  canFinance = true,
  onAdd = () => {},
  onAddSetup,
  onAllocate = () => {},
  onReconcile = () => {},
  onSelectRow = () => {},
  onAddBudget = () => {},
  onBudgetAction = () => {},
  onRefresh = () => {},
}: {
  rows?: Row[];
  setupRows?: Row[];
  allocationsRows?: Row[];
  reconciliationsRows?: Row[];
  budgetRows?: Row[];
  scSection?: ScSection;
  activeSection?: ScSection;
  setScSection?: (s: ScSection) => void;
  onSectionChange?: (s: ScSection) => void;
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  setTab?: (t: PropertyTab) => void;
  canFinance?: boolean;
  onAdd?: () => void;
  onAddSetup?: () => void;
  onAllocate?: (row: any) => void;
  onReconcile?: (row: any) => void;
  onSelectRow?: (r: Row) => void;
  onAddBudget?: () => void;
  onBudgetAction?: (b: any, a: "approve" | "reject") => void;
  onRefresh?: () => void;
}) {
  const currentSection = activeSection || scSection || "setup";
  const setCurrentSection = onSectionChange || setScSection;
  const currentRows = (setupRows || rows || []) as ServiceChargeRow[];
  const handleAdd = onAddSetup || onAdd;
  const charges = currentRows;
  const totalBudget = charges.reduce((s, c) => s + Number(c.annual_budget ?? 0), 0);
  const activeCharges = charges.filter((c) => c.is_active !== false).length;
  const method = charges[0]?.method ?? "—";
  const totalArea = (charges[0]?.metadata as Record<string, unknown> | undefined)?.total_lettable_area;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ViewToolbar
        title="Service Charge Management"
        subtitle="Configure cost centres, apportion unit budgets, and run period reconciliations"
        search={search}
        onSearch={setSearch}
        placeholder="Search service charges…"
      >
        <div style={{ display: "inline-flex", borderRadius: 8, border: "1px solid #cbd5e1", overflow: "hidden", background: "#f8fafc", gap: 0 }}>
          <button
            type="button"
            onClick={() => setCurrentSection("setup")}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 800, border: 0, cursor: "pointer",
              background: currentSection === "setup" ? "#0f172a" : "transparent",
              color: currentSection === "setup" ? "#ffffff" : "#475569",
            }}
          >
            📋 Cost Centres
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection("allocations")}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 800, border: 0, cursor: "pointer",
              background: currentSection === "allocations" ? "#0f172a" : "transparent",
              color: currentSection === "allocations" ? "#ffffff" : "#475569",
            }}
          >
            📊 Allocations
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection("reconciliations")}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 800, border: 0, cursor: "pointer",
              background: currentSection === "reconciliations" ? "#0f172a" : "transparent",
              color: currentSection === "reconciliations" ? "#ffffff" : "#475569",
            }}
          >
            ⚖️ Reconciliations
          </button>
          <button
            type="button"
            onClick={() => setCurrentSection("budget")}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 800, border: 0, cursor: "pointer",
              background: currentSection === "budget" ? "#0f172a" : "transparent",
              color: currentSection === "budget" ? "#ffffff" : "#475569",
            }}
          >
            💰 Budget vs Actual
          </button>
        </div>
        <button className="btn primary sm" onClick={handleAdd} style={{ fontWeight: 800 }}>
          + Set Up Charge
        </button>
      </ViewToolbar>

      {currentSection === "setup" && (
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

          <Panel title="Cost Centres" action={<div className="row" style={{ gap: 8 }}><button className="btn ghost sm" onClick={() => setTab("service-charge-allocations")}>Allocations →</button><button className="btn primary sm" onClick={handleAdd}>+ Set up charge</button></div>}>
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
                    {charges.map((c) => {
                      const share = totalBudget > 0 ? pct(Number(c.annual_budget ?? 0), totalBudget) : "0";
                      return (
                        <tr key={String(c.id)}>
                          <td style={{ fontWeight: 600 }}>{String(c.name ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{String(c.description ?? "—")}</td>
                          <td>
                            {c.is_recoverable !== false ? (
                              <span className="badge badge-green">Recoverable</span>
                            ) : (
                              <span className="badge">Direct Cost</span>
                            )}
                          </td>
                          <td className="mono font-semibold">{kM(c.annual_budget)}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{share}%</td>
                          <td><StatusPill value={c.is_active !== false ? "Active" : "Inactive"} /></td>
                          <td>
                            <div className="row" style={{ gap: 6 }}>
                              <button className="btn ghost sm" onClick={() => onAllocate(c)}>Apportion</button>
                              <button className="btn ghost sm" onClick={() => onReconcile(c)}>Reconcile</button>
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
        </>
      )}

      {currentSection === "allocations" && (
        <Panel title="Charge Allocations">
          <ListState loading={loading} empty={(allocationsRows.length > 0 ? allocationsRows : charges).length === 0} emptyTitle="No allocations found" emptyDesc="Generated unit allocations for each service charge appear here.">
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
                  {(allocationsRows.length > 0 ? allocationsRows : (rows as ServiceChargeAllocationRow[])).map((a) => (
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

      {currentSection === "reconciliations" && (
        <Panel title="Service Charge Reconciliations">
          <ListState loading={loading} empty={(reconciliationsRows.length > 0 ? reconciliationsRows : charges).length === 0} emptyTitle="No reconciliations found" emptyDesc="Period reconciliations comparing budget to actual spend appear here.">
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
                  {(reconciliationsRows.length > 0 ? reconciliationsRows : (rows as ServiceChargeReconciliationRow[])).map((r) => (
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

      {currentSection === "budget" && (
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
    </div>
  );
}

/* ─── SERVICE CHARGE ALLOCATIONS (dedicated tab) ─── */

