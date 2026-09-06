"use client";

import { useMemo } from "react";
import { EmptyState, KpiCard, KpiStrip, LoadingState, StatusPill } from "@/components/module-ui";
import { CompanionDash, Row } from "../../types/companion.types";
import { fmtDate, fmtDateTime, greeting, STATUS_TONE } from "../../utils/companion.utils";
import { DailyBriefingCard } from "../DailyBriefingCard";
import { CompanionNudgeCard } from "@/components/companion-nudge-card";

export function OverviewView({
  dash,
  loading,
  userName,
  onSelectTab,
  onRunAction,
  onManageReminders,
  canManageReminders,
}: {
  dash: CompanionDash | null;
  loading: boolean;
  userName: string;
  onSelectTab: (tab: string) => void;
  onRunAction: (task: Row, action: string) => void;
  onManageReminders: () => void;
  canManageReminders: boolean;
}) {
  const kpis = (dash?.kpis ?? {}) as Record<string, unknown>;
  const recentTasks = dash?.recentTasks ?? [];
  const overdueTasks = dash?.overdueTasks ?? [];
  const escalatedTasks = dash?.escalatedTasks ?? [];

  return (
    <div className="module-page-stack">
      {dash?.activeNudge && (
        <CompanionNudgeCard nudge={dash.activeNudge} />
      )}

      <div className="module-toolbar">
        <div className="module-toolbar-copy">
          Personal workspace & team operational briefings
        </div>
        <div className="module-action-group">
          {canManageReminders && (
            <button className="btn ghost sm" onClick={onManageReminders}>📣 Manage team reminders</button>
          )}
          <a
            href="/caretaker-portal?preview=1"
            target="_blank"
            rel="noreferrer"
            className="module-secondary-action"
          >
            📱 Preview caretaker portal ↗
          </a>
        </div>
      </div>

      <DailyBriefingCard userName={userName} />

      <KpiStrip>
        {Number(kpis.dueToday ?? 0) > 0 && <KpiCard icon="📅" label="Due Today" value={String(kpis.dueToday)} sub="Tasks due today" onClick={() => onSelectTab("my-tasks")} />}
        <KpiCard icon="⏰" label="Overdue" value={String(kpis.overdue ?? 0)} sub="Past due date" borderColor="var(--danger)" onClick={() => onSelectTab("my-tasks")} />
        <KpiCard icon="🚨" label="Escalated" value={String(kpis.escalated ?? 0)} sub="SLA breaches" borderColor="var(--danger)" onClick={() => onSelectTab("my-tasks")} />
        <KpiCard icon="⚙️" label="In Progress" value={String(kpis.inProgress ?? 0)} sub="Actively worked" onClick={() => onSelectTab("my-tasks")} />
        <KpiCard icon="✅" label="Completed" value={String(kpis.completed ?? 0)} sub="All time" onClick={() => onSelectTab("my-tasks")} />
      </KpiStrip>

      <div className="module-split-layout module-split-layout-wide">
        <div className="module-column-stack">
          <div className="card module-content-card">
            <div className="module-card-heading">
              <h3>My Tasks</h3>
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

        <div className="module-column-stack">
          <div className="card module-content-card">
            <h3 className="module-card-title">🚨 Escalated</h3>
            {escalatedTasks.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: "12px 0" }}>No escalated tasks.</div>
            ) : (
              escalatedTasks.map((t: Row) => (
                <div key={String(t.id)} className="module-list-row">
                  <strong style={{ fontSize: 13 }}>{String(t.title)}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{String(t.assignee_name || t.assignee_username || "—")} · {fmtDate(t.due_at)}</div>
                </div>
              ))
            )}
          </div>

          <div className="card module-content-card">
            <h3 className="module-card-title">⏰ Overdue</h3>
            {overdueTasks.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: "12px 0" }}>Nothing overdue. 🎉</div>
            ) : (
              overdueTasks.map((t: Row) => (
                <div key={String(t.id)} className="module-list-row">
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
