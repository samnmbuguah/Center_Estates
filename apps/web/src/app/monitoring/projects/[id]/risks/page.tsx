"use client";
import Link from "next/link";
import { use } from "react";
import { ModuleShell } from "@/components/module-shell";
import { RiskMatrix } from "@/components/monitoring/risk-matrix";
import { constructionNav } from "@/lib/module-nav";

export default function RisksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Monitoring"
      eyebrow="Site Operations & Governance"
      title="Project Risk Matrix & Issue Register"
      subtitle="5x5 visual likelihood vs impact heatmap, mitigation action tracking, and status controls."
      accent="var(--color-danger)"
      groups={constructionNav}
      activeId="risks"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/monitoring";
        else window.location.href = `/monitoring?tab=${tabId}`;
      }}
    >
      <div className="property-app monitoring-app">
        <div style={{ marginBottom: 14 }}>
          <Link href={`/monitoring/projects/${id}`} style={{ color: "var(--color-info)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Project Workspace
          </Link>
        </div>
        <RiskMatrix />
      </div>
    </ModuleShell>
  );
}
