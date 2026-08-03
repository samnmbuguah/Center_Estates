import { redirect } from "next/navigation";

const routeTabMap: Record<string, string> = {
  "milestones/pending-verification": "milestones",
  "pending-verification": "milestones",
  "daily-logs": "daily-logs",
  reports: "reports",
  finance: "requisitions",
  certificates: "certificates",
  "generate-ipc": "certificates",
  disbursements: "disbursements",
  drawdowns: "drawdowns",
  "contingency-drawdowns": "contingency-drawdowns",
  variations: "variations",
  "provisional-sums": "provisional-sums",
  boq: "boq",
  "boq-review": "boq",
  tickets: "tickets",
  risks: "risks",
  documents: "documents",
  materials: "materials",
  "site-visits": "site-visits",
};

export default async function AppCatchAllPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const fullPath = slug.join("/");
  const lastPath = slug[slug.length - 1] || "";

  const tab = routeTabMap[fullPath] || routeTabMap[lastPath] || (lastPath ? lastPath : "overview");
  redirect(`/monitoring?tab=${encodeURIComponent(tab)}`);
}
