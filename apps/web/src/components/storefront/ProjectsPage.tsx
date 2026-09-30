"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { formatKES } from "./ListingsBrowser";

export type PublicProject = {
  id: string;
  code: string;
  name: string;
  status: string;
  location: string;
  description: string;
  listing_count: number;
  min_price: string | null;
  max_price: string | null;
  construction_progress: string;
  is_featured: boolean;
  image: string;
};

function ProjectCard({ project }: { project: PublicProject }) {
  const progress = Number(project.construction_progress ?? 0);
  return (
    <Link
      href={`/properties?project=${project.id}`}
      style={{ display: "block", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)", textDecoration: "none", color: "inherit", position: "relative" }}
    >
      {project.is_featured && (
        <span style={{ position: "absolute", top: 10, left: 10, zIndex: 1, background: "var(--primary)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 20 }}>
          ★ Featured
        </span>
      )}
      <div style={{ aspectRatio: "16/10", background: "var(--color-sky-bg, #e0f2fe)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {project.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.image} alt={project.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 40 }}>🏗️</span>
        )}
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{project.name}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{project.location || "Kenya"}</div>
        {project.description && (
          <p className="muted" style={{ fontSize: 13, margin: "8px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {project.description}
          </p>
        )}
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontWeight: 800, color: "var(--primary)" }}>
            {project.min_price ? `From ${formatKES(project.min_price)}` : "—"}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {project.listing_count} unit{project.listing_count === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, progress))}%`, background: "var(--primary)", borderRadius: 4 }} />
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{Math.round(progress)}% complete</div>
        </div>
      </div>
    </Link>
  );
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/v1/sales/public/projects/");
        if (!response.ok) throw new Error("bad response");
        const payload = await response.json().catch(() => ({}));
        if (active) {
          setProjects(Array.isArray(payload.results) ? payload.results : []);
          setUnavailable(false);
        }
      } catch {
        if (active) setUnavailable(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <MarketingLayout>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 20px 18px" }}>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 8px" }}>Our projects</h1>
        <p className="muted" style={{ fontSize: 16, margin: 0, maxWidth: 720 }}>
          Development projects with units currently for sale — progress, pricing and availability at a glance.
        </p>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "8px 20px 64px" }}>
        {loading ? (
          <p className="muted" style={{ textAlign: "center" }}>Loading projects…</p>
        ) : unavailable ? (
          <p className="muted" style={{ textAlign: "center" }}>Projects are currently unavailable. Please try again later.</p>
        ) : projects.length === 0 ? (
          <p className="muted" style={{ textAlign: "center" }}>No projects with available units right now — check back soon.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
            {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
        )}
      </section>
    </MarketingLayout>
  );
}
