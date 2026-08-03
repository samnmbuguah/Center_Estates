import { useEffect, useState } from "react";

import { fetchExecDashboard, type ExecDashboard } from "../api";
import { ErrorBanner, Skeleton } from "../components";
import { SimpleBarChart, SimplePieChart, SimpleLineChart } from "../lib/charts";

interface ProjectOption { id: string; name: string }

const money = (v: unknown) =>
  "KES " + Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="card card-compact">
      <div className="muted fs-xs">{label}</div>
      <div className="fs-20 fw-700" style={{ color }}>{value}</div>
      {sub && <div className="muted fs-xs">{sub}</div>}
    </div>
  );
}

export function ExecutiveDashboard() {
  const projectId = sessionStorage.getItem("activeProject") || "";
  const [data, setData] = useState<ExecDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setData(null);
    fetchExecDashboard(projectId).then(setData).catch((e) => setError((e as Error).message));
  }, [projectId]);

  const schedule = (data?.schedule ?? { planned_percent: 0, actual_percent: 0, variance: 0 }) as any;
  const cost = (data?.cost ?? { budget: 0, forecast_final_cost: 0, certified_to_date: 0, paid_to_date: 0, cost_variance: 0, approved_variations: 0 }) as any;
  const risk = (data?.risk ?? { high_risk_tickets: 0, overdue_tickets: 0, critical_issues: 0 }) as any;

  const behind = schedule.actual_percent < schedule.planned_percent;

  const scurveData = data ? [
    { label: "Schedule", planned: schedule.planned_percent, actual: schedule.actual_percent },
  ] : [];

  const costData = data ? [
    { label: "Budget", value: Number(cost.budget) / 1_000_000 },
    { label: "Forecast", value: Number(cost.forecast_final_cost) / 1_000_000 },
    { label: "Certified", value: Number(cost.certified_to_date) / 1_000_000 },
    { label: "Paid", value: Number(cost.paid_to_date) / 1_000_000 },
  ] : [];

  const riskData = data ? [
    { name: "High Risk", value: risk.high_risk_tickets },
    { name: "Overdue", value: risk.overdue_tickets },
    { name: "Critical", value: risk.critical_issues },
  ].filter(d => d.value > 0) : [];

  return (
    <div>
      <h2>Client Dashboard</h2>
      <p className="muted">Executive read-only overview: schedule, cost and risk.</p>
      <ErrorBanner message={error} />

      {projectId && <p className="muted fs-base mb-md">Project: {projectId.slice(0, 8)}</p>}

      {!data ? (
        <>
          <div className="grid"><Skeleton height={80} /><Skeleton height={80} /><Skeleton height={80} /></div>
          <div className="card mt-sm"><Skeleton height={200} /></div>
          <h3 className="mt-md">Cost</h3>
          <div className="grid"><Skeleton height={80} /><Skeleton height={80} /><Skeleton height={80} /><Skeleton height={80} /><Skeleton height={80} /><Skeleton height={80} /></div>
        </>
      ) : (
        <>
          <h3>Schedule</h3>
          <div className="grid">
            <Stat label="Actual progress" value={`${schedule.actual_percent}%`} />
            <Stat label="Planned progress" value={`${schedule.planned_percent}%`} />
            <Stat
              label="Variance"
              value={`${schedule.variance > 0 ? "+" : ""}${schedule.variance}%`}
              color={behind ? "var(--danger)" : "var(--success)"}
              sub={behind ? "Behind plan" : "On / ahead of plan"}
            />
          </div>
          <div className="card">
            <SimpleBarChart data={scurveData} bars={[{ key: "planned", color: "var(--muted, #94a3b8)" }, { key: "actual", color: "var(--accent, #2563eb)" }]} />
          </div>

          <h3 className="mt-md">Cost</h3>
          <div className="grid">
            <Stat label="Total budget" value={money(cost.budget)} />
            <Stat label="Approved variations" value={money(cost.approved_variations)} />
            <Stat label="Forecast final cost" value={money(cost.forecast_final_cost)} />
            <Stat label="Certified to date" value={money(cost.certified_to_date)} />
            <Stat label="Paid to date" value={money(cost.paid_to_date)} />
            <Stat
              label="Cost variance"
              value={money(cost.cost_variance)}
              color={Number(cost.cost_variance) > 0 ? "var(--danger)" : "var(--success)"}
              sub="forecast − budget"
            />
          </div>
          <div className="card">
            <SimpleBarChart data={costData} bars={[{ key: "value", color: "var(--accent, #2563eb)" }]} />
          </div>

          <h3 className="mt-md">Risk summary</h3>
          <div className="grid">
            <Stat label="High-risk tickets" value={String(risk.high_risk_tickets)}
              color={risk.high_risk_tickets ? "var(--danger)" : undefined} />
            <Stat label="Overdue tickets" value={String(risk.overdue_tickets)}
              color={risk.overdue_tickets ? "var(--warning)" : undefined} />
            <Stat label="Critical issues" value={String(risk.critical_issues)}
              color={risk.critical_issues ? "var(--danger)" : undefined} />
          </div>
          {riskData.length > 0 && (
            <div className="card">
              <SimplePieChart data={riskData} />
            </div>
          )}
          <p className="muted mt-sm">No operational ticket detail shown by default.</p>
        </>
      )}
    </div>
  );
}
