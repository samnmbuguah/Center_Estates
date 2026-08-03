import { redirect } from "next/navigation";

const subrouteTabMap: Record<string, string> = {
  "provisional-sums": "provisional-sums",
  variations: "variations",
  "boq-review": "boq",
  "boq-material-reconciliation": "boq",
  "contingency-drawdowns": "contingency-drawdowns",
  "generate-ipc": "certificates",
  ipc: "certificates",
  "ipc-generation": "certificates",
  "retention-register": "certificates",
  retention: "certificates",
  "work-orders": "work-orders",
  subcontractors: "subcontractors",
  "pre-construction": "requirement-waivers",
  waivers: "requirement-waivers",
  "site-records": "daily-logs",
  "quality-tests": "quality-tests",
  rfis: "rfis",
  notices: "tickets",
  issues: "tickets",
  stakeholders: "project-memberships",
  team: "project-memberships",
  members: "project-memberships",
  boq: "boq",
  "boq-cost-states": "boq",
  "cost-dashboard": "overview",
  "executive-dashboard": "overview",
  "cash-flow": "requisitions",
  finance: "requisitions",
  disbursements: "disbursements",
  store: "materials",
  ingestion: "materials",
  bim: "bim-models",
  "bim-models": "bim-models",
  "bim-discrepancies": "bim-discrepancies",
  drone: "drone-datasets",
  "drone-datasets": "drone-datasets",
  satellite: "satellite-datasets",
  "satellite-datasets": "satellite-datasets",
  "monthly-reports": "reports",
  calendar: "calendar",
  chat: "chat",
  notifications: "notifications",
  administration: "audit-log",
  roles: "audit-log",
  users: "audit-log",
  "audit-log": "audit-log",
  milestones: "milestones",
  "daily-logs": "daily-logs",
  documents: "documents",
  reports: "reports",
  "site-visits": "site-visits",
  materials: "materials",
  tickets: "tickets",
  risks: "risks",
  approvals: "approvals",
  certificates: "certificates",
  drawdowns: "drawdowns",
};

export default async function AppProjectsSubroutePage({
  params,
}: {
  params: Promise<{ id: string; subroute?: string[] }>;
}) {
  const { id, subroute } = await params;
  const sub = subroute?.[0] || "";
  const tab = subrouteTabMap[sub] || (sub ? sub : "project-memberships");
  redirect(`/monitoring?tab=${encodeURIComponent(tab)}&id=${encodeURIComponent(id)}`);
}
