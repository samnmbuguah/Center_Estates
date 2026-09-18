import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { fetchExecDashboard, type ExecDashboard } from "../api";
import { useWorkspace } from "../context/WorkspaceContext";
import { ErrorBanner, Skeleton, KpiCard } from "../components";
import { SimpleBarChart, SimplePieChart } from "../lib/charts";

const money = (v: unknown) =>
  "KES " + Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const moneyShort = (v: unknown) => {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `KES ${(n / 1_000).toFixed(0)}K`;
  return `KES ${n.toLocaleString()}`;
};

export function ExecutiveDashboard() {
  const { activeProjectId, activeProject, projects, selectProject, loading: workspaceLoading } = useWorkspace();
  const [data, setData] = useState<ExecDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    setError(null);
    fetchExecDashboard(activeProjectId)
      .then((res) => {
        setData(res);
      })
      .catch((e) => {
        setError((e as Error).message);
      })
      .finally(() => setLoading(false));
  }, [activeProjectId]);

  const schedule = (data?.schedule ?? { planned_percent: 0, actual_percent: 0, variance: 0 }) as {
    planned_percent: number;
    actual_percent: number;
    variance: number;
  };

  const cost = (data?.cost ?? {
    budget: 0,
    forecast_final_cost: 0,
    certified_to_date: 0,
    paid_to_date: 0,
    cost_variance: 0,
    approved_variations: 0,
  }) as {
    budget: number;
    forecast_final_cost: number;
    certified_to_date: number;
    paid_to_date: number;
    cost_variance: number;
    approved_variations: number;
  };

  const risk = (data?.risk ?? {
    high_risk_tickets: 0,
    overdue_tickets: 0,
    critical_issues: 0,
  }) as {
    high_risk_tickets: number;
    overdue_tickets: number;
    critical_issues: number;
  };

  const behind = schedule.actual_percent < schedule.planned_percent;
  const progressGap = Math.abs(schedule.variance);

  const costData = data
    ? [
        { label: "Budget", value: Math.round(Number(cost.budget || 0) / 1_000_000 * 10) / 10 },
        { label: "Forecast", value: Math.round(Number(cost.forecast_final_cost || 0) / 1_000_000 * 10) / 10 },
        { label: "Certified", value: Math.round(Number(cost.certified_to_date || 0) / 1_000_000 * 10) / 10 },
        { label: "Paid", value: Math.round(Number(cost.paid_to_date || 0) / 1_000_000 * 10) / 10 },
      ]
    : [];

  const riskData = data
    ? [
        { name: "High Risk", value: Number(risk.high_risk_tickets || 0) },
        { name: "Overdue", value: Number(risk.overdue_tickets || 0) },
        { name: "Critical", value: Number(risk.critical_issues || 0) },
      ].filter((d) => d.value > 0)
    : [];

  const totalRiskCount = Number(risk.high_risk_tickets || 0) + Number(risk.overdue_tickets || 0) + Number(risk.critical_issues || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: 1600, margin: "0 auto" }}>
      {/* Header with Project Selector */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "rgba(37, 99, 235, 0.1)",
                color: "var(--brand-primary, #2563eb)",
              }}
            >
              <Building2 size={18} />
            </span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text)" }}>
                Executive Command Center
              </h2>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                High-level governance: physical delivery, commercial S-curves, and risk exposure
              </div>
            </div>
          </div>
        </div>

        {/* Project Selector controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {projects.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="exec-project-select" style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
                Active Project:
              </label>
              <select
                id="exec-project-select"
                value={activeProjectId}
                onChange={(e) => selectProject(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontWeight: 600,
                  fontSize: 13,
                  minWidth: 200,
                  cursor: "pointer",
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.code ? `(${p.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeProject && (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: activeProject.stage === "active" ? "rgba(22, 163, 74, 0.1)" : "rgba(37, 99, 235, 0.1)",
                color: activeProject.stage === "active" ? "#16a34a" : "var(--brand-primary, #2563eb)",
                border: "1px solid currentColor",
              }}
            >
              {activeProject.stage || "Active"}
            </span>
          )}
        </div>
      </div>

      <ErrorBanner message={error} />

      {workspaceLoading || loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <Skeleton height={90} />
            <Skeleton height={90} />
            <Skeleton height={90} />
            <Skeleton height={90} />
          </div>
          <div className="card" style={{ padding: 20 }}>
            <Skeleton height={260} />
          </div>
        </div>
      ) : !activeProjectId ? (
        <div
          className="card"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Building2 size={36} style={{ color: "var(--muted)", opacity: 0.5 }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>No Active Project Selected</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 440 }}>
            Select a project from the top bar or portfolio register to view executive metrics and EVM status.
          </p>
        </div>
      ) : (
        <>
          {/* Top KPI Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <KpiCard
              label="PHYSICAL PROGRESS"
              value={`${schedule.actual_percent}%`}
              sub={
                behind
                  ? `−${progressGap}% behind planned (${schedule.planned_percent}%)`
                  : `+${progressGap}% on track (${schedule.planned_percent}% target)`
              }
              color={behind ? "var(--color-danger, #dc2626)" : "var(--color-emerald-strong, #16a34a)"}
              icon={behind ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
            />

            <KpiCard
              label="APPROVED BUDGET"
              value={moneyShort(cost.budget)}
              sub={
                cost.approved_variations > 0
                  ? `Includes ${moneyShort(cost.approved_variations)} approved variations`
                  : "Original contract sum"
              }
              color="var(--brand-primary, #2563eb)"
              icon={<DollarSign size={20} />}
            />

            <KpiCard
              label="CERTIFIED TO DATE"
              value={moneyShort(cost.certified_to_date)}
              sub={`Paid: ${moneyShort(cost.paid_to_date)} · Retained/Pending: ${moneyShort(Math.max(0, cost.certified_to_date - cost.paid_to_date))}`}
              color="var(--color-info, #0284c7)"
              icon={<CheckCircle2 size={20} />}
            />

            <KpiCard
              label="ACTIVE RISK EXPOSURE"
              value={totalRiskCount === 0 ? "All Clear" : `${totalRiskCount} Issues`}
              sub={
                risk.critical_issues > 0
                  ? `${risk.critical_issues} critical · ${risk.overdue_tickets} overdue`
                  : totalRiskCount > 0
                  ? `${risk.high_risk_tickets} high-risk tickets`
                  : "No critical site blockers"
              }
              color={totalRiskCount > 0 ? "var(--color-danger, #dc2626)" : "var(--color-emerald-strong, #16a34a)"}
              icon={<ShieldAlert size={20} />}
            />
          </div>

          {/* Progress & Commercial Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
            {/* Physical Schedule Progress */}
            <div
              className="card"
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Physical Delivery Schedule</h3>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Actual site execution versus baseline programme
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: behind ? "rgba(220, 38, 38, 0.1)" : "rgba(22, 163, 74, 0.1)",
                    color: behind ? "#dc2626" : "#16a34a",
                  }}
                >
                  {behind ? "Behind Plan" : "On Track"}
                </span>
              </div>

              {/* Progress visual comparison */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Actual Completed</span>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--brand-primary, #2563eb)" }}>
                      {schedule.actual_percent}%
                    </span>
                  </div>
                  <div style={{ height: 10, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, schedule.actual_percent)}%`,
                        background: "var(--brand-primary, #2563eb)",
                        borderRadius: 5,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--muted)" }}>Planned Programme Baseline</span>
                    <span className="mono" style={{ fontWeight: 600, color: "var(--muted)" }}>
                      {schedule.planned_percent}%
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, schedule.planned_percent)}%`,
                        background: "var(--color-slate-400, #94a3b8)",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  padding: "12px 14px",
                  background: "var(--surface-2)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>Schedule Variance</div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: behind ? "#dc2626" : "#16a34a",
                    }}
                  >
                    {schedule.variance > 0 ? "+" : ""}
                    {schedule.variance}%
                  </div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>Status Assessment</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    {behind ? "Mitigation Needed" : "Progression Healthy"}
                  </div>
                </div>
              </div>
            </div>

            {/* Cost & Financial Valuation S-Curve */}
            <div
              className="card"
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Financial & Commercial Performance</h3>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Budget vs Forecast vs Certified Value (KES Millions)
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background:
                      cost.cost_variance > 0 ? "rgba(220, 38, 38, 0.1)" : "rgba(22, 163, 74, 0.1)",
                    color: cost.cost_variance > 0 ? "#dc2626" : "#16a34a",
                  }}
                >
                  {cost.cost_variance > 0 ? "Variance Unfavorable" : "Within Budget"}
                </span>
              </div>

              {costData.length > 0 && (
                <div style={{ height: 160, display: "flex", alignItems: "center" }}>
                  <SimpleBarChart
                    data={costData}
                    bars={[{ key: "value", color: "var(--brand-primary, #2563eb)" }]}
                  />
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>Budget</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 12 }}>
                    {moneyShort(cost.budget)}
                  </div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>Certified</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 12, color: "var(--brand-primary, #2563eb)" }}>
                    {moneyShort(cost.certified_to_date)}
                  </div>
                </div>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>Paid</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 12, color: "#16a34a" }}>
                    {moneyShort(cost.paid_to_date)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk & Safety Profile */}
          <div
            className="card"
            style={{
              padding: 20,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Site Risks & Quality Governance</h3>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Summary of unresolved site blockers, quality exceptions, and audit notices
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  fontWeight: 600,
                }}
              >
                Aggregated from Tickets and Site Logbooks
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: risk.critical_issues > 0 ? "rgba(220, 38, 38, 0.08)" : "var(--surface-2)",
                  border: `1px solid ${risk.critical_issues > 0 ? "rgba(220, 38, 38, 0.3)" : "var(--border)"}`,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: risk.critical_issues > 0 ? "#dc2626" : "var(--muted)" }}>
                  CRITICAL ISSUES
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: risk.critical_issues > 0 ? "#dc2626" : "var(--text)" }}>
                  {risk.critical_issues}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Immediate action required</div>
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: risk.overdue_tickets > 0 ? "rgba(234, 179, 8, 0.08)" : "var(--surface-2)",
                  border: `1px solid ${risk.overdue_tickets > 0 ? "rgba(234, 179, 8, 0.3)" : "var(--border)"}`,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: risk.overdue_tickets > 0 ? "#b45309" : "var(--muted)" }}>
                  OVERDUE TICKETS
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: risk.overdue_tickets > 0 ? "#b45309" : "var(--text)" }}>
                  {risk.overdue_tickets}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Beyond resolution SLA</div>
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: risk.high_risk_tickets > 0 ? "rgba(249, 115, 22, 0.08)" : "var(--surface-2)",
                  border: `1px solid ${risk.high_risk_tickets > 0 ? "rgba(249, 115, 22, 0.3)" : "var(--border)"}`,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: risk.high_risk_tickets > 0 ? "#c2410c" : "var(--muted)" }}>
                  HIGH RISK ITEMS
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: risk.high_risk_tickets > 0 ? "#c2410c" : "var(--text)" }}>
                  {risk.high_risk_tickets}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Subcontractor & site risks</div>
              </div>
            </div>

            {riskData.length > 0 && (
              <div style={{ height: 160, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <SimplePieChart data={riskData} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
