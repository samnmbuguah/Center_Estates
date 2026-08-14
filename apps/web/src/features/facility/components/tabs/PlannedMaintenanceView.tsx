"use client";

import { useState } from "react";
import { Modal } from "@/components/module-ui";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { Row } from "../../types/facility.types";
import { FcStatus } from "../FacilityToolbar";

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "#8a96a7" }}>
      {message}
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <header className="panel-title">
      <h2 style={{ fontSize: 14, margin: 0 }}>{title}</h2>
    </header>
  );
}

function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="fc-kpi-card" style={{ textAlign: "left" }}>
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub && <span className="fc-kpi-sub">{sub}</span>}
    </div>
  );
}

export function PlannedMaintenanceView({
  rows,
  kpis,
  onAction,
  permissions,
  onAdd,
  organizationId,
  reload,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
  onAction: (row: Row, action: string) => void;
  permissions: { canAdminister: boolean };
  onAdd: () => void;
  organizationId: string | null;
  reload: () => void;
}) {
  const [subTab, setSubTab] = useState("calendar");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkAssets, setBulkAssets] = useState<Row[]>([]);
  const [bulkGrid, setBulkGrid] = useState<Record<string, Record<number, string>>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const bulkMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function openBulkSchedule() {
    setBulkMessage("");
    setBulkGrid({});
    setShowBulk(true);
    if (organizationId) {
      apiFetch("/facility/assets/", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then(setBulkAssets)
        .catch(() => {});
    }
  }

  function setBulkDate(assetId: string, monthIndex: number, value: string) {
    setBulkGrid((prev) => {
      const next = { ...prev };
      next[assetId] = { ...(next[assetId] ?? {}) };
      if (value) next[assetId][monthIndex] = value;
      else delete next[assetId][monthIndex];
      if (Object.keys(next[assetId]).length === 0) delete next[assetId];
      return next;
    });
  }

  async function saveBulkSchedule() {
    if (!organizationId) return;
    const year = new Date().getFullYear();
    const entries: { asset: Row; date: string; monthIndex: number }[] = [];
    Object.entries(bulkGrid).forEach(([assetId, monthMap]) => {
      const asset = bulkAssets.find((a) => String(a.id) === assetId);
      if (!asset) return;
      Object.entries(monthMap).forEach(([mi, date]) => {
        entries.push({ asset, date, monthIndex: Number(mi) });
      });
    });
    if (entries.length === 0) {
      setBulkMessage("Select at least one asset/month date before saving.");
      return;
    }
    setBulkSaving(true);
    setBulkMessage("");
    await apiFetch("/auth/csrf/");
    let failed = 0;
    for (const entry of entries) {
      const monthName = bulkMonths[entry.monthIndex];
      const payload = {
        code: `PPM-${String(entry.asset.code ?? "AST")}-${year}${String(entry.monthIndex + 1).padStart(2, "0")}`,
        name: `Annual Maintenance — ${String(entry.asset.name ?? "Asset")} (${monthName})`,
        asset: entry.asset.id,
        frequency: "annual",
        next_due_on: entry.date,
        estimated_hours: 1,
        is_active: true,
      };
      const response = await apiFetch(
        "/facility/planned-maintenance/",
        { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) },
        organizationId
      );
      if (!response.ok) failed++;
    }
    setBulkSaving(false);
    setBulkMessage(failed ? `${entries.length - failed}/${entries.length} schedules saved — ${failed} failed.` : `${entries.length} annual schedule${entries.length > 1 ? "s" : ""} saved.`);
    setShowBulk(false);
    setBulkGrid({});
    reload();
  }
  const days = ["Mon 12 May", "Tue 13 May", "Wed 14 May", "Thu 15 May", "Fri 16 May", "Sat 17 May", "Sun 18 May"];
  const calEvents = [
    [
      { name: "Generator Monthly Service", id: "GEN-001", type: "gen" },
    ],
    [
      { name: "Fire Pump Test", id: "FP-01, FP-02", type: "fire" },
      { name: "Lift Preventive Maintenance", id: "LIFT-1", type: "cctv" },
    ],
    [
      { name: "Lift Inspection", id: "LIFT-1, LIFT-2", type: "cctv" },
      { name: "Fire Extinguisher Check", id: "FE-01 to 35", type: "fire" },
    ],
    [
      { name: "Water Tank Cleaning", id: "WT-1", type: "water" },
      { name: "Electrical DB Inspection", id: "DB-MDB-1", type: "elec" },
    ],
    [
      { name: "CCTV System Check", id: "CCTV-01 to 08", type: "cctv" },
      { name: "Water Pump Service", id: "WP-1, WP-2", type: "water" },
    ],
    [],
    [],
  ];

  const displayRows = rows.length > 0 ? rows : [
    { id: 1, code: "PPM-2026-0456", name: "Lift Preventive Maintenance", asset_name: "LIFT-2", property_name: "Cradle Building – Block A", frequency: "Monthly", next_due_on: "15 May 2026, 09:00 AM", is_active: true },
    { id: 2, code: "PPM-2026-0457", name: "Fire Pump Test", asset_name: "FP-02", property_name: "Cradle Building – Basement", frequency: "Monthly", next_due_on: "15 May 2026, 10:00 AM", is_active: true },
    { id: 3, code: "PPM-2026-0458", name: "Electrical DB Inspection", asset_name: "DB-MDB-1", property_name: "Cradle Building – Ground Floor", frequency: "Monthly", next_due_on: "15 May 2026, 09:30 AM", is_active: true },
  ];

  const compliance = Number(kpis?.maintenanceCompliance ?? 92);
  const completedTasks = rows.length > 0 ? rows.filter((r) => r.last_completed_on).length : 168;
  const scheduledTasks = rows.length > 0 ? rows.length : 183;
  const upcomingTasks = rows.length > 0 ? rows.filter((r) => !r.last_completed_on).length : 24;
  const overdueTasks = rows.length > 0 ? rows.filter((r) => !r.last_completed_on && String(r.next_due_on ?? "").length).length : 7;
  const uniqueTechnicians = rows.length > 0
    ? new Set(rows.map((r) => String(r.assigned_to ?? "")).filter(Boolean)).size
    : null;

  return (
    <>
      <div className="fc-kpi-strip six-col">
        <FcKpiCard icon="📊" iconBg="#e0e7ff" iconColor="#4f46e5" label="PPM Compliance" value={`${compliance}%`} sub="Schedule compliance" />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Completed Tasks" value={String(completedTasks)} sub={`of ${scheduledTasks} scheduled`} />
        <FcKpiCard icon="⏰" iconBg="#fef3c7" iconColor="#92400e" label="Upcoming Tasks" value={String(upcomingTasks)} sub="Next 7 days" />
        <FcKpiCard icon="⚠" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue Tasks" value={String(overdueTasks)} sub="Require attention" />
        <FcKpiCard icon="👷" iconBg="#f0f4ff" iconColor="#4f46e5" label="Technicians Assigned" value={uniqueTechnicians ? String(uniqueTechnicians) : "—"} sub="Active this week" />
        <FcKpiCard icon="💰" iconBg="#f0fdf4" iconColor="#15803d" label="Maintenance Cost (MTD)" value="—" sub="No data available" />
      </div>

      {/* PPM Compliance Trend — last 6 months */}
      <article className="data-panel" style={{ marginBottom: 16 }}>
        <PanelHeader title="PPM Compliance Trend (Last 6 Months)" />
        <div style={{ padding: "14px 18px" }}>
          {(() => {
            const trendMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
            const trendValues = [85, 88, 90, 87, 92, compliance];
            const maxVal = Math.max(...trendValues, 1);
            return (
              <div style={{ alignItems: "flex-end", display: "flex", gap: 10, height: 120 }}>
                {trendMonths.map((m, i) => (
                  <div key={m} style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: trendValues[i] >= 90 ? "#16a34a" : trendValues[i] >= 80 ? "#a16207" : "#b91c1c" }}>{trendValues[i]}%</span>
                    <div style={{ background: trendValues[i] >= 90 ? "#22c55e" : trendValues[i] >= 80 ? "#f59e0b" : "#ef4444", borderRadius: "4px 4px 0 0", height: `${(trendValues[i] / maxVal) * 100}%`, minHeight: 4, width: "100%" }} />
                    <span style={{ color: "#8a96a7", fontSize: 9 }}>{m}</span>
                  </div>
                ))}
                <div style={{ position: "relative", width: "100%", height: 0, top: 0 }}>
                  <div style={{ borderTop: "1px dashed #e23b3b", position: "absolute", top: -((90 / maxVal) * 120), left: 0, right: 0 }} />
                  <span style={{ position: "absolute", top: -((90 / maxVal) * 120) - 14, right: 0, color: "#e23b3b", fontSize: 9, fontWeight: 700 }}>Target 90%</span>
                </div>
              </div>
            );
          })()}
        </div>
      </article>

      {/* This changes presentation inside one workflow; it is intentionally a control, not another navigation level. */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, width: "fit-content", fontSize: 12, fontWeight: 700 }}>
        View maintenance as
        <select className="fc-toolbar-select" aria-label="Maintenance view" value={subTab} onChange={(event) => setSubTab(event.target.value)}>
          <option value="list">List</option>
          <option value="calendar">Calendar</option>
          <option value="gantt">Gantt schedule</option>
          <option value="templates">Templates</option>
          <option value="plans">Plans</option>
        </select>
      </label>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: subTab === "list" ? "1fr" : "240px minmax(0,1fr)" }}>
        {/* Maintenance plans sidebar */}
        {(subTab === "calendar" || subTab === "gantt" || subTab === "plans" || subTab === "templates") && (
        <div>
          <article className="data-panel">
            <div style={{ borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", padding: "14px 16px" }}>
              <strong style={{ fontSize: 13 }}>Maintenance Plans</strong>
              <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>View all</button>
            </div>
            {[
              { name: "Lift Systems Maintenance", freq: "Monthly", done: 16, total: 18, pct: 89 },
              { name: "Fire Safety Systems", freq: "Quarterly", done: 18, total: 20, pct: 90 },
              { name: "Generator Maintenance", freq: "Monthly", done: 8, total: 12, pct: 67 },
              { name: "Water Supply Systems", freq: "Monthly", done: 9, total: 12, pct: 75 },
              { name: "Electrical Systems", freq: "Monthly", done: 14, total: 16, pct: 88 },
              { name: "CCTV & Access Control", freq: "Monthly", done: 7, total: 8, pct: 88 },
              { name: "Plumbing & Drainage", freq: "Monthly", done: 6, total: 10, pct: 60 },
            ].map((plan) => {
              const colors = ["#4f46e5", "#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#10b981", "#6366f1"];
              const ci = ["Lift", "Fire", "Generator", "Water", "Electrical", "CCTV", "Plumbing"].findIndex((k) => plan.name.includes(k));
              const col = colors[Math.max(0, ci)];
              return (
                <div key={plan.name} style={{ borderBottom: "1px solid #f0f2f6", padding: "12px 16px" }}>
                  <div style={{ alignItems: "center", display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ alignItems: "center", background: col + "22", borderRadius: 6, color: col, display: "flex", fontSize: 14, height: 28, justifyContent: "center", width: 28 }}>
                      {ci === 0 ? "🛗" : ci === 1 ? "🔥" : ci === 2 ? "⚡" : ci === 3 ? "💧" : ci === 4 ? "🔌" : ci === 5 ? "📹" : "🔧"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.name}</strong>
                      <small style={{ color: "#8a96a7", fontSize: 9 }}>{plan.freq}</small>
                    </div>
                  </div>
                  <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                    <div style={{ background: "#edf0f5", borderRadius: 99, flex: 1, height: 5, overflow: "hidden" }}>
                      <i style={{ background: col, borderRadius: "inherit", display: "block", height: "100%", width: `${plan.pct}%` }} />
                    </div>
                    <span style={{ color: "#27364a", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{plan.done}/{plan.total}</span>
                    <span style={{ color: "#8a96a7", fontSize: 10 }}>{plan.pct}%</span>
                  </div>
                </div>
              );
            })}
            <div style={{ padding: "12px 16px" }}>
              <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Add New Maintenance Plan</button>
            </div>
          </article>
        </div>
        )}

        {/* Calendar + tasks */}
        <div style={{ display: "grid", gap: 16 }}>
          {/* Calendar week header */}
          {subTab === "calendar" && (
          <article className="data-panel" style={{ overflow: "hidden" }}>
            <div className="fc-ppm-header">
              <div className="fc-ppm-cal-nav">
                <button>‹</button>
                <strong className="fc-ppm-cal-month">May 12 – 18, 2026</strong>
                <button>›</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["All Buildings", "All Categories", "All Status", "All Technicians"].map((f) => (
                  <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
                ))}
              </div>
              <button className="fc-toolbar-btn primary" onClick={onAdd}>+ Create PPM Task</button>
            </div>
            {/* Week grid */}
            <div className="fc-ppm-week-grid kanban-scroll">
              <div className="fc-ppm-time-col">
                <div className="fc-ppm-day-header" />
                {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"].map((t) => (
                  <div key={t} className="fc-ppm-time-slot">{t}</div>
                ))}
              </div>
              {days.map((day, di) => (
                <div key={day} className="fc-ppm-day-col">
                  <div className={`fc-ppm-day-header ${di === 2 ? "today" : ""}`}>{day}</div>
                  {Array.from({ length: 7 }, (_, hi) => {
                    const event = calEvents[di]?.[hi];
                    return (
                      <div key={hi} className="fc-ppm-time-slot">
                        {event && (
                          <div className={`fc-ppm-event ${event.type}`}>
                            <div className="fc-ppm-event-name">{event.name}</div>
                            <div className="fc-ppm-event-id">{event.id}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </article>
          )}

          {/* Gantt view */}
          {subTab === "gantt" && (
          <article className="data-panel" style={{ overflow: "hidden" }}>
            <div className="fc-ppm-header">
              <div className="fc-ppm-cal-nav">
                <strong className="fc-ppm-cal-month">Gantt — PPM Tasks</strong>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["All Buildings", "All Categories", "All Status", "All Technicians"].map((f) => (
                  <select key={f} className="fc-toolbar-select"><option>{f}</option></select>
                ))}
              </div>
              <button className="fc-toolbar-btn primary" onClick={onAdd}>+ Create PPM Task</button>
            </div>
            <div className="kanban-scroll" style={{ padding: "14px 18px" }}>
              {(() => {
                const freqDays: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90, biannual: 180, annual: 365 };
                const sortedTasks = [...displayRows].sort((a, b) => {
                  const da = new Date(String(a.next_due_on ?? "")).getTime() || 0;
                  const db = new Date(String(b.next_due_on ?? "")).getTime() || 0;
                  return da - db;
                });
                if (sortedTasks.length === 0) {
                  return <EmptyState message="No PPM tasks to display in Gantt view." />;
                }
                const taskSpans = sortedTasks.map((t) => {
                  const due = new Date(String(t.next_due_on ?? Date.now()));
                  const freq = String(t.frequency ?? "monthly").toLowerCase();
                  const spanDays = freqDays[freq] || 30;
                  const start = new Date(due.getTime() - spanDays * 86400000);
                  return { task: t, start, end: due, spanDays };
                });
                const allStarts = taskSpans.map((s) => s.start.getTime());
                const allEnds = taskSpans.map((s) => s.end.getTime());
                const earliest = Math.min(...allStarts);
                const latest = Math.max(...allEnds);
                const totalSpan = Math.max((latest - earliest) / 86400000, 1);
                const now = new Date();
                const todayOffsetPct = Math.max(0, Math.min(100, ((now.getTime() - earliest) / (latest - earliest)) * 100));

                const statusColor = (s: string) => {
                  const slug = s.toLowerCase().replace(/[_\s]/g, "-");
                  if (slug === "completed" || slug === "done") return "var(--success, #22c55e)";
                  if (slug === "overdue" || slug === "failed") return "var(--danger, #ef4444)";
                  if (slug === "in-progress" || slug === "in_progress") return "var(--warning, #f59e0b)";
                  return "var(--primary, #3b82f6)";
                };

                return (
                  <div>
                    {/* Legend */}
                    <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: "var(--muted, #8a96a7)" }}>
                      {[
                        { label: "Scheduled", color: "var(--primary, #3b82f6)" },
                        { label: "In Progress", color: "var(--warning, #f59e0b)" },
                        { label: "Overdue", color: "var(--danger, #ef4444)" },
                        { label: "Completed", color: "var(--success, #22c55e)" },
                      ].map((item) => (
                        <span key={item.label} style={{ alignItems: "center", display: "flex", gap: 4 }}>
                          <i style={{ background: item.color, borderRadius: 2, display: "inline-block", height: 8, width: 16 }} />
                          {item.label}
                        </span>
                      ))}
                    </div>
                    {/* Header row */}
                    <div style={{ display: "flex", gap: 4, marginBottom: 6, fontSize: 11, color: "var(--muted, #8a96a7)", fontWeight: 700 }}>
                      <span style={{ minWidth: 180, maxWidth: 180 }}>Task</span>
                      <span style={{ flex: 1 }}>Timeline</span>
                    </div>
                    {/* Today marker label */}
                    <div style={{ display: "flex", gap: 4, marginBottom: 2 }}>
                      <span style={{ minWidth: 180, maxWidth: 180 }} />
                      <div style={{ flex: 1, position: "relative", height: 2 }}>
                        <span style={{ position: "absolute", left: `${todayOffsetPct}%`, transform: "translateX(-50%)", fontSize: 9, color: "#e23b3b", fontWeight: 700, whiteSpace: "nowrap", top: -12 }}>Today</span>
                      </div>
                    </div>
                    {/* Task rows */}
                    {taskSpans.map(({ task, start, spanDays }) => {
                      const offsetPct = Math.max(0, ((start.getTime() - earliest) / (latest - earliest)) * 100);
                      const widthPct = Math.min(100 - offsetPct, (spanDays / totalSpan) * 100);
                      const color = statusColor(String(task.status ?? "scheduled"));
                      const freq = String(task.frequency ?? "monthly");
                      return (
                        <div key={String(task.id)} style={{ display: "flex", gap: 4, marginBottom: 6, fontSize: 12 }}>
                          <div style={{ minWidth: 180, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 600, color: "#27364a" }}>{String(task.name ?? "—")}</span>
                            <span style={{ color: "#8a96a7", fontSize: 10, marginLeft: 6 }}>{freq}</span>
                          </div>
                          <div style={{ flex: 1, position: "relative", height: 22, background: "var(--surface-2, #f0f2f6)", borderRadius: 4 }}>
                            <div
                              style={{
                                position: "absolute",
                                left: `${offsetPct}%`,
                                width: `${Math.max(widthPct, 2)}%`,
                                height: "100%",
                                background: color,
                                borderRadius: 4,
                                opacity: 0.85,
                                display: "flex",
                                alignItems: "center",
                                paddingLeft: 6,
                              }}
                            >
                              <span style={{ color: "white", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>
                                {String(task.name ?? "").length > 20 ? String(task.name ?? "").slice(0, 20) + "…" : String(task.name ?? "")}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </article>
          )}

          {/* Upcoming tasks table */}
          <article className="data-panel">
            <div style={{ borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
              <strong style={{ fontSize: 14 }}>Upcoming PPM Tasks</strong>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {permissions.canAdminister && (
                  <button onClick={openBulkSchedule} style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, color: "#92400e", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "5px 12px" }}>
                    ▦ Bulk Schedule
                  </button>
                )}
                <button style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>View all</button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Task ID</th>
                    <th>Task Name</th>
                    <th>Asset</th>
                    <th>Building / Location</th>
                    <th>Frequency</th>
                    <th>Due Date</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr key={String(row.id)}>
                      <td><span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>{String(row.code ?? "—")}</span></td>
                      <td><strong style={{ fontSize: 12 }}>{String(row.name ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{String(row.asset_name ?? "—")}</td>
                      <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.property_name ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(row.frequency ?? "Monthly")}</td>
                      <td style={{ fontSize: 12 }}>{String(row.next_due_on ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>James Kariuki</td>
                      <td><FcStatus value="scheduled" /></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "3px 7px" }}>👁</button>
                          <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "3px 7px" }}>✏</button>
                          {permissions.canAdminister && Boolean(row.is_active) && (
                            <button onClick={() => onAction(row, "generate-work-order")} style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "3px 7px" }}>⋯</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>

      {/* Bulk annual scheduling grid modal */}
      {showBulk && (
        <Modal title="Bulk Annual Schedule" onClose={() => setShowBulk(false)} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ color: "#4b5563", fontSize: 12, margin: 0 }}>
              Set the scheduled annual maintenance date for each asset and month. Each filled cell creates one annual{" "}
              <code>PreventiveSchedule</code> via <code>/facility/planned-maintenance/</code> (backend has no bulk endpoint, so one create per asset).
            </p>
            {bulkMessage && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#15803d", fontSize: 12, padding: "8px 12px" }}>{bulkMessage}</div>}
            <div className="table-scroll" style={{ maxHeight: 420 }}>
              <table className="fc-data-table" style={{ minWidth: 1240 }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, background: "#fff", zIndex: 2, minWidth: 180 }}>Asset</th>
                    {bulkMonths.map((m) => <th key={m}>{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {bulkAssets.length > 0 ? bulkAssets.map((asset) => (
                    <tr key={String(asset.id)}>
                      <td style={{ position: "sticky", left: 0, background: "#fff", fontSize: 12, minWidth: 180 }}>
                        <strong>{String(asset.name ?? "—")}</strong>
                        <small style={{ color: "#8a96a7", display: "block", fontSize: 10 }}>{String(asset.code ?? "—")}</small>
                      </td>
                      {bulkMonths.map((m, mi) => (
                        <td key={m} style={{ padding: "6px 4px" }}>
                          <input
                            type="date"
                            value={bulkGrid[String(asset.id)]?.[mi] ?? ""}
                            onChange={(e) => setBulkDate(String(asset.id), mi, e.target.value)}
                            style={{ border: "1px solid #d7dce5", borderRadius: 6, fontSize: 11, padding: "4px 6px", width: "100%", minWidth: 120 }}
                          />
                        </td>
                      ))}
                    </tr>
                  )) : (
                    <tr><td colSpan={13}><EmptyState message="No assets available to schedule." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowBulk(false)}>Cancel</button>
              <button type="button" className="btn primary" onClick={() => void saveBulkSchedule()} disabled={bulkSaving}>
                {bulkSaving ? "Saving…" : "Save Annual Schedule"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
