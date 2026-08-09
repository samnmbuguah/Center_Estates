"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CircleAlert, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { usePropertyContext } from "@/lib/property-context";

type ActivityRecord = Record<string, unknown>;

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

function ActivityState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card" role="status" style={{ padding: 24, textAlign: "center" }}>
      <p className="muted" style={{ marginTop: 0 }}>{message}</p>
      <button type="button" className="btn ghost sm" onClick={onRetry}><RefreshCw size={14} /> Retry</button>
    </div>
  );
}

export function ModuleTicketsView({ moduleName, portfolio = false }: { moduleName: string; portfolio?: boolean }) {
  const { activeProperty } = usePropertyContext();
  const [rows, setRows] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true); setError("");
    void apiFetch("/construction/tickets/", portfolio ? { headers: { "X-Property-Scope": "portfolio" } } : undefined)
      .then(async (response) => {
        if (!response.ok) throw new Error("Ticket access is not enabled for this workspace.");
        const data = await response.json();
        setRows(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [activeProperty?.id]);

  return (
    <section aria-labelledby="module-tickets-heading">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div><p className="eyebrow">{moduleName} operations</p><h2 id="module-tickets-heading">Tickets & issues</h2><p className="muted">{portfolio ? "Issues across your accessible projects." : `Issues scoped to ${activeProperty?.name ?? "the current property"}.`}</p></div>
        <span className="status-pill"><CircleAlert size={14} /> {rows.length} visible</span>
      </div>
      {loading ? <ActivityState message="Loading tickets…" onRetry={load} /> : error ? <ActivityState message={error} onRetry={load} /> : rows.length === 0 ? <ActivityState message="No tickets are recorded for this property." onRetry={load} /> : (
        <div className="data-panel table-scroll"><table className="fc-data-table"><thead><tr><th>Reference</th><th>Title</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead><tbody>
          {rows.map((row, index) => <tr key={String(row.id ?? index)}><td className="mono">{String(row.reference ?? row.code ?? `TICKET-${index + 1}`)}</td><td>{String(row.title ?? row.subject ?? row.description ?? "—")}</td><td>{String(row.priority ?? "—")}</td><td><span className="status-pill">{String(row.status ?? "open")}</span></td><td>{formatDate(row.updated_at ?? row.created_at)}</td></tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}

export function ModuleCalendarView({ moduleName, portfolio = false }: { moduleName: string; portfolio?: boolean }) {
  const { activeProperty } = usePropertyContext();
  const [rows, setRows] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true); setError("");
    void apiFetch("/construction/calendar/", portfolio ? { headers: { "X-Property-Scope": "portfolio" } } : undefined)
      .then(async (response) => {
        if (!response.ok) throw new Error("Calendar access is not enabled for this workspace.");
        const data = await response.json();
        setRows(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [activeProperty?.id]);

  return (
    <section aria-labelledby="module-calendar-heading">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div><p className="eyebrow">{moduleName} operations</p><h2 id="module-calendar-heading">Calendar</h2><p className="muted">{portfolio ? "Meetings, inspections and operational events across your accessible projects." : `Meetings, inspections and operational events for ${activeProperty?.name ?? "the current property"}.`}</p></div>
        <span className="status-pill"><CalendarDays size={14} /> {rows.length} events</span>
      </div>
      {loading ? <ActivityState message="Loading calendar…" onRetry={load} /> : error ? <ActivityState message={error} onRetry={load} /> : rows.length === 0 ? <ActivityState message="No calendar events are recorded for this property." onRetry={load} /> : (
        <div className="data-panel table-scroll"><table className="fc-data-table"><thead><tr><th>Event</th><th>Type</th><th>Starts</th><th>Ends</th><th>Project</th></tr></thead><tbody>
          {rows.map((row, index) => <tr key={String(row.id ?? index)}><td><strong>{String(row.title ?? row.name ?? "Untitled event")}</strong></td><td>{String(row.event_type ?? row.type ?? "—")}</td><td>{formatDate(row.starts_at ?? row.start_at ?? row.start)}</td><td>{formatDate(row.ends_at ?? row.end_at ?? row.end)}</td><td>{String(row.project_name ?? row.project ?? "—")}</td></tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}
