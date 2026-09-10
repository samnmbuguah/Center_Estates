"use client";
import Link from "next/link";
import { use } from "react";
import { ModuleShell } from "@/components/module-shell";
import { IpcBuilder } from "@/components/monitoring/ipc-builder";
import { constructionNav } from "@/lib/module-nav";

export default function IpcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Monitoring"
      eyebrow="Commercial & Finance"
      title="Interim Payment Certificate (IPC) Builder"
      subtitle="Valuation breakdown, retention fund deductions, advance recoveries, and certificate export."
      accent="var(--color-danger)"
      groups={constructionNav}
      activeId="certificates"
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
        <IpcBuilder initialData={{ certificateNumber: `IPC-2026-${id.slice(0, 3).toUpperCase()}` }} />
      </div>
    </ModuleShell>
  );
}
