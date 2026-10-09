"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  HardHat,
  Layers,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { formatKES } from "./ListingsBrowser";

const WHATSAPP_SALES_PHONE = "254712345678";

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

type StageFilter = "all" | "ready" | "construction" | "offplan";

function getStageLabel(progress: number) {
  if (progress >= 95) return "Ready for Occupation";
  if (progress >= 70) return "Finishing Works & MEP";
  if (progress >= 30) return "Superstructure & Slabs";
  if (progress > 0) return "Substructure & Foundation";
  return "Pre-Launch / Ground Breaking";
}

function ProjectCard({ project }: { project: PublicProject }) {
  const progress = Math.min(100, Math.max(0, Number(project.construction_progress ?? 0)));
  const stageLabel = getStageLabel(progress);
  const whatsappUrl = `https://wa.me/${WHATSAPP_SALES_PHONE}?text=${encodeURIComponent(
    `Hi Center Estates! I'd like to learn more about ${project.name} in ${project.location || "Kenya"}. Could you share available unit floor plans and pricing?`
  )}`;

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid var(--border)",
        overflow: "hidden",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "var(--shadow-lg, 0 12px 30px rgba(0,0,0,0.1))";
        e.currentTarget.style.borderColor = "var(--brand, #b91c1c)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* Image Container with Badges */}
      <div
        style={{
          position: "relative",
          aspectRatio: "16/10",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {project.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.image}
            alt={project.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ textAlign: "center", color: "#94a3b8" }}>
            <Building2 size={54} strokeWidth={1.5} />
            <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, letterSpacing: "0.5px" }}>
              DEVELOPMENT MASTERPLAN
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            zIndex: 2,
          }}
        >
          {project.is_featured && (
            <span
              style={{
                background: "var(--brand, #b91c1c)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: 20,
                boxShadow: "0 2px 6px rgba(185, 28, 28, 0.4)",
              }}
            >
              ★ Featured Development
            </span>
          )}
          <span
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(6px)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <ShieldCheck size={13} color="#22c55e" /> Vetted Title
          </span>
        </div>

        {/* Availability Badge */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 14,
            background: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(6px)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 14,
          }}
        >
          {project.listing_count} {project.listing_count === 1 ? "unit available" : "units available"}
        </div>
      </div>

      {/* Content Details */}
      <div style={{ padding: 22, flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--ink, #0f172a)", margin: 0 }}>
              {project.name}
            </h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                color: "var(--ink3, #64748b)",
                marginTop: 4,
              }}
            >
              <MapPin size={13} color="var(--brand, #b91c1c)" />
              <span>{project.location || "Nairobi, Kenya"}</span>
            </div>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3, #64748b)", textTransform: "uppercase" }}>
              Starting From
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--brand, #b91c1c)", marginTop: 2 }}>
              {project.min_price ? formatKES(project.min_price) : "Contact Sales"}
            </div>
          </div>
        </div>

        {project.description && (
          <p
            style={{
              fontSize: 13.5,
              color: "var(--ink2, #334155)",
              lineHeight: 1.6,
              margin: "14px 0 0",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {project.description}
          </p>
        )}

        {/* Construction Milestone Progress */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "var(--ink2, #334155)" }}>
              {stageLabel}
            </span>
            <span style={{ fontWeight: 800, color: progress >= 90 ? "#16a34a" : "var(--brand, #b91c1c)" }}>
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: "var(--bg, #f1f5f9)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: progress >= 90 ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #b91c1c, #dc2626)",
                borderRadius: 4,
                transition: "width 0.6s ease",
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 18,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 10,
          }}
        >
          <Link
            href={`/properties?project=${project.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 10,
              background: "var(--brand, #b91c1c)",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 700,
              textDecoration: "none",
              transition: "background 0.2s",
            }}
          >
            View Available Units <ArrowRight size={15} />
          </Link>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Chat on WhatsApp about this project"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 42,
              height: 42,
              borderRadius: 10,
              border: "1px solid #86efac",
              background: "#f0fdf4",
              color: "#16a34a",
              textDecoration: "none",
              transition: "transform 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <MessageCircle size={18} />
          </a>
        </div>
      </div>
    </div>
  );
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

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
    return () => {
      active = false;
    };
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const prog = Number(p.construction_progress || 0);
      if (stageFilter === "ready" && prog < 90) return false;
      if (stageFilter === "construction" && (prog < 25 || prog >= 90)) return false;
      if (stageFilter === "offplan" && prog >= 25) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesLoc = (p.location || "").toLowerCase().includes(q);
        if (!matchesName && !matchesLoc) return false;
      }
      return true;
    });
  }, [projects, stageFilter, searchQuery]);

  return (
    <MarketingLayout isSales={true}>
      {/* Hero Header */}
      <section
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          color: "#fff",
          padding: "54px 20px 48px",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.1)", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            <Sparkles size={14} color="#fca5a5" /> DIRECT DEVELOPER MASTERPLANS
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 900, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
            Vetted Real Estate Developments
          </h1>
          <p style={{ fontSize: 16, color: "#cbd5e1", maxWidth: 740, margin: "0 0 28px", lineHeight: 1.6 }}>
            Explore verified residential, mixed-use, and commercial developments across Kenya. Complete with live milestone tracking, sectional title registration, and direct developer payment plans.
          </p>

          {/* Quick Metrics Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              paddingTop: 24,
              borderTop: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fca5a5" }}>100%</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Surveyed Sectional Titles</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fca5a5" }}>Zero%</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Intermediary Broker Markup</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fca5a5" }}>Live</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>QS Construction Audits</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fca5a5" }}>Escrow</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>Milestone Protected Terms</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "36px 20px 80px" }}>
        {/* Controls & Filter Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 32,
            paddingBottom: 20,
            borderBottom: "1px solid var(--border)",
          }}
        >
          {/* Stage Tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg, #f1f5f9)",
              padding: 4,
              borderRadius: 12,
              flexWrap: "wrap",
            }}
          >
            {[
              { id: "all", label: "All Developments" },
              { id: "ready", label: "Ready to Occupy (90%+)" },
              { id: "construction", label: "Under Construction" },
              { id: "offplan", label: "Off-Plan / Pre-Launch" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStageFilter(tab.id as StageFilter)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: stageFilter === tab.id ? 700 : 500,
                  border: "none",
                  cursor: "pointer",
                  background: stageFilter === tab.id ? "var(--surface)" : "transparent",
                  color: stageFilter === tab.id ? "var(--brand, #b91c1c)" : "var(--ink2, #475569)",
                  boxShadow: stageFilter === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: "relative", minWidth: 260 }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink3, #94a3b8)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search development name or location…"
              style={{
                padding: "9px 12px 9px 36px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 13.5,
                outline: "none",
                width: "100%",
              }}
            />
          </div>
        </div>

        {/* Projects Grid / Loading States */}
        {loading ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div
              style={{
                display: "inline-block",
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "3px solid var(--border)",
                borderTopColor: "var(--brand, #b91c1c)",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p className="muted" style={{ marginTop: 14 }}>Loading developments…</p>
          </div>
        ) : unavailable ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <p className="muted">Projects are currently unavailable. Please refresh or try again later.</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              background: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
            }}
          >
            <Building2 size={44} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>
              No developments found matching this filter
            </h3>
            <p className="muted" style={{ fontSize: 14, margin: "0 0 16px" }}>
              Try selecting a different stage tab or clearing your search keywords.
            </p>
            <button
              type="button"
              onClick={() => {
                setStageFilter("all");
                setSearchQuery("");
              }}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: "var(--brand, #b91c1c)",
                color: "#fff",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
              gap: 26,
            }}
          >
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </MarketingLayout>
  );
}
