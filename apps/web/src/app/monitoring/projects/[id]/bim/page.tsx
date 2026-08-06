"use client";
import Link from "next/link";
import { use } from "react";
import { ModuleShell } from "@/components/module-shell";
import { BimViewer } from "@/components/monitoring/bim-viewer";
import { constructionNav } from "@/lib/module-nav";

export default function BimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Monitoring"
      eyebrow="Digital Twin & Technical Modules"
      title="3D BIM Model & IFC Element Inspector"
      subtitle="Interactive WebGL 3D model navigation, IFC element selection, and BoQ material breakdown."
      accent="#dc2626"
      groups={constructionNav}
      activeId="bim-models"
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
        <BimViewer modelName={`Center Estates Plaza Tower A (Project #${id})`} />
      </div>
    </ModuleShell>
  );
}
