import { redirect } from "next/navigation";

const subrouteTabMap: Record<string, string> = {
  "provisional-sums": "provisional-sums",
  variations: "variations",
  "boq-review": "boq",
  "boq-material-reconciliation": "boq",
  "contingency-drawdowns": "contingency-drawdowns",
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
