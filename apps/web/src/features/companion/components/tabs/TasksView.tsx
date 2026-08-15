"use client";

import { useMemo, useState } from "react";
import { DetailDrawer, EmptyState, Field, LoadingState, SearchInput, StatusPill } from "@/components/module-ui";
import { ChecklistItem, Row } from "../../types/companion.types";
import { fmtDateTime, STATUS_TONE } from "../../utils/companion.utils";

const KANBAN_COLUMNS = [
  { id: "pending", label: "To Do / Pending", icon: "📌", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.25)" },
  { id: "acknowledged", label: "Acknowledged", icon: "👁️", color: "#0284c7", bg: "rgba(2, 132, 199, 0.08)", border: "rgba(2, 132, 199, 0.25)" },
  { id: "in_progress", label: "In Progress", icon: "⚡", color: "#6366f1", bg: "rgba(99, 102, 241, 0.08)", border: "rgba(99, 102, 241, 0.25)" },
  { id: "completed", label: "Completed", icon: "✅", color: "#16a34a", bg: "rgba(22, 163, 74, 0.08)", border: "rgba(22, 163, 74, 0.25)" },
  { id: "delegated", label: "Delegated", icon: "🔄", color: "#f43f5e", bg: "rgba(244, 63, 94, 0.08)", border: "rgba(244, 63, 94, 0.25)" },
] as const;

export function TasksView({
  tab,
  rows,
  loading,
  search,
  setSearch,
  canAssign,
  onOpenAssign,
  onSelectTask,
  onRunAction,
  onOpenDelegate,
  onOpenCompleteModal,
  onUpdateChecklist,
}: {
  tab: "tasks" | "my-tasks" | "delegations";
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  canAssign: boolean;
  onOpenAssign: () => void;
  onSelectTask: (t: Row) => void;
  onRunAction: (t: Row, a: string) => void;
  onOpenDelegate: (t: Row) => void;
  onOpenCompleteModal?: (t: Row) => void;
  onUpdateChecklist?: (taskId: string, checklist: ChecklistItem[]) => void;
}) {
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const title = tab === "my-tasks" ? "My Tasks" : tab === "delegations" ? "Delegations Hub" : "Task Assignment Centre";

  // Extract distinct assignees for quick filter
  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const id = String(r.assignee || "");
      const name = String(r.assignee_name || r.assignee_username || "");
      if (id && name) map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  // Metrics computation for high-level management overview
  const metrics = useMemo(() => {
    const total = rows.length;
    const inProgress = rows.filter((r) => r.status === "in_progress").length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const overdue = rows.filter((r) => {
      if (r.status === "completed" || r.status === "cancelled") return false;
      if (r.overdue) return true;
      if (r.due_at) return new Date(String(r.due_at)).getTime() < Date.now();
      return false;
    }).length;
    return { total, inProgress, completed, overdue };
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all" && String(r.assignee) !== assigneeFilter) return false;
      if (overdueOnly) {
        const isOverdue = r.overdue || (r.due_at && new Date(String(r.due_at)).getTime() < Date.now());
        if (!isOverdue || r.status === "completed") return false;
      }
      return true;
    });
  }, [rows, priorityFilter, assigneeFilter, overdueOnly]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* HEADER & METRIC CARDS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <span>{title}</span>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 12, background: "var(--surface-sunken)", color: "var(--muted)", fontWeight: 600 }}>
              {filteredRows.length} tasks
            </span>
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
            Task tracking, SLA enforcement, sub-task checklists, and proof-of-work validation.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* VIEW SWITCHER */}
          <div style={{ display: "flex", background: "var(--surface-sunken)", padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}>
            <button
              onClick={() => setViewMode("kanban")}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "kanban" ? "var(--surface)" : "transparent",
                color: viewMode === "kanban" ? "var(--primary)" : "var(--muted)",
                boxShadow: viewMode === "kanban" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              📊 Kanban Board
            </button>
            <button
              onClick={() => setViewMode("table")}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "table" ? "var(--surface)" : "transparent",
                color: viewMode === "table" ? "var(--primary)" : "var(--muted)",
                boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              📋 Table View
            </button>
          </div>

          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks by title, ref, source…" />

          {canAssign && (
            <button className="btn primary sm" onClick={onOpenAssign} style={{ fontWeight: 600 }}>
              Assign Task
            </button>
          )}
        </div>
      </div>

      {/* QUICK KPI STRIP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Tasks</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{metrics.total}</div>
          </div>
          <span style={{ fontSize: 20 }}>🗂️</span>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, textTransform: "uppercase" }}>In Progress</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#6366f1" }}>{metrics.inProgress}</div>
          </div>
          <span style={{ fontSize: 20 }}>⚡</span>
        </div>
        <div
          onClick={() => setOverdueOnly(!overdueOnly)}
          style={{
            background: overdueOnly ? "rgba(239, 68, 68, 0.12)" : "var(--surface)",
            border: `1px solid ${overdueOnly ? "#ef4444" : "var(--border)"}`,
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 600, textTransform: "uppercase" }}>
              Overdue / SLA Alerts {overdueOnly && "✓"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{metrics.overdue}</div>
          </div>
          <span style={{ fontSize: 20 }}>⚠️</span>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, textTransform: "uppercase" }}>Completed</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>{metrics.completed}</div>
          </div>
          <span style={{ fontSize: 20 }}>✅</span>
        </div>
      </div>

      {/* FILTER BAR */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "var(--surface)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Filter by:</span>

        {/* Priority Filter */}
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "urgent", "high", "normal", "low"].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                border: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "capitalize",
                cursor: "pointer",
                background: priorityFilter === p ? "var(--primary)" : "transparent",
                color: priorityFilter === p ? "#fff" : "var(--text)",
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Assignee Filter if multiple available */}
        {assignees.length > 0 && (
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-sunken)",
              color: "var(--text)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <option value="all">All Assignees</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                👤 {a.name}
              </option>
            ))}
          </select>
        )}

        {(priorityFilter !== "all" || assigneeFilter !== "all" || overdueOnly) && (
          <button
            onClick={() => {
              setPriorityFilter("all");
              setAssigneeFilter("all");
              setOverdueOnly(false);
            }}
            style={{ padding: "3px 8px", fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <LoadingState rows={5} />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No tasks match the active filters"
          description={
            tab === "my-tasks"
              ? "You have no tasks matching this filter. Check back later or ask your manager to assign work."
              : tab === "delegations"
              ? "No tasks have been delegated to others yet. Use the delegate action on any task to reassign it."
              : "No tasks have been created or match the search. Assign a task to a staff member to get started."
          }
          action={canAssign ? <button className="btn primary sm" onClick={onOpenAssign}>Assign Task</button> : undefined}
        />
      ) : viewMode === "kanban" ? (
        /* KANBAN BOARD VIEW */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {KANBAN_COLUMNS.map((col) => {
            const colTasks = filteredRows.filter((r) => r.status === col.id);
            return (
              <div
                key={col.id}
                style={{
                  background: "var(--surface)",
                  borderRadius: 10,
                  border: `1px solid ${col.border}`,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  minHeight: 320,
                }}
              >
                {/* COLUMN HEADER */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{col.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: col.color }}>{col.label}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 10,
                      background: col.bg,
                      color: col.color,
                    }}
                  >
                    {colTasks.length}
                  </span>
                </div>

                {/* TASK CARDS */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {colTasks.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 8px", color: "var(--muted)", fontSize: 12, fontStyle: "italic" }}>
                      No tasks in this stage
                    </div>
                  ) : (
                    colTasks.map((t) => {
                      const checklist = Array.isArray(t.checklist) ? (t.checklist as ChecklistItem[]) : [];
                      const completedCount = checklist.filter((c) => c.completed).length;
                      const hasChecklist = checklist.length > 0;
                      const progressPct = hasChecklist ? Math.round((completedCount / checklist.length) * 100) : 0;
                      const isOverdue = t.overdue || (t.due_at && new Date(String(t.due_at)).getTime() < Date.now() && t.status !== "completed");

                      return (
                        <div
                          key={String(t.id)}
                          onClick={() => onSelectTask(t)}
                          style={{
                            background: "var(--surface-sunken)",
                            border: `1px solid ${isOverdue ? "#ef4444" : "var(--border)"}`,
                            borderRadius: 8,
                            padding: 12,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            transition: "transform 0.15s ease, box-shadow 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          {/* TOP META: Reference + Priority */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                            <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>
                              {String(t.reference ?? "CPN")}
                            </div>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              {Boolean(t.attachment_url) && (
                                <span title="Evidence Photo Attached" style={{ fontSize: 11 }}>
                                  📸
                                </span>
                              )}
                              <StatusPill value={String(t.priority ?? "normal")} />
                            </div>
                          </div>

                          {/* TITLE */}
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", lineHeight: 1.35 }}>
                            {String(t.title)}
                          </div>

                          {/* SOURCE & PROPERTY */}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
                            <span style={{ background: "rgba(0,0,0,0.05)", padding: "1px 6px", borderRadius: 4 }}>
                              🏷️ {String(t.source_module ?? "companion")}
                            </span>
                            {Boolean(t.property_name) && (
                              <span style={{ background: "rgba(0,0,0,0.05)", padding: "1px 6px", borderRadius: 4 }}>
                                🏢 {String(t.property_name)}
                              </span>
                            )}
                          </div>

                          {/* SUBTASK CHECKLIST PROGRESS */}
                          {hasChecklist && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>
                                <span>Checklist</span>
                                <span>{completedCount}/{checklist.length} ({progressPct}%)</span>
                              </div>
                              <div style={{ width: "100%", height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct === 100 ? "#16a34a" : "var(--primary)" }} />
                              </div>
                            </div>
                          )}

                          {/* DUE DATE & OVERDUE BADGE */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, marginTop: 4 }}>
                            <div style={{ color: isOverdue ? "#ef4444" : "var(--muted)", fontWeight: isOverdue ? 700 : 500 }}>
                              {isOverdue ? "⚠️ Overdue: " : "⏱️ Due: "}
                              {fmtDateTime(t.due_at)}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>
                                {String(t.assignee_name || t.assignee_username || "?").charAt(0).toUpperCase()}
                              </span>
                              <span>{String(t.assignee_name || t.assignee_username || "—")}</span>
                            </div>
                          </div>

                          {/* CARD QUICK ACTIONS */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: "flex",
                              gap: 6,
                              paddingTop: 8,
                              marginTop: 4,
                              borderTop: "1px dashed var(--border)",
                              flexWrap: "wrap",
                            }}
                          >
                            {col.id === "pending" && (
                              <button
                                className="btn ghost sm"
                                style={{ padding: "2px 8px", fontSize: 11, flex: 1 }}
                                onClick={() => onRunAction(t, "acknowledge")}
                              >
                                👁️ Ack
                              </button>
                            )}
                            {(col.id === "pending" || col.id === "acknowledged") && (
                              <button
                                className="btn ghost sm"
                                style={{ padding: "2px 8px", fontSize: 11, flex: 1, color: "#6366f1" }}
                                onClick={() => onRunAction(t, "start")}
                              >
                                ⚡ Start
                              </button>
                            )}
                            {col.id === "in_progress" && (
                              <button
                                className="btn ghost sm"
                                style={{ padding: "2px 8px", fontSize: 11, flex: 1, color: "#16a34a", fontWeight: 700 }}
                                onClick={() => {
                                  if (onOpenCompleteModal) onOpenCompleteModal(t);
                                  else onRunAction(t, "complete");
                                }}
                              >
                                ✓ Complete
                              </button>
                            )}
                            {col.id !== "completed" && (
                              <button
                                className="btn ghost sm"
                                style={{ padding: "2px 8px", fontSize: 11 }}
                                onClick={() => onOpenDelegate(t)}
                              >
                                🔄 Delegate
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card" style={{ padding: 18 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Task Ref & Title</th>
                  <th>Assignee</th>
                  <th>Source</th>
                  <th>Priority</th>
                  <th>Sub-tasks</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((t) => {
                  const status = String(t.status || "pending");
                  const checklist = Array.isArray(t.checklist) ? (t.checklist as ChecklistItem[]) : [];
                  const completedCount = checklist.filter((c) => c.completed).length;

                  return (
                    <tr key={String(t.id)} style={{ cursor: "pointer" }} onClick={() => onSelectTask(t)}>
                      <td>
                        <strong style={{ fontSize: 13, color: "var(--text)" }}>{String(t.title)}</strong>
                        <div className="mono muted" style={{ fontSize: 11, display: "flex", gap: 6, alignItems: "center" }}>
                          <span>{String(t.reference ?? "")}</span>
                          {Boolean(t.attachment_url) && <span>📸 Evidence</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
                            {String(t.assignee_name || t.assignee_username || "?").charAt(0).toUpperCase()}
                          </span>
                          <span>{String(t.assignee_name || t.assignee_username || "—")}</span>
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(t.source_module ?? "companion")}</td>
                      <td><StatusPill value={String(t.priority ?? "normal")} /></td>
                      <td style={{ fontSize: 12 }}>
                        {checklist.length > 0 ? (
                          <span style={{ fontWeight: 600, color: completedCount === checklist.length ? "#16a34a" : "var(--muted)" }}>
                            {completedCount}/{checklist.length}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>{fmtDateTime(t.due_at)}</td>
                      <td><StatusPill value={status} tone={STATUS_TONE[status]} /></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {status === "pending" && (
                            <button className="btn ghost sm" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => onRunAction(t, "acknowledge")}>
                              Ack
                            </button>
                          )}
                          {(status === "pending" || status === "acknowledged") && (
                            <button className="btn ghost sm" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => onRunAction(t, "start")}>
                              Start
                            </button>
                          )}
                          {status === "in_progress" && (
                            <button
                              className="btn ghost sm"
                              style={{ padding: "3px 8px", fontSize: 11, color: "#16a34a", fontWeight: 700 }}
                              onClick={() => {
                                if (onOpenCompleteModal) onOpenCompleteModal(t);
                                else onRunAction(t, "complete");
                              }}
                            >
                              ✓ Done
                            </button>
                          )}
                          {status !== "completed" && status !== "cancelled" && (
                            <button className="btn ghost sm" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => onOpenDelegate(t)}>
                              Delegate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
