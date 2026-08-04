"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { companionNav } from "@/lib/module-nav";
import {
  Badge,
  DetailDrawer,
  EmptyState,
  ErrorBanner,
  Field,
  KpiCard,
  KpiStrip,
  LoadingState,
  Modal,
  SearchInput,
  StatusPill,
} from "@/components/module-ui";

export type CompanionTab =
  | "overview"
  | "tasks"
  | "my-tasks"
  | "templates"
  | "delegations"
  | "performance"
  | "staff"
  | "audit-events";

const labels: Record<CompanionTab, string> = {
  overview: "My Companion",
  tasks: "Task Assignment Centre",
  "my-tasks": "My Tasks",
  templates: "Task Templates",
  delegations: "Delegations",
  performance: "Performance Dashboard",
  staff: "Staff History",
  "audit-events": "Audit Trail",
};

type Row = Record<string, unknown>;
type CompanionDash = {
  kpis?: Record<string, unknown>;
  recentTasks?: Row[];
  overdueTasks?: Row[];
  escalatedTasks?: Row[];
  staff?: Row[];
  user?: Record<string, unknown>;
  tasks?: Row[];
  events?: Row[];
};

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_TONE: Record<string, "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray"> = {
  pending: "yellow",
  acknowledged: "blue",
  in_progress: "purple",
  completed: "green",
  delegated: "cyan",
  cancelled: "gray",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function TaskActions({ row, onAction }: { row: Row; onAction: (task: Row, action: string) => void }) {
  const status = String(row.status ?? "");
  return (
    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
      {status === "pending" && <button className="btn ghost sm" onClick={() => onAction(row, "acknowledge")}>Acknowledge</button>}
      {(status === "pending" || status === "acknowledged") && <button className="btn ghost sm" onClick={() => onAction(row, "start")}>Start</button>}
      {(status === "in_progress" || status === "acknowledged") && <button className="btn primary sm" onClick={() => onAction(row, "complete")}>Complete</button>}
      <button className="btn ghost sm" onClick={() => onAction(row, "delegate")}>Delegate</button>
    </div>
  );
}

export function CompanionWorkspace({ initialTab = "overview" }: { initialTab?: string }) {
  const { session, can } = useAuth();
  const org = session?.activeOrganizationId ?? null;
  const [tab, setTab] = useState<CompanionTab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab") as CompanionTab | null;
      if (q && labels[q]) return q;
    }
    return (initialTab as CompanionTab) || "overview";
  });

  const [dash, setDash] = useState<CompanionDash | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [staff, setStaff] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [delegateTarget, setDelegateTarget] = useState<Row | null>(null);
  const [staffDetail, setStaffDetail] = useState<CompanionDash | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [staffOptions, setStaffOptions] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isManager = can("companion.assign") || can("companion.performance.view") || can("*");

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") {
        const res = await apiFetch("/companion/dashboard/", {}, org);
        if (res.ok) setDash(await res.json());
        else setDash(null);
      } else if (tab === "performance") {
        const res = await apiFetch("/companion/performance/?from=&to=", {}, org);
        if (res.ok) {
          const data = await res.json();
          setDash(data);
          setStaff(Array.isArray(data.staff) ? data.staff : []);
        } else {
          setError("Performance analytics require an administrator or manager role.");
          setDash(null);
        }
      } else if (tab === "staff") {
        const res = await apiFetch("/companion/performance/?from=&to=", {}, org);
        if (res.ok) {
          const data = await res.json();
          setStaff(Array.isArray(data.staff) ? data.staff : []);
        } else {
          setError("Staff analytics require an administrator or manager role.");
        }
      } else if (tab === "templates") {
        const res = await apiFetch(`/companion/templates/?search=${encodeURIComponent(search)}`, {}, org);
        if (res.ok) setTemplates((await res.json()) as Row[]);
      } else if (tab === "audit-events") {
        const res = await apiFetch(`/companion/tasks/?search=${encodeURIComponent(search)}`, {}, org);
        if (res.ok) {
          const data = (await res.json()) as Row[];
          setRows(data);
        }
      } else {
        const endpoint =
          tab === "my-tasks" ? `/companion/tasks/?scope=mine&search=${encodeURIComponent(search)}`
          : tab === "delegations" ? `/companion/tasks/?scope=mine&status=delegated&search=${encodeURIComponent(search)}`
          : `/companion/tasks/?search=${encodeURIComponent(search)}`;
        const res = await apiFetch(endpoint, {}, org);
        if (res.ok) setRows((await res.json()) as Row[]);
        else setRows([]);
      }
    } catch {
      setError("Unable to connect to the Companion service.");
    } finally {
      setLoading(false);
    }
  }, [tab, search, org]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const loadStaffOptions = useCallback(async () => {
    if (!org) return;
    try {
      const res = await apiFetch("/companion/performance/?from=&to=", {}, org);
      if (res.ok) {
        const data = await res.json();
        setStaffOptions(Array.isArray(data.staff) ? data.staff : []);
      }
    } catch {
      /* ignore */
    }
  }, [org]);

  async function runTaskAction(task: Row, action: string) {
    if (!org) return;
    setBusy(true);
    setMsg("");
    try {
      await apiFetch("/auth/csrf/");
      let path = `/companion/tasks/${task.id}/${action}/`;
      let payload: Record<string, unknown> = {};
      if (action === "delegate") {
        const target = delegateTarget;
        if (!target) return;
        payload = { delegate_to: target.user_id };
        path = `/companion/tasks/${task.id}/delegate/`;
      }
      const res = await apiFetch(path, { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) }, org);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(String(body?.detail ?? body?.delegate_to ?? "Task action failed."));
      } else {
        setDelegateTarget(null);
        load();
      }
    } catch {
      setMsg("Task action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAssignTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!org) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/companion/tasks/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          ...Object.fromEntries(form.entries()),
          assigned_by: session?.user.id,
        }),
      }, org);
      if (res.ok) {
        setShowAssign(false);
        load();
      } else {
        const body = await res.json().catch(() => ({}));
        setMsg(String(body?.detail ?? "Task assignment failed."));
      }
    } catch {
      setMsg("Task assignment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!org) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setMsg("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/companion/templates/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      }, org);
      if (res.ok) {
        setShowTemplate(false);
        load();
      } else {
        setMsg("Template creation failed.");
      }
    } catch {
      setMsg("Template creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openStaffDetail(row: Row) {
    if (!org) return;
    setStaffDetail(null);
    try {
      const res = await apiFetch(`/companion/performance/staff/?user_id=${row.user_id}`, {}, org);
      if (res.ok) setStaffDetail(await res.json());
    } catch {
      /* ignore */
    }
  }

  const kpis = (dash?.kpis ?? {}) as Record<string, unknown>;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const userName = session?.user?.firstName
    ? `${session.user.firstName}${session.user.lastName ? ` ${session.user.lastName}` : ""}`
    : session?.user?.username ?? "there";

  const recentTasks = tab === "overview" ? (dash?.recentTasks ?? []) : rows;
  const overdueTasks = tab === "overview" ? (dash?.overdueTasks ?? []) : [];
  const escalatedTasks = tab === "overview" ? (dash?.escalatedTasks ?? []) : [];

  return (
    <ModuleShell
      moduleKey="companion"
      moduleName="Companion"
      eyebrow="Personal command center"
      title="Companion & Staff Performance"
      subtitle="Daily work, task assignment and staff productivity — SLA and adoption analytics."
      accent="#0d9488"
      groups={companionNav}
      activeId={tab}
      onSelect={(id) => { setSearch(""); setTab(id as CompanionTab); }}
      contextLabel="Section"
      contextValue={labels[tab]}
      actions={
        isManager ? (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost sm" onClick={() => setShowTemplate(true)}>+ Template</button>
            <button className="btn primary sm" onClick={() => { if (isManager) loadStaffOptions(); setShowAssign(true); }}>+ Assign Task</button>
          </div>
        ) : null
      }
    >
      <div className="valuation-workspace" style={{ padding: "16px 24px" }}>
        {msg && <ErrorBanner message={msg} onRetry={() => setMsg("")} />}
        {error && tab !== "performance" && tab !== "staff" && <ErrorBanner message={error} onRetry={load} />}

        {/* MY COMPANION */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="card" style={{ background: "linear-gradient(120deg, rgba(13,148,136,0.12), transparent)", border: "1px solid var(--border)" }}>
              <p className="eyebrow" style={{ marginBottom: 6 }}>{today}</p>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{greeting()}, {userName}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Let&apos;s make today productive — here is what needs your attention.</p>
            </div>

            <KpiStrip>
              <KpiCard icon="📅" label="Due Today" value={String(kpis.dueToday ?? 0)} sub="Tasks due today" onClick={() => setTab("my-tasks")} />
              <KpiCard icon="⏰" label="Overdue" value={String(kpis.overdue ?? 0)} sub="Past due date" borderColor="var(--danger)" onClick={() => setTab("my-tasks")} />
              <KpiCard icon="🚨" label="Escalated" value={String(kpis.escalated ?? 0)} sub="SLA breaches" borderColor="var(--danger)" onClick={() => setTab("my-tasks")} />
              <KpiCard icon="⚙️" label="In Progress" value={String(kpis.inProgress ?? 0)} sub="Actively worked" onClick={() => setTab("my-tasks")} />
              <KpiCard icon="✅" label="Completed" value={String(kpis.completed ?? 0)} sub="All time" onClick={() => setTab("my-tasks")} />
            </KpiStrip>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="card" style={{ padding: 18 }}>
                  <div className="panel-title" style={{ padding: "0 0 12px" }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>My Tasks</h3>
                    <button className="btn ghost sm" onClick={() => setTab("my-tasks")}>View all →</button>
                  </div>
                  {loading ? <LoadingState rows={4} /> : recentTasks.length === 0 ? (
                    <EmptyState icon="✅" title="All clear" description="No companion tasks are pending for you right now." />
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr><th>Task</th><th>Source</th><th>Priority</th><th>Due</th><th>Status</th><th>Actions</th></tr>
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
                              <td><TaskActions row={t} onAction={runTaskAction} /></td>
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
        )}

        {/* TASK ASSIGNMENT CENTRE / ALL TASKS / MY TASKS / DELEGATIONS */}
        {(tab === "tasks" || tab === "my-tasks" || tab === "delegations") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{labels[tab]}</h3>
              <SearchInput value={search} onChange={setSearch} placeholder="Search tasks by title, reference, source…" />
            </div>
            {loading ? <LoadingState rows={5} /> : rows.length === 0 ? (
              <EmptyState icon="🗂️" title="No tasks" description={tab === "my-tasks" ? "You have no tasks matching this view." : "Assign a task to get started."} action={isManager ? <button className="btn primary sm" onClick={() => { if (isManager) loadStaffOptions(); setShowAssign(true); }}>+ Assign Task</button> : null} />
            ) : (
              <div className="card" style={{ padding: 18 }}>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Task</th><th>Assignee</th><th>Source</th><th>Priority</th><th>Due</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((t) => (
                        <tr key={String(t.id)} style={{ cursor: "pointer" }} onClick={() => setSelected(t)}>
                          <td>
                            <strong style={{ fontSize: 13 }}>{String(t.title)}</strong>
                            <div className="mono muted" style={{ fontSize: 11 }}>{String(t.reference ?? "")}</div>
                          </td>
                          <td style={{ fontSize: 13 }}>{String(t.assignee_name || t.assignee_username || "—")}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{String(t.source_module ?? "companion")}</td>
                          <td><StatusPill value={String(t.priority ?? "normal")} /></td>
                          <td className="mono" style={{ fontSize: 12 }}>{fmtDateTime(t.due_at)}</td>
                          <td><StatusPill value={String(t.status)} tone={STATUS_TONE[String(t.status)]} /></td>
                          <td onClick={(e) => e.stopPropagation()}><TaskActions row={t} onAction={runTaskAction} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TEMPLATES */}
        {tab === "templates" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Task Templates</h3>
              <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />
            </div>
            {loading ? <LoadingState rows={4} /> : templates.length === 0 ? (
              <EmptyState icon="📋" title="No templates" description="Reusable task templates appear here." action={<button className="btn primary sm" onClick={() => setShowTemplate(true)}>+ Template</button>} />
            ) : (
              <div className="card" style={{ padding: 18 }}>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Name</th><th>Title template</th><th>Priority</th><th>Due in</th><th>SLA (hrs)</th><th>Status</th></tr></thead>
                    <tbody>
                      {templates.map((t) => (
                        <tr key={String(t.id)}>
                          <td><strong style={{ fontSize: 13 }}>{String(t.name)}</strong></td>
                          <td style={{ fontSize: 13 }}>{String(t.title_template ?? "")}</td>
                          <td><StatusPill value={String(t.default_priority ?? "normal")} /></td>
                          <td className="mono">{String(t.default_days_to_due ?? "—")} days</td>
                          <td className="mono">{String(t.sla_hours ?? "—")}</td>
                          <td><StatusPill value={t.is_active ? "Active" : "Inactive"} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PERFORMANCE DASHBOARD */}
        {tab === "performance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {error ? <ErrorBanner message={error} /> : loading ? <LoadingState rows={6} /> : (
              <>
                <KpiStrip>
                  <KpiCard icon="👥" label="Daily Active Users" value={String(kpis.dailyActiveUsers ?? 0)} sub={`${kpis.totalStaff ?? 0} staff`} onClick={() => setTab("staff")} />
                  <KpiCard icon="📝" label="Tasks Assigned" value={String(kpis.tasksAssigned ?? 0)} sub="All time" />
                  <KpiCard icon="✅" label="Tasks Completed" value={String(kpis.tasksCompleted ?? 0)} sub={`${kpis.completionRate ?? 0}% completion`} />
                  <KpiCard icon="⏰" label="Overdue Tasks" value={String(kpis.overdueTasks ?? 0)} sub="Needs attention" borderColor="var(--danger)" />
                  <KpiCard icon="🚨" label="Escalated Tasks" value={String(kpis.escalatedTasks ?? 0)} sub="SLA breaches" borderColor="var(--danger)" />
                  <KpiCard icon="📈" label="Adoption Score" value={`${kpis.adoptionScore ?? 0}%`} sub="System adoption" />
                </KpiStrip>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div className="card" style={{ padding: 18 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>⚠️ Staff Requiring Attention</h3>
                    <div className="table-scroll" style={{ maxHeight: 320 }}>
                      <table>
                        <thead><tr><th>Staff</th><th>Assigned</th><th>Completed</th><th>Overdue</th><th>Status</th></tr></thead>
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
                    {escalatedTasks.length === 0 ? <div className="muted" style={{ padding: "16px 0" }}>No escalated tasks.</div> : (
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
        )}

        {/* STAFF HISTORY */}
        {tab === "staff" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error ? <ErrorBanner message={error} /> : loading ? <LoadingState rows={6} /> : staff.length === 0 ? (
              <EmptyState icon="👥" title="No staff" description="Staff analytics require an administrator or manager role." />
            ) : (
              <div className="card" style={{ padding: 18 }}>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Staff</th><th>Last login</th><th>Assigned</th><th>Completed</th><th>Completion %</th><th>Overdue</th><th>Status</th></tr></thead>
                    <tbody>
                      {staff.map((s) => (
                        <tr key={String(s.user_id)} style={{ cursor: "pointer" }} onClick={() => openStaffDetail(s)}>
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
        )}

        {/* AUDIT TRAIL */}
        {tab === "audit-events" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Task Audit Trail</h3>
              <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" />
            </div>
            {loading ? <LoadingState rows={5} /> : rows.length === 0 ? (
              <EmptyState icon="📜" title="No events" description="Task events appear here as work is acknowledged, completed and escalated." />
            ) : (
              <div className="card" style={{ padding: 18 }}>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Task</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due</th></tr></thead>
                    <tbody>
                      {rows.map((t) => (
                        <tr key={String(t.id)}>
                          <td><strong style={{ fontSize: 13 }}>{String(t.title)}</strong></td>
                          <td style={{ fontSize: 12 }}>{String(t.assignee_name || t.assignee_username || "—")}</td>
                          <td><StatusPill value={String(t.status)} tone={STATUS_TONE[String(t.status)]} /></td>
                          <td><StatusPill value={String(t.priority ?? "normal")} /></td>
                          <td className="mono">{fmtDateTime(t.due_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TASK DETAIL DRAWER */}
        {selected && (
          <DetailDrawer title={String(selected.title ?? "Task")} onClose={() => setSelected(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="row"><StatusPill value={String(selected.status)} tone={STATUS_TONE[String(selected.status)]} /><StatusPill value={String(selected.priority ?? "normal")} /></div>
              <Field label="Reference"><div className="mono" style={{ color: "var(--primary)", fontWeight: 700 }}>{String(selected.reference ?? "—")}</div></Field>
              <Field label="Assignee"><div>{String(selected.assignee_name || selected.assignee_username || "—")}</div></Field>
              <Field label="Assigned by"><div>{String(selected.assigned_by_name || "—")}</div></Field>
              <Field label="Source"><div className="mono">{String(selected.source_module ?? "—")}{selected.source_ref ? ` · ${selected.source_ref}` : ""}</div></Field>
              <Field label="Due"><div>{fmtDateTime(selected.due_at)}</div></Field>
              <Field label="SLA due"><div>{fmtDateTime(selected.sla_due_at)}</div></Field>
              <Field label="Description"><div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{String(selected.description ?? "—")}</div></Field>
              <div className="modal-actions">
                <button className="btn ghost sm" onClick={() => setSelected(null)}>Close</button>
                <TaskActions row={selected} onAction={(r, a) => { setSelected(null); runTaskAction(r, a); }} />
              </div>
            </div>
          </DetailDrawer>
        )}

        {/* DELEGATE MODAL */}
        {delegateTarget && (
          <Modal title={`Delegate: ${String(delegateTarget.title ?? "task")}`} onClose={() => setDelegateTarget(null)}>
            <Field label="Delegate to" required>
              <select
                value={delegateTarget._delegateTo as string ?? ""}
                onChange={(e) => setDelegateTarget({ ...delegateTarget, _delegateTo: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              >
                <option value="">Select staff member…</option>
                {staffOptions.filter((s) => s.user_id !== String(delegateTarget.assignee_id)).map((s) => (
                  <option key={String(s.user_id)} value={String(s.user_id)}>{String(s.name)}</option>
                ))}
              </select>
            </Field>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDelegateTarget(null)}>Cancel</button>
              <button className="btn primary" disabled={busy || !delegateTarget._delegateTo} onClick={() => runTaskAction(delegateTarget, "delegate")}>
                {busy ? "Delegating…" : "Delegate Task"}
              </button>
            </div>
          </Modal>
        )}

        {/* STAFF DETAIL DRAWER */}
        {staffDetail && (
          <DetailDrawer title={String(staffDetail.user?.name ?? "Staff")} onClose={() => setStaffDetail(null)} width={520}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="mono muted">{String(staffDetail.user?.username ?? "")}</div>
              <h4 style={{ margin: "6px 0 0", fontSize: 14 }}>Recent tasks</h4>
              {(staffDetail.tasks ?? []).length === 0 ? <div className="muted">No tasks recorded.</div> : (
                <div className="table-scroll" style={{ maxHeight: 320 }}>
                  <table>
                    <thead><tr><th>Task</th><th>Status</th><th>Due</th></tr></thead>
                    <tbody>
                      {(staffDetail.tasks ?? []).map((t: Row) => (
                        <tr key={String(t.id)}>
                          <td style={{ fontSize: 12 }}>{String(t.title)}</td>
                          <td><StatusPill value={String(t.status)} tone={STATUS_TONE[String(t.status)]} /></td>
                          <td className="mono">{fmtDate(t.due_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <h4 style={{ margin: "6px 0 0", fontSize: 14 }}>Event history</h4>
              {(staffDetail.events ?? []).length === 0 ? <div className="muted">No events recorded.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(staffDetail.events ?? []).map((e: Row) => (
                    <div key={String(e.id)} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "6px 0", fontSize: 12 }}>
                      <span>{String(e.action ?? "")} · {String(e.actor_name || e.actor_username || "—")}</span>
                      <span className="muted">{fmtDateTime(e.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DetailDrawer>
        )}

        {/* ASSIGN TASK MODAL */}
        {showAssign && (
          <Modal title="Assign Task" onClose={() => setShowAssign(false)} wide>
            <form onSubmit={submitAssignTask} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Title" required>
                  <input name="title" required placeholder="e.g. Approve payment voucher #PV-2041" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
                </Field>
                <Field label="Assignee" required>
                  <select name="assignee" required style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}>
                    <option value="">Select staff…</option>
                    {staffOptions.map((s) => (
                      <option key={String(s.user_id)} value={String(s.user_id)}>{String(s.name)}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea name="description" rows={3} placeholder="Describe the work…" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Priority" required>
                  <select name="priority" defaultValue="normal" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </Field>
                <Field label="Due date">
                  <input name="due_at" type="datetime-local" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
                </Field>
                <Field label="SLA due">
                  <input name="sla_due_at" type="datetime-local" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Source module">
                  <input name="source_module" placeholder="e.g. property" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
                </Field>
                <Field label="Source reference">
                  <input name="source_ref" placeholder="e.g. lease LS-2026-0128" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
                </Field>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setShowAssign(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={busy}>{busy ? "Assigning…" : "Assign Task"}</button>
              </div>
            </form>
          </Modal>
        )}

        {/* TEMPLATE MODAL */}
        {showTemplate && (
          <Modal title="Create Task Template" onClose={() => setShowTemplate(false)}>
            <form onSubmit={submitTemplate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Name" required>
                <input name="name" required placeholder="e.g. Weekly inspection" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
              </Field>
              <Field label="Title template" required>
                <input name="title_template" required placeholder="e.g. Perform {building} inspection" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
              </Field>
              <Field label="Description template">
                <textarea name="description_template" rows={2} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Default priority">
                  <select name="default_priority" defaultValue="normal" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </Field>
                <Field label="Due in (days)">
                  <input name="default_days_to_due" type="number" defaultValue={7} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
                </Field>
                <Field label="SLA (hours)">
                  <input name="sla_hours" type="number" defaultValue={24} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }} />
                </Field>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setShowTemplate(false)}>Cancel</button>
                <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : "Create Template"}</button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </ModuleShell>
  );
}

export default CompanionWorkspace;
