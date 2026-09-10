import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/components/monitoring/react-router-shim";
import {
  Calendar, Clock, CheckCircle, Download, Flag, Search, Upload,
} from "lucide-react";
import type { SCurve } from "../shared-types";
import {
  fetchIngestionStatus,
  fetchMilestones,
  fetchScurve,
  updateWorkplanTask,
} from "../api";
import { useWorkspace } from "../context/WorkspaceContext";
import { formatDate, pct } from "../lib/format";
import { PageEmpty, PageError, PageLoading } from "../components/PageState";

/** Work-plan task as returned by GET /projects/:id/ingest/status */
interface WorkPlanTask {
  task_id: string;
  task_name: string;
  start_date: string | null;
  end_date: string | null;
  duration_days?: number;
  wbs_level?: number;
  status?: string;
  percent_complete?: number | string;
  resource?: string;
  responsible_party?: string;
}

interface ActivityRow {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  durationDays: number;
  pct: number;
  status: string;
  wbsLevel: number;
  resource: string;
  responsible: string;
  isCritical: boolean;
  color: string;
  barLeft: number;
  barWidth: number;
}

interface SCurveSeriesPoint {
  label: string;
  planned: number;
  actual: number | null;
}

function parseDateMs(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    return Number.isFinite(ms) ? ms : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function statusColor(status: string, complete: number): string {
  const s = (status || "").toLowerCase();
  if (complete >= 100 || /complete|done|closed/.test(s)) return "var(--color-emerald)";
  if (/delay|late|behind|critical/.test(s)) return "var(--color-danger)";
  if (/risk|warning|at risk/.test(s)) return "var(--color-amber)";
  if (complete <= 0 || /not started|pending|draft/.test(s)) return "var(--color-slate-400)";
  return "var(--color-emerald)";
}

function normalizeStatus(status: string, complete: number): string {
  const raw = (status || "").trim();
  if (raw) return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (complete >= 100) return "Completed";
  if (complete > 0) return "In Progress";
  return "Not Started";
}

/** Critical when status signals delay/risk, or progress is materially behind elapsed schedule. */
function computeIsCritical(
  status: string,
  complete: number,
  start: string | null,
  end: string | null,
): boolean {
  const s = (status || "").toLowerCase();
  if (/delay|risk|critical|behind|late/.test(s)) return true;
  const startMs = parseDateMs(start);
  const endMs = parseDateMs(end);
  if (startMs == null || endMs == null || endMs <= startMs) return false;
  const now = Date.now();
  if (now < startMs) return false;
  const expected = Math.min(100, Math.max(0, ((now - startMs) / (endMs - startMs)) * 100));
  return complete < expected - 10;
}

function monthLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

/** Build planned/actual cumulative series from task schedule + percent_complete. */
function computeScurveFromTasks(tasks: ActivityRow[]): SCurveSeriesPoint[] {
  const dated = tasks.filter((t) => parseDateMs(t.start) != null && parseDateMs(t.end) != null);
  if (!dated.length) {
    const avg = tasks.length
      ? tasks.reduce((s, t) => s + t.pct, 0) / tasks.length
      : 0;
    return [{ label: "Now", planned: 100, actual: Math.round(avg * 10) / 10 }];
  }

  const starts = dated.map((t) => parseDateMs(t.start)!);
  const ends = dated.map((t) => parseDateMs(t.end)!);
  const minMs = Math.min(...starts);
  const maxMs = Math.max(...ends);
  const span = Math.max(maxMs - minMs, 1);
  // ~8–12 points across the programme
  const steps = Math.min(12, Math.max(4, Math.ceil(span / (30 * 24 * 3600 * 1000))));
  const points: SCurveSeriesPoint[] = [];
  const now = Date.now();

  for (let i = 0; i <= steps; i++) {
    const t = minMs + (span * i) / steps;
    let plannedSum = 0;
    let actualSum = 0;
    for (const task of dated) {
      const s = parseDateMs(task.start)!;
      const e = parseDateMs(task.end)!;
      const dur = Math.max(e - s, 1);
      // Planned linear ramp within task window
      let planned = 0;
      if (t >= e) planned = 100;
      else if (t > s) planned = ((t - s) / dur) * 100;
      plannedSum += planned;
      // Actual: use reported % once the as-of date is at/after start
      if (t < s) actualSum += 0;
      else actualSum += task.pct;
    }
    const n = dated.length;
    const planned = Math.round((plannedSum / n) * 10) / 10;
    const actualRaw = Math.round((actualSum / n) * 10) / 10;
    points.push({
      label: monthLabel(t),
      planned,
      actual: t <= now + 24 * 3600 * 1000 ? actualRaw : null,
    });
  }
  return points;
}

function seriesFromApi(scurve: SCurve | null): SCurveSeriesPoint[] | null {
  const series = scurve?.series;
  if (!series?.length) return null;
  return series.map((p) => ({
    label: (p?.week || "").replace(/^\d{4}-/, "") || p?.week || "",
    planned: Number(p?.planned_percent ?? 0),
    actual: p?.actual_percent == null ? null : Number(p.actual_percent),
  }));
}

function polylineCoords(
  series: SCurveSeriesPoint[],
  key: "planned" | "actual",
  width = 500,
  height = 140,
  padY = 20,
): string {
  if (!series.length) return "";
  const usableH = height - padY;
  return series
    .map((item, idx) => {
      const val = item[key];
      if (val == null || !Number.isFinite(val)) return null;
      const x = series.length === 1 ? width / 2 : (idx / (series.length - 1)) * width;
      const y = height - padY * 0.2 - (Math.min(100, Math.max(0, val)) / 100) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function buildGanttMetrics(rows: Omit<ActivityRow, "barLeft" | "barWidth">[]): ActivityRow[] {
  const starts = rows.map((r) => parseDateMs(r.start)).filter((v): v is number => v != null);
  const ends = rows.map((r) => parseDateMs(r.end)).filter((v): v is number => v != null);
  const minMs = starts.length ? Math.min(...starts) : Date.now();
  const maxMs = ends.length ? Math.max(...ends) : minMs + 30 * 24 * 3600 * 1000;
  const span = Math.max(maxMs - minMs, 1);

  return rows.map((r, idx) => {
    const s = parseDateMs(r.start);
    const e = parseDateMs(r.end);
    if (s == null || e == null) {
      // Equal-width slots when dates are missing (e.g. milestone fallback)
      const slot = 100 / Math.max(rows.length, 1);
      return { ...r, barLeft: idx * slot, barWidth: Math.max(slot * 0.85, 2) };
    }
    const left = ((s - minMs) / span) * 100;
    const width = Math.max(((Math.max(e, s) - s) / span) * 100, 0.8);
    return { ...r, barLeft: left, barWidth: width };
  });
}

function ganttHeaderLabels(rows: ActivityRow[]): string[] {
  const starts = rows.map((r) => parseDateMs(r.start)).filter((v): v is number => v != null);
  const ends = rows.map((r) => parseDateMs(r.end)).filter((v): v is number => v != null);
  if (!starts.length || !ends.length) return ["Start", "Mid", "End"];
  const minMs = Math.min(...starts);
  const maxMs = Math.max(...ends);
  const n = 6;
  return Array.from({ length: n }, (_, i) => {
    const t = minMs + ((maxMs - minMs) * i) / Math.max(n - 1, 1);
    return new Date(t).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  });
}

function mapWorkPlanTasks(raw: WorkPlanTask[]): ActivityRow[] {
  const base = raw.map((t) => {
    const complete = Number(t.percent_complete ?? 0);
    const status = normalizeStatus(t.status || "", complete);
    const start = t.start_date || null;
    const end = t.end_date || null;
    const isCritical = computeIsCritical(t.status || "", complete, start, end);
    return {
      id: String(t.task_id || t.task_name || Math.random()),
      name: t.task_name || t.task_id || "Task",
      start,
      end,
      durationDays: Number(t.duration_days || 0),
      pct: Number.isFinite(complete) ? complete : 0,
      status,
      wbsLevel: Number(t.wbs_level ?? 0),
      resource: t.resource || "",
      responsible: t.responsible_party || "",
      isCritical,
      color: isCritical ? "var(--color-danger)" : statusColor(status, complete),
    };
  });
  return buildGanttMetrics(base);
}

function mapMilestones(items: any[]): ActivityRow[] {
  const base = (items || []).map((m: any, idx: number) => {
    const complete = Number(m.percent_complete ?? 0);
    const status = m.submitted_at
      ? complete >= 100
        ? "Completed"
        : "In Progress"
      : complete > 0
        ? "In Progress"
        : "Not Started";
    // Prefer any date-like fields if present; else sequential from created_at
    const start =
      m.start_date ||
      m.planned_start ||
      (m.created_at ? new Date(m.created_at > 1e12 ? m.created_at : m.created_at * 1000).toISOString().slice(0, 10) : null);
    const end = m.end_date || m.planned_end || m.due_date || start;
    const isCritical = computeIsCritical(status, complete, start, end);
    return {
      id: String(m.milestone_id || m.id || `M-${idx + 1}`),
      name: String(m.milestone_id || m.name || m.payment_instruction || `Milestone ${idx + 1}`),
      start,
      end,
      durationDays: 0,
      pct: Number.isFinite(complete) ? complete : 0,
      status,
      wbsLevel: 0,
      resource: "",
      responsible: m.required_certifying_role || "",
      isCritical,
      color: isCritical ? "var(--color-danger)" : statusColor(status, complete),
    };
  });
  return buildGanttMetrics(base);
}

export function Timeline() {
  const navigate = useNavigate();
  const { activeProjectId, activeProject, projects, selectProject, loading: wsLoading } = useWorkspace();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [searchQuery, setSearchQuery] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [scurveApi, setScurveApi] = useState<SCurve | null>(null);
  const [totalBoq, setTotalBoq] = useState(0);
  const [totalCertified, setTotalCertified] = useState(0);
  const [source, setSource] = useState<"work_plan" | "milestones" | "none">("none");
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  const saveProgress = async (taskId: string, value: number) => {
    if (!activeProjectId || source !== "work_plan") return;
    const pctVal = Math.max(0, Math.min(100, Number(value)));
    if (!Number.isFinite(pctVal)) return;
    setSavingTaskId(taskId);
    try {
      const updated = await updateWorkplanTask(activeProjectId, taskId, { percent_complete: pctVal });
      setActivities((prev) =>
        prev.map((a) =>
          a.id === taskId
            ? {
                ...a,
                pct: Number(updated.percent_complete),
                status: updated.status || a.status,
                color: a.isCritical ? "var(--color-danger)" : a.color,
              }
            : a,
        ),
      );
    } catch (e) {
      setError((e as Error).message || "Failed to update progress");
    } finally {
      setSavingTaskId(null);
    }
  };

  const load = useCallback(async () => {
    if (!activeProjectId) {
      setActivities([]);
      setScurveApi(null);
      setSource("none");
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [statusRes, scurveRes] = await Promise.all([
        fetchIngestionStatus(activeProjectId).catch(() => null),
        fetchScurve(activeProjectId).catch(() => null),
      ]);

      setScurveApi(scurveRes);
      setTotalBoq(Number((statusRes as any)?.total_boq_amount ?? 0));
      setTotalCertified(Number((statusRes as any)?.total_certified ?? 0));

      const workPlan = ((statusRes as any)?.work_plan_tasks || []) as WorkPlanTask[];
      if (workPlan.length > 0) {
        setActivities(mapWorkPlanTasks(workPlan));
        setSource("work_plan");
      } else {
        const milestones = await fetchMilestones(activeProjectId).catch(() => []);
        const list = Array.isArray(milestones) ? milestones : [];
        if (list.length > 0) {
          setActivities(mapMilestones(list));
          setSource("milestones");
        } else {
          setActivities([]);
          setSource("none");
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load programme data");
      setActivities([]);
      setSource("none");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activities.filter((a) => {
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q);
      const matchesCritical = !criticalOnly || a.isCritical;
      return matchesSearch && matchesCritical;
    });
  }, [activities, searchQuery, criticalOnly]);

  const sCurveSeries = useMemo(() => {
    const fromApi = seriesFromApi(scurveApi);
    if (fromApi?.length) return fromApi;
    if (activities.length) return computeScurveFromTasks(activities);
    return [] as SCurveSeriesPoint[];
  }, [scurveApi, activities]);

  const plannedPath = useMemo(() => polylineCoords(sCurveSeries, "planned"), [sCurveSeries]);
  const actualPath = useMemo(() => polylineCoords(sCurveSeries, "actual"), [sCurveSeries]);

  const latestActualPoint = useMemo(() => {
    const withActual = sCurveSeries.filter((s) => s.actual != null);
    return withActual[withActual.length - 1] ?? null;
  }, [sCurveSeries]);

  const overallProgress = useMemo(() => {
    if (latestActualPoint?.actual != null) return Number(latestActualPoint.actual);
    if (!activities.length) return 0;
    return Math.round((activities.reduce((s, a) => s + a.pct, 0) / activities.length) * 10) / 10;
  }, [latestActualPoint, activities]);

  const plannedProgress = useMemo(() => {
    if (latestActualPoint) {
      const idx = sCurveSeries.findIndex((s) => s.label === latestActualPoint.label);
      if (idx >= 0) return sCurveSeries[idx]!.planned;
    }
    const last = sCurveSeries[sCurveSeries.length - 1];
    return last?.planned ?? overallProgress;
  }, [latestActualPoint, sCurveSeries, overallProgress]);

  const spi = plannedProgress > 0 ? overallProgress / plannedProgress : 1;
  const scheduleVariance = overallProgress - plannedProgress;

  const criticalCount = activities.filter((a) => a.isCritical).length;
  const completedCount = activities.filter((a) => a.pct >= 100 || /complete/i.test(a.status)).length;

  const baselineFinish = useMemo(() => {
    const ends = activities.map((a) => parseDateMs(a.end)).filter((v): v is number => v != null);
    return ends.length ? Math.max(...ends) : null;
  }, [activities]);

  const programmeStart = useMemo(() => {
    const starts = activities.map((a) => parseDateMs(a.start)).filter((v): v is number => v != null);
    return starts.length ? Math.min(...starts) : null;
  }, [activities]);

  const todayLinePct = useMemo(() => {
    if (programmeStart == null || baselineFinish == null || baselineFinish <= programmeStart) return null;
    const now = Date.now();
    if (now < programmeStart) return 0;
    if (now > baselineFinish) return 100;
    return ((now - programmeStart) / (baselineFinish - programmeStart)) * 100;
  }, [programmeStart, baselineFinish]);

  const ganttLabels = useMemo(() => ganttHeaderLabels(filteredActivities.length ? filteredActivities : activities), [filteredActivities, activities]);

  const activeMarker = useMemo(() => {
    if (!sCurveSeries.length || latestActualPoint == null || latestActualPoint.actual == null) return null;
    const idx = sCurveSeries.findIndex((s) => s.label === latestActualPoint.label);
    if (idx < 0) return null;
    const x = sCurveSeries.length === 1 ? 250 : (idx / (sCurveSeries.length - 1)) * 500;
    const y = 140 - 20 * 0.2 - (Math.min(100, Math.max(0, latestActualPoint.actual)) / 100) * (140 - 20);
    return { x, y, value: latestActualPoint.actual };
  }, [sCurveSeries, latestActualPoint]);

  const scheduleStatusLabel = useMemo(() => {
    if (!activities.length) return { label: "—", sub: "No programme data", color: "var(--muted)" };
    if (scheduleVariance >= 2) return { label: "Ahead", sub: `${scheduleVariance.toFixed(1)}% ahead of plan`, color: "var(--color-emerald)" };
    if (scheduleVariance <= -5 || criticalCount > 0)
      return {
        label: criticalCount > 0 ? "At Risk" : "Behind",
        sub: `${Math.abs(scheduleVariance).toFixed(1)}% vs plan · ${criticalCount} critical`,
        color: scheduleVariance <= -10 ? "var(--color-danger)" : "var(--color-amber)",
      };
    return { label: "On Track", sub: `${scheduleVariance >= 0 ? "+" : ""}${scheduleVariance.toFixed(1)}% vs plan`, color: "var(--color-emerald)" };
  }, [activities, scheduleVariance, criticalCount]);

  const donutParts = useMemo(() => {
    const total = Math.max(activities.length, 1);
    const onTrack = activities.filter((a) => a.color === "var(--color-emerald)").length;
    const risk = activities.filter((a) => a.color === "var(--color-amber)").length;
    const delayed = activities.filter((a) => a.color === "var(--color-danger)").length;
    const idle = activities.filter((a) => a.color === "var(--color-slate-400)").length;
    const buckets = [
      { label: "On Track / Done", count: onTrack, color: "var(--color-emerald)" },
      { label: "At Risk", count: risk, color: "var(--color-amber)" },
      { label: "Delayed / Critical", count: delayed, color: "var(--color-danger)" },
      { label: "Not Started", count: idle, color: "var(--color-slate-400)" },
    ];
    let acc = 0;
    const stops: string[] = [];
    for (const b of buckets) {
      const share = (b.count / total) * 100;
      if (share <= 0) continue;
      stops.push(`${b.color} ${acc}% ${acc + share}%`);
      acc += share;
    }
    if (acc < 100) stops.push(`var(--surface-3) ${acc}% 100%`);
    return {
      gradient: stops.length ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(var(--surface-3) 0% 100%)",
      buckets,
      total: activities.length,
    };
  }, [activities]);

  const handleExportCSV = () => {
    const headers = [
      "Activity ID",
      "Activity Name",
      "Baseline Start",
      "Baseline Finish",
      "Duration (days)",
      "% Complete",
      "Status",
      "Is Critical Path",
      "Resource",
      "Responsible",
    ];
    const rows = filteredActivities.map((a) => [
      `"${a.id.replace(/"/g, '""')}"`,
      `"${a.name.replace(/"/g, '""')}"`,
      `"${formatDate(a.start)}"`,
      `"${formatDate(a.end)}"`,
      `"${a.durationDays || ""}"`,
      `"${a.pct}%"`,
      `"${a.status}"`,
      `"${a.isCritical ? "YES" : "NO"}"`,
      `"${(a.resource || "").replace(/"/g, '""')}"`,
      `"${(a.responsible || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Programme_Activities_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─── Project selector when none active ─────────────────────────────────────
  if (!wsLoading && !activeProjectId) {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "1600px", margin: "0 auto" }}>
        <h1 className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
          Programme & Schedule
        </h1>
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <Calendar size={40} style={{ color: "var(--muted)", marginBottom: 12 }} />
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Select a project</h2>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
            Choose a project to load the live programme / construction schedule.
          </p>
          {projects.length === 0 ? (
            <PageEmpty
              title="No projects yet"
              description="Onboard a project and ingest a work plan to see the Gantt and S-curve."
              action={{ label: "Go to projects", onClick: () => navigate("/app/projects") }}
            />
          ) : (
            <select
              value=""
              onChange={(e) => e.target.value && selectProject(e.target.value)}
              style={{
                minWidth: 280,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
                fontSize: 14,
              }}
            >
              <option value="">— Select project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  }

  if (wsLoading || (loading && !activities.length && !error)) {
    return (
      <div style={{ padding: "20px", width: "100%", maxWidth: "1600px", margin: "0 auto" }}>
        <h1 className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
          Programme & Schedule
        </h1>
        <PageLoading rows={3} />
      </div>
    );
  }

  if (error && !activities.length) {
    return (
      <div style={{ padding: "20px", width: "100%", maxWidth: "1600px", margin: "0 auto" }}>
        <h1 className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
          Programme & Schedule
        </h1>
        <PageError message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "1600px", margin: "0 auto" }}>
      <h1 className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        Programme & Schedule
      </h1>

      {/* Header with project context */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase" }}>
            Programme & Schedule
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800 }}>
            {activeProject?.name || "Construction Schedule"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            Live data
            {source === "work_plan" ? " · work plan tasks" : source === "milestones" ? " · milestones fallback" : ""}
            {totalBoq > 0 ? ` · BoQ certified ${pct(totalBoq ? (totalCertified / totalBoq) * 100 : 0, 1)}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {projects.length > 1 && (
            <select
              value={activeProjectId}
              onChange={(e) => selectProject(e.target.value)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--text)",
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn ghost sm" onClick={load} disabled={loading} title="Refresh">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 0 }}>
          <PageError message={error} onRetry={load} />
        </div>
      )}

      {!activities.length ? (
        <PageEmpty
          title="No programme activities"
          description="Ingest a work plan (Excel) or create milestones for this project. No demo figures are shown."
          icon={<Upload size={40} />}
          action={{ label: "Open ingestion", onClick: () => navigate(activeProjectId ? `/app/projects/${activeProjectId}/ingestion` : "/app/ingestion") }}
        />
      ) : (
        <>
          {/* KPI metric strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Overall Progress</div>
                <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "IBM Plex Mono", color: "var(--text)" }}>
                  {pct(overallProgress, 1)}
                </div>
                <div style={{ fontSize: "11px", color: scheduleVariance >= 0 ? "var(--color-emerald)" : "var(--color-amber)", fontWeight: 600, marginTop: "2px" }}>
                  Planned {pct(plannedProgress, 1)}
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: `4px solid ${scheduleStatusLabel.color === "var(--muted)" ? "var(--color-emerald)" : scheduleStatusLabel.color}`,
                  display: "grid",
                  placeItems: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: scheduleStatusLabel.color === "var(--muted)" ? "var(--color-emerald)" : scheduleStatusLabel.color,
                }}
              >
                {Math.round(overallProgress)}%
              </div>
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Schedule Status</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: scheduleStatusLabel.color }}>{scheduleStatusLabel.label}</div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{scheduleStatusLabel.sub}</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(16,185,129,0.15)", display: "grid", placeItems: "center", color: scheduleStatusLabel.color }}>
                <Calendar size={20} />
              </div>
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Baseline Finish Date</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>
                  {baselineFinish != null ? formatDate(baselineFinish) : "—"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>Latest task end</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(139,92,246,0.15)", display: "grid", placeItems: "center", color: "var(--color-violet-strong)" }}>
                <Flag size={20} />
              </div>
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Programme Start</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>
                  {programmeStart != null ? formatDate(programmeStart) : "—"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>Earliest task start</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(59,130,246,0.15)", display: "grid", placeItems: "center", color: "var(--color-blue)" }}>
                <Calendar size={20} />
              </div>
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Critical / Delayed</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: criticalCount ? "var(--color-amber)" : "var(--color-emerald)", fontFamily: "IBM Plex Mono" }}>
                  {criticalCount}
                </div>
                <div style={{ fontSize: "11px", color: criticalCount ? "var(--color-amber)" : "var(--muted)", fontWeight: 600, marginTop: "2px" }}>
                  of {activities.length} activities
                </div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(245,158,11,0.15)", display: "grid", placeItems: "center", color: "var(--color-amber)" }}>
                <Clock size={20} />
              </div>
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Activities Complete</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-emerald)", fontFamily: "IBM Plex Mono" }}>
                  {completedCount} / {activities.length}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                  {activities.length ? pct((completedCount / activities.length) * 100, 0) : "0%"} completed
                </div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(16,185,129,0.15)", display: "grid", placeItems: "center", color: "var(--color-emerald)" }}>
                <CheckCircle size={20} />
              </div>
            </div>
          </div>

          {/* Performance + S-curve + critical summary */}
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 300px", gap: "16px" }}>
            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: "13px", fontWeight: 700, color: "var(--text)", textTransform: "uppercase" }}>
                Programme Performance
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Planned Progress (PV)</span>
                  <strong>{pct(plannedProgress, 1)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Earned Progress (EV)</span>
                  <strong>{pct(overallProgress, 1)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Schedule Performance (SPI)</span>
                  <strong style={{ color: spi >= 1 ? "var(--color-emerald)" : "var(--color-danger)" }}>
                    {spi.toFixed(2)} {spi >= 1 ? "↑" : "↓"}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Time Variance (SV)</span>
                  <strong style={{ color: scheduleVariance >= 0 ? "var(--color-emerald)" : "var(--color-danger)" }}>
                    {scheduleVariance >= 0 ? "+" : ""}
                    {scheduleVariance.toFixed(1)}%
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Critical activities</span>
                  <strong style={{ color: criticalCount ? "var(--color-amber)" : "var(--color-emerald)" }}>{criticalCount}</strong>
                </div>
                <button
                  className="btn ghost sm"
                  style={{ color: "var(--color-danger)", padding: 0, justifyContent: "flex-start", marginTop: "4px" }}
                  onClick={() => navigate("/app/reports")}
                >
                  View performance details →
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text)", textTransform: "uppercase" }}>
                  Dynamic Progress S-Curve
                </h3>
                <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
                  <span style={{ color: "var(--muted)" }}>— Planned</span>
                  <span style={{ color: "var(--color-emerald)", fontWeight: 600 }}>— Actual ({pct(overallProgress, 0)})</span>
                </div>
              </div>
              {sCurveSeries.length === 0 ? (
                <div style={{ flex: 1, minHeight: 180, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 12 }}>
                  No S-curve points yet
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, minHeight: 180, position: "relative" }}>
                    <svg width="100%" height="100%" viewBox="0 0 500 150" preserveAspectRatio="none">
                      <line x1="0" y1="30" x2="500" y2="30" stroke="#cbd5e1" strokeDasharray="3 3" />
                      <line x1="0" y1="75" x2="500" y2="75" stroke="#cbd5e1" strokeDasharray="3 3" />
                      <line x1="0" y1="120" x2="500" y2="120" stroke="#cbd5e1" strokeDasharray="3 3" />
                      {plannedPath && (
                        <polyline points={plannedPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />
                      )}
                      {actualPath && (
                        <polyline points={actualPath} fill="none" stroke="#10b981" strokeWidth="3" />
                      )}
                      {activeMarker && (
                        <>
                          <circle cx={activeMarker.x} cy={activeMarker.y} r="5" fill="#10b981" />
                          <rect x={activeMarker.x - 18} y={activeMarker.y - 22} width="36" height="18" rx="4" fill="#10b981" />
                          <text x={activeMarker.x} y={activeMarker.y - 9} fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">
                            {Math.round(activeMarker.value)}%
                          </text>
                        </>
                      )}
                    </svg>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)", marginTop: "4px", gap: 2, overflow: "hidden" }}>
                    {sCurveSeries.map((s, i) => (
                      <span key={`${s.label}-${i}`} style={{ flex: 1, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: 700, color: "var(--text)", textTransform: "uppercase" }}>
                Critical Path Summary
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    position: "relative",
                    width: 90,
                    height: 90,
                    borderRadius: "50%",
                    background: donutParts.gradient,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center", textAlign: "center" }}>
                    <div>
                      <strong style={{ fontSize: 16, color: "var(--text)" }}>{donutParts.total}</strong>
                      <div style={{ fontSize: 9, color: "var(--muted)" }}>Activities</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px" }}>
                  {donutParts.buckets.map((b) => (
                    <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color }} />
                      {b.label}:{" "}
                      <strong>
                        {b.count}
                        {donutParts.total ? ` (${Math.round((b.count / donutParts.total) * 100)}%)` : ""}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: "11px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: 10 }}>Critical activities</span>
                  <strong style={{ color: criticalCount ? "var(--color-danger)" : "var(--color-emerald)" }}>
                    {criticalCount === 0
                      ? "None flagged"
                      : activities
                          .filter((a) => a.isCritical)
                          .slice(0, 2)
                          .map((a) => a.name)
                          .join(", ") + (criticalCount > 2 ? ` +${criticalCount - 2}` : "")}
                  </strong>
                </div>
                <button className="btn ghost sm" style={{ color: "var(--color-danger)", padding: 0 }} onClick={() => setCriticalOnly((v) => !v)}>
                  {criticalOnly ? "Show all activities" : "View critical path →"}
                </button>
              </div>
            </div>
          </div>

          {/* Activities table + Gantt */}
          <div className="card" style={{ padding: "18px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text)", textTransform: "uppercase" }}>
                  Programme Activities
                </h3>
                <div style={{ position: "relative", width: 220 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    placeholder="Search activity..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      paddingLeft: 30,
                      height: 32,
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--text)",
                    }}
                  />
                </div>
                {criticalOnly && (
                  <button className="btn ghost sm" onClick={() => setCriticalOnly(false)} style={{ fontSize: 11 }}>
                    Critical only ×
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                <div style={{ display: "flex", gap: 12, marginRight: 12, fontSize: 11 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 10, background: "var(--color-blue)", borderRadius: 2, opacity: 0.5 }} /> Baseline
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 10, background: "var(--color-emerald)", borderRadius: 2 }} /> Actual
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 10, background: "var(--color-danger)", borderRadius: 2 }} /> Critical
                  </span>
                </div>
                <button
                  className="btn ghost sm"
                  onClick={handleExportCSV}
                  style={{ border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 4 }}
                  title="Export filtered activities to CSV"
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                No activities match your search{criticalOnly ? " / critical filter" : ""}.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(420px, 480px) 1fr", gap: "16px", overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", textTransform: "uppercase", fontSize: "11px", color: "var(--muted)", textAlign: "left" }}>
                      <th style={{ padding: "8px" }}>ID</th>
                      <th style={{ padding: "8px" }}>Activity Name</th>
                      <th style={{ padding: "8px" }}>Baseline Start</th>
                      <th style={{ padding: "8px" }}>Baseline Finish</th>
                      <th style={{ padding: "8px" }}>% Complete</th>
                      <th style={{ padding: "8px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((a) => (
                      <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px", fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{a.id}</td>
                        <td
                          style={{
                            padding: "8px",
                            fontWeight: 600,
                            color: "var(--text)",
                            paddingLeft: 8 + Math.min(a.wbsLevel, 4) * 10,
                          }}
                        >
                          {a.name}
                        </td>
                        <td style={{ padding: "8px", color: "var(--muted)", whiteSpace: "nowrap" }}>{formatDate(a.start)}</td>
                        <td style={{ padding: "8px", color: "var(--muted)", whiteSpace: "nowrap" }}>{formatDate(a.end)}</td>
                        <td style={{ padding: "8px", fontWeight: 700 }}>
                          {source === "work_plan" ? (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              defaultValue={Math.round(a.pct)}
                              disabled={savingTaskId === a.id}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isFinite(v) && v !== a.pct) saveProgress(a.id, v);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              }}
                              style={{
                                width: 64,
                                padding: "4px 6px",
                                borderRadius: 6,
                                border: "1px solid var(--border)",
                                background: "var(--surface-2)",
                                color: "var(--text)",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                              title="Edit progress and press Enter or leave field to save"
                            />
                          ) : (
                            pct(a.pct, a.pct % 1 === 0 ? 0 : 1)
                          )}
                        </td>
                        <td style={{ padding: "8px" }}>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 10,
                              background: `color-mix(in srgb, ${a.color} 13%, transparent)`,
                              color: a.color,
                              fontWeight: 700,
                              border: `1px solid color-mix(in srgb, ${a.color} 25%, transparent)`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {a.status}
                            {a.isCritical ? " ★" : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div
                  style={{
                    position: "relative",
                    minHeight: Math.max(120, filteredActivities.length * 34 + 40),
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    padding: "10px",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--muted)",
                    }}
                  >
                    {ganttLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>

                  {todayLinePct != null && (
                    <div
                      style={{
                        position: "absolute",
                        left: `calc(10px + (100% - 20px) * ${todayLinePct / 100})`,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: "var(--color-danger)",
                        zIndex: 10,
                        pointerEvents: "none",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: -28,
                          background: "var(--color-danger)",
                          color: "#fff",
                          padding: "1px 5px",
                          borderRadius: 8,
                          fontSize: 9,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {mounted ? formatDate(Date.now()) : ""}
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
                    {filteredActivities.map((a) => (
                      <div key={a.id} style={{ height: 20, position: "relative", width: "100%" }} title={`${a.name}: ${formatDate(a.start)} → ${formatDate(a.end)} (${pct(a.pct)})`}>
                        <div
                          style={{
                            position: "absolute",
                            left: `${a.barLeft}%`,
                            width: `${a.barWidth}%`,
                            height: 6,
                            top: 0,
                            background: "var(--color-blue)",
                            opacity: 0.45,
                            borderRadius: 3,
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: `${a.barLeft}%`,
                            width: `${Math.max(a.barWidth * (a.pct / 100), a.pct > 0 ? 0.4 : 0)}%`,
                            height: 10,
                            top: 6,
                            background: a.isCritical ? "var(--color-danger)" : a.color,
                            borderRadius: 4,
                            minWidth: a.pct > 0 ? 2 : 0,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
