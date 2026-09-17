"use client";

import {
  Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
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
                  <div title={`Income ${kM(row.rentalIncome)}`} style={{ width: 24, height: `${Math.max((row.rentalIncome / max) * 100, 3)}%`, background: "var(--color-success)", borderRadius: "5px 5px 0 0" }} />
                  <div title={`Expenses ${kM(row.operatingExpenses)}`} style={{ width: 24, height: `${Math.max((row.operatingExpenses / max) * 100, 3)}%`, background: "var(--color-danger)", borderRadius: "5px 5px 0 0" }} />
                  <span className="muted" style={{ position: "absolute", transform: "translateY(22px)", fontSize: 11 }}>{row.year}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 20px", fontSize: 12, display: "flex", gap: 20 }}>
              <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--color-success)", marginRight: 6 }} />Rental income</span>
              <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--color-danger)", marginRight: 6 }} />Operating expenses</span>
            </div>
          </Panel>

          <Panel title="Selected Property Forecast">
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Year</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Rental income</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Operating expenses</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Net operating income</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projections.map((row) => (
                    <TableRow key={row.year} hover>
                      <TableCell><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{row.year}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>{kM(row.rentalIncome)}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "error.main" }}>
                          {kM(row.operatingExpenses)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: row.netOperatingIncome >= 0 ? "success.main" : "error.main", fontWeight: 800 }}>
                          {kM(row.netOperatingIncome)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Panel>

          <EmptyState icon="🏗️" title="No approved capital plan" description="Approved capital projects for this property will appear here once they are recorded." />
        </>
      )}
    </div>
  );
}
