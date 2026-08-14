"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CalendarDays, CircleAlert, RefreshCw } from "lucide-react";
import { Box, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Typography } from "@mui/material";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { usePropertyContext } from "@/lib/property-context";

const CalendarWidget = dynamic(() => import("@/components/calendar-widget"), { ssr: false, loading: () => <ActivityState message="Loading calendar widget…" onRetry={() => window.location.reload()} /> });

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
  const load = useCallback(() => {
    setLoading(true); setError("");
    void apiFetch("/tickets-feed/", portfolio ? { headers: { "X-Property-Scope": "portfolio" } } : undefined)
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Tickets could not be loaded."));
        const data = await response.json();
        setRows(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [portfolio]);
  useEffect(() => { queueMicrotask(load); }, [activeProperty?.id, load]);

  const moduleKey = moduleName.toLowerCase() === "portfolio" ? "all" : moduleName.toLowerCase();
  const relevantRows = useMemo(() => rows.filter((row) => (
    portfolio || moduleKey === "all" || String(row.module) === moduleKey
  )), [rows, portfolio, moduleKey]);

  return (
    <section aria-labelledby="module-tickets-heading">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div><p className="eyebrow">{moduleName} operations</p><h2 id="module-tickets-heading">Tickets & issues</h2><p className="muted">{portfolio ? "Issues across your accessible projects and operations." : `Issues scoped to ${activeProperty?.name ?? "the current property"}.`}</p></div>
        <span className="status-pill"><CircleAlert size={14} /> {relevantRows.length} visible</span>
      </div>
      {loading ? <ActivityState message="Loading tickets…" onRetry={load} /> : error ? <ActivityState message={error} onRetry={load} /> : relevantRows.length === 0 ? <ActivityState message={activeProperty ? "No open tickets or issues are recorded for this property." : "No open tickets or issues recorded in this organization."} onRetry={load} /> : (
        <div className="data-panel table-scroll"><table className="fc-data-table"><thead><tr><th>Reference</th><th>Title</th><th>Module</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead><tbody>
          {relevantRows.map((row, index) => <tr key={String(row.id ?? index)}><td className="mono">{String(row.reference ?? row.code ?? `TICKET-${index + 1}`)}</td><td>{String(row.title ?? row.subject ?? row.description ?? "—")}</td><td><span style={{ textTransform: "capitalize", fontSize: "0.85rem" }}>{String(row.module ?? "general")}</span></td><td>{String(row.priority ?? "—")}</td><td><span className="status-pill">{String(row.status ?? "open")}</span></td><td>{formatDate(row.updated_at ?? row.created_at)}</td></tr>)}
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
  const [moduleFilter, setModuleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [range, setRange] = useState({ start: "", end: "" });
  const load = useCallback(() => {
    setLoading(true); setError("");
    const params = new URLSearchParams(); if (range.start) params.set("start", range.start); if (range.end) params.set("end", range.end);
    void apiFetch(`/calendar-feed/?${params.toString()}`, portfolio ? { headers: { "X-Property-Scope": "portfolio" } } : undefined)
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiErrorMessage(response, "The calendar could not be loaded."));
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) throw new Error("The calendar service returned an unexpected response. Please retry in a moment.");
        const data = await response.json().catch(() => { throw new Error("The calendar data could not be read. Please retry in a moment."); });
        setRows(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [portfolio, range.start, range.end]);
  useEffect(() => { queueMicrotask(load); }, [activeProperty?.id, load]);

  const moduleKey = moduleName.toLowerCase() === "portfolio" ? "all" : moduleName.toLowerCase();
  const relevantRows = useMemo(() => rows.filter((row) => (
    (portfolio || moduleKey === "all" || String(row.module) === moduleKey)
    && (moduleFilter === "all" || String(row.module) === moduleFilter)
    && (typeFilter === "all" || String(row.event_type) === typeFilter)
  )), [rows, portfolio, moduleKey, moduleFilter, typeFilter]);
  const modules = [...new Set(rows.map(row => String(row.module ?? "operations")))].sort();
  const types = [...new Set(rows.map(row => String(row.event_type ?? "event")))].sort();
  const borderColors: Record<string, string> = { property: "#e23b3b", facility: "#0284c7", companion: "#16a34a", monitoring: "#d97706" };
  const calendarEvents = relevantRows.map((row, index) => ({
    id: String(row.id ?? index), title: String(row.title ?? "Untitled event"),
    start: String(row.starts_at), end: row.ends_at ? String(row.ends_at) : undefined,
    allDay: Boolean(row.all_day), url: String(row.source_url ?? ""),
    backgroundColor: String(row.status) === "overdue" ? "#dc2626" : borderColors[String(row.module)] ?? "#64748b",
    borderColor: String(row.status) === "overdue" ? "#dc2626" : borderColors[String(row.module)] ?? "#64748b",
    extendedProps: { subtitle: row.subtitle, propertyName: row.property_name, module: row.module },
  }));

  return (
    <section aria-labelledby="module-calendar-heading">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div><p className="eyebrow">{moduleName} operations</p><h2 id="module-calendar-heading">Calendar</h2><p className="muted">{portfolio ? "Meetings, inspections and operational events across your accessible projects." : `Meetings, inspections and operational events for ${activeProperty?.name ?? "the current property"}.`}</p></div>
        <span className="status-pill"><CalendarDays size={14} /> {relevantRows.length} events</span>
      </div>
      {portfolio && rows.length > 0 && <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Module</InputLabel><Select value={moduleFilter} label="Module" onChange={event => setModuleFilter(event.target.value)}><MenuItem value="all">All modules</MenuItem>{modules.map(module => <MenuItem key={module} value={module}>{module.replaceAll("_", " ")}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Event type</InputLabel><Select value={typeFilter} label="Event type" onChange={event => setTypeFilter(event.target.value)}><MenuItem value="all">All event types</MenuItem>{types.map(type => <MenuItem key={type} value={type}>{type.replaceAll("_", " ")}</MenuItem>)}</Select></FormControl>
      </Paper>}
      {error ? <ActivityState message={error} onRetry={load} /> : <CalendarWidget events={calendarEvents} loading={loading} onRangeChange={(next) => setRange((current) => current.start === next.start && current.end === next.end ? current : next)} />}
      {!loading && !error && relevantRows.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 1 }}>No operational deadlines or appointments fall within this calendar range.</Typography>}
    </section>
  );
}
