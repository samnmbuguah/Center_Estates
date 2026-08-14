"use client";

import { EmptyState, Panel } from "@/components/module-ui";
import type { DashboardData } from "../../types/property.types";
import { kM } from "../../utils/property.utils";

const currentYear = new Date().getFullYear();
export const forecastYears = Array.from({ length: 5 }, (_, index) => currentYear + index);

export function ForecastView({ dashboard }: { dashboard: DashboardData | null }) {
  const property = dashboard?.propertySummary ?? dashboard?.portfolio?.[0];
  const baseRent = Number(property?.monthlyRent ?? 0) * 12;
  const baseExpenses = Number(dashboard?.kpis?.expensesYtd ?? 0);
  const projections = forecastYears.map((year, index) => {
    const rentalIncome = Math.round(baseRent * Math.pow(1.05, index));
    const operatingExpenses = Math.round(baseExpenses * Math.pow(1.03, index));
    return { year, rentalIncome, operatingExpenses, netOperatingIncome: rentalIncome - operatingExpenses };
  });
  const max = Math.max(...projections.flatMap((row) => [row.rentalIncome, row.operatingExpenses]), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      <div className="card" style={{ padding: 16, background: "var(--surface-2)" }}>
        <h4 style={{ margin: 0, fontSize: 15 }}>5-Year Forecast · {String(property?.name ?? "Selected property")}</h4>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
          A selected-property projection based on current annualised rent and recorded expenses. Portfolio forecasts belong on the Overview page.
        </p>
      </div>

      <div className="card" style={{ padding: 14, background: "var(--surface-2)", border: "1px dashed var(--primary)" }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>Forecast assumptions</h4>
        <div className="row" style={{ gap: 24, flexWrap: "wrap", fontSize: 12 }}>
          <span>Annual rent growth: <strong>5%</strong></span>
          <span>Operating expense growth: <strong>3%</strong></span>
          <span>Starting annual rent: <strong>{kM(baseRent)}</strong></span>
          <span>Starting recorded expenses: <strong>{kM(baseExpenses)}</strong></span>
        </div>
      </div>

      {!property || (baseRent === 0 && baseExpenses === 0) ? (
        <EmptyState icon="📈" title="Not enough property data" description="Add an active lease, billing data and expenses for this property to generate its forecast." />
      ) : (
        <>
          <Panel title="Income and expense projection">
            <div className="row" style={{ alignItems: "flex-end", gap: 24, height: 210, padding: "22px 24px 10px", borderBottom: "1px solid var(--border)" }}>
              {projections.map((row) => (
                <div key={row.year} style={{ flex: 1, minWidth: 70, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
                  <div title={`Income ${kM(row.rentalIncome)}`} style={{ width: 24, height: `${Math.max((row.rentalIncome / max) * 100, 3)}%`, background: "#16a34a", borderRadius: "5px 5px 0 0" }} />
                  <div title={`Expenses ${kM(row.operatingExpenses)}`} style={{ width: 24, height: `${Math.max((row.operatingExpenses / max) * 100, 3)}%`, background: "#dc2626", borderRadius: "5px 5px 0 0" }} />
                  <span className="muted" style={{ position: "absolute", transform: "translateY(22px)", fontSize: 11 }}>{row.year}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 20px", fontSize: 12, display: "flex", gap: 20 }}>
              <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "#16a34a", marginRight: 6 }} />Rental income</span>
              <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "#dc2626", marginRight: 6 }} />Operating expenses</span>
            </div>
          </Panel>

          <Panel title="Selected Property Forecast">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead><tr><th>Year</th><th>Rental income</th><th>Operating expenses</th><th>Net operating income</th></tr></thead>
                <tbody>{projections.map((row) => (
                  <tr key={row.year}>
                    <td className="mono">{row.year}</td>
                    <td className="mono">{kM(row.rentalIncome)}</td>
                    <td className="mono" style={{ color: "var(--danger)" }}>{kM(row.operatingExpenses)}</td>
                    <td className="mono" style={{ color: row.netOperatingIncome >= 0 ? "#16a34a" : "var(--danger)", fontWeight: 800 }}>{kM(row.netOperatingIncome)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Panel>

          <EmptyState icon="🏗️" title="No approved capital plan" description="Approved capital projects for this property will appear here once they are recorded." />
        </>
      )}
    </div>
  );
}
