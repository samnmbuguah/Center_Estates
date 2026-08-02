"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { constructionNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type ProjectRow = Record<string, string | number | boolean | null>;

const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function ProjectsDirectoryPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/construction/projects/")
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as ProjectRow[];
          setProjects(data || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = projects.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return String(p.name || "").toLowerCase().includes(term) || String(p.code || "").toLowerCase().includes(term) || String(p.location || "").toLowerCase().includes(term);
  });

  return (
    <ModuleShell
      moduleKey="monitoring"
      moduleName="Construction Monitoring"
      eyebrow="Construction Directory"
      title="Project Portfolio & Workspaces"
      subtitle="Active construction sites, budgets, milestones and command center access."
      accent="#dc2626"
      groups={constructionNav}
      activeId="projects"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/monitoring";
        else window.location.href = `/monitoring?tab=${id}`;
      }}
      contextLabel="Portfolio Scope"
      contextValue={`${projects.length} Total Projects`}
    >
      <div className="property-app monitoring-app">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search project by name, code or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", width: 320, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <Link
            href="/monitoring?tab=projects"
            style={{ background: "#dc2626", color: "#fff", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}
          >
            + New Project Workspace
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading project directory…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {filtered.map((proj) => (
              <div
                key={String(proj.id)}
                style={{
                  background: "#ffffff",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  padding: 16,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#dc2626", fontWeight: "bold" }}>{String(proj.code)}</span>
                      <h4 style={{ margin: "2px 0 0 0", fontSize: "1.05rem", color: "#0f172a" }}>{String(proj.name)}</h4>
                    </div>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem", fontWeight: "bold",
                      background: "#dcfce7", color: "#166534"
                    }}>
                      {String(proj.stage || "Active").replaceAll("_", " ")}
                    </span>
                  </div>

                  <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 12px 0" }}>
                    📍 {String(proj.location || "Nairobi Site")} | Client: <strong>{String(proj.client_name || "Center Estates")}</strong>
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#f8fafc", padding: 10, borderRadius: 6, fontSize: "0.8rem", marginBottom: 14 }}>
                    <div>
                      <small style={{ color: "#64748b" }}>Budget</small>
                      <div style={{ fontWeight: "bold", color: "#0f172a" }}>{cash.format(Number(proj.budget || 0))}</div>
                    </div>
                    <div>
                      <small style={{ color: "#64748b" }}>Target Completion</small>
                      <div style={{ fontWeight: "bold", color: "#0f172a" }}>{String(proj.planned_completion_date || "2026-12-31")}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    href={`/monitoring/projects/${proj.id}`}
                    style={{ flex: 1, textAlign: "center", background: "#0f172a", color: "#ffffff", padding: "8px", borderRadius: 6, fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}
                  >
                    Open Workspace
                  </Link>
                  <Link
                    href={`/monitoring/projects/${proj.id}/programme`}
                    style={{ background: "#f1f5f9", color: "#334155", padding: "8px 12px", borderRadius: 6, fontSize: "0.85rem", textDecoration: "none" }}
                  >
                    📊 Gantt
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
