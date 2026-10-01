"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  HardHat,
  Home,
  Key,
  Layers,
  MapPin,
  MessageCircle,
  PhoneCall,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { ListingsBrowser, UNIT_TYPES, formatKES } from "./ListingsBrowser";
import type { PublicProject } from "./ProjectsPage";

export { formatKES } from "./ListingsBrowser";
export type { PublicListing } from "./ListingsBrowser";

const CATEGORIES = [
  { label: "Apartments", type: "Apartment", icon: <Building2 size={24} />, description: "Modern urban living" },
  { label: "Villas & Townhouses", type: "Villa", icon: <Home size={24} />, description: "Spacious family homes" },
  { label: "Studios", type: "Studio", icon: <Layers size={24} />, description: "High-yield investments" },
  { label: "Commercial", type: "Office", icon: <TrendingUp size={24} />, description: "Offices & retail units" },
  { label: "Off-Plan Projects", href: "/projects", icon: <HardHat size={24} />, description: "Pre-launch developments" },
  { label: "Land & Plots", type: "Land", icon: <MapPin size={24} />, description: "Prime development parcels" },
];

const TRUST_PILLARS = [
  {
    icon: <ShieldCheck size={28} color="#b91c1c" />,
    title: "Verified Sectional Titles",
    description: "Every development and unit passes comprehensive legal due diligence, sectional title registration, and survey verification.",
  },
  {
    icon: <Sparkles size={28} color="#b91c1c" />,
    title: "Direct Developer Pricing",
    description: "Zero intermediary markups or hidden fees. Transparent milestone schedules direct from leading tier-1 builders.",
  },
  {
    icon: <TrendingUp size={28} color="#b91c1c" />,
    title: "Live Milestone Tracking",
    description: "Monitor structural progress, MEP installations, and finishing works slab-by-slab via your dedicated buyer portal.",
  },
  {
    icon: <Key size={28} color="#b91c1c" />,
    title: "Complete Handover Support",
    description: "From formal snagging audits to utility meter onboarding and tenant letting, our advisory team stays with you.",
  },
];

export function StorefrontHome() {
  const [activeTab, setActiveTab] = useState<"all" | "sale" | "offplan" | "commercial">("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [featuredProjects, setFeaturedProjects] = useState<PublicProject[]>([]);

  // Applied filter state passed down to ListingsBrowser
  const [appliedFilters, setAppliedFilters] = useState<{
    search?: string;
    type?: string;
    location?: string;
    minPrice?: string;
    maxPrice?: string;
  }>({});

  // Load featured projects for the developments showcase
  useEffect(() => {
    fetch("/api/v1/sales/public/projects/")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PublicProject[]) => {
        setFeaturedProjects(Array.isArray(data) ? data.slice(0, 3) : []);
      })
      .catch(() => setFeaturedProjects([]));
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilters({
      search: searchKeyword,
      type: selectedType,
      location: selectedLocation,
      minPrice: minBudget,
      maxPrice: maxBudget,
    });
    // Smooth scroll down to the listings section
    const el = document.getElementById("available-units");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCategoryClick = (cat: (typeof CATEGORIES)[0]) => {
    if (cat.href) return; // Regular navigation
    const newType = selectedType === cat.type ? "" : (cat.type ?? "");
    setSelectedType(newType);
    setAppliedFilters((prev) => ({ ...prev, type: newType }));
    const el = document.getElementById("available-units");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <MarketingLayout>
      {/* ── 1. HERO SECTION WITH TABBED SEARCH CONSOLE ────────────────── */}
      <section
        style={{
          position: "relative",
          background: "linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.94) 100%), url('/images/hero.jpg') center/cover no-repeat",
          color: "#ffffff",
          padding: "72px 20px 88px",
          minHeight: 520,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {/* Subtle decorative glow */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "300px",
            background: "radial-gradient(circle, rgba(185, 28, 28, 0.25) 0%, rgba(15, 23, 42, 0) 70%)",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 2, maxWidth: 940, width: "100%", margin: "0 auto" }}>
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 30,
              background: "rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.2px",
              marginBottom: 20,
            }}
          >
            <Sparkles size={14} color="#fca5a5" />
            <span>Verified Real Estate &amp; Sectional Title Developments</span>
          </div>

          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.15,
              margin: "0 0 16px",
              letterSpacing: "-1px",
              textShadow: "0 2px 10px rgba(0,0,0,0.3)",
            }}
          >
            Find a Place You&apos;ll Love to Own &amp; Invest In
          </h1>

          <p
            style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              color: "rgba(255, 255, 255, 0.85)",
              maxWidth: 680,
              margin: "0 auto 36px",
              lineHeight: 1.6,
            }}
          >
            Explore verified off-plan developments, sectional-title apartments, and luxury villas direct from leading Kenyan developers.
          </p>

          {/* ── UNIFIED SEARCH CONSOLE ─────────────────── */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: "10px",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.35)",
              maxWidth: 920,
              margin: "0 auto",
              textAlign: "left",
              color: "var(--ink, #0f172a)",
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 6,
                padding: "4px 8px 12px",
                borderBottom: "1px solid #f1f5f9",
                flexWrap: "wrap",
              }}
            >
              {[
                { id: "all", label: "All Properties" },
                { id: "sale", label: "For Sale" },
                { id: "offplan", label: "Off-Plan Projects" },
                { id: "commercial", label: "Commercial" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    if (tab.id === "commercial") {
                      setSelectedType("Office");
                    } else if (tab.id === "offplan") {
                      setSelectedType("");
                    }
                  }}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background: activeTab === tab.id ? "var(--brand, #b91c1c)" : "transparent",
                    color: activeTab === tab.id ? "#ffffff" : "#64748b",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Inputs Grid */}
            <form
              onSubmit={handleSearchSubmit}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                padding: "12px 6px 4px",
                alignItems: "center",
              }}
            >
              {/* Keyword / Project input */}
              <div style={{ position: "relative" }}>
                <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Project or unit code…"
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 38px",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              {/* Property Type */}
              <div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  aria-label="Property type"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="">All Property Types</option>
                  {UNIT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div style={{ position: "relative" }}>
                <MapPin size={16} color="#94a3b8" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  placeholder="Location (e.g. Kilimani)…"
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 38px",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              {/* Price max */}
              <div>
                <input
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Max Budget (KES)…"
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              {/* Search button */}
              <div>
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 4px 12px rgba(185, 28, 28, 0.35)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <Search size={16} /> Search Properties
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ── 2. QUICK CATEGORY SELECT TILES ─────────────────────── */}
      <section style={{ maxWidth: 1180, margin: "-32px auto 48px", padding: "0 20px", position: "relative", zIndex: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
          }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedType === cat.type;
            const content = (
              <div
                style={{
                  background: isSelected ? "var(--brand, #b91c1c)" : "#ffffff",
                  color: isSelected ? "#ffffff" : "var(--ink, #0f172a)",
                  border: isSelected ? "1px solid var(--brand, #b91c1c)" : "1px solid var(--border, #e2e8f0)",
                  borderRadius: 16,
                  padding: "18px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  boxShadow: isSelected ? "0 8px 20px rgba(185, 28, 28, 0.25)" : "0 4px 12px rgba(0,0,0,0.04)",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: isSelected ? "rgba(255, 255, 255, 0.2)" : "rgba(185, 28, 28, 0.08)",
                    color: isSelected ? "#ffffff" : "var(--brand, #b91c1c)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  {cat.icon}
                </div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{cat.label}</div>
                <div style={{ fontSize: 11.5, color: isSelected ? "rgba(255,255,255,0.8)" : "var(--ink3, #64748b)", marginTop: 2 }}>
                  {cat.description}
                </div>
              </div>
            );

            if (cat.href) {
              return (
                <Link key={cat.label} href={cat.href} style={{ textDecoration: "none" }}>
                  {content}
                </Link>
              );
            }

            return (
              <div key={cat.label} onClick={() => handleCategoryClick(cat)}>
                {content}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 3. FEATURED DEVELOPMENTS / PROJECTS SHOWCASE ──────────── */}
      {featuredProjects.length > 0 && (
        <section style={{ maxWidth: 1180, margin: "0 auto 64px", padding: "0 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--brand, #b91c1c)", textTransform: "uppercase", letterSpacing: "1px" }}>
                Off-Plan &amp; Under Construction
              </span>
              <h2 style={{ fontSize: 28, fontWeight: 900, margin: "4px 0 0" }}>Featured Developments</h2>
            </div>
            <Link
              href="/projects"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 700,
                fontSize: 14,
                color: "var(--brand, #b91c1c)",
                textDecoration: "none",
              }}
            >
              Browse all developments <ArrowRight size={15} />
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}
          >
            {featuredProjects.map((project) => {
              const progress = Number(project.construction_progress ?? 0);
              return (
                <Link
                  key={project.id}
                  href={`/properties?project=${project.id}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "var(--surface)",
                    textDecoration: "none",
                    color: "inherit",
                    position: "relative",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                >
                  {/* Progress badge */}
                  <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
                    <span
                      style={{
                        background: "rgba(15, 23, 42, 0.8)",
                        backdropFilter: "blur(6px)",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "4px 10px",
                        borderRadius: 20,
                      }}
                    >
                      {progress > 0 ? `${progress}% Complete` : "Planning"}
                    </span>
                  </div>

                  {/* Image container */}
                  <div
                    style={{
                      aspectRatio: "16/10",
                      background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
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
                      <HardHat size={44} color="#94a3b8" />
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ padding: 20, flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{project.name}</div>
                    <div style={{ fontSize: 13, color: "var(--ink3, #64748b)", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <MapPin size={13} /> {project.location || "Kenya"}
                    </div>

                    {project.description && (
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--ink2, #334155)",
                          margin: "10px 0 0",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          lineHeight: 1.5,
                        }}
                      >
                        {project.description}
                      </p>
                    )}

                    <div style={{ marginTop: "auto", paddingTop: 16 }}>
                      {/* Price & availability */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                        <span style={{ fontWeight: 900, color: "var(--brand, #b91c1c)", fontSize: 16 }}>
                          {project.min_price ? `From ${formatKES(project.min_price)}` : "Price on enquiry"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--ink3, #64748b)" }}>
                          {project.listing_count} unit{project.listing_count === 1 ? "" : "s"} left
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(Math.max(progress, 0), 100)}%`,
                            background: "linear-gradient(90deg, #b91c1c 0%, #ef4444 100%)",
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 4. AVAILABLE PROPERTIES CATALOG ───────────────────────── */}
      <section id="available-units" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px 64px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--brand, #b91c1c)", textTransform: "uppercase", letterSpacing: "1px" }}>
              Direct From Developers &amp; Owners
            </span>
            <h2 style={{ fontSize: 28, fontWeight: 900, margin: "4px 0 0" }}>Explore Available Units</h2>
          </div>
          {selectedType && (
            <button
              type="button"
              onClick={() => {
                setSelectedType("");
                setAppliedFilters((prev) => ({ ...prev, type: "" }));
              }}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink2)",
                cursor: "pointer",
              }}
            >
              Filtering by: <strong>{selectedType}</strong> ✕ Clear
            </button>
          )}
        </div>

        {/* Listings browser connected to applied filters */}
        <ListingsBrowser initial={appliedFilters} />
      </section>

      {/* ── 5. WHY CHOOSE CENTER ESTATES (TRUST PILLARS) ────────────── */}
      <section
        style={{
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "72px 20px",
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 48px" }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--brand, #b91c1c)", textTransform: "uppercase", letterSpacing: "1px" }}>
              The Center Estates Standard
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 900, margin: "6px 0 12px" }}>Why Buy &amp; Invest With Us</h2>
            <p style={{ color: "var(--ink3, #64748b)", fontSize: 15, lineHeight: 1.6 }}>
              We eliminate ambiguity in real estate through legal vetting, transparent escrow, and automated milestone tracking.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 24,
            }}
          >
            {TRUST_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                style={{
                  background: "#ffffff",
                  borderRadius: 18,
                  padding: 28,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "rgba(185, 28, 28, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  {pillar.icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>{pillar.title}</h3>
                <p style={{ color: "var(--ink2, #334155)", fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. SELLER & DEVELOPER CALL-TO-ACTION BANNER ─────────────── */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 20px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            color: "#ffffff",
            borderRadius: 24,
            padding: "48px 36px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.4)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-50%",
              right: "-10%",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(185, 28, 28, 0.3) 0%, rgba(15, 23, 42, 0) 70%)",
              pointerEvents: "none",
            }}
          />

          <span
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              color: "#fca5a5",
              fontSize: 12,
              fontWeight: 800,
              padding: "4px 12px",
              borderRadius: 20,
              marginBottom: 16,
            }}
          >
            For Developers &amp; Property Owners
          </span>

          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, margin: "0 0 12px", maxWidth: 640 }}>
            Looking to Sell, Lease, or Syndicate a Development?
          </h2>

          <p style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: 15, maxWidth: 600, margin: "0 0 28px", lineHeight: 1.6 }}>
            Partner with Center Estates for institutional-grade sales distribution, buyer milestone escrow, and seamless facility handover.
          </p>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/contact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)",
                color: "#ffffff",
                padding: "14px 28px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(185, 28, 28, 0.4)",
              }}
            >
              <PhoneCall size={16} /> Schedule Advisory Consultation
            </Link>
            <a
              href="https://wa.me/254712345678?text=Hi!%20I'm%20a%20developer/owner%20interested%20in%20partnering%20with%20Center%20Estates."
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                color: "#ffffff",
                padding: "14px 24px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              <MessageCircle size={16} /> WhatsApp Sales Desk
            </a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
