import { Link, useLocation } from "@/components/monitoring/react-router-shim";
import { ChevronRight, Home } from "lucide-react";

const LABELS: Record<string, string> = {
  "/app": "Dashboard", "/app/projects": "Projects",
  "/app/daily-logs": "Daily Logs", "/app/tickets": "Tickets",
  "/app/reports": "Reports", "/app/finance": "Finance",
  "/app/store": "Store", "/app/users": "Users",
  "/app/settings": "Settings", "/app/tenants": "Tenants",
  "/app/roles": "Roles", "/app/audit-log": "Audit Trail",
  "/app/notices": "Notices", "/app/calendar": "Calendar",
  "/app/chat": "Chat", "/app/issues": "Issues",
  "/app/rfis": "RFIs", "/app/verifications": "Verifications",
  "/app/approvals": "Approvals", "/app/assistant": "AI Assistant",
  "/app/documentation": "Documentation",
  "/app/site-records": "Site Records", "/app/timeline": "Timeline",
  "/app/notifications": "Notifications",
  "/app/client-dashboard": "Client Dashboard",
  "/app/monthly-reports": "Monthly Reports",
  "/app/pending-verifications": "Pending Verifications",
};

export function Breadcrumbs() {
  const loc = useLocation();
  const parts = loc.pathname.split("/").filter(Boolean);

  if (parts.length <= 1) return null;

  const crumbs = [];
  let path = "";
  for (const p of parts) {
    path += "/" + p;
    const label = LABELS[path] || p.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (path === loc.pathname) {
      crumbs.push({ label, path, active: true });
    } else {
      crumbs.push({ label, path, active: false });
    }
  }

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, marginBottom: 16, color: "var(--muted)" }}>
      <Link to="/app" style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}><Home size={14} /></Link>
      {crumbs.map((c, i) => (
        <span key={c.path} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronRight size={12} />
          {c.active ? (
            <span style={{ color: "var(--text)", fontWeight: 500 }}>{c.label}</span>
          ) : (
            <Link to={c.path} style={{ color: "var(--muted)", textDecoration: "none" }}>{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
