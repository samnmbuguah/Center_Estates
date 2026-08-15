"use client";

import { useMemo } from "react";
import { EmptyState, KpiCard, KpiStrip, LoadingState, StatusPill } from "@/components/module-ui";
import { CompanionDash, Row } from "../../types/companion.types";
import { fmtDate, fmtDateTime, greeting, STATUS_TONE } from "../../utils/companion.utils";

export function OverviewView({
  dash,
  loading,
  userName,
  onSelectTab,
  onRunAction,
}: {
  dash: CompanionDash | null;
  loading: boolean;
  userName: string;
  onSelectTab: (tab: string) => void;
  onRunAction: (task: Row, action: string) => void;
}) {
  const kpis = (dash?.kpis ?? {}) as Record<string, unknown>;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const recentTasks = dash?.recentTasks ?? [];
  const overdueTasks = dash?.overdueTasks ?? [];
  const escalatedTasks = dash?.escalatedTasks ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card" style={{ background: "linear-gradient(120deg, rgba(13,148,136,0.12), transparent)", border: "1px solid var(--border)", padding: 20 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>{today}</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{greeting()}, {userName}</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Let&apos;s make today productive — here is what needs your attention.</p>
      </div>

      <KpiStrip>
        <KpiCard icon="📅" label="Due Today" value={String(kpis.dueToday ?? 0)} sub="Tasks due today" onClick={() => onSelectTab("my-tasks")} />
        <KpiCard icon="⏰" label="Overdue" value={String(kpis.overdue ?? 0)} sub="Past due date" borderColor="var(--danger)" onClick={() => onSelectTab("my-tasks")} />
        <KpiCard icon="🚨" label="Escalated" value={String(kpis.escalated ?? 0)} sub="SLA breaches" borderColor="var(--danger)" onClick={() => onSelectTab("my-tasks")} />
        <KpiCard icon="⚙️" label="In Progress" value={String(kpis.inProgress ?? 0)} sub="Actively worked" onClick={() => onSelectTab("my-tasks")} />
        <KpiCard icon="✅" label="Completed" value={String(kpis.completed ?? 0)} sub="All time" onClick={() => onSelectTab("my-tasks")} />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="panel-title" style={{ padding: "0 0 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>My Tasks</h3>
              <button className="btn ghost sm" onClick={() => onSelectTab("my-tasks")}>View all →</button>
            </div>
            {loading ? (
              <LoadingState rows={4} />
            ) : recentTasks.length === 0 ? (
              <EmptyState icon="✅" title="All clear" description="No companion tasks are pending for you right now. Tasks assigned to you will appear here." />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Source</th>
                      <th>Priority</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTasks.map((t: Row) => (
                      <tr key={String(t.id)}>
                        <td>
                          <strong style={{ fontSize: 13 }}>{String(t.title)}</strong>
                          {t.description ? <div className="muted" style={{ fontSize: 11 }}>{String(t.description).slice(0, 80)}</div> : null}
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>{String(t.source_module ?? "companion")}</td>
                        <td><StatusPill value={String(t.priority ?? "normal")} /></td>
                        <td className="mono" style={{ fontSize: 12 }}>{fmtDateTime(t.due_at)}</td>
                        <td><StatusPill value={String(t.status)} tone={STATUS_TONE[String(t.status)]} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>🚨 Escalated</h3>
            {escalatedTasks.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: "12px 0" }}>No escalated tasks.</div>
            ) : (
              escalatedTasks.map((t: Row) => (
                <div key={String(t.id)} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
                  <strong style={{ fontSize: 13 }}>{String(t.title)}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{String(t.assignee_name || t.assignee_username || "—")} · {fmtDate(t.due_at)}</div>
                </div>
              ))
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>⏰ Overdue</h3>
            {overdueTasks.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: "12px 0" }}>Nothing overdue. 🎉</div>
            ) : (
              overdueTasks.map((t: Row) => (
                <div key={String(t.id)} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
                  <strong style={{ fontSize: 13 }}>{String(t.title)}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>Due {fmtDateTime(t.due_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
