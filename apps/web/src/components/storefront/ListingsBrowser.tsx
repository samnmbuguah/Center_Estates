"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bed, Layers, MapPin, Maximize2, Sparkles, Building2, Heart, MessageCircle } from "lucide-react";

export type PublicListing = {
  id: string;
  project: { id?: string; name: string; location: string; description?: string };
  unit: { code: string; type: string; floor: string; area: string | null; bedrooms: number | null };
  price: string;
  minimum_deposit_percent: string;
  construction_progress: string;
  status: string;
  is_featured: boolean;
  images: { url: string; kind: string; title: string; primary: boolean }[];
};

export type ListingFilters = {
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  type?: string;
  location?: string;
  project?: string;
};

export function formatKES(value: string | number): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

export function formatUSD(value: string | number): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(amount / 129));
}

export async function fetchListings(params: ListingFilters): Promise<PublicListing[]> {
  const query = new URLSearchParams();
  const search = (params.search ?? "").trim();
  const minPrice = (params.minPrice ?? "").trim();
  const maxPrice = (params.maxPrice ?? "").trim();
  const location = (params.location ?? "").trim();
  if (search) query.set("search", search);
  if (minPrice) query.set("min_price", minPrice);
  if (maxPrice) query.set("max_price", maxPrice);
  if (params.type) query.set("type", params.type);
  if (location) query.set("location", location);
  if (params.project) query.set("project", params.project);

  const response = await fetch(`/api/v1/sales/public/listings/?${query.toString()}`);
  if (!response.ok) throw new Error("bad response");
  const payload = await response.json().catch(() => ({}));
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload)) return payload;
  return [];
}

export function ListingCard({
  listing,
  isSaved = false,
  onToggleSave,
}: {
  listing: PublicListing;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
}) {
  const image = listing.images.find((i) => i.primary) ?? listing.images[0];

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--border)",
        overflow: "hidden",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.1))";
        e.currentTarget.style.borderColor = "var(--brand, #b91c1c)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* Save / Favorite Button */}
      {onToggleSave && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSave(listing.id);
          }}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 4,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: isSaved ? "#b91c1c" : "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          title={isSaved ? "Remove from shortlist" : "Save this property"}
          aria-label={isSaved ? "Remove from shortlist" : "Save property"}
        >
          <Heart size={16} fill={isSaved ? "#fff" : "none"} strokeWidth={2.2} />
        </button>
      )}

      {/* Badges */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 3,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {listing.is_featured && (
          <span
            style={{
              background: "var(--brand, #b91c1c)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 20,
              boxShadow: "0 2px 6px rgba(185, 28, 28, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Sparkles size={12} /> Featured
          </span>
        )}
        <span
          style={{
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 20,
          }}
        >
          {listing.status === "available" ? "For Sale" : listing.status.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>

      <Link
        href={`/listings/${listing.id}`}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {/* Image container */}
        <div
          style={{
            aspectRatio: "16/10",
            background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={listing.unit.code}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "transform 0.3s ease",
              }}
            />
          ) : (
            <Building2 size={44} color="#94a3b8" />
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontWeight: 900, fontSize: 20, color: "var(--brand, #b91c1c)", letterSpacing: "-0.5px" }}>
              {formatKES(listing.price)}
            </span>
            {Number(listing.price) > 0 && (
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink3, #64748b)" }}>
                (~{formatUSD(listing.price)})
              </span>
            )}
          </div>

          <div style={{ fontWeight: 800, fontSize: 16, marginTop: 4, color: "var(--ink, #0f172a)" }}>
            {listing.unit.type || "Unit"} · {listing.unit.code}
          </div>

          <div
            style={{
              fontSize: 13,
              color: "var(--ink3, #64748b)",
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
            }}
          >
            <MapPin size={13} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {listing.project.name}
              {listing.project.location ? ` · ${listing.project.location}` : ""}
            </span>
          </div>

          {/* Specs bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--border)",
              fontSize: 12,
              color: "var(--ink2, #334155)",
              flexWrap: "wrap",
            }}
          >
            {listing.unit.bedrooms !== null && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Bed size={14} color="#64748b" />{" "}
                {listing.unit.bedrooms === 0 ? "Studio" : `${listing.unit.bedrooms} Bed`}
              </span>
            )}
            {listing.unit.area && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Maximize2 size={13} color="#64748b" /> {listing.unit.area} sqft
              </span>
            )}
            {listing.unit.floor && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Layers size={13} color="#64748b" /> Fl. {listing.unit.floor}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--border)",
        overflow: "hidden",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ aspectRatio: "16/10", background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "pulse 1.5s infinite" }} />
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ width: "60%", height: 22, borderRadius: 6, background: "#e2e8f0" }} />
        <div style={{ width: "40%", height: 16, borderRadius: 6, background: "#f1f5f9" }} />
        <div style={{ width: "75%", height: 14, borderRadius: 6, background: "#f1f5f9" }} />
        <div style={{ width: "100%", height: 28, borderRadius: 6, background: "#f8fafc", marginTop: 8 }} />
      </div>
    </div>
  );
}

export const UNIT_TYPES = ["Apartment", "Bedsitter", "Studio", "Maisonette", "Villa", "Townhouse", "Office", "Retail", "Land"];

export function ListingsBrowser({
  initial = {},
  autoFocus = false,
  hideFilters = false,
}: {
  initial?: ListingFilters;
  autoFocus?: boolean;
  hideFilters?: boolean;
}) {
  const [search, setSearch] = useState(initial.search ?? "");
  const [minPrice, setMinPrice] = useState(initial.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice ?? "");
  const [unitType, setUnitType] = useState(initial.type ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [project, setProject] = useState(initial.project ?? "");
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [viewTab, setViewTab] = useState<"all" | "saved">("all");

  // Load saved favorites from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("ce_saved_units");
        if (stored) setSavedIds(JSON.parse(stored));
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("ce_saved_units", JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
  }, []);

  // Sync state if initial props change
  useEffect(() => {
    if (initial.type !== undefined) setUnitType(initial.type);
    if (initial.location !== undefined) setLocation(initial.location);
    if (initial.search !== undefined) setSearch(initial.search);
    if (initial.project !== undefined) setProject(initial.project);
  }, [initial.type, initial.location, initial.search, initial.project]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchListings({
        search: search.trim(), minPrice: minPrice.trim(), maxPrice: maxPrice.trim(),
        type: unitType, location: location.trim(), project,
      });
      setListings(rows);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [search, minPrice, maxPrice, unitType, location, project]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 350);
    return () => clearTimeout(timer);
  }, [load]);

  const visibleListings = useMemo(() => {
    if (viewTab === "saved") {
      return listings.filter((l) => savedIds.includes(l.id));
    }
    return listings;
  }, [listings, viewTab, savedIds]);

  const clearAllFilters = () => {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setUnitType("");
    setLocation("");
    setProject("");
  };

  return (
    <>
      {!hideFilters && (
        <section style={{ padding: "0 20px 8px", display: "flex", justifyContent: "center" }}>
          <form
            onSubmit={(event) => { event.preventDefault(); void load(); }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 1040 }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by project, unit code or keyword…"
              aria-label="Search listings"
              autoFocus={autoFocus}
              style={{ flex: "2 1 240px", maxWidth: 360, padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }}
            />
            <input
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Min KES"
              aria-label="Minimum price"
              inputMode="numeric"
              style={{ flex: "1 1 120px", maxWidth: 150, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }}
            />
            <input
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Max KES"
              aria-label="Maximum price"
              inputMode="numeric"
              style={{ flex: "1 1 120px", maxWidth: 150, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }}
            />
            <select
              value={unitType}
              onChange={(event) => setUnitType(event.target.value)}
              aria-label="Property type"
              style={{ flex: "1 1 130px", maxWidth: 160, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, background: "var(--surface)" }}
            >
              <option value="">All Types</option>
              {UNIT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location…"
              aria-label="Location"
              style={{ flex: "1 1 130px", maxWidth: 160, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }}
            />
            <button type="submit" className="btn primary" style={{ padding: "12px 26px", fontSize: 14, fontWeight: 700 }}>Search</button>
          </form>
          {project && (
            <p className="muted" style={{ fontSize: 13, textAlign: "center", width: "100%", marginTop: 10 }}>
              Showing units from a selected project · <Link href="/properties" onClick={() => setProject("")}>Clear filter</Link>
            </p>
          )}
        </section>
      )}

      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "12px 20px 64px" }}>
        {/* Results Bar with Saved Shortlist Tab */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
            paddingBottom: 14,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setViewTab("all")}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                fontSize: 13,
                fontWeight: viewTab === "all" ? 700 : 500,
                cursor: "pointer",
                background: viewTab === "all" ? "var(--ink, #0f172a)" : "var(--bg, #f1f5f9)",
                color: viewTab === "all" ? "#fff" : "var(--ink2, #475569)",
                transition: "all 0.15s ease",
              }}
            >
              All Properties ({listings.length})
            </button>

            <button
              type="button"
              onClick={() => setViewTab("saved")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                fontSize: 13,
                fontWeight: viewTab === "saved" ? 700 : 500,
                cursor: "pointer",
                background: viewTab === "saved" ? "var(--brand, #b91c1c)" : "var(--bg, #f1f5f9)",
                color: viewTab === "saved" ? "#fff" : "var(--ink2, #475569)",
                transition: "all 0.15s ease",
              }}
            >
              <Heart size={13} fill={viewTab === "saved" ? "#fff" : "none"} /> Saved ({savedIds.length})
            </button>
          </div>

          <div style={{ fontSize: 13, color: "var(--ink3, #64748b)" }}>
            Showing {visibleListings.length} unit{visibleListings.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Content States */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : unavailable ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <p className="muted">Listings are currently unavailable. Please refresh or try again later.</p>
          </div>
        ) : visibleListings.length === 0 ? (
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              background: "var(--surface)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              maxWidth: 580,
              margin: "20px auto",
            }}
          >
            {viewTab === "saved" ? (
              <>
                <Heart size={44} color="#b91c1c" style={{ margin: "0 auto 12px" }} />
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>
                  Your Shortlist is Empty
                </h3>
                <p className="muted" style={{ fontSize: 14, margin: "0 0 18px", lineHeight: 1.5 }}>
                  Click the heart icon on any listing card to save properties you like and compare them here.
                </p>
                <button
                  type="button"
                  onClick={() => setViewTab("all")}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    background: "var(--brand, #b91c1c)",
                    color: "#fff",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13.5,
                  }}
                >
                  Browse Available Properties
                </button>
              </>
            ) : (
              <>
                <Building2 size={44} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>
                  No Units Match Your Criteria
                </h3>
                <p className="muted" style={{ fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
                  We could not find any active units matching your selected price range or type. Try resetting your filters or contacting our sales desk for off-market inventory.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 8,
                      background: "var(--brand, #b91c1c)",
                      color: "#fff",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13.5,
                    }}
                  >
                    Reset All Filters
                  </button>
                  <a
                    href="https://wa.me/254712345678?text=Hi%20Center%20Estates%2C%20I%20am%20looking%20for%20a%20property%20matching%20specific%20requirements."
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "9px 18px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontWeight: 700,
                      textDecoration: "none",
                      fontSize: 13.5,
                    }}
                  >
                    <MessageCircle size={15} /> Talk to Sales Desk
                  </a>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 22 }}>
            {visibleListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isSaved={savedIds.includes(listing.id)}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
