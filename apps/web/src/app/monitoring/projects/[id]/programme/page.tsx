"use client";

import Link from "next/link";
import { use } from "react";
import { ModuleShell } from "@/components/module-shell";
import { TimelineViewer } from "@/components/monitoring/timeline-viewer";
import { constructionNav } from "@/lib/module-nav";

export default function ProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Monitoring"
      eyebrow="Programme & Controls"
      title="Interactive Gantt Timeline & Progress S-Curve"
      subtitle="Critical path schedule tracking, WBS work plan, and earned value progress curves."
      accent="#dc2626"
      groups={constructionNav}
      activeId="work-plan"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/monitoring";
        else window.location.href = `/monitoring?tab=${tabId}`;
      }}
      contextLabel="Project ID"
      contextValue={`PROJ-${id}`}
    >
      <div className="property-app monitoring-app">
        <div style={{ marginBottom: 14 }}>
          <Link href={`/monitoring/projects/${id}`} style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Project Workspace
          </Link>
        </div>
        <TimelineViewer projectName={`Project #${id} — Execution Schedule`} />
      </div>
    </ModuleShell>
  );
}
