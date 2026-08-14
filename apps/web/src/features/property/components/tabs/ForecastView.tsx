"use client";

import { useState, useMemo, Fragment, type ReactNode } from "react";
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

export const forecastYears = [2026, 2027, 2028, 2029, 2030] as const;

export const forecastProperties = [
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

export const capitalProjects = [
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

export function ForecastView() {
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

