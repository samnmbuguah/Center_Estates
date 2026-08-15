"use client";

import { DetailDrawer, EmptyState, Field, LoadingState, Modal, SearchInput, StatusPill } from "@/components/module-ui";
import { Row } from "../../types/companion.types";
import { fmtDateTime, STATUS_TONE } from "../../utils/companion.utils";

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
}) {
  const title = tab === "my-tasks" ? "My Tasks" : tab === "delegations" ? "Delegations" : "Task Assignment Centre";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks by title, reference, source…" />
          {canAssign && (
            <button className="btn primary sm" onClick={onOpenAssign}>
              + Assign Task
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No tasks found"
          description={
            tab === "my-tasks"
              ? "You have no tasks matching this filter. Check back later or ask your manager to assign work."
              : tab === "delegations"
              ? "No tasks have been delegated to others yet. Use the delegate action on any task to reassign it."
              : "No tasks have been created yet. Assign a task to a staff member to get started."
          }
          action={canAssign ? <button className="btn primary sm" onClick={onOpenAssign}>+ Assign Task</button> : undefined}
        />
      ) : (
        <div className="card" style={{ padding: 18 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assignee</th>
                  <th>Source</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const status = String(t.status || "pending");
                  return (
                    <tr key={String(t.id)} style={{ cursor: "pointer" }} onClick={() => onSelectTask(t)}>
                      <td>
                        <strong style={{ fontSize: 13 }}>{String(t.title)}</strong>
                        <div className="mono muted" style={{ fontSize: 11 }}>{String(t.reference ?? "")}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{String(t.assignee_name || t.assignee_username || "—")}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(t.source_module ?? "companion")}</td>
                      <td><StatusPill value={String(t.priority ?? "normal")} /></td>
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
                            <button className="btn ghost sm" style={{ padding: "3px 8px", fontSize: 11, color: "#16a34a" }} onClick={() => onRunAction(t, "complete")}>
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
