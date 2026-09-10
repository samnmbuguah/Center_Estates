import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "@/components/monitoring/react-router-shim";
import {
  MapPin, Plus, Share2, Layers, FileText,
} from "lucide-react";

import {
  fetchCostDashboard,
  fetchIngestionStatus,
  fetchMilestones,
  fetchProject,
  fetchScurve,
  type CostDashboardData,
  type IngestionStatus,
  type Project,
} from "../api";
import type { SCurve } from "../shared-types";
import { useWorkspace } from "../context/WorkspaceContext";
import { money, formatDate, stageLabel, pct } from "../lib/format";
import { SimpleBarChart } from "../lib/charts";
import { PageEmpty, PageError, PageLoading, StatusPill } from "../components/PageState";

type MilestoneRow = {
  id: string;
  title?: string;
  name?: string;
  milestone_id?: string;
  percent_complete?: number;
  status?: string;
  target_date?: string | null;
  planned_date?: string | null;
};

function milestoneTitle(m: MilestoneRow): string {
  return m.title || m.name || m.milestone_id || m.id || "Milestone";
}

function milestoneStatus(m: MilestoneRow): { label: string; tone: "success" | "info" | "neutral" | "warning" } {
  const p = Number(m.percent_complete ?? 0);
  if (m.status) {
    const s = String(m.status).toLowerCase();
    if (s.includes("complete") || s === "done") return { label: stageLabel(m.status), tone: "success" };
    if (s.includes("progress") || s === "active") return { label: stageLabel(m.status), tone: "info" };
    if (s.includes("hold") || s.includes("risk")) return { label: stageLabel(m.status), tone: "warning" };
    return { label: stageLabel(m.status), tone: "neutral" };
  }
  if (p >= 100) return { label: "Completed", tone: "success" };
  if (p > 0) return { label: "In Progress", tone: "info" };
  return { label: "Pending", tone: "neutral" };
}

export function ProjectWorkspace() {
  const { projectId: paramId } = useParams();
  const { activeProjectId, selectProject } = useWorkspace();
  const navigate = useNavigate();
  const projectId = paramId || activeProjectId || "";

  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [cost, setCost] = useState<CostDashboardData | null>(null);
  const [scurve, setScurve] = useState<SCurve | null>(null);
  const [ingestion, setIngestion] = useState<IngestionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setMilestones([]);
      setCost(null);
      setScurve(null);
      setIngestion(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, ms, costData, sc, ing] = await Promise.all([
        fetchProject(projectId),
        fetchMilestones(projectId).catch(() => [] as MilestoneRow[]),
        fetchCostDashboard(projectId).catch(() => null),
        fetchScurve(projectId).catch(() => null),
        fetchIngestionStatus(projectId).catch(() => null),
      ]);
      setProject(p);
      setMilestones(Array.isArray(ms) ? ms : []);
      setCost(costData);
      setScurve(sc);
      setIngestion(ing);
    } catch (e) {
      const message = (e as Error).message || "Failed to load project workspace";
      setError(message);
      setProject(null);
      if (/404|not found|does not exist/i.test(message)) {
        selectProject("");
        navigate("/app/projects", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (projectId && projectId !== activeProjectId) {
      selectProject(projectId);
    }
  }, [projectId, activeProjectId, selectProject]);

  const averageProgress = useMemo(() => {
    if (!milestones.length) return null;
    const sum = milestones.reduce((s, m) => s + Number(m.percent_complete || 0), 0);
    return Math.round((sum / milestones.length) * 10) / 10;
  }, [milestones]);

  const nextMilestone = useMemo(
    () => milestones.find((m) => Number(m.percent_complete || 0) < 100) || null,
    [milestones],
  );

  const completedCount = milestones.filter((m) => Number(m.percent_complete || 0) >= 100).length;

  const budget = Number(cost?.budget ?? project?.budget ?? project?.approved_budget ?? 0);
  const certified = Number(cost?.certified_to_date ?? 0);
  const budgetPct = budget > 0 ? Math.round((certified / budget) * 1000) / 10 : null;

  const scurveChart = useMemo(() => {
    const series = scurve?.series ?? [];
    return series.map((pt) => ({
      label: pt?.week || "",
      planned: Number(pt?.planned_percent ?? 0),
      actual: Number(pt?.actual_percent ?? 0),
    }));
  }, [scurve]);

  if (!projectId) {
    return (
      <div style={{ padding: 20, maxWidth: 1600, margin: "0 auto" }}>
        <PageEmpty
          title="No project selected"
          description="Select a project from the portfolio or workspace switcher to open the command center."
          action={{ label: "View Projects", onClick: () => navigate("/app/projects") }}
        />
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 20 }}><PageLoading rows={5} /></div>;
  }

  if (error && !project) {
    return (
      <div style={{ padding: 20 }}>
        <PageError message={error} onRetry={load} />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 20 }}>
        <PageEmpty title="Project not found" description={`No project data for id “${projectId}”.`} />
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%" }}>
      {error && <PageError message={error} onRetry={load} />}

      <div className="card" style={{ padding: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>
                {project.code || project.id}
              </span>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
                {project.name}
              </h1>
              <StatusPill label={stageLabel(project.stage)} tone="success" />
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
              <span><MapPin size={13} style={{ marginRight: 4 }} /> {project.location || "Location not set"}</span>
              {project.project_type && (
                <>
                  <span>•</span>
                  <span>{String(project.project_type).replace(/_/g, " ")}</span>
                </>
              )}
              {project.client_name && (
                <>
                  <span>•</span>
                  <span>Client: <strong style={{ color: "var(--text)" }}>{project.client_name}</strong></span>
                </>
              )}
            </div>
            {(project.modules?.length ?? 0) > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {project.modules.map((m) => (
                  <span
                    key={m}
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Layers size={10} /> {m}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontWeight: 700, minWidth: 142, justifyContent: "center", whiteSpace: "nowrap" }} onClick={() => navigate("/app/reports")}>
              <Share2 size={15} style={{ marginRight: 4 }} /> Share / Reports
            </button>
            <button className="btn btn-primary" style={{ background: "var(--color-danger)", borderColor: "var(--color-danger)" }} onClick={() => navigate("/app/daily-logs")}>
              <Plus size={15} style={{ marginRight: 4 }} /> New Log
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Overall Physical Progress</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-brand-blue)", fontFamily: "IBM Plex Mono, monospace", margin: "2px 0" }}>
              {averageProgress != null ? pct(averageProgress) : "—"}
            </div>
            {averageProgress != null ? (
              <div style={{ width: "100%", height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, averageProgress)}%`, height: "100%", background: "var(--color-brand-blue)" }} />
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {milestones.length === 0 ? "No milestones yet" : "—"}
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              {milestones.length ? `${completedCount} of ${milestones.length} milestones complete` : "Upload a work plan to generate milestones"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Stage / Schedule</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "2px 0" }}>
              {stageLabel(project.stage)}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Target: {formatDate(project.planned_completion_date)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Budget Expenditure</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", fontFamily: "IBM Plex Mono, monospace", margin: "2px 0" }}>
              {budgetPct != null ? `${budgetPct}% certified` : "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {budget > 0 || certified > 0
                ? `${money(certified)} of ${money(budget)}`
                : "No budget figures from API"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Next Milestone</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-brand-blue)", margin: "2px 0" }}>
              {nextMilestone ? milestoneTitle(nextMilestone) : milestones.length ? "All complete" : "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {nextMilestone
                ? `${Number(nextMilestone.percent_complete || 0)}% · ${formatDate(nextMilestone.target_date || nextMilestone.planned_date)}`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(260px, 360px)", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ padding: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>PROGRESS OVER TIME (S-Curve)</h3>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Planned vs actual from reports API
                </div>
              </div>
              <Link to={`/app/projects/${projectId}/milestones`} style={{ fontSize: 12, color: "var(--color-brand-blue)" }}>
                Programme →
              </Link>
            </div>

            {scurveChart.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                No S-curve series available for this project yet.
              </div>
            ) : (
              <div style={{ height: 240 }}>
                <SimpleBarChart
                  data={scurveChart}
                  bars={[
                    { key: "planned", color: "var(--steel, var(--color-slate-400))" },
                    { key: "actual", color: "var(--color-brand-blue)" },
                  ]}
                  height={240}
                />
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              PROJECT DATA SOURCES
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, fontSize: 12 }}>
              <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>BoQ Items</div>
                <strong style={{ color: "var(--text)", fontSize: 18 }}>
                  {ingestion ? (ingestion.boq_item_count ?? ingestion.boq_items?.length ?? 0) : "—"}
                </strong>
              </div>
              <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Work Plan Tasks</div>
                <strong style={{ color: "var(--text)", fontSize: 18 }}>
                  {ingestion ? (ingestion.work_plan_task_count ?? ingestion.work_plan_tasks?.length ?? 0) : "—"}
                </strong>
              </div>
              <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Milestones Generated</div>
                <strong style={{ color: ingestion?.milestones_generated ? "var(--color-emerald)" : "var(--muted)", fontSize: 18 }}>
                  {ingestion ? (ingestion.milestones_generated || milestones.length > 0 ? "Yes" : "No") : "—"}
                </strong>
              </div>
              <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Documents</div>
                <strong style={{ color: "var(--text)", fontSize: 18 }}>
                  {project.documents?.length ?? "—"}
                </strong>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Link to={`/app/projects/${projectId}/ingestion`} className="btn ghost sm">
                <FileText size={14} style={{ marginRight: 4 }} /> Open Ingestion
              </Link>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              MILESTONES TIMELINE
            </h4>
            <Link to={`/app/projects/${projectId}/milestones`} style={{ fontSize: 12, color: "var(--color-brand-blue)" }}>
              View all
            </Link>
          </div>

          {milestones.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>
              No milestones yet. Generate them from a work plan on the ingestion page.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {milestones.slice(0, 12).map((m) => {
                const st = milestoneStatus(m);
                const progress = Number(m.percent_complete || 0);
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "var(--surface-2)",
                      padding: "10px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{milestoneTitle(m)}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                        {progress}% complete
                        {(m.target_date || m.planned_date) ? ` · ${formatDate(m.target_date || m.planned_date)}` : ""}
                      </div>
                      <div style={{ width: "100%", height: 3, background: "var(--surface-3)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, progress)}%`, height: "100%", background: st.tone === "success" ? "var(--color-emerald)" : "var(--color-brand-blue)" }} />
                      </div>
                    </div>
                    <StatusPill label={st.label} tone={st.tone} />
                  </div>
                );
              })}
              {milestones.length > 12 && (
                <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                  +{milestones.length - 12} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
