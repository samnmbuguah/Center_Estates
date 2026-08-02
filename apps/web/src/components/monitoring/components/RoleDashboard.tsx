import { AlertTriangle, BarChart3, BookOpen, Boxes, Building2, Camera, CheckCircle, ClipboardList, FileText, HardHat, LayoutDashboard, List, MapPin, ShieldCheck, TrendingUp, TrendingDown, Users, Wallet, Zap } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "@/components/monitoring/react-router-shim";

import { fetchDashboard, fetchCompliance, fetchIssues, fetchProjects, getToken } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "./ErrorBanner";
import type { TourAPI } from "../components/tour";
import { Skeleton } from "./Skeleton";

type Layout = "overview" | "compliance" | "issues" | "finance" | "team";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface RoleDashboardConfig {
  title: string;
  layouts: { key: Layout; label: string; icon: ComponentType<LucideProps> }[];
  stats: (data: any, can: (perm: string) => boolean) => Array<{ label: string; value: number | string; icon: ReactNode; to?: string; perm?: string }>;
  quickActions?: (can: (perm: string) => boolean) => Array<{ label: string; to: string; icon: ComponentType<LucideProps>; perm?: string }>;
}

const ROLE_CONFIGS: Record<string, RoleDashboardConfig> = {
  clerk_of_works: {
    title: "Site Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "compliance", label: "Daily Logs", icon: ClipboardList },
      { key: "issues", label: "Issues", icon: AlertTriangle },
    ],
    stats: (data, can) => [
      { label: "My projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Today's tasks", value: data?.milestones_due_today ?? 0, icon: <CheckCircle size={22} />, to: "/app/site-records", perm: "site.reporting.view" },
      { label: "Open tickets", value: data?.tickets_open ?? 0, icon: <span style={{color:"var(--danger)"}}>{String(data?.tickets_open ?? 0)}</span>, to: "/app/tickets", perm: "site.reporting.view" },
      { label: "Missing logs", value: data?.missing_logs ?? 0, icon: <AlertTriangle size={22} />, to: "/app/daily-logs", perm: "site.reporting.daily.manage" },
      { label: "Photos today", value: data?.evidence_today ?? 0, icon: <Camera size={22} /> },
    ],
    quickActions: (can) => [
      { label: "Add Daily Log", to: "/app/daily-logs", icon: ClipboardList, perm: "site.reporting.daily.manage" },
      { label: "Report Issue", to: "/app/tickets", icon: AlertTriangle, perm: "site.reporting.tickets.manage" },
      { label: "Upload Photo", to: "/app/site-records", icon: Camera, perm: "documents.upload" },
    ],
  },
  project_manager: {
    title: "Project Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "compliance", label: "Compliance", icon: BarChart3 },
      { key: "issues", label: "Issues", icon: List },
      { key: "team", label: "Team", icon: Users },
    ],
    stats: (data, can) => [
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "On track", value: data?.projects_on_track ?? 0, icon: <CheckCircle size={22} /> },
      { label: "At risk", value: data?.projects_at_risk ?? 0, icon: <AlertTriangle size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Pending verification", value: data?.pending_verifications ?? 0, icon: <ShieldCheck size={22} />, to: "/app/verifications", perm: "site.reporting.milestone.verify" },
      { label: "Open tickets", value: data?.tickets_open ?? 0, icon: <span style={{color:"var(--danger)"}}>{String(data?.tickets_open ?? 0)}</span>, to: "/app/tickets", perm: "site.reporting.view" },
    ],
    quickActions: (can) => [
      { label: "New Project", to: "/app/onboarding", icon: Building2, perm: "projects.create" },
      { label: "Verify Progress", to: "/app/verifications", icon: ShieldCheck, perm: "site.reporting.milestone.verify" },
      { label: "View Reports", to: "/app/reports", icon: FileText, perm: "site.reporting.view" },
    ],
  },
  qs: {
    title: "Cost Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "finance", label: "Finance", icon: BarChart3 },
      { key: "compliance", label: "Compliance", icon: ClipboardList },
    ],
    stats: (data, can) => [
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Requisitions pending", value: data?.finance?.requisitions_pending ?? 0, icon: <Wallet size={22} />, to: "/app/finance", perm: "finance.view" },
      { label: "Certificates issued", value: data?.finance?.certificates ?? 0, icon: <CheckCircle size={22} />, to: "/app/finance", perm: "finance.view" },
      { label: "Variations pending", value: data?.variations_pending ?? 0, icon: <AlertTriangle size={22} />, to: "/app/projects", perm: "projects.edit" },
    ],
    quickActions: (can) => [
      { label: "Review Requisitions", to: "/app/finance", icon: BarChart3, perm: "finance.requisition.review" },
      { label: "Issue Certificate", to: "/app/finance", icon: CheckCircle, perm: "finance.certificate.issue" },
      { label: "Cost Dashboard", to: "/app/projects", icon: TrendingUp, perm: "finance.view" },
    ],
  },
  financier: {
    title: "Financier Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "finance", label: "Finance", icon: BarChart3 },
      { key: "compliance", label: "Risk", icon: AlertTriangle },
    ],
    stats: (data, can) => [
      { label: "Funded projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Total facility", value: data?.finance?.total_facility ?? "KES 0", icon: <Wallet size={22} /> },
      { label: "Amount drawn", value: data?.finance?.amount_drawn ?? "KES 0", icon: <Wallet size={22} /> },
      { label: "Certificates pending", value: data?.finance?.certificates_pending ?? 0, icon: <FileText size={22} />, to: "/app/finance", perm: "finance.view" },
    ],
    quickActions: (can) => [
      { label: "Finance Reports", to: "/app/finance", icon: FileText, perm: "finance.view" },
      { label: "View Projects", to: "/app/projects", icon: Building2, perm: "projects.view" },
    ],
  },
  admin: {
    title: "Admin Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "team", label: "Users", icon: Users },
      { key: "compliance", label: "System", icon: BarChart3 },
    ],
    stats: (data, can) => [
      { label: "Total users", value: data?.users?.total ?? 0, icon: <Users size={22} />, to: "/app/users", perm: "users.view" },
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Open tickets", value: data?.tickets_open ?? 0, icon: <span style={{color:"var(--danger)"}}>{String(data?.tickets_open ?? 0)}</span>, to: "/app/tickets", perm: "site.reporting.view" },
      { label: "System alerts", value: data?.alerts ?? 0, icon: <AlertTriangle size={22} /> },
    ],
    quickActions: (can) => [
      { label: "Manage Users", to: "/app/users", icon: Users, perm: "users.view" },
      { label: "Manage Roles", to: "/app/roles", icon: ShieldCheck, perm: "roles.manage" },
      { label: "System Settings", to: "/app/settings", icon: BarChart3, perm: "settings.manage" },
      { label: "Audit Log", to: "/app/audit-log", icon: FileText, perm: "audit.view" },
    ],
  },
  structural_engineer: {
    title: "Engineer Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "compliance", label: "Compliance", icon: ClipboardList },
      { key: "issues", label: "Issues", icon: AlertTriangle },
    ],
    stats: (data, can) => [
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Pending verifications", value: data?.pending_verifications ?? 0, icon: <ShieldCheck size={22} />, to: "/app/verifications", perm: "site.reporting.milestone.verify" },
      { label: "Open tickets", value: data?.tickets_open ?? 0, icon: <AlertTriangle size={22} />, to: "/app/tickets", perm: "site.reporting.view" },
    ],
    quickActions: (can) => [
      { label: "Verify Progress", to: "/app/verifications", icon: ShieldCheck, perm: "site.reporting.milestone.verify" },
      { label: "View Reports", to: "/app/reports", icon: FileText, perm: "site.reporting.view" },
    ],
  },
  mep_engineer: {
    title: "MEP Engineer Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "issues", label: "Issues", icon: AlertTriangle },
    ],
    stats: (data, can) => [
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Pending verifications", value: data?.pending_verifications ?? 0, icon: <ShieldCheck size={22} />, to: "/app/verifications", perm: "site.reporting.milestone.verify" },
    ],
    quickActions: (can) => [
      { label: "Verify Progress", to: "/app/verifications", icon: ShieldCheck, perm: "site.reporting.milestone.verify" },
    ],
  },
  architect: {
    title: "Architect Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "issues", label: "Issues", icon: AlertTriangle },
    ],
    stats: (data, can) => [
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Pending verifications", value: data?.pending_verifications ?? 0, icon: <ShieldCheck size={22} />, to: "/app/verifications", perm: "site.reporting.milestone.verify" },
    ],
    quickActions: (can) => [
      { label: "Verify Progress", to: "/app/verifications", icon: ShieldCheck, perm: "site.reporting.milestone.verify" },
      { label: "Upload Documents", to: "/app/projects", icon: FileText, perm: "documents.upload" },
    ],
  },
  contractor: {
    title: "Contractor Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "compliance", label: "Compliance", icon: ClipboardList },
    ],
    stats: (data, can) => [
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Open tickets", value: data?.tickets_open ?? 0, icon: <AlertTriangle size={22} />, to: "/app/tickets", perm: "site.reporting.view" },
    ],
  },
  sub_contractor: {
    title: "Sub Contractor Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
    ],
    stats: (data, can) => [
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
    ],
  },
  client: {
    title: "Client Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "compliance", label: "Reports", icon: FileText },
    ],
    stats: (data, can) => [
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Open tickets", value: data?.tickets_open ?? 0, icon: <AlertTriangle size={22} />, to: "/app/tickets", perm: "site.reporting.view" },
    ],
  },
  buyer: {
    title: "Buyer Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
    ],
    stats: (data, can) => [
      { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Stock items", value: data?.store?.items ?? 0, icon: <Boxes size={22} />, to: "/app/store", perm: "store.view" },
    ],
  },
  auditor: {
    title: "Auditor Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
    ],
    stats: (data, can) => [
      { label: "Projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
      { label: "Audit trail", value: "—", icon: <ShieldCheck size={22} />, to: "/app/audit-log", perm: "audit.view" },
    ],
    quickActions: (can) => [
      { label: "Audit Trail", to: "/app/audit-log", icon: ShieldCheck, perm: "audit.view" },
      { label: "View Reports", to: "/app/reports", icon: FileText, perm: "site.reporting.view" },
    ],
  },
  drone_operator: {
    title: "Drone Operator Dashboard",
    layouts: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
    ],
    stats: (data, can) => [
      { label: "Projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
    ],
  },
};

const DEFAULT_CONFIG: RoleDashboardConfig = {
  title: "Dashboard",
  layouts: [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "compliance", label: "Compliance", icon: BarChart3 },
    { key: "issues", label: "Issues", icon: List },
  ],
  stats: (data, can) => [
    { label: "Active projects", value: data?.projects?.total ?? 0, icon: <Building2 size={22} />, to: "/app/projects", perm: "projects.view" },
    { label: "Open tickets", value: data?.tickets_open ?? 0, icon: <span style={{color:"var(--danger)"}}>{String(data?.tickets_open ?? 0)}</span>, to: "/app/tickets", perm: "site.reporting.view" },
  ],
};

export function RoleDashboard() {
  const { me, can } = useAuth();
  const [layout, setLayout] = useState<Layout>("overview");
  const [data, setData] = useState<any>(null);
  const [compliance, setCompliance] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const userRole = me?.roles?.[0] || "default";
  const config = ROLE_CONFIGS[userRole] || DEFAULT_CONFIG;
  const tour = useOutletContext<TourAPI>();

  const activeProjectId = sessionStorage.getItem("activeProject") || "";

  const loadOverview = useCallback(() => {
    fetchDashboard(activeProjectId || undefined)
      .then(d => {
        setData(d);
        fetchCompliance(14).then(setCompliance).catch(() => {});
        fetchIssues(activeProjectId || undefined).then(setIssues).catch(() => {});
        fetch("/audit/logs?limit=5", { headers: { Authorization: `Bearer ${getToken()}` } })
          .then(r => r.ok ? r.json() : { results: [] })
          .then(d => setActivity(d.results ?? []))
          .catch(() => {});
      })
      .catch(e => setError(e.message));
  }, [activeProjectId]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const totalProjects = data?.projects?.total ?? 0;
  const onboardedProjects = data?.onboarded_projects ?? 0;
  const onboardPct = totalProjects > 0 ? Math.round((onboardedProjects / totalProjects) * 100) : 0;
  const portfolioValue = data?.finance?.total_facility ?? "KES 0";

  const stat = (label: string, value: number | string, icon: ReactNode, to?: string, perm?: string) => {
    const inner = (
      <>
        <div className="stat-icon">{icon}</div>
        <div>
          <div className="stat">{value}</div>
          <div className="muted">{label}</div>
        </div>
      </>
    );
    if (to && (!perm || can(perm))) {
      return <Link to={to} className="card stat-card stat-link" key={label}>{inner}</Link>;
    }
    return <div className="card stat-card" key={label}>{inner}</div>;
  };

  const quickActions = config.quickActions?.(can) || [];

  return (
    <div>
      {/* Personalized greeting */}
      <div className="page-head">
        <h2>{getGreeting()}, {me?.username ? me.username.charAt(0).toUpperCase() + me.username.slice(1) : "User"}</h2>
        <div className="muted" style={{ fontSize: 13 }}>
          {config.title} — {totalProjects} projects · {onboardedProjects} onboarded
        </div>
      </div>

      {/* Selected project info */}
      {activeProjectId && data?.project && (
        <div className="card" style={{ marginBottom: 16, padding: "12px 16px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: 15 }}>{data.project.name}</strong>
              <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>— {data.project.stage || "N/A"}</span>
            </div>
            <div className="row" style={{ gap: 16 }}>
              {data.project.budget && <span style={{ fontSize: 13 }}>Budget: <strong>{data.project.budget}</strong></span>}
              {data.project.location && <span style={{ fontSize: 13, color: "var(--muted)" }}>{data.project.location}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--muted)" }}>QUICK ACTIONS</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {quickActions.map((action, i) => {
              if (action.perm && !can(action.perm)) return null;
              const IconComp = action.icon as any;
              return (
                <Link key={i} to={action.to} className="btn sm ghost">
                  <IconComp size={14} style={{ marginRight: 6 }} /> {action.label}
                </Link>
              );
            })}

          </div>
        </div>
      )}

      {/* Layout tabs */}
      <div className="tabs" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {config.layouts.map(l => (
          <button key={l.key} className={`btn sm ${layout === l.key ? "primary" : "ghost"}`} onClick={() => setLayout(l.key)}>
            <l.icon size={16} /> {l.label}
          </button>
        ))}
      </div>

      {/* Overview layout */}
      {layout === "overview" && data && (
        <>
          {/* Stats row */}
          <div className="grid" data-tour-target="dashboard-stats">
            {config.stats(data, can).map((s, i) => stat(s.label, s.value, s.icon, s.to, s.perm))}
          </div>

          {/* Portfolio Overview + Onboarding Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            {/* Portfolio Overview */}
            <Link to="/app/projects" className="card" style={{ textDecoration: "none", cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>PORTFOLIO OVERVIEW</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{totalProjects}</div>
              <div className="muted" style={{ fontSize: 13 }}>Total Projects</div>
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Est. Portfolio Value</span>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--steel)" }}>{portfolioValue}</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 13 }}>{onboardedProjects} / {totalProjects} onboarded</span>
                <div className="progress" style={{ marginTop: 4 }}>
                  <span style={{ width: `${onboardPct}%` }} />
                </div>
              </div>
            </Link>

            {/* Onboarding Status */}
            <Link to="/app/onboarding" className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", cursor: "pointer" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto 12px" }}>
                  <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)", width: 100, height: 100 }}>
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--primary)" strokeWidth="3" strokeDasharray={`${onboardPct}, 100`} />
                  </svg>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 24, fontWeight: 700 }}>{onboardPct}%</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Onboarding Status</div>
                <div className="muted" style={{ fontSize: 12 }}>{onboardedProjects} complete · {totalProjects - onboardedProjects} pending</div>
              </div>
            </Link>
          </div>

          {/* Recent Activity */}
          {activity.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>RECENT ACTIVITY</div>
                <Link to="/app/audit-log" className="muted" style={{ fontSize: 12 }}>View all</Link>
              </div>
              {activity.map((a: any) => (
                <Link key={a.id} to="/app/audit-log" style={{ textDecoration: "none", padding: "8px 0", borderBottom: "1px solid var(--border)", display: "block" }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>{a.user}</strong> — {a.action}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {new Date(a.timestamp / 1000).toLocaleDateString()} · {new Date(a.timestamp / 1000).toLocaleTimeString()}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Alerts & Analytics */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--muted)" }}>ALERTS & ANALYTICS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Link to="/app/issues" style={{ textDecoration: "none", padding: 12, background: "var(--surface)", borderRadius: 8, display: "block", border: "1px solid transparent", transition: "border-color 0.15s", cursor: "pointer" }} className="stat-link">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Open Issues</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: issues.length > 0 ? "var(--warning)" : "var(--muted)" }}>{issues.length}</div>
                <div className="muted" style={{ fontSize: 12 }}>across all projects</div>
              </Link>
              <Link to="/app/tickets" style={{ textDecoration: "none", padding: 12, background: "var(--surface)", borderRadius: 8, display: "block", border: "1px solid transparent", transition: "border-color 0.15s", cursor: "pointer" }} className="stat-link">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Open Tickets</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: (data?.tickets_open ?? 0) > 0 ? "var(--danger)" : "var(--muted)" }}>{data?.tickets_open ?? 0}</div>
                <div className="muted" style={{ fontSize: 12 }}>awaiting resolution</div>
              </Link>
              <Link to="/app/verifications" style={{ textDecoration: "none", padding: 12, background: "var(--surface)", borderRadius: 8, display: "block", border: "1px solid transparent", transition: "border-color 0.15s", cursor: "pointer" }} className="stat-link">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Risk & Approvals</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--muted)" }}>{data?.pending_verifications ?? 0}</div>
                <div className="muted" style={{ fontSize: 12 }}>pending verification</div>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Compliance layout */}
      {layout === "compliance" && (
        <>
          <div className="page-head"><h3>Daily Log Compliance</h3></div>
          {compliance.length === 0 && <Skeleton count={4} height={20} style={{ marginBottom: 8 }} />}
          <div className="card">
            <table>
              <thead><tr><th>Project</th><th>Logged / Window</th><th>Streak</th><th>Missing</th></tr></thead>
              <tbody>
                {compliance.map((c: any) => (
                  <tr key={c.project_id}>
                    <td>{c.project_name}</td>
                    <td>{c.days_logged} / {c.days_window}</td>
                    <td>{c.streak_days} days</td>
                    <td style={{ color: "var(--danger)" }}>{(c.missing_dates ?? []).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Issues layout */}
      {layout === "issues" && (
        <>
          <div className="page-head"><h3>Open Issues</h3></div>
          {issues.length === 0 && <p className="muted">No open issues.</p>}
          <div className="card">
            {issues.map((i: any) => (
              <div key={i.id} className="issue-row" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{i.body ?? i.title ?? "Issue"}</strong>
                  <span style={{ color: i.flag === "urgent" ? "var(--danger)" : i.flag === "issue" ? "var(--warning)" : "inherit" }}>
                    {i.flag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Finance layout */}
      {layout === "finance" && data && (
        <>
          <div className="page-head"><h3>Finance Overview</h3></div>
          <div className="card">
            <div className="grid">
              {stat("Total facility", data.finance?.total_facility ?? "KES 0", <Wallet size={22} />)}
              {stat("Amount drawn", data.finance?.amount_drawn ?? "KES 0", <Wallet size={22} />)}
              {stat("Available", data.finance?.available ?? "KES 0", <CheckCircle size={22} />)}
              {stat("Exposure", data.finance?.exposure ?? "KES 0", <AlertTriangle size={22} />)}
            </div>
          </div>
        </>
      )}

      {/* Team layout */}
      {layout === "team" && (
        <>
          <div className="page-head"><h3>Team Overview</h3></div>
          <div className="card">
            <p className="muted">Team management features coming soon.</p>
          </div>
        </>
      )}

      {/* Loading state */}
      {layout === "overview" && !data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid">
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Skeleton height={160} />
            <Skeleton height={160} />
          </div>
        </div>
      )}
    </div>
  );
}
