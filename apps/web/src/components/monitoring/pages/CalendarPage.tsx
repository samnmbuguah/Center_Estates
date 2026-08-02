import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar, MapPin, Plus, X, RefreshCw, CheckSquare, Users, List,
} from "lucide-react";
import {
  fetchCalendarEvents,
  createCalendarEvent,
  type CalendarEvent,
} from "../api";
import { useWorkspace } from "../context/WorkspaceContext";
import { formatDateTime, formatDate } from "../lib/format";
import { PageLoading, PageError, StatusPill, PageEmpty, TableEmpty } from "../components/PageState";

type TabId = "meetings" | "action-items" | "calendar";

type FlatAction = {
  key: string;
  eventId: string;
  eventTitle: string;
  eventType: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  status: string;
  priority: string;
};

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const s = (status || "").toLowerCase();
  if (["completed", "done", "closed", "resolved", "minutes approved"].includes(s)) return "success";
  if (["overdue", "cancelled", "high"].includes(s)) return "danger";
  if (["scheduled", "planned", "pending"].includes(s)) return "info";
  if (["in_progress", "in progress", "medium"].includes(s)) return "warning";
  return "neutral";
}

function localToMs(value: string): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function msToLocalInput(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function attendeeLabels(attendees: CalendarEvent["attendees"]): string[] {
  if (!Array.isArray(attendees)) return [];
  return attendees.map((a) => (typeof a === "string" ? a : a?.name || "")).filter(Boolean);
}

function flattenActionItems(events: CalendarEvent[]): FlatAction[] {
  const rows: FlatAction[] = [];
  for (const ev of events) {
    if (!Array.isArray(ev.action_items)) continue;
    ev.action_items.forEach((item, idx) => {
      if (typeof item === "string") {
        rows.push({
          key: `${ev.id}-${idx}`,
          eventId: ev.id,
          eventTitle: ev.title,
          eventType: ev.event_type,
          description: item,
          assignedTo: "",
          dueDate: "",
          status: "open",
          priority: "",
        });
      } else {
        rows.push({
          key: `${ev.id}-${idx}`,
          eventId: ev.id,
          eventTitle: ev.title,
          eventType: ev.event_type,
          description: item.description || "—",
          assignedTo: item.assignedTo || "",
          dueDate: item.dueDate || "",
          status: item.status || "open",
          priority: item.priority || "",
        });
      }
    });
  }
  return rows;
}

function isOpenAction(status: string): boolean {
  const s = (status || "open").toLowerCase();
  return !["completed", "done", "closed", "resolved"].includes(s);
}

const emptyMeetingForm = {
  title: "",
  start: "",
  end: "",
  location: "",
  description: "",
  attendees: "",
};

const TABS: { id: TabId; label: string; icon: typeof Calendar }[] = [
  { id: "meetings", label: "Meetings", icon: Users },
  { id: "action-items", label: "Action Items", icon: CheckSquare },
  { id: "calendar", label: "Calendar", icon: List },
];

export default function CalendarPage() {
  const { activeProjectId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabId>("meetings");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyMeetingForm);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { project_id?: string } = {};
      if (activeProjectId) params.project_id = activeProjectId;
      const rows = await fetchCalendarEvents(params);
      const list = Array.isArray(rows) ? rows : [];
      list.sort((a, b) => (b.start || 0) - (a.start || 0));
      setEvents(list);
    } catch (e: any) {
      setEvents([]);
      setError(e?.message || "Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();

  const meetings = useMemo(
    () => events.filter((e) => e.event_type === "meeting"),
    [events],
  );

  const siteVisits = useMemo(
    () => events.filter((e) => e.event_type === "site_visit" || e.event_type === "inspection"),
    [events],
  );

  const actionItems = useMemo(() => flattenActionItems(events), [events]);

  const openActions = useMemo(
    () => actionItems.filter((a) => isOpenAction(a.status)),
    [actionItems],
  );

  const resolvedActions = useMemo(
    () => actionItems.filter((a) => !isOpenAction(a.status)),
    [actionItems],
  );

  const upcomingMeetings = useMemo(
    () => meetings.filter(
      (m) => m.start >= now && (m.status || "").toLowerCase() !== "cancelled",
    ),
    [meetings, now],
  );

  const completedMeetings = useMemo(
    () => meetings.filter((m) => (m.status || "").toLowerCase() === "completed"),
    [meetings],
  );

  const calendarList = useMemo(
    () => events.slice().sort((a, b) => (a.start || 0) - (b.start || 0)),
    [events],
  );

  async function submitMeeting() {
    setFormError(null);
    if (!form.title.trim()) {
      setFormError("Title is required");
      return;
    }
    const start = localToMs(form.start);
    const end = localToMs(form.end);
    if (!start || !end) {
      setFormError("Start and end date/time are required");
      return;
    }
    if (end < start) {
      setFormError("End must be after start");
      return;
    }
    const attendees = form.attendees
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await createCalendarEvent({
        title: form.title.trim(),
        description: form.description.trim(),
        event_type: "meeting",
        location: form.location.trim(),
        project_id: activeProjectId || null,
        start,
        end,
        status: "scheduled",
        attendees,
        findings: "",
        action_items: [],
      });
      setForm(emptyMeetingForm);
      setShowForm(false);
      await load();
      setActiveTab("meetings");
    } catch (e: any) {
      setFormError(e?.message || "Failed to schedule meeting");
    } finally {
      setSaving(false);
    }
  }

  function openCreateForm() {
    setShowForm(true);
    setFormError(null);
    if (!form.start) {
      const start = Date.now();
      const end = start + 60 * 60 * 1000;
      setForm((f) => ({ ...f, start: msToLocalInput(start), end: msToLocalInput(end) }));
    }
  }

  if (loading && events.length === 0) {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Meetings & Action Items</h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Progress meetings, minutes, and action-item tracking from live calendar data
          </div>
        </div>
        <PageLoading rows={3} />
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Meetings & Action Items</h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Progress meetings, minutes, and action-item tracking from live calendar data
          </div>
        </div>
        <PageError message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Meetings & Action Items</h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Progress meetings, minutes of meeting (MoM), and action-item tracking
            {activeProjectId ? " for the selected project" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            className="btn"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 4 }}
            onClick={() => setActiveTab("action-items")}
          >
            <CheckSquare size={15} /> Action Items
          </button>
          <button
            className="btn primary"
            onClick={openCreateForm}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <Plus size={15} /> Schedule Meeting
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 13, border: "1px solid rgba(239,68,68,0.25)" }}>
          {error}
        </div>
      )}

      {/* KPIs from live counts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {[
          { label: "Meetings Held", value: String(completedMeetings.length), sub: `${meetings.length} total meetings`, color: "var(--text)" },
          { label: "Open Action Items", value: String(openActions.length), sub: `${actionItems.length} total actions`, color: "#f59e0b" },
          { label: "Resolved Action Items", value: String(resolvedActions.length), sub: "Completed / closed", color: "#10b981" },
          { label: "Upcoming Meetings", value: String(upcomingMeetings.length), sub: `${siteVisits.length} site visit(s)`, color: "#00a3ff" },
        ].map((k) => (
          <div key={k.label} className="card" style={{ padding: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Create meeting form */}
      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Schedule Meeting</h3>
            <button type="button" className="btn ghost sm" onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>
          {formError && <div style={{ marginBottom: 12, fontSize: 13, color: "#ef4444" }}>{formError}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Weekly Site Progress Meeting"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Start *</label>
              <input
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>End *</label>
              <input
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Boardroom / Teams / Site"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Attendees</label>
              <input
                value={form.attendees}
                onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                placeholder="Comma-separated names"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description / Agenda</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Agenda, discussion points…"
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>
          </div>
          {!activeProjectId && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
              No project selected — meeting will be saved without a project link.
            </div>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn primary" onClick={submitMeeting} disabled={saving}>
              {saving ? "Saving…" : "Create Meeting"}
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.id === "meetings" ? meetings.length
              : tab.id === "action-items" ? actionItems.length
                : events.length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: 0,
                background: activeTab === tab.id ? "var(--surface-3)" : "transparent",
                color: activeTab === tab.id ? "var(--text)" : "var(--muted)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon size={14} />
              {tab.label}
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Meetings tab */}
      {activeTab === "meetings" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 420px)", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--text)" }}>MINUTES OF MEETINGS (MoM)</h3>
            {meetings.length === 0 ? (
              <PageEmpty
                title="No meetings yet"
                description="Schedule a meeting to capture attendees, discussion notes, and linked action items. No demo data is shown."
                action={{ label: "Schedule Meeting", onClick: openCreateForm }}
                icon={<Users size={40} />}
              />
            ) : (
              meetings.map((mtg) => {
                const people = attendeeLabels(mtg.attendees);
                const items = Array.isArray(mtg.action_items) ? mtg.action_items : [];
                return (
                  <div key={mtg.id} className="card" style={{ padding: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 10, gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{mtg.title}</h4>
                          <StatusPill label={(mtg.status || "scheduled").replace(/_/g, " ")} tone={statusTone(mtg.status)} />
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Calendar size={12} /> {formatDateTime(mtg.start)}
                            {mtg.end ? ` – ${formatDateTime(mtg.end)}` : ""}
                          </span>
                          {mtg.location && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <MapPin size={12} /> {mtg.location}
                            </span>
                          )}
                          {mtg.created_by && <span>By {mtg.created_by}</span>}
                        </div>
                      </div>
                    </div>

                    {mtg.description && (
                      <div style={{ marginBottom: 12 }}>
                        <h5 style={{ margin: "0 0 4px", fontSize: 11, color: "var(--muted)" }}>SUMMARY / AGENDA</h5>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{mtg.description}</p>
                      </div>
                    )}

                    {mtg.findings && (
                      <div style={{ marginBottom: 12, background: "var(--surface-2)", padding: "10px 12px", borderRadius: 6, fontSize: 12 }}>
                        <h5 style={{ margin: "0 0 6px", fontSize: 11, color: "var(--muted)" }}>NOTES / FINDINGS</h5>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{mtg.findings}</p>
                      </div>
                    )}

                    {people.length > 0 && (
                      <div style={{ marginBottom: 12, fontSize: 12 }}>
                        <h5 style={{ margin: "0 0 4px", fontSize: 11, color: "var(--muted)" }}>ATTENDEES</h5>
                        <div style={{ color: "var(--text)" }}>{people.join(" · ")}</div>
                      </div>
                    )}

                    {items.length > 0 && (
                      <div style={{ background: "var(--surface-2)", padding: "10px 12px", borderRadius: 6, fontSize: 12 }}>
                        <h5 style={{ margin: "0 0 6px", fontSize: 11, color: "var(--muted)" }}>ACTION ITEMS ({items.length})</h5>
                        <ul style={{ margin: 0, paddingLeft: 16, color: "var(--text)" }}>
                          {items.map((item, idx) => {
                            const text = typeof item === "string" ? item : (item.description || "—");
                            const who = typeof item === "string" ? "" : item.assignedTo;
                            const st = typeof item === "string" ? "" : item.status;
                            return (
                              <li key={idx} style={{ marginBottom: 4 }}>
                                {text}
                                {(who || st) && (
                                  <span style={{ color: "var(--muted)" }}>
                                    {" — "}
                                    {[who, st].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {mtg.minutes_url && (
                      <div style={{ marginTop: 10, fontSize: 12 }}>
                        <a href={mtg.minutes_url} target="_blank" rel="noreferrer">Open minutes</a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Side: open actions snapshot */}
          <div className="card" style={{ padding: 20, alignSelf: "start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>OPEN ACTIONS</h3>
              <span style={{ fontSize: 12, color: "#00a3ff" }}>{openActions.length} open</span>
            </div>
            {openActions.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>No open action items from meetings or visits.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {openActions.slice(0, 12).map((item) => (
                  <div key={item.key} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.description}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {item.eventTitle}
                      {item.assignedTo ? ` · ${item.assignedTo}` : ""}
                      {item.dueDate ? ` · Due ${item.dueDate}` : ""}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <StatusPill label={(item.status || "open").replace(/_/g, " ")} tone={statusTone(item.status)} />
                      {item.priority && (
                        <span style={{ marginLeft: 6 }}>
                          <StatusPill label={item.priority} tone={statusTone(item.priority)} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {openActions.length > 12 && (
                  <button className="btn ghost sm" onClick={() => setActiveTab("action-items")}>
                    View all {openActions.length} open items →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action items tab */}
      {activeTab === "action-items" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>ACTION ITEMS REGISTER</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {openActions.length} open · {resolvedActions.length} resolved
            </span>
          </div>
          {actionItems.length === 0 ? (
            <div style={{ padding: 24 }}>
              <PageEmpty
                title="No action items"
                description="Action items appear here when they are attached to meetings or site visits. Nothing is fabricated."
                icon={<CheckSquare size={40} />}
              />
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                    {["#", "Action", "Source", "Type", "Assigned To", "Due", "Priority", "Status"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actionItems.map((item, i) => (
                    <tr key={item.key} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700, fontFamily: "monospace" }}>{String(i + 1).padStart(2, "0")}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{item.description}</td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{item.eventTitle}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <StatusPill label={(item.eventType || "").replace(/_/g, " ")} tone="neutral" />
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--primary)", fontSize: 11 }}>{item.assignedTo || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 11 }}>
                        {item.dueDate || "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {item.priority ? <StatusPill label={item.priority} tone={statusTone(item.priority)} /> : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <StatusPill label={(item.status || "open").replace(/_/g, " ")} tone={statusTone(item.status)} />
                      </td>
                    </tr>
                  ))}
                  {actionItems.length === 0 && <TableEmpty colSpan={8} label="No action items" />}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Full calendar list tab */}
      {activeTab === "calendar" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>CALENDAR EVENTS</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {events.length} event{events.length === 1 ? "" : "s"} · {meetings.length} meetings · {siteVisits.length} visits
            </span>
          </div>
          {calendarList.length === 0 ? (
            <div style={{ padding: 24 }}>
              <PageEmpty
                title="Calendar is empty"
                description="Meetings and site visits will appear here once scheduled. No demo entries are shown."
                action={{ label: "Schedule Meeting", onClick: openCreateForm }}
                icon={<Calendar size={40} />}
              />
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                    {["Title", "Type", "Start", "End", "Location", "Created by", "Actions", "Status"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarList.map((ev) => (
                    <tr key={ev.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                        <div>{ev.title}</div>
                        {ev.description && (
                          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400, marginTop: 2, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ev.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <StatusPill
                          label={(ev.event_type || "event").replace(/_/g, " ")}
                          tone={ev.event_type === "site_visit" || ev.event_type === "inspection" ? "info" : "neutral"}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{formatDateTime(ev.start)}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{formatDateTime(ev.end)}</td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{ev.location || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>{ev.created_by || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {Array.isArray(ev.action_items) ? ev.action_items.length : 0}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <StatusPill label={(ev.status || "scheduled").replace(/_/g, " ")} tone={statusTone(ev.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Compact upcoming strip */}
          {(upcomingMeetings.length > 0 || siteVisits.some((v) => v.start >= now)) && (
            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>UPCOMING</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[...upcomingMeetings, ...siteVisits.filter((v) => v.start >= now)]
                  .sort((a, b) => a.start - b.start)
                  .slice(0, 8)
                  .map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface-2)",
                        minWidth: 180,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {formatDate(ev.start)} · {(ev.event_type || "").replace(/_/g, " ")}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
