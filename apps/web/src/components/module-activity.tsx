"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CircleAlert, RefreshCw } from "lucide-react";
import { Box, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Typography } from "@mui/material";
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
  const load = useCallback(() => {
    setLoading(true); setError("");
    void apiFetch("/construction/tickets/", portfolio ? { headers: { "X-Property-Scope": "portfolio" } } : undefined)
      .then(async (response) => {
        if (!response.ok) throw new Error("Ticket access is not enabled for this workspace.");
        const data = await response.json();
        setRows(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [portfolio]);
  useEffect(() => { queueMicrotask(load); }, [activeProperty?.id, load]);

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
  const [moduleFilter, setModuleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const load = useCallback(() => {
    setLoading(true); setError("");
    void apiFetch("/calendar-feed/", portfolio ? { headers: { "X-Property-Scope": "portfolio" } } : undefined)
      .then(async (response) => {
        if (!response.ok) throw new Error("Calendar access is not enabled for this workspace.");
        const data = await response.json();
        setRows(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [portfolio]);
  useEffect(() => { queueMicrotask(load); }, [activeProperty?.id, load]);

  const moduleKey = moduleName.toLowerCase() === "portfolio" ? "all" : moduleName.toLowerCase();
  const relevantRows = useMemo(() => rows.filter((row) => (
    (portfolio || moduleKey === "all" || String(row.module) === moduleKey)
    && (moduleFilter === "all" || String(row.module) === moduleFilter)
    && (typeFilter === "all" || String(row.event_type) === typeFilter)
  )), [rows, portfolio, moduleKey, moduleFilter, typeFilter]);
  const modules = [...new Set(rows.map(row => String(row.module ?? "operations")))].sort();
  const types = [...new Set(rows.map(row => String(row.event_type ?? "event")))].sort();
  const colors: Record<string, "error" | "info" | "success" | "warning" | "default"> = { property: "error", facility: "info", companion: "success", monitoring: "warning" };
  const borderColors: Record<string, string> = { property: "#e23b3b", facility: "#0284c7", companion: "#16a34a", monitoring: "#d97706" };

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
      {loading ? <ActivityState message="Loading calendar…" onRetry={load} /> : error ? <ActivityState message={error} onRetry={load} /> : relevantRows.length === 0 ? <ActivityState message="No operational deadlines or appointments fall within this calendar range." onRetry={load} /> : (
        <Box sx={{ display: "grid", gap: 1.25 }}>
          {relevantRows.map((row, index) => {
            const start = new Date(String(row.starts_at));
            const overdue = String(row.status) === "overdue";
            return <Paper key={String(row.id ?? index)} variant="outlined" sx={{ overflow: "hidden", borderLeft: 4, borderLeftColor: overdue ? "error.main" : borderColors[String(row.module)] ?? "divider" }}>
              <Link href={String(row.source_url ?? "#")} style={{ display: "grid", gridTemplateColumns: "76px minmax(0,1fr) auto", gap: 16, alignItems: "center", padding: 16 }}>
                <Box sx={{ textAlign: "center", borderRight: 1, borderColor: "divider", pr: 2 }}><Typography variant="overline" color="text.secondary">{start.toLocaleDateString("en-KE", { month: "short" })}</Typography><Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1 }}>{start.getDate()}</Typography></Box>
                <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 750 }}>{String(row.title ?? "Untitled event")}</Typography><Typography variant="body2" color="text.secondary">{String(row.subtitle ?? "")} {row.property_name ? `· ${String(row.property_name)}` : ""}</Typography><Typography variant="caption" color="text.secondary">{formatDate(row.starts_at)}</Typography></Box>
                <Box sx={{ display: "flex", gap: .75, flexWrap: "wrap", justifyContent: "flex-end" }}><Chip size="small" color={colors[String(row.module)] ?? "default"} label={String(row.module ?? "operations")} /><Chip size="small" variant="outlined" color={overdue ? "error" : "default"} label={String(row.status ?? "scheduled").replaceAll("_", " ")} /></Box>
              </Link>
            </Paper>;
          })}
        </Box>
      )}
    </section>
  );
}
