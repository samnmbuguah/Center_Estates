"use client";

import { useMemo, useState } from "react";

export interface TaskItem {
  id: string;
  wbs: string;
  name: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  progressPct: number;
  baselinePct: number;
  status: "completed" | "in_progress" | "delayed" | "not_started";
  responsible: string;
  criticalPath?: boolean;
}

interface TimelineViewerProps {
  projectName?: string;
  tasks?: TaskItem[];
}

const DEFAULT_TASKS: TaskItem[] = [
  { id: "t1", wbs: "1.0", name: "Site Mobilization & Fencing", startDate: "2026-01-05", endDate: "2026-01-25", durationDays: 20, progressPct: 100, baselinePct: 100, status: "completed", responsible: "Lead Contractor", criticalPath: true },
  { id: "t2", wbs: "1.1", name: "Excavation & Bulk Earthworks", startDate: "2026-01-20", endDate: "2026-02-28", durationDays: 39, progressPct: 100, baselinePct: 100, status: "completed", responsible: "Civil Subcontractor", criticalPath: true },
  { id: "t3", wbs: "1.2", name: "Substructure & Foundation Concrete", startDate: "2026-02-15", endDate: "2026-04-10", durationDays: 54, progressPct: 92, baselinePct: 95, status: "in_progress", responsible: "Structural Eng", criticalPath: true },
  { id: "t4", wbs: "2.0", name: "Superstructure Reinforced Concrete Frame", startDate: "2026-04-01", endDate: "2026-07-31", durationDays: 121, progressPct: 68, baselinePct: 75, status: "in_progress", responsible: "Main Contractor", criticalPath: true },
  { id: "t5", wbs: "2.1", name: "External Masonry & Blockwork", startDate: "2026-05-15", endDate: "2026-08-30", durationDays: 107, progressPct: 45, baselinePct: 60, status: "delayed", responsible: "Masonry Team", criticalPath: false },
  { id: "t6", wbs: "3.0", name: "MEP Rough-in & Conduit Installation", startDate: "2026-06-01", endDate: "2026-09-15", durationDays: 106, progressPct: 30, baselinePct: 40, status: "in_progress", responsible: "MEP Subcontractor", criticalPath: false },
  { id: "t7", wbs: "4.0", name: "Finishes, Tiling & Painting", startDate: "2026-08-15", endDate: "2026-11-30", durationDays: 107, progressPct: 0, baselinePct: 10, status: "not_started", responsible: "Finishing Subcontractor", criticalPath: true },
];

export function TimelineViewer({ projectName = "Active Construction Project", tasks = DEFAULT_TASKS }: TimelineViewerProps) {
  const [activeTab, setActiveTab] = useState<"gantt" | "scurve">("gantt");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (showCriticalOnly && !t.criticalPath) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      return true;
    });
  }, [tasks, filterStatus, showCriticalOnly]);

  // Overall S-Curve Points Generation
  const scurvePoints = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const planned = [5, 12, 22, 35, 48, 62, 75, 85, 92, 97, 99, 100];
    const actual = [5, 12, 20, 32, 44, 56, 68, null, null, null, null, null]; // Actual up to current month (Jul)
    return { months, planned, actual };
  }, []);

  return (
    <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      {/* Controls & Mode Selection */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>📊 Programme & Gantt Schedule</h3>
          <small style={{ color: "#64748b" }}>{projectName} — Baseline vs Actual progress tracking</small>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "#f1f5f9", padding: 3, borderRadius: 8, border: "1px solid #cbd5e1" }}>
            <button
              onClick={() => setActiveTab("gantt")}
              style={{
                background: activeTab === "gantt" ? "#2563eb" : "transparent",
                color: activeTab === "gantt" ? "#ffffff" : "#475569",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Gantt View
            </button>
            <button
              onClick={() => setActiveTab("scurve")}
              style={{
                background: activeTab === "scurve" ? "#2563eb" : "transparent",
                color: activeTab === "scurve" ? "#ffffff" : "#475569",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              S-Curve Graph
            </button>
          </div>

          {activeTab === "gantt" && (
            <>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "#fff" }}
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="delayed">Delayed</option>
                <option value="not_started">Not Started</option>
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "#dc2626", fontWeight: 600, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={showCriticalOnly}
                  onChange={(e) => setShowCriticalOnly(e.target.checked)}
                />
                Critical Path Only
              </label>
            </>
          )}
        </div>
      </div>

      {activeTab === "gantt" ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 10, textAlign: "left", width: 60 }}>WBS</th>
                <th style={{ padding: 10, textAlign: "left" }}>Task Name</th>
                <th style={{ padding: 10, textAlign: "left", width: 100 }}>Start</th>
                <th style={{ padding: 10, textAlign: "left", width: 100 }}>Finish</th>
                <th style={{ padding: 10, textAlign: "center", width: 80 }}>Days</th>
                <th style={{ padding: 10, textAlign: "center", width: 120 }}>Progress</th>
                <th style={{ padding: 10, textAlign: "left", width: 280 }}>Gantt Progress Bar</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9", background: t.criticalPath ? "#fff5f5" : "#ffffff" }}>
                  <td style={{ padding: 10, fontFamily: "monospace", fontWeight: "bold" }}>{t.wbs}</td>
                  <td style={{ padding: 10 }}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{t.name}</div>
                    <small style={{ color: "#64748b" }}>Owner: {t.responsible}</small>
                  </td>
                  <td style={{ padding: 10, color: "#475569" }}>{t.startDate}</td>
                  <td style={{ padding: 10, color: "#475569" }}>{t.endDate}</td>
                  <td style={{ padding: 10, textAlign: "center", fontWeight: "bold" }}>{t.durationDays}d</td>
                  <td style={{ padding: 10, textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        background: t.status === "completed" ? "#dcfce7" : t.status === "delayed" ? "#fee2e2" : "#dbeafe",
                        color: t.status === "completed" ? "#166534" : t.status === "delayed" ? "#991b1b" : "#1e40af",
                      }}
                    >
                      {t.progressPct}% ({t.status.replace("_", " ")})
                    </span>
                  </td>
                  <td style={{ padding: 10 }}>
                    {/* Visual Gantt Bar */}
                    <div style={{ position: "relative", height: 22, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                      {/* Baseline Ghost Bar */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          width: `${t.baselinePct}%`,
                          height: "100%",
                          background: "#cbd5e1",
                          opacity: 0.5,
                        }}
                        title={`Baseline Planned: ${t.baselinePct}%`}
                      />
                      {/* Actual Progress Bar */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          width: `${t.progressPct}%`,
                          height: "100%",
                          background: t.status === "completed" ? "#22c55e" : t.status === "delayed" ? "#ef4444" : "#3b82f6",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* S-Curve SVG Chart */
        <div style={{ padding: 10 }}>
          <div style={{ display: "flex", gap: 20, marginBottom: 10, fontSize: "0.85rem", justifyContent: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i style={{ width: 14, height: 4, background: "#2563eb", borderRadius: 2 }} />
              <strong>Planned Baseline Curve (S-Curve)</strong>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i style={{ width: 14, height: 4, background: "#16a34a", borderRadius: 2 }} />
              <strong>Actual Progress Curve (Earned)</strong>
            </span>
          </div>

          <svg viewBox="0 0 700 280" style={{ width: "100%", height: 280, background: "#fafafa", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((val, idx) => {
              const y = 240 - (val / 100) * 200;
              return (
                <g key={val}>
                  <line x1="50" y1={y} x2="670" y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <text x="35" y={y + 4} fontSize="11" fill="#64748b" textAnchor="end">{val}%</text>
                </g>
              );
            })}

            {/* Months labels */}
            {scurvePoints.months.map((m, idx) => {
              const x = 50 + idx * 56;
              return (
                <text key={m} x={x} y="260" fontSize="11" fill="#64748b" textAnchor="middle">{m}</text>
              );
            })}

            {/* Planned S-Curve Path */}
            <path
              d={scurvePoints.planned.map((val, idx) => {
                const x = 50 + idx * 56;
                const y = 240 - (val / 100) * 200;
                return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
              }).join(" ")}
              fill="none"
              stroke="#2563eb"
              strokeWidth="3"
            />

            {/* Actual S-Curve Path */}
            <path
              d={scurvePoints.actual
                .filter((v): v is number => v !== null)
                .map((val, idx) => {
                  const x = 50 + idx * 56;
                  const y = 240 - (val / 100) * 200;
                  return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                }).join(" ")}
              fill="none"
              stroke="#16a34a"
              strokeWidth="3.5"
            />

            {/* Actual Points Dots */}
            {scurvePoints.actual.map((val, idx) => {
              if (val === null) return null;
              const x = 50 + idx * 56;
              const y = 240 - (val / 100) * 200;
              return (
                <circle key={idx} cx={x} cy={y} r="5" fill="#16a34a" stroke="#ffffff" strokeWidth="2" />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
