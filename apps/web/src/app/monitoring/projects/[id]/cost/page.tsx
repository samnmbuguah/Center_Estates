"use client";

import Link from "next/link";
import { use } from "react";
import { ModuleShell } from "@/components/module-shell";
import { BoqIngestion } from "@/components/monitoring/boq-ingestion";
import { constructionNav } from "@/lib/module-nav";

export default function CostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Monitoring"
      eyebrow="Commercial Management"
      title="BoQ, Variations & Cost Control Engine"
      subtitle="Bill of Quantities spreadsheet ingestion, variation approval state machine, provisional sums & contingency recovery."
      accent="#dc2626"
      groups={constructionNav}
      activeId="boq"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/monitoring";
        else window.location.href = `/monitoring?tab=${tabId}`;
      }}
    >
      <div className="property-app monitoring-app">
        <div style={{ marginBottom: 14 }}>
          <Link href={`/monitoring/projects/${id}`} style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Project Workspace
          </Link>
        </div>
        <BoqIngestion />
      </div>
    </ModuleShell>
  );
}
