"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bed, Layers, MapPin, Maximize2, Sparkles, Building2 } from "lucide-react";

export type PublicListing = {
  id: string;
  project: { name: string; location: string; description?: string };
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
  const response = await fetch(`/api/v1/sales/public/listings/${query.toString() ? `?${query}` : ""}`);
  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.results) ? payload.results : [];
}

function bedroomLabel(count: number | null): string | null {
  if (count === null || count === undefined) return null;
  return count === 0 ? "Studio" : `${count} Bed${count === 1 ? "" : "s"}`;
}

export function ListingCard({ listing }: { listing: PublicListing }) {
  const image = listing.images.find((img) => img.primary) ?? listing.images[0];
  const beds = bedroomLabel(listing.unit.bedrooms);
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="storefront-listing-card"
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
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
    >
      {/* Badges */}
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {listing.is_featured && (
          <span
            style={{
              background: "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              gap: 4,
              boxShadow: "0 2px 6px rgba(185,28,28,0.3)",
            }}
          >
            <Sparkles size={11} /> Featured
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
        <div style={{ fontWeight: 900, fontSize: 20, color: "var(--brand, #b91c1c)", letterSpacing: "-0.5px" }}>
          {formatKES(listing.price)}
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
          {beds && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Bed size={14} color="#64748b" /> {beds}
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

  return (
    <>
      {!hideFilters && (
        <section style={{ padding: "0 20px 8px", display: "flex", justifyContent: "center" }}>
          <form
            onSubmit={(event) => { event.preventDefault(); void load(); }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 980 }}
          >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by project, unit or type…"
            aria-label="Search listings"
            autoFocus={autoFocus}
            style={{ flex: "2 1 240px", maxWidth: 380, padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 15 }}
          />
          <input
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Min price (KES)"
            aria-label="Minimum price"
            inputMode="numeric"
            style={{ flex: "1 1 130px", maxWidth: 170, padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 15 }}
          />
          <input
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Max price (KES)"
            aria-label="Maximum price"
            inputMode="numeric"
            style={{ flex: "1 1 130px", maxWidth: 170, padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 15 }}
          />
          <select
            value={unitType}
            onChange={(event) => setUnitType(event.target.value)}
            aria-label="Property type"
            style={{ flex: "1 1 130px", maxWidth: 180, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 15, background: "var(--surface)" }}
          >
            <option value="">All types</option>
            {UNIT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Location…"
            aria-label="Location"
            style={{ flex: "1 1 130px", maxWidth: 170, padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 15 }}
          />
          <button type="submit" className="btn primary" style={{ padding: "12px 28px", fontSize: 15 }}>Search</button>
        </form>
        {project && (
          <p className="muted" style={{ fontSize: 13, textAlign: "center", width: "100%", marginTop: 10 }}>
            Showing units from a selected project · <Link href="/properties" onClick={() => setProject("")}>Clear</Link>
          </p>
        )}
      </section>
      )}

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "8px 20px 64px" }}>
        {loading ? (
          <p className="muted" style={{ textAlign: "center" }}>Loading listings…</p>
        ) : unavailable ? (
          <p className="muted" style={{ textAlign: "center" }}>Listings are currently unavailable. Please try again later.</p>
        ) : listings.length === 0 ? (
          <p className="muted" style={{ textAlign: "center" }}>No units match your search yet — try broadening it or contact sales.</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{listings.length} available unit{listings.length === 1 ? "" : "s"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 18 }}>
              {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
            </div>
          </>
        )}
      </section>
    </>
  );
}
