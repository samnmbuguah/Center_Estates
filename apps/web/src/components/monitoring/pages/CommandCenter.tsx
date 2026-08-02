import { ArrowRight, BarChart3, Building2, CalendarDays, ClipboardCheck, FileText, MessageSquare, Settings, ShoppingCart, Ticket, Users, type LucideIcon } from "lucide-react";
import { Link } from "@/components/monitoring/react-router-shim";
import { useAuth } from "../auth";

const MODULES: [string, string, LucideIcon, string, string][] = [
  ["Construction", "Projects, monitoring, quality, progress & site management", Building2, "/app/projects", "projects.view"],
  ["Pre-Construction Hub", "Planning, approvals, designs, budgets, procurement & contracts", ClipboardCheck, "/app/pre-construction", "projects.view"],
  ["Procurement", "Planning, RFQs, purchase orders, suppliers & deliveries", ShoppingCart, "/app/store", "store.view"],
  ["Ticketing & SLA", "Manage tickets, track due dates & escalations", Ticket, "/app/tickets", "site.reporting.view"],
  ["Communication Centre", "Chat, notices, announcements and stakeholder updates", MessageSquare, "/app/chat", "site.reporting.view"],
  ["Enterprise Calendar", "Meetings, site visits, milestones and important dates", CalendarDays, "/app/calendar", "calendar.view"],
  ["Documents", "Drawings, contracts, reports and project files", FileText, "/app/project-documents", "site.reporting.view"],
  ["Reports & Analytics", "Dashboards, KPIs, analytics and custom reports", BarChart3, "/app/reports", "site.reporting.view"],
  ["Stakeholders", "Clients, consultants, contractors and project teams", Users, "/app/stakeholders", "projects.view"],
  ["Administration", "Users, roles, permissions, settings and audit tools", Settings, "/app/administration", "users.view"],
];

export function CommandCenter() {
  const { can, me } = useAuth();
  const modules = MODULES.filter(([, , , , perm]) => can(perm));
  return <div className="command-center">
    <div className="page-head"><div><h1>Command Center</h1><p className="muted">Access your modules</p></div></div>
    <div className="command-grid">{modules.map(([label, desc, Icon, path]) => <Link className="command-card" to={path as string} key={label as string}>
      <span className="command-icon"><Icon size={28} /></span><div><h3>{label as string}</h3><p>{desc as string}</p></div><ArrowRight size={19} className="command-arrow" />
    </Link>)}</div>
    <div className="command-status"><strong>System Status</strong><span>● All systems operational</span><span>● Mobile sync online</span><span>● GPS tracking active</span><span>● Last data sync: just now</span></div>
  </div>;
}
