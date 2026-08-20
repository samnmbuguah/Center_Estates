import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@/components/monitoring/react-router-shim";
import {
  Building2, AlertTriangle, FileText, Plus, Camera, CalendarDays,
  CheckCircle2, ArrowRight, FolderOpen, CircleDollarSign, ClipboardList,
  MapPin, Wallet, TrendingUp, Users, Activity,
} from "lucide-react";
import { useAuth } from "../auth";
import {
  fetchDashboard, fetchProjects, fetchRisks, fetchDrawdownRequests,
  fetchCalendarEvents, fetchAuditLogs, type CalendarEvent, type DrawdownRequest,
} from "../api";
import type { Project } from "../api-types";
import { money, formatDate, formatDateTime, stageLabel, riskLevel } from "../lib/format";
import { KpiCard } from "../components/KpiCard";
import { PageLoading, PageError, StatusPill } from "../components/PageState";
import { Box, Grid, Typography } from "@mui/material";

type DashData = {
  projects: { total: number; by_stage: Record<string, number> };
  tickets_open: number;
  risks?: { open: number; high: number };
  drawdowns?: { pending: number; pending_amount: number };
  site_visits_due?: number;
  budget?: { total: number; spent: number; utilization_pct: number };
  finance?: { requisitions_pending: number; certificates: number; disbursements_pending: number };
  recent_activity?: { action: string; resource: string; user: string; details: string; timestamp: number }[];
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const STAGE_COLORS: Record<string, string> = {
  planning: "#3b82f6",
  active: "#f59e0b",
  on_hold: "#94a3b8",
  review_required: "#8b5cf6",
  complete: "#06b6d4",
  closed: "#10b981",
  construction: "#f59e0b",
};

export function Dashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const firstName = me?.username?.split(/[.@_\s]/)[0] || me?.username || "there";
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dash, setDash] = useState<DashData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [drawdowns, setDrawdowns] = useState<DrawdownRequest[]>([]);
  const [visits, setVisits] = useState<CalendarEvent[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      const [d, projs, riskRows, ddRows, events] = await Promise.all([
        fetchDashboard() as Promise<DashData>,
        fetchProjects(),
        fetchRisks().catch(() => [] as any[]),
        fetchDrawdownRequests().catch(() => [] as DrawdownRequest[]),
        fetchCalendarEvents({ start: now }).catch(() => [] as CalendarEvent[]),
      ]);
      setDash(d);
      setProjects(projs);
      setRisks(Array.isArray(riskRows) ? riskRows : []);
      setDrawdowns(Array.isArray(ddRows) ? ddRows.filter((x) => !["disbursed", "rejected"].includes(x.status)) : []);
      setVisits((Array.isArray(events) ? events : []).filter((e) => e.event_type === "site_visit" || e.event_type === "meeting").slice(0, 5));

      // Prefer dashboard recent_activity; fall back to audit logs if permitted
      if (d.recent_activity?.length) {
        setActivity(d.recent_activity);
      } else {
        try {
          const logs = await fetchAuditLogs({ limit: 8 });
          setActivity((logs.results || []).map((e: any) => ({
            action: e.action,
            resource: e.resource,
            user: e.user,
            details: e.details,
            timestamp: e.timestamp,
          })));
        } catch {
          setActivity([]);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byStage = dash?.projects?.by_stage || {};
  const totalProjects = dash?.projects?.total ?? projects.length;
  const activeCount = byStage.active ?? projects.filter((p) => p.stage === "active").length;
  const risksOpen = dash?.risks?.open ?? risks.filter((r) => r.status === "open" || r.status === "Open").length;
  const risksHigh = dash?.risks?.high ?? risks.filter((r) => Number(r.current ?? r.inherent ?? 0) >= 15).length;
  const ddPending = dash?.drawdowns?.pending ?? drawdowns.length;
  const ddAmount = dash?.drawdowns?.pending_amount ?? drawdowns.reduce((s, d) => s + Number(d.amount || 0), 0);
  const visitsDue = dash?.site_visits_due ?? visits.length;
  const budgetTotal = dash?.budget?.total ?? projects.reduce((s, p) => s + Number(p.budget || p.tender_amount || 0), 0);
  const budgetSpent = dash?.budget?.spent ?? 0;
  const utilPct = dash?.budget?.utilization_pct ?? (budgetTotal > 0 ? Math.round((budgetSpent / budgetTotal) * 1000) / 10 : 0);

  const progressBreakdown = useMemo(() => {
    const entries = Object.entries(byStage);
    if (!entries.length && projects.length) {
      const map: Record<string, number> = {};
      projects.forEach((p) => { map[p.stage || "unknown"] = (map[p.stage || "unknown"] || 0) + 1; });
      return Object.entries(map).map(([label, count]) => ({
        label: stageLabel(label),
        count,
        pct: totalProjects ? Math.round((count / totalProjects) * 100) : 0,
        color: STAGE_COLORS[label] || "#94a3b8",
        key: label,
      }));
    }
    return entries.map(([label, count]) => ({
      label: stageLabel(label),
      count,
      pct: totalProjects ? Math.round((count / totalProjects) * 100) : 0,
      color: STAGE_COLORS[label] || "#94a3b8",
      key: label,
    }));
  }, [byStage, projects, totalProjects]);

  const topRisks = useMemo(() => {
    return [...risks]
      .filter((r) => (r.status || "").toLowerCase() !== "closed")
      .sort((a, b) => Number(b.current ?? b.inherent ?? 0) - Number(a.current ?? a.inherent ?? 0))
      .slice(0, 5)
      .map((r) => {
        const score = Number(r.current ?? r.inherent ?? (r.likelihood || 0) * (r.impact || 0));
        const lvl = riskLevel(score);
        const proj = projects.find((p) => p.id === r.project_id);
        return {
          level: lvl.level,
          label: r.description || r.desc || r.reference || "Risk",
          project: proj?.name || r.project_id || "—",
          date: r.next_review || "—",
          color: lvl.color,
          bg: lvl.bg,
        };
      });
  }, [risks, projects]);

  const lifecycleStages = useMemo(() => {
    const planning = byStage.planning || 0;
    const active = byStage.active || 0;
    const hold = byStage.on_hold || 0;
    const review = byStage.review_required || 0;
    const complete = byStage.complete || 0;
    const closed = byStage.closed || 0;
    return [
      { label: "Planning /\nPre-Construction", count: planning, active: planning > 0 && active === 0, path: "/app/pre-construction" },
      { label: "Approvals", count: review, active: false, path: "/app/approvals" },
      { label: "Construction", count: active, active: active > 0, path: "/app/timeline" },
      { label: "On Hold", count: hold, active: false, path: "/app/projects" },
      { label: "Complete", count: complete, active: false, path: "/app/projects" },
      { label: "Closed", count: closed, active: false, path: "/app/projects" },
    ];
  }, [byStage]);

  const quickActions = [
    { icon: Plus, label: "Onboard Project", path: "/app/onboarding", color: "#e53e3e" },
    { icon: Camera, label: "Site Visits", path: "/app/site-visits", color: "#3b82f6" },
    { icon: AlertTriangle, label: "Raise Risk", path: "/app/issues", color: "#f59e0b" },
    { icon: CircleDollarSign, label: "Drawdowns", path: "/app/drawdown-requests", color: "#10b981" },
    { icon: CalendarDays, label: "Schedule Meeting", path: "/app/calendar", color: "#8b5cf6" },
    { icon: FileText, label: "Generate Report", path: "/app/reports", color: "#06b6d4" },
    { icon: FolderOpen, label: "Documents", path: "/app/project-documents", color: "#f97316" },
    { icon: ClipboardList, label: "Daily Logs", path: "/app/daily-logs", color: "#10b981" },
  ];

  if (loading) return <PageLoading rows={3} />;
  if (error) return <PageError message={error} onRetry={load} />;

  const conic = progressBreakdown.length
    ? (() => {
        let acc = 0;
        const parts = progressBreakdown.map((b) => {
          const start = acc;
          acc += b.pct;
          return `${b.color} ${start}% ${acc}%`;
        });
        if (acc < 100) parts.push(`var(--surface-3) ${acc}% 100%`);
        return `conic-gradient(${parts.join(", ")})`;
      })()
    : "conic-gradient(var(--surface-3) 0% 100%)";

  return (
    <div style={{ display: "flex", gap: 0, minHeight: "100%" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
            Construction Monitoring Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
            Live portfolio overview — project progress, risks, and site operations.
          </Typography>
        </Box>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
              {greeting()}, {firstName}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Live portfolio overview — figures come from the API only.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", fontSize: 13, color: "var(--muted)" }}>
              <Building2 size={14} /> All Projects
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", fontSize: 13, color: "var(--muted)" }}>
              <CalendarDays size={14} /> {today}
            </div>
          </div>
        </div>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#fee2e2", color: "#dc2626",
              textAlign: "center"
            }}>
              <Building2 size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{activeCount}</Typography>
              <Typography variant="caption">Active Projects</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#fef3c7", color: "#d97706",
              textAlign: "center"
            }}>
              <Camera size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{visitsDue}</Typography>
              <Typography variant="caption">Site Visits Due</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#dcfce7", color: "#059669",
              textAlign: "center"
            }}>
              <Wallet size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{ddPending}</Typography>
              <Typography variant="caption">Drawdowns Pending</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#fee2e2", color: "#dc2626",
              textAlign: "center"
            }}>
              <AlertTriangle size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{risksOpen}</Typography>
              <Typography variant="caption">Risks Open</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#ede9fe", color: "#7c3aed",
              textAlign: "center"
            }}>
              <ClipboardList size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{dash?.tickets_open ?? 0}</Typography>
              <Typography variant="caption">Open Tickets</Typography>
            </Box>
          </Grid>
        </Grid>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 16 }}>
              Project Progress Overview
            </div>
            {totalProjects === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No projects yet. Onboard your first project to see stage distribution.</p>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 90, height: 90, borderRadius: "50%", flexShrink: 0, background: conic, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{totalProjects}</div>
                    <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 600 }}>Total</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {progressBreakdown.map((b) => (
                    <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, flex: 1, color: "var(--muted)" }}>{b.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{b.count}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>({b.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Link to="/app/projects" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#e53e3e", fontWeight: 700, marginTop: 12, textDecoration: "none" }}>
              View all projects <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 12 }}>
              Budget Utilization
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Portfolio Budget</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{money(budgetTotal)}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>Utilized (paid / certified)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981", marginBottom: 12 }}>{money(budgetSpent)}</div>
            <div style={{ position: "relative", height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: `conic-gradient(#e53e3e 0% ${Math.min(utilPct, 100)}%, var(--surface-3) ${Math.min(utilPct, 100)}% 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{utilPct}%</div>
                  <div style={{ fontSize: 9, color: "var(--muted)" }}>Utilized</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>Top Risks</span>
              <Link to="/app/issues" style={{ fontSize: 12, color: "#e53e3e", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>View all <ArrowRight size={11} /></Link>
            </div>
            {topRisks.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>No open risks in the register.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {topRisks.map((r, i) => (
                  <Link key={i} to="/app/issues" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: r.bg, color: r.color, flexShrink: 0 }}>{r.level}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.project}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>Upcoming Visits & Meetings</span>
              <Link to="/app/calendar" style={{ fontSize: 12, color: "#e53e3e", fontWeight: 700, textDecoration: "none" }}>Calendar</Link>
            </div>
            {visits.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>No upcoming calendar events.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visits.map((v) => {
                  const proj = projects.find((p) => p.id === v.project_id);
                  return (
                    <div key={v.id} style={{ display: "flex", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(0,163,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <MapPin size={16} style={{ color: "var(--primary)" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{v.title}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{proj?.name || v.location || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{formatDateTime(v.start)}</div>
                      </div>
                      <StatusPill label={v.status || "Scheduled"} tone="info" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>Drawdowns Pending</span>
              <Link to="/app/drawdown-requests" style={{ fontSize: 12, color: "#e53e3e", fontWeight: 700, textDecoration: "none" }}>View all</Link>
            </div>
            {drawdowns.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>No pending drawdown requests.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {drawdowns.slice(0, 5).map((d) => {
                  const proj = projects.find((p) => p.id === d.project_id);
                  return (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, background: "var(--surface-2)", cursor: "pointer" }}
                      onClick={() => navigate("/app/drawdown-requests")}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{proj?.name || d.project_id || "Project"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{d.request_number}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{money(d.amount)}</div>
                        <StatusPill label={d.status.replaceAll("_", " ")} tone="warning" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>Recent Activity</span>
              <Link to="/app/audit-log" style={{ fontSize: 12, color: "#e53e3e", fontWeight: 700, textDecoration: "none" }}>Audit trail</Link>
            </div>
            {activity.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>No recent audit activity.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activity.slice(0, 5).map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <CheckCircle2 size={14} style={{ color: "#10b981" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{a.action}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{a.details || a.resource || a.user}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{formatDateTime(a.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 16 }}>
            Project Lifecycle Stages
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
            {lifecycleStages.map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 80 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                  <Link to={s.path} style={{ textDecoration: "none" }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: s.active ? "linear-gradient(135deg,#e53e3e,#c53030)" : "var(--surface-2)",
                      border: s.active ? "none" : "2px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: s.active ? "0 4px 16px rgba(229,62,62,0.4)" : "none",
                    }}>
                      <Building2 size={16} style={{ color: s.active ? "#fff" : "var(--muted)" }} />
                    </div>
                  </Link>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: s.active ? "#e53e3e" : "var(--text)", whiteSpace: "pre-line", lineHeight: 1.2 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{s.count} Projects</div>
                  </div>
                </div>
                {i < lifecycleStages.length - 1 && (
                  <div style={{ width: 24, height: 2, background: s.count > 0 ? "#e53e3e" : "var(--border)", flexShrink: 0, marginBottom: 24 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ width: 220, flexShrink: 0, marginLeft: 20 }} className="dashboard-quick-actions">
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 12 }}>Quick Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <button key={qa.label} onClick={() => navigate(qa.path)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 10px",
                  borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)",
                  color: "var(--text)", fontSize: 13, fontWeight: 500, cursor: "pointer",
                  textAlign: "left", width: "100%",
                }}>
                  <Icon size={15} style={{ color: qa.color, flexShrink: 0 }} />
                  {qa.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{
          borderRadius: 12, overflow: "hidden",
          background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
          border: "1px solid var(--border)", padding: "20px 16px 16px", minHeight: 120,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.4 }}>
            Construction Monitoring<br />
            <span style={{ color: "#f59e0b" }}>made simple,</span>{" "}
            <span style={{ color: "#10b981" }}>transparent</span><br />
            and <span style={{ color: "#e53e3e" }}>accountable.</span>
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
            Real Estate Solutions — Center Estates
          </div>
        </div>
      </div>
    </div>
  );
}
