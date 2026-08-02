import React, { useEffect, useState } from "react";
import { useParams, Link } from "@/components/monitoring/react-router-shim";
import { BarChart3, Coins, TrendingUp, TrendingDown, AlertTriangle, FileDown, FileText, Users, Truck, Package, Calendar } from "lucide-react";
import { get, fetchCashFlowForecast } from "../api";
import { ErrorBanner } from "../components";
import { SimpleBarChart } from "../lib/charts";
import * as Recharts from "recharts";

const ResponsiveContainer = Recharts.ResponsiveContainer as any;
const BarChart = Recharts.BarChart as any;
const Bar = Recharts.Bar as any;
const XAxis = Recharts.XAxis as any;
const YAxis = Recharts.YAxis as any;
const CartesianGrid = Recharts.CartesianGrid as any;
const Tooltip = Recharts.Tooltip as any;
const Legend = Recharts.Legend as any;

import type { CashFlowForecast } from "../api";

const CONTRACT_LABELS: Record<string, { label: string; icon: any; desc: string }> = {
  full: { label: "Full Contract", icon: Package, desc: "Contractor supplies materials + labor" },
  labor_only: { label: "Labor Only", icon: Users, desc: "Owner supplies materials" },
  materials_supply: { label: "Materials Supply", icon: Truck, desc: "Contractor supplies materials only" },
};

const money = (v: unknown) =>
  "KES " + Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATE_COLORS: Record<string, string> = {
  budgeted: "#94a3b8",
  ascertained: "#8b5cf6",
  committed: "#3b82f6",
  certified: "#22c55e",
  paid: "#059669",
};

function CashFlowTab({ id }: { id: string }) {
  const [cfData, setCfData] = useState<CashFlowForecast | null>(null);
  const [cfError, setCfError] = useState<string | null>(null);
  const [cfView, setCfView] = useState<"chart" | "table">("chart");

  useEffect(() => {
    fetchCashFlowForecast(id)
      .then(setCfData)
      .catch((e) => setCfError(e.message));
  }, [id]);

  if (cfError) return <ErrorBanner message={cfError} />;
  if (!cfData) return <p>Loading cash flow forecast...</p>;

  const totalPlanned = Number(cfData.total_planned);
  const totalActual = Number(cfData.total_actual);
  const remaining = Number(cfData.remaining);

  const chartData = cfData.months.map((m) => ({
    label: m.month,
    Planned: Number(m.planned) / 1_000_000,
    Actual: Number(m.actual) / 1_000_000,
  }));

  return (
    <div>
      <div className="grid mb-md">
        <div className="card card-compact">
          <div className="muted fs-xs mb-xs">Total Planned</div>
          <div className="fw-700 fs-24">{money(cfData.total_planned)}</div>
        </div>
        <div className="card card-compact">
          <div className="muted fs-xs mb-xs">Total Actual</div>
          <div className="fw-700 fs-24">{money(cfData.total_actual)}</div>
        </div>
        <div className="card card-compact" style={{ borderLeftColor: remaining > 0 ? "var(--success)" : "var(--danger)" }}>
          <div className="muted fs-xs mb-xs">Remaining</div>
          <div className="fw-700 fs-24">{money(cfData.remaining)}</div>
        </div>
        <div className="card card-compact">
          <div className="muted fs-xs mb-xs">Forecast Completion</div>
          <div className="fw-700 fs-24">{cfData.forecast_completion ?? "N/A"}</div>
        </div>
      </div>

      <div className="flex-between mb-sm">
        <h3 className="m-0">Monthly Cash Flow</h3>
        <div className="row gap-sm">
          <button className={`btn sm ${cfView === "chart" ? "" : "ghost"}`} onClick={() => setCfView("chart")}>
            <BarChart3 size={14} className="mr-xs" />Chart
          </button>
          <button className={`btn sm ${cfView === "table" ? "" : "ghost"}`} onClick={() => setCfView("table")}>
            <FileText size={14} className="mr-xs" />Table
          </button>
        </div>
      </div>

      {cfView === "chart" ? (
        <div className="card mb-md">
          <h3 style={{ marginTop: 0 }}>Planned vs Actual (KES millions)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #334155)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted, #94a3b8)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted, #94a3b8)" />
              <Tooltip contentStyle={{ background: "var(--card-bg, #1e293b)", border: "1px solid var(--border, #334155)", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="Planned" fill="var(--accent, #2563eb)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Actual" fill="var(--success, #16a34a)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card mb-md" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Planned</th>
                <th>Actual</th>
                <th>Cum. Planned</th>
                <th>Cum. Actual</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {cfData.months.map((m) => {
                const planned = Number(m.planned);
                const actual = Number(m.actual);
                const cumPlanned = Number(m.cumulative_planned);
                const cumActual = Number(m.cumulative_actual);
                const variance = planned - actual;
                return (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td className="mono">{money(m.planned)}</td>
                    <td className="mono">{money(m.actual)}</td>
                    <td className="mono">{money(m.cumulative_planned)}</td>
                    <td className="mono">{money(m.cumulative_actual)}</td>
                    <td className="mono" style={{ color: variance >= 0 ? "var(--success)" : "var(--danger)" }}>
                      {variance >= 0 ? "+" : ""}{money(variance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CostDashboard() {
  const downloadPdf = async (url: string) => {
    try {
      const { getToken } = await import("../api");
      const token = getToken();
      if (!token) { window.open(url, "_blank"); return; }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = url.split("/").pop()?.split("?")[0] || "report.pdf";
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };
  const { id = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [contractType, setContractType] = useState<string>("full");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "cashflow">("overview");

  useEffect(() => {
    if (tab !== "overview") return;
    Promise.all([
      get<any>(`/projects/${id}/cost-dashboard`),
      get<any>(`/projects/${id}`).then(p => setContractType(p.contract_type || "full")).catch(() => {}),
    ]).then(([d]) => setData(d)).catch(e => setError(e.message));
  }, [id, tab]);

  return (
    <div>
      <div className="flex-between">
        <h2>Cost Dashboard</h2>
        <div className="row gap-md">
          {CONTRACT_LABELS[contractType] && (
            <span className="badge flex-center fs-base p-sm">
              {React.createElement(CONTRACT_LABELS[contractType].icon, { size: 16 })}
              {CONTRACT_LABELS[contractType].label}
            </span>
          )}
          <button className="btn sm" onClick={() => downloadPdf(`/api/finance/reports/cost-dashboard?project_id=${id}`)}>
            <FileText size={14} className="mr-xs" />PDF Report
          </button>
          <button className="btn sm" onClick={() => downloadPdf(`/api/finance/reports/retention-statement?project_id=${id}`)}>
            <FileText size={14} className="mr-xs" />Retention
          </button>
          <button className="btn sm" onClick={() => downloadPdf(`/api/finance/reports/advance-schedule?project_id=${id}`)}>
            <FileText size={14} className="mr-xs" />Advance Schedule
          </button>
          <a href={`/api/exports/cost/${id}/csv`} className="btn sm no-underline" download>
            <FileText size={14} className="mr-xs" />CSV
          </a>
        </div>
      </div>

      <div className="row gap-sm mb-md" style={{ borderBottom: "1px solid var(--border, #334155)", paddingBottom: 4 }}>
        <button
          className={`btn sm ghost ${tab === "overview" ? "" : ""}`}
          style={tab === "overview" ? { borderBottom: "2px solid var(--accent)" } : {}}
          onClick={() => setTab("overview")}
        >
          <Coins size={14} className="mr-xs" />Overview
        </button>
        <button
          className={`btn sm ghost ${tab === "cashflow" ? "" : ""}`}
          style={tab === "cashflow" ? { borderBottom: "2px solid var(--accent)" } : {}}
          onClick={() => setTab("cashflow")}
        >
          <Calendar size={14} className="mr-xs" />Cash Flow
        </button>
      </div>

      {tab === "overview" ? (
        !data ? (error ? <ErrorBanner message={error} /> : <p>Loading...</p>) : (
          <>
            {(() => {
              const budget = Number(data.budget) || 0;
              const forecast = Number(data.forecast_final_cost) || 0;
              const certified = Number(data.certified_to_date) || 0;
              const paid = Number(data.paid_to_date) || 0;
              const costVariance = Number(data.cost_variance) || 0;
              const cpi = certified > 0 && forecast > 0 ? (certified / forecast) : 1;
              const spi = certified > 0 && budget > 0 ? (certified / budget) : 1;
              const cpiColor = cpi >= 1 ? "var(--success)" : cpi >= 0.9 ? "var(--warning)" : "var(--danger)";
              const spiColor = spi >= 1 ? "var(--success)" : spi >= 0.9 ? "var(--warning)" : "var(--danger)";
              const burnPercent = budget > 0 ? Math.round(paid / budget * 100) : 0;
              const chartData = [
                { label: "Budget", value: budget / 1_000_000 },
                { label: "Forecast", value: forecast / 1_000_000 },
                { label: "Certified", value: certified / 1_000_000 },
                { label: "Paid", value: paid / 1_000_000 },
              ];
              const boqStateData = data.boq_by_state ? Object.entries(data.boq_by_state).map(([state, info]: [string, any]) => ({
                label: state.charAt(0).toUpperCase() + state.slice(1),
                value: Number(info.total) / 1_000_000,
                count: info.count,
                color: STATE_COLORS[state] || "#94a3b8",
              })).filter((d) => d.value > 0 || d.count > 0) : [];
              const rows = [
                { label: "Tender Amount", value: data.tender_amount },
                { label: "Budget", value: data.budget },
                { label: "Budget vs Tender", value: data.budget_vs_tender, color: data.budget_vs_tender?.startsWith("-") ? "var(--success)" : data.budget_vs_tender === "0.00" ? "" : "var(--danger)" },
                { label: "Approved Variations", value: data.approved_variations, color: data.approved_variations?.startsWith("-") ? "var(--danger)" : "" },
                { label: "Forecast Final Cost", value: data.forecast_final_cost },
                { label: "Cost Variance", value: data.cost_variance, color: data.cost_variance?.startsWith("-") ? "var(--success)" : "var(--danger)" },
                { label: "Provisional Sums (Budgeted)", value: data.provisional_sums_budget },
                { label: "Provisional Sums (Ascertained)", value: data.provisional_sums_ascertained },
                { label: "Contingency Drawn", value: data.contingency_drawn },
                { label: "Certified to Date", value: data.certified_to_date },
                { label: "Paid to Date", value: data.paid_to_date },
                { label: "Retention Held", value: data.total_retention_held, color: "var(--warning)" },
                { label: "Advance Recovery", value: data.total_advance_recovery },
              ];

              return (
                <>
                  <div className="grid mb-md">
                    <div className="card card-compact" style={{ borderLeftColor: cpiColor }}>
                      <div className="muted fs-xs mb-xs">Cost Performance Index</div>
                      <div className="fw-700 fs-28" style={{ color: cpiColor }}>{cpi.toFixed(3)}</div>
                      <div className="muted fs-xs">
                        {cpi >= 1 ? <TrendingUp size={12} style={{ verticalAlign: -2 }} /> : <TrendingDown size={12} style={{ verticalAlign: -2 }} />}
                        {" "}{cpi >= 1 ? "Under budget" : "Over budget"} ({cpi >= 1 ? "+" : ""}{((cpi - 1) * 100).toFixed(1)}%)
                      </div>
                    </div>
                    <div className="card card-compact" style={{ borderLeftColor: spiColor }}>
                      <div className="muted fs-xs mb-xs">Schedule Performance Index</div>
                      <div className="fw-700 fs-28" style={{ color: spiColor }}>{spi.toFixed(3)}</div>
                      <div className="muted fs-xs">
                        {spi >= 1 ? <TrendingUp size={12} style={{ verticalAlign: -2 }} /> : <TrendingDown size={12} style={{ verticalAlign: -2 }} />}
                        {" "}{spi >= 1 ? "On/ahead of schedule" : "Behind schedule"} ({spi >= 1 ? "+" : ""}{((spi - 1) * 100).toFixed(1)}%)
                      </div>
                    </div>
                    <div className="card card-compact" style={{ borderLeftColor: costVariance > 0 ? "var(--danger)" : "var(--success)" }}>
                      <div className="muted fs-xs mb-xs">Cost Variance</div>
                      <div className="fw-700 fs-28">{money(data.cost_variance)}</div>
                      <div className="muted fs-xs">
                        {costVariance > 0 ? <AlertTriangle size={12} style={{ verticalAlign: -2, color: "var(--danger)" }} /> : null}
                        {" "}{costVariance > 0 ? "Over budget" : costVariance < 0 ? "Under budget" : "On budget"}
                      </div>
                    </div>
                    <div className="card card-compact">
                      <div className="muted fs-xs mb-xs">Advance Payments Outstanding</div>
                      <div className="fw-700 fs-28">{money(data.advance_payments_outstanding)}</div>
                      <div className="muted fs-xs">of {money(data.advance_payments_total)} total</div>
                    </div>
                  </div>

                  <div className="grid-2 mb-md">
                    <div className="card">
                      <h3 className="mt-0">Planned vs Actual (KES millions)</h3>
                      <SimpleBarChart data={chartData} bars={[{ key: "value", color: "var(--accent, #2563eb)" }]} />
                    </div>
                    <div className="card">
                      <h3 className="mt-0">Burn Rate</h3>
                      <p className="muted">{burnPercent}% of budget utilised</p>
                      <div className="mt-sm" style={{ background: "var(--surface-2, #1e293b)", borderRadius: 8, height: 24, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(burnPercent, 100)}%`, height: "100%", background: costVariance > 0 ? "var(--danger, #dc2626)" : "var(--success, #16a34a)", borderRadius: 8, transition: "width 0.5s" }} />
                      </div>
                      <div className="flex-between mt-sm fs-sm">
                        <span>0%</span>
                        <span className="muted">{money(paid)} / {money(budget)}</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>

                  {boqStateData.length > 0 && (
                    <div className="card mb-md">
                      <div className="row flex-between mb-sm">
                        <h3 className="m-0">BoQ Cost State Breakdown</h3>
                        <Link to={`/app/projects/${id}/boq-cost-states`} className="btn ghost sm">Manage States</Link>
                      </div>
                      <div className="flex-wrap gap-lg">
                        {boqStateData.map((d: any) => (
                          <div key={d.label} className="p-sm" style={{ flex: "1 1 120px", background: "var(--surface-2)", borderRadius: 8, borderLeft: `4px solid ${d.color}` }}>
                            <div className="muted fs-xs">{d.label}</div>
                            <div className="fs-lg fw-700">{d.count} items</div>
                            <div className="muted fs-xs">KES {Number(d.value).toFixed(1)}M</div>
                          </div>
                        ))}
                      </div>
                      <div className="row gap-md mt-sm fs-sm">
                        <span className="muted">Total BoQ:</span>
                        <b>{money(data.boq_total)}</b>
                        <span className="muted ml-sm">Certified:</span>
                        <b className="text-success">{money(data.boq_certified_total)}</b>
                      </div>
                    </div>
                  )}

                  <div className="card">
                    <table>
                      <thead><tr><th>Metric</th><th>Amount</th></tr></thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.label}>
                            <td>{r.label}</td>
                            <td className="mono" style={r.color ? { color: r.color } : {}}>
                              {Number(r.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </>
        )
      ) : (
        <CashFlowTab id={id} />
      )}
    </div>
  );
}
