"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { constructionNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type ProjectRow = Record<string, string | number | boolean | null>;

const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function SingleProjectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/construction/projects/${id}/`)
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as ProjectRow;
          setProject(data);
        } else if (active) {
          setProject({ id, code: `PROJ-${id.slice(0, 4)}`, name: "Center Estates Commercial Plaza", location: "Kilimani, Nairobi", budget: 450000000 });
        }
      })
      .catch(() => {
        if (active) setProject({ id, code: `PROJ-${id.slice(0, 4)}`, name: "Center Estates Commercial Plaza", location: "Kilimani, Nairobi", budget: 450000000 });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const projName = project ? String(project.name || "Construction Project") : "Project Workspace";

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Monitoring"
      eyebrow="Project Command Center"
      title={projName}
      subtitle="Unified control center for site progress, financials, technical BIM/Drone records, and commercial certifications."
      accent="#dc2626"
      groups={constructionNav}
      activeId="projects"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/monitoring";
        else window.location.href = `/monitoring?tab=${tabId}`;
      }}
      contextLabel="Active Project Scope"
      contextValue={projName}
    >
      <div className="property-app monitoring-app">
        {/* Project Workspace Navigation Bar */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", borderBottom: "2px solid #e2e8f0", paddingBottom: 8, marginBottom: 16 }}>
          <Link href={`/monitoring/projects/${id}`} style={{ padding: "8px 14px", borderRadius: 6, background: "#dc2626", color: "#fff", textDecoration: "none", fontWeight: "bold", fontSize: "0.85rem" }}>
            📌 Workspace Overview
          </Link>
          <Link href={`/monitoring/projects/${id}/programme`} style={{ padding: "8px 14px", borderRadius: 6, background: "#f1f5f9", color: "#334155", textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}>
            📊 Programme & Gantt
          </Link>
          <Link href={`/monitoring/projects/${id}/cost`} style={{ padding: "8px 14px", borderRadius: 6, background: "#f1f5f9", color: "#334155", textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}>
            💰 Cost & Variations
          </Link>
          <Link href={`/monitoring/projects/${id}/ipc`} style={{ padding: "8px 14px", borderRadius: 6, background: "#f1f5f9", color: "#334155", textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}>
            📄 IPC & Drawdowns
          </Link>
          <Link href={`/monitoring/projects/${id}/bim`} style={{ padding: "8px 14px", borderRadius: 6, background: "#f1f5f9", color: "#334155", textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}>
            🏢 3D BIM Viewer
          </Link>
          <Link href={`/monitoring/projects/[id]/risks`} style={{ padding: "8px 14px", borderRadius: 6, background: "#f1f5f9", color: "#334155", textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}>
            ⚠️ Risk Matrix
          </Link>
          <Link href={`/monitoring/projects/${id}/site-ops`} style={{ padding: "8px 14px", borderRadius: 6, background: "#f1f5f9", color: "#334155", textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}>
            📋 Site Logs & Quality
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading project workspace…</div>
        ) : (
          <div>
            {/* Quick KPI Overview */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Project Budget</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#0f172a" }}>{cash.format(Number(project?.budget || 450000000))}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Physical Completion</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#16a34a" }}>68.4%</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Certified Value</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#2563eb" }}>{cash.format(142000000)}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Open Risks / Issues</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#dc2626" }}>5 High Priority</h3>
              </div>
            </div>

            {/* Modules Grid Quick Access */}
            <h3 style={{ fontSize: "1.1rem", margin: "0 0 12px 0", color: "#0f172a" }}>Project Modules & Deep Workflows</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              <Link href={`/monitoring/projects/${id}/programme`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "#2563eb" }}>📊 Programme & Gantt Schedule</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Baseline vs actual progress curves, critical path analysis, S-curve graph.</p>
                </div>
              </Link>

              <Link href={`/monitoring/projects/${id}/cost`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "#16a34a" }}>💰 Cost & Variations</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>BoQ line items, variation state machine, provisional sums, contingency allowances.</p>
                </div>
              </Link>

              <Link href={`/monitoring/projects/${id}/ipc`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "#7c3aed" }}>📄 IPC & Funding Drawdowns</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Interim payment certificate builder, retention tracking, funding drawdown requests.</p>
                </div>
              </Link>

              <Link href={`/monitoring/projects/${id}/bim`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "#ea580c" }}>🏢 3D BIM Viewer & Models</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>WebGL 3D model navigation, IFC GUID linking to BoQ executed quantities.</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
