import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/components/monitoring/react-router-shim";
import {
  Calendar, MapPin, Plus, X, RefreshCw, FileText, AlertTriangle, Download,
} from "lucide-react";
import {
  fetchCalendarEvents,
  createCalendarEvent,
  createTicket,
  type CalendarEvent,
} from "../api";
import { useWorkspace } from "../context/WorkspaceContext";
import { formatDateTime, formatDate } from "../lib/format";
import { PageLoading, PageError, StatusPill, PageEmpty, TableEmpty } from "../components/PageState";

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "done" || s === "closed") return "success";
  if (s === "overdue" || s === "cancelled") return "danger";
  if (s === "scheduled" || s === "planned") return "info";
  if (s === "in_progress" || s === "in progress") return "warning";
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

function actionItemCount(ev: CalendarEvent): number {
  return Array.isArray(ev.action_items) ? ev.action_items.length : 0;
}

function openActionCount(events: CalendarEvent[]): number {
  let n = 0;
  for (const ev of events) {
    if (!Array.isArray(ev.action_items)) continue;
    for (const item of ev.action_items) {
      if (typeof item === "string") {
        n += 1;
        continue;
      }
      const st = (item.status || "open").toLowerCase();
      if (!["completed", "done", "closed", "resolved"].includes(st)) n += 1;
    }
  }
  return n;
}

const emptyForm = {
  title: "",
  start: "",
  end: "",
  location: "",
  description: "",
};

export function SiteVisits() {
  const navigate = useNavigate();
  const { activeProjectId } = useWorkspace();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketMsg, setTicketMsg] = useState<string | null>(null);
  const [section, setSection] = useState<"overview" | "findings">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { project_id?: string } = {};
      if (activeProjectId) params.project_id = activeProjectId;
      const rows = await fetchCalendarEvents(params);
      const list = (Array.isArray(rows) ? rows : []).filter(
        (e) => e.event_type === "site_visit" || e.event_type === "inspection",
      );
      list.sort((a, b) => (b.start || 0) - (a.start || 0));
      setEvents(list);
    } catch (e: any) {
      setEvents([]);
      setError(e?.message || "Failed to load site visits");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const exportCsv = () => {
    const rows = [["Title", "Type", "Status", "Start", "Location", "Findings", "Action Items"], ...events.map(e => [e.title, e.event_type, e.status, formatDateTime(e.start), e.location || "", e.findings || "", (e.action_items || []).length])];
    const csv = rows.map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `site-visits-${activeProjectId || "portfolio"}.csv`; a.click();
  };

  const kpis = useMemo(() => {
    const total = events.length;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = events.filter((e) => e.start >= monthStart.getTime()).length;
    const overdue = events.filter(
      (e) => (e.status || "").toLowerCase() === "overdue" ||
        ((e.status || "").toLowerCase() === "scheduled" && e.end > 0 && e.end < now),
    ).length;
    const openActions = openActionCount(events);
    const completed = events.filter((e) => (e.status || "").toLowerCase() === "completed").length;
    const scheduled = events.filter((e) => {
      const s = (e.status || "").toLowerCase();
      return (s === "scheduled" || s === "planned") && e.start >= now;
    }).length;
    const lastVisit = events.find((e) => (e.status || "").toLowerCase() === "completed")
      || events[0]
      || null;

    return [
      { label: "Total Site Visits", value: String(total), sub: activeProjectId ? "Selected project" : "All projects", color: "var(--color-blue)" },
      { label: "This Month", value: String(thisMonth), sub: "Scheduled or completed", color: "var(--color-emerald)" },
      { label: "Overdue", value: String(overdue), sub: overdue ? "Require attention" : "None overdue", color: overdue ? "var(--color-amber)" : "var(--color-emerald)" },
      { label: "Open Actions", value: String(openActions), sub: "Across all visits", color: "var(--color-violet-strong)" },
      { label: "Completed", value: String(completed), sub: total ? `${Math.round((completed / total) * 100)}% of total` : "No visits yet", color: "var(--color-emerald)" },
      {
        label: "Last Visit",
        value: lastVisit ? formatDate(lastVisit.start) : "—",
        sub: lastVisit ? (lastVisit.created_by || lastVisit.title) : "No visits recorded",
        color: "var(--color-blue)",
      },
      { label: "Upcoming", value: String(scheduled), sub: "Scheduled ahead", color: "var(--color-brand-blue)" },
    ];
  }, [events, activeProjectId, now]);

  const upcoming = useMemo(
    () => events
      .filter((e) => e.start >= now && (e.status || "").toLowerCase() !== "cancelled")
      .slice()
      .sort((a, b) => a.start - b.start)
      .slice(0, 6),
    [events, now],
  );

  const findings = useMemo(() => {
    const rows: { id: string; visitTitle: string; date: number; text: string; status: string }[] = [];
    for (const ev of events) {
      const text = (ev.findings || "").trim();
      if (!text) continue;
      rows.push({
        id: ev.id,
        visitTitle: ev.title,
        date: ev.start,
        text,
        status: ev.status,
      });
    }
    return rows;
  }, [events]);

  const calendarMonth = useMemo(() => {
    const ref = new Date();
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const visitDays = new Set<number>();
    for (const e of events) {
      const d = new Date(e.start);
      if (d.getFullYear() === year && d.getMonth() === month) {
        visitDays.add(d.getDate());
      }
    }
    return {
      label: ref.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      daysInMonth,
      visitDays,
      today: ref.getDate(),
    };
  }, [events]);

  const selected = selectedId ? events.find((e) => e.id === selectedId) || null : null;

  async function submitCreate() {
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
    setSaving(true);
    try {
      await createCalendarEvent({
        title: form.title.trim(),
        description: form.description.trim(),
        event_type: "site_visit",
        location: form.location.trim(),
        project_id: activeProjectId || null,
        start,
        end,
        status: "scheduled",
        attendees: [],
        findings: "",
        action_items: [],
      });
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (e: any) {
      setFormError(e?.message || "Failed to create site visit");
    } finally {
      setSaving(false);
    }
  }

  if (loading && events.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Site Visits</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Schedule, conduct, and record site visits, inspections, and findings
          </p>
        </div>
        <PageLoading rows={3} />
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Site Visits</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Schedule, conduct, and record site visits, inspections, and findings
          </p>
        </div>
        <PageError message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Site Visits</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Schedule, conduct, and record site visits, inspections, and findings
            {activeProjectId ? " for the selected project" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={exportCsv} style={{ display: "flex", gap: 6, alignItems: "center" }}><Download size={15} /> Export CSV</button>
          <button className="btn ghost" onClick={() => navigate("/app/calendar")} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Calendar size={15} /> View Calendar
          </button>
          <button className="btn ghost" onClick={load} disabled={loading} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            className="btn primary"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
              if (!form.start) {
                const start = Date.now();
                const end = start + 2 * 60 * 60 * 1000;
                setForm((f) => ({ ...f, start: msToLocalInput(start), end: msToLocalInput(end) }));
              }
            }}
            style={{ display: "flex", gap: 6, alignItems: "center" }}
          >
            <Plus size={15} /> New Site Visit
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "var(--color-danger)", fontSize: 13, border: "1px solid rgba(239,68,68,0.25)" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        <button className={`btn sm ${section === "overview" ? "" : "ghost"}`} onClick={() => setSection("overview")}>Overview</button>
        <button className="btn ghost sm" onClick={() => navigate("/app/calendar")}>Calendar</button>
        <button className={`btn sm ${section === "findings" ? "" : "ghost"}`} onClick={() => setSection("findings")}>All Findings ({findings.length})</button>
      </div>

      {section === "findings" && <div className="card"><div className="row" style={{ justifyContent: "space-between" }}><div><h3 style={{ margin: 0 }}>All Site Visit Findings</h3><p className="muted">Findings recorded against the selected project’s visits.</p></div><button className="btn ghost sm" onClick={() => setSection("overview")}>Back to overview</button></div>{findings.length === 0 ? <PageEmpty title="No findings recorded" description="Findings will appear here when they are added to a site visit." /> : <table><thead><tr><th>Visit</th><th>Date</th><th>Finding</th><th>Status</th></tr></thead><tbody>{findings.map(f => <tr key={f.id}><td>{f.visitTitle}</td><td>{formatDate(f.date)}</td><td style={{ whiteSpace: "pre-wrap" }}>{f.text}</td><td><StatusPill label={f.status || "scheduled"} tone={statusTone(f.status)} /></td></tr>)}</tbody></table>}</div>}

      {/* Create form */}
      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Schedule Site Visit</h3>
            <button type="button" className="btn ghost sm" onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>
          {formError && (
            <div style={{ marginBottom: 12, fontSize: 13, color: "var(--color-danger)" }}>{formError}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Progress & Quality Inspection"
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
                placeholder="Site office / grid reference"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Purpose, scope, checklist focus…"
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>
          </div>
          {!activeProjectId && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
              No project selected — visit will be saved without a project link. Select a project in the workspace switcher to attach it.
            </div>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn primary" onClick={submitCreate} disabled={saving}>
              {saving ? "Saving…" : "Create Site Visit"}
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {kpis.map((k) => (
          <div
            key={k.label}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderTop: `3px solid ${k.color}`,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{k.value}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {events.length === 0 ? (
        <PageEmpty
          title="No site visits yet"
          description="Schedule a site visit to start tracking inspections, findings, and follow-up actions. No demo data is shown."
          action={{ label: "New Site Visit", onClick: () => setShowForm(true) }}
          icon={<MapPin size={40} />}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", gap: 16 }}>
          {/* Visit register */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>SITE VISIT REGISTER</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{events.length} visit{events.length === 1 ? "" : "s"}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", color: "var(--muted)", textAlign: "left" }}>
                    {["Title", "Start", "End", "Location", "Created by", "Actions", "Status", ""].map((h) => (
                      <th key={h || "actions"} style={{ padding: "10px 12px", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((v) => (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: selectedId === v.id ? "var(--surface-2)" : undefined,
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text)", maxWidth: 220 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
                        {v.description && (
                          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {v.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{formatDateTime(v.start)}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{formatDateTime(v.end)}</td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{v.location || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>{v.created_by || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>{actionItemCount(v)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <StatusPill label={(v.status || "scheduled").replace(/_/g, " ")} tone={statusTone(v.status)} />
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <button className="btn ghost sm" style={{ fontSize: 11, padding: "2px 6px" }} onClick={(e) => { e.stopPropagation(); setSelectedId(v.id); }}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && <TableEmpty colSpan={8} label="No site visits recorded" />}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Mini calendar */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>SITE VISIT CALENDAR</span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{calendarMonth.label}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", fontSize: 11 }}>
                {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }, (_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {Array.from({ length: calendarMonth.daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const hasVisit = calendarMonth.visitDays.has(day);
                  const isToday = day === calendarMonth.today;
                  return (
                    <div
                      key={day}
                      style={{
                        padding: "6px 2px",
                        borderRadius: 6,
                        background: isToday ? "var(--color-danger)" : hasVisit ? "var(--surface-3)" : "transparent",
                        color: isToday ? "#fff" : "var(--text)",
                        fontWeight: isToday || hasVisit ? 700 : 400,
                      }}
                      title={hasVisit ? "Visit scheduled" : undefined}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>UPCOMING VISITS</span>
                <Calendar size={14} style={{ color: "var(--muted)" }} />
              </div>
              {upcoming.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>No upcoming visits scheduled.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {upcoming.map((uv) => (
                    <div
                      key={uv.id}
                      style={{ padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer" }}
                      onClick={() => setSelectedId(uv.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                        <span style={{ color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{uv.title}</span>
                        <StatusPill label={(uv.status || "scheduled").replace(/_/g, " ")} tone={statusTone(uv.status)} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 4 }}>{formatDateTime(uv.start)}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {uv.location || "No location"}{uv.created_by ? ` • ${uv.created_by}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Findings */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>RECENT FINDINGS</span>
                <AlertTriangle size={14} style={{ color: "var(--muted)" }} />
              </div>
              {findings.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>No findings recorded on visits yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {findings.map((f) => (
                    <div key={f.id} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>
                        <span>{f.visitTitle}</span>
                        <span>{formatDate(f.date)}</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 4, whiteSpace: "pre-wrap" }}>{f.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selected.title}</h3>
                <StatusPill label={(selected.status || "scheduled").replace(/_/g, " ")} tone={statusTone(selected.status)} />
                <StatusPill label={(selected.event_type || "site_visit").replace(/_/g, " ")} tone="info" />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 12 }}>
                <span><Calendar size={12} style={{ marginRight: 4 }} />{formatDateTime(selected.start)} → {formatDateTime(selected.end)}</span>
                {selected.location && <span><MapPin size={12} style={{ marginRight: 4 }} />{selected.location}</span>}
                {selected.created_by && <span>By {selected.created_by}</span>}
              </div>
            </div>
            <button className="btn ghost sm" onClick={() => setSelectedId(null)}><X size={14} /></button>
          </div>

          {selected.description && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>DESCRIPTION</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{selected.description}</p>
            </div>
          )}

          {selected.findings && (
            <div style={{ marginBottom: 12, background: "var(--surface-2)", padding: "10px 12px", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>FINDINGS</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{selected.findings}</p>
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn sm"
                  disabled={ticketBusy || !activeProjectId}
                  title={!activeProjectId ? "Select a project first" : "Create a site ticket from these findings"}
                  onClick={async () => {
                    if (!activeProjectId || !selected.findings) return;
                    setTicketBusy(true);
                    setTicketMsg(null);
                    try {
                      await createTicket({
                        project_id: activeProjectId,
                        title: `Site visit finding: ${selected.title}`.slice(0, 200),
                        body: selected.findings,
                        priority: "high",
                        risk_level: "high",
                      });
                      setTicketMsg("Ticket created from findings.");
                    } catch (e) {
                      setTicketMsg((e as Error).message || "Failed to create ticket");
                    } finally {
                      setTicketBusy(false);
                    }
                  }}
                >
                  {ticketBusy ? "Creating…" : "Convert findings → Ticket"}
                </button>
                {ticketMsg && <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>{ticketMsg}</span>}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>ATTENDEES</div>
              {attendeeLabels(selected.attendees).length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>No attendees listed</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {attendeeLabels(selected.attendees).map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>ACTION ITEMS</div>
              {!Array.isArray(selected.action_items) || selected.action_items.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>No action items</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {selected.action_items.map((item, idx) => {
                    const text = typeof item === "string" ? item : (item.description || "—");
                    const st = typeof item === "string" ? "" : (item.status || "");
                    const who = typeof item === "string" ? "" : (item.assignedTo || "");
                    return (
                      <li key={idx} style={{ marginBottom: 4 }}>
                        {text}
                        {(who || st) && (
                          <span style={{ color: "var(--muted)", fontSize: 11 }}>
                            {" — "}
                            {[who, st].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {selected.minutes_url && (
            <div style={{ marginTop: 12, fontSize: 12 }}>
              <FileText size={12} style={{ marginRight: 4 }} />
              <a href={selected.minutes_url} target="_blank" rel="noreferrer">Minutes / report</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
