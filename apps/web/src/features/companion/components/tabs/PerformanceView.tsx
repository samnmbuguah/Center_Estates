"use client";

import { Badge, EmptyState, ErrorBanner, KpiCard, KpiStrip, LoadingState } from "@/components/module-ui";
import { CompanionDash, Row } from "../../types/companion.types";
import { fmtDate, fmtDateTime } from "../../utils/companion.utils";

export function PerformanceView({
  tab,
  isSuperAdmin,
  dash,
  staff,
  loading,
  error,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onApplyDateFilter,
  onOpenStaffDetail,
}: {
  tab: "performance" | "staff";
  isSuperAdmin: boolean;
  dash: CompanionDash | null;
  staff: Row[];
  loading: boolean;
  error: string;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  onApplyDateFilter: () => void;
  onOpenStaffDetail: (s: Row) => void;
}) {
  if (!isSuperAdmin) {
    return (
      <EmptyState
        icon="🔒"
        title="Super Admin Access Required"
        description="Performance analytics and team SLA metrics are available to platform super administrators only."
      />
    );
  }

  const kpis = (dash?.kpis ?? {}) as Record<string, unknown>;
  const escalatedTasks = dash?.escalatedTasks ?? [];
  const inputStyle = { padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12 };

  if (tab === "staff") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? <ErrorBanner message={error} /> : loading ? <LoadingState rows={6} /> : staff.length === 0 ? (
          <EmptyState icon="👥" title="No staff data available" description="Staff performance analytics require active staff members in the organization." />
        ) : (
          <div className="card" style={{ padding: 18 }}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Last Login</th>
                    <th>Assigned</th>
                    <th>Completed</th>
                    <th>Completion %</th>
                    <th>Overdue</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={String(s.user_id)} style={{ cursor: "pointer" }} onClick={() => onOpenStaffDetail(s)}>
                      <td><strong style={{ fontSize: 13 }}>{String(s.name)}</strong></td>
                      <td style={{ fontSize: 12 }}>{fmtDateTime(s.last_login)}</td>
                      <td className="mono">{String(s.tasks_assigned ?? 0)}</td>
                      <td className="mono">{String(s.tasks_completed ?? 0)}</td>
                      <td className="mono">{String(s.completion_rate ?? 0)}%</td>
                      <td className="mono" style={{ color: s.overdue_tasks ? "var(--danger)" : "var(--text)" }}>{String(s.overdue_tasks ?? 0)}</td>
                      <td>{s.requires_attention ? <Badge value="attention" tone="red" /> : <Badge value="ok" tone="green" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error ? <ErrorBanner message={error} /> : loading ? <LoadingState rows={6} /> : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>From:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
            <label style={{ fontSize: 12, fontWeight: 600 }}>To:</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
            <button className="btn ghost sm" onClick={onApplyDateFilter}>Apply Filter</button>
          </div>

          <KpiStrip>
            <KpiCard icon="👥" label="Daily Active Users" value={String(kpis.dailyActiveUsers ?? 0)} sub={`${kpis.totalStaff ?? 0} staff`} />
            <KpiCard icon="📝" label="Tasks Assigned" value={String(kpis.tasksAssigned ?? 0)} sub="All time" />
            <KpiCard icon="✅" label="Tasks Completed" value={String(kpis.tasksCompleted ?? 0)} sub={`${kpis.completionRate ?? 0}% completion`} />
            <KpiCard icon="⏰" label="Overdue Tasks" value={String(kpis.overdueTasks ?? 0)} sub="Needs attention" borderColor="var(--danger)" />
            <KpiCard icon="🚨" label="Escalated Tasks" value={String(kpis.escalatedTasks ?? 0)} sub="SLA breaches" borderColor="var(--danger)" />
            <KpiCard icon="📈" label="Adoption Score" value={`${kpis.adoptionScore ?? 0}%`} sub="System adoption" />
          </KpiStrip>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>⚠️ Staff Requiring Attention</h3>
              <div className="table-scroll" style={{ maxHeight: 320 }}>
                <table>
                  <thead>
                    <tr><th>Staff</th><th>Assigned</th><th>Completed</th><th>Overdue</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={String(s.user_id)}>
                        <td><strong style={{ fontSize: 13 }}>{String(s.name)}</strong></td>
                        <td className="mono">{String(s.tasks_assigned ?? 0)}</td>
                        <td className="mono">{String(s.tasks_completed ?? 0)}</td>
                        <td className="mono" style={{ color: s.overdue_tasks ? "var(--danger)" : "var(--text)" }}>{String(s.overdue_tasks ?? 0)}</td>
                        <td>{s.requires_attention ? <Badge value="attention" tone="red" /> : <Badge value="ok" tone="green" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>🚨 Escalated Tasks</h3>
              {escalatedTasks.length === 0 ? (
                <div className="muted" style={{ padding: "16px 0" }}>No escalated tasks.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {escalatedTasks.map((t: Row) => (
                    <div key={String(t.id)} style={{ borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
                      <strong style={{ fontSize: 13 }}>{String(t.title)}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{String(t.assignee_name || t.assignee_username || "—")} · due {fmtDate(t.due_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
