import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "@/components/monitoring/react-router-shim";
import {
  Building2, Grid2X2, List, MapPin, Plus, Search, Filter, Wallet, Activity,
  AlertTriangle, CheckCircle2, ChevronRight, Eye, Layers, Settings, FileText
} from "lucide-react";

import { fetchProjects } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

interface ProjectOption {
  id: string;
  name: string;
  code?: string;
  location?: string;
  stage?: string;
  budget?: number;
  tender_amount?: number;
  project_type?: string;
  client?: string;
  contractor?: string;
  clerk_of_works?: string;
  physical_progress?: number;
  health?: "On Track" | "At Risk" | "Delayed";
  image_url?: string;
  cover_image?: string;
}

export function Projects() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Controls (Photo 03 Top Filter Bar)
  const [stageFilter, setStageFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  useEffect(() => {
    fetchProjects().then((data: any[]) => {
      // Honest mapping only — never invent progress, health, or stakeholders.
      const enhanced = data.map((p) => ({
        ...p,
        client: p.client_name || p.client || "",
        contractor: p.contractor || "",
        clerk_of_works: p.clerk_of_works || "",
        physical_progress: typeof p.physical_progress === "number" ? p.physical_progress : null,
        health: p.health || null,
        project_type: p.project_type || "standard",
        budget: p.budget ?? p.tender_amount ?? null,
      }));
      setProjects(enhanced);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter((p) => {
    if (stageFilter !== "all" && p.stage !== stageFilter) return false;
    if (sectorFilter !== "all" && (p.project_type || "").toLowerCase() !== sectorFilter.toLowerCase()) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.code || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = projects.filter((p) => p.stage === "active").length;
  const planningCount = projects.filter((p) => p.stage === "planning").length;
  const completedCount = projects.filter((p) => ["complete", "closed"].includes(p.stage || "")).length;

  const totalValue = projects.reduce((sum, p) => sum + Number(p.budget || p.tender_amount || 0), 0);

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
      {/* Header & Page Subtitle (Mockup 03 Header) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--text)" }}>Project Portfolio</h1>
          <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
            Manage & Monitor All Real Estate, Commercial, and Infrastructure Projects
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-primary" onClick={() => navigate("/app/onboarding")}>
            <Plus size={15} style={{ marginRight: "4px" }} /> + Onboard Project
          </button>
        </div>
      </div>

      <ErrorBanner message={error} />

      {/* Filter Toolbar & View Toggle (Photo 03 Filter Toolbar) */}
      <div className="card" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          {/* Status Filter Pills */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: `All Projects (${projects.length})` },
              { id: "active", label: `Active (${activeCount})` },
              { id: "planning", label: `Planning (${planningCount})` },
              { id: "complete", label: `Completed (${completedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStageFilter(tab.id)}
                className={`btn sm ${stageFilter === tab.id ? "primary" : "ghost"}`}
                style={{
                  background: stageFilter === tab.id ? "var(--color-brand-blue)" : "var(--surface-2)",
                  color: stageFilter === tab.id ? "#fff" : "var(--muted)",
                  border: "1px solid var(--border)",
                  fontSize: "12px",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid / Table View Switcher */}
          <div style={{ display: "flex", gap: "4px", background: "var(--surface-2)", padding: "2px", borderRadius: "6px", border: "1px solid var(--border)" }}>
            <button
              onClick={() => setViewMode("cards")}
              style={{
                background: viewMode === "cards" ? "var(--surface)" : "transparent",
                color: viewMode === "cards" ? "var(--primary)" : "var(--muted)",
                border: "none",
                padding: "6px 10px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <Grid2X2 size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              style={{
                background: viewMode === "table" ? "var(--surface)" : "transparent",
                color: viewMode === "table" ? "var(--primary)" : "var(--muted)",
                border: "none",
                padding: "6px 10px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Dropdowns & Search Input */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              placeholder="Search by project name, code, client or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                paddingLeft: "36px",
                paddingRight: "12px",
                height: "38px",
                borderRadius: "6px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: "13px",
              }}
            />
          </div>

          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            style={{ height: "38px", borderRadius: "6px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "13px", padding: "0 10px" }}
          >
            <option value="all">All Sectors</option>
            <option value="commercial">Commercial</option>
            <option value="residential">Residential</option>
            <option value="infrastructure">Infrastructure</option>
          </select>

          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            style={{ height: "38px", borderRadius: "6px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "13px", padding: "0 10px" }}
          >
            <option value="all">All Regions</option>
            <option value="nairobi">Nairobi</option>
            <option value="coast">Coast</option>
            <option value="northern">Northern</option>
          </select>
        </div>
      </div>

      {/* Main Content Area: Cards Grid View (Mockup 03 Cards) vs Table View */}
      {viewMode === "cards" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
          {filtered.length === 0 && (
            <div className="card" style={{ gridColumn: "1 / -1", padding: 32, textAlign: "center", color: "var(--muted)" }}>
              No projects match your filters. Try clearing filters or onboard a new project.
            </div>
          )}
          {filtered.map((p) => {
            const budgetVal = Number(p.budget || p.tender_amount || 0);
            const progress = typeof p.physical_progress === "number" ? p.physical_progress : null;
            const healthColor = p.health === "Delayed" ? "var(--color-danger)" : p.health === "At Risk" ? "var(--color-amber)" : p.health === "On Track" ? "var(--color-emerald)" : "var(--color-slate-400)";

            const imgMap: Record<string, string> = {
              "proj-a": "/images/site_inspection.png",
              "proj-b": "/images/drone_orthomosaic.png",
              "proj-c": "/images/westlands_office.png",
              "proj-d": "/images/mombasa_logistics.png",
              "proj-e": "/images/westlands_office.png",
              "kasneb-towers-2": "/images/kasneb_towers.png",
              "mombasa-logistics-hub": "/images/mombasa_logistics.png",
              "westlands-office-park": "/images/westlands_office.png",
              "nairobi-water-pipeline": "/images/site_inspection.png",
              "kisumu-housing-project": "/images/drone_orthomosaic.png",
            };

            // Curated local project imagery takes precedence over generic
            // evidence thumbnails so portfolio cards match the project identity.
            const heroImg = imgMap[p.id] || p.image_url || p.cover_image || null;

            return (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: "0 0 16px 0",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "14px",
                  overflow: "hidden",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                {/* Hero Site Photo */}
                <div style={{ position: "relative", height: 140, overflow: "hidden", background: "var(--surface-2)" }}>
                  {heroImg ? (
                    <img src={heroImg} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                      <Building2 size={36} />
                    </div>
                  )}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)",
                  }} />
                  {p.health && (
                    <span style={{
                      position: "absolute", top: 10, right: 10, fontSize: "11px",
                      padding: "3px 8px", borderRadius: "12px", background: `color-mix(in srgb, ${healthColor} 87%, transparent)`,
                      color: "#ffffff", fontWeight: 700,
                    }}>
                      {p.health}
                    </span>
                  )}
                  <span style={{
                    position: "absolute", bottom: 10, left: 12, fontSize: "11px",
                    color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
                  }}>
                    {(p.project_type || "standard").replace(/_/g, " ")}
                  </span>
                </div>

                {/* Project Header Title */}
                <div style={{ padding: "0 16px" }}>
                  <h3 style={{ margin: "0", fontSize: "17px", fontWeight: 700, color: "var(--text)" }}>
                    {p.name}
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                    <span><MapPin size={12} style={{ marginRight: "2px" }} /> {p.location || "—"}</span>
                    <span>•</span>
                    <span>Code: <strong style={{ color: "var(--text)" }}>{p.code || "—"}</strong></span>
                  </div>
                </div>

                {/* Key Stakeholders & Details */}
                <div style={{ background: "var(--surface-2)", padding: "10px 12px", borderRadius: "8px", fontSize: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "0 16px" }}>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: "11px" }}>Client</div>
                    <strong style={{ color: "var(--text)" }}>{p.client || "—"}</strong>
                  </div>
                  <div>
                    <div style={{ color: "var(--muted)", fontSize: "11px" }}>Stage</div>
                    <strong style={{ color: "var(--primary)" }}>{(p.stage || "—").replace(/_/g, " ")}</strong>
                  </div>
                </div>

                {/* Progress Bar & Financials */}
                <div style={{ padding: "0 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--muted)" }}>Physical Progress</span>
                    <strong style={{ color: "var(--color-brand-blue)", fontFamily: "IBM Plex Mono" }}>{progress != null ? `${progress}%` : "—"}</strong>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "var(--surface-3)", borderRadius: "4px", overflow: "hidden", marginBottom: "12px" }}>
                    <div style={{ width: `${progress ?? 0}%`, height: "100%", background: progress != null ? "var(--color-brand-blue)" : "transparent", borderRadius: "4px" }} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ color: "var(--muted)", fontSize: "11px" }}>Contract Sum</div>
                      <strong style={{ fontFamily: "IBM Plex Mono" }}>
                        {budgetVal > 0 ? `KSh ${(budgetVal / 1000000).toFixed(1)}M` : "—"}
                      </strong>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "var(--muted)", fontSize: "11px" }}>Stage</div>
                      <strong style={{ fontFamily: "IBM Plex Mono", color: "var(--color-emerald)" }}>{(p.stage || "—").replace(/_/g, " ")}</strong>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "8px", marginTop: "4px", padding: "0 16px" }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, background: "var(--color-brand-blue)", borderColor: "var(--color-brand-blue)", fontSize: "12px" }}
                    onClick={() => {
                      sessionStorage.setItem("activeProject", p.id);
                      navigate(`/app/workspace/${p.id}`);
                    }}
                  >
                    Open Workspace →
                  </button>
                  <button
                    className="btn"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "12px" }}
                    onClick={() => navigate(`/app/onboarding/${p.id}`)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card" style={{ padding: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "10px" }}>Project Name</th>
                <th style={{ padding: "10px" }}>Code</th>
                <th style={{ padding: "10px" }}>Location</th>
                <th style={{ padding: "10px" }}>Client</th>
                <th style={{ padding: "10px" }}>Contract Sum</th>
                <th style={{ padding: "10px" }}>Progress</th>
                <th style={{ padding: "10px" }}>Stage</th>
                <th style={{ padding: "10px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>No projects match your filters.</td></tr>
              )}
              {filtered.map((p) => {
                const b = Number(p.budget || p.tender_amount || 0);
                const prog = typeof p.physical_progress === "number" ? p.physical_progress : null;
                return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px", fontWeight: 700 }}>
                    <Link to={`/app/workspace/${p.id}`} style={{ color: "var(--text)", textDecoration: "none" }}>{p.name}</Link>
                  </td>
                  <td style={{ padding: "10px", fontFamily: "IBM Plex Mono" }}>{p.code || "—"}</td>
                  <td style={{ padding: "10px", color: "var(--muted)" }}>{p.location || "—"}</td>
                  <td style={{ padding: "10px" }}>{p.client || "—"}</td>
                  <td style={{ padding: "10px", fontFamily: "IBM Plex Mono" }}>{b > 0 ? `KSh ${(b / 1000000).toFixed(1)}M` : "—"}</td>
                  <td style={{ padding: "10px", fontFamily: "IBM Plex Mono", color: "var(--color-brand-blue)", fontWeight: 700 }}>{prog != null ? `${prog}%` : "—"}</td>
                  <td style={{ padding: "10px" }}>
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(0,163,255,0.12)", color: "var(--color-brand-blue)", fontWeight: 600 }}>
                      {(p.stage || "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    <button className="btn sm ghost" style={{ color: "var(--color-brand-blue)" }} onClick={() => {
                      sessionStorage.setItem("activeProject", p.id);
                      navigate(`/app/workspace/${p.id}`);
                    }}>
                      Workspace →
                    </button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
