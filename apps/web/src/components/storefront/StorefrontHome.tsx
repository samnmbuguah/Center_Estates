"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";

export type PublicListing = {
  id: string;
  project: { name: string; location: string; description?: string };
  unit: { code: string; type: string; floor: string; area: string | null; bedrooms: null };
  price: string;
  minimum_deposit_percent: string;
  construction_progress: string;
  status: string;
  images: { url: string; kind: string; title: string; primary: boolean }[];
};

export function formatKES(value: string | number): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

async function fetchListings(params: { search?: string; max_price?: string }): Promise<PublicListing[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.max_price) query.set("max_price", params.max_price);
  const response = await fetch(`/api/v1/sales/public/listings/${query.toString() ? `?${query}` : ""}`);
  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.results) ? payload.results : [];
}

function ListingCard({ listing }: { listing: PublicListing }) {
  const image = listing.images.find((img) => img.primary) ?? listing.images[0];
  return (
    <Link
      href={`/listings/${listing.id}`}
      style={{ display: "block", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ aspectRatio: "16/10", background: "var(--color-sky-bg, #e0f2fe)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={listing.unit.code} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 40 }}>🏢</span>
        )}
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: "var(--primary)" }}>{formatKES(listing.price)}</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>{listing.unit.type || "Unit"} · {listing.unit.code}</div>
        <div className="muted" style={{ fontSize: 13 }}>{listing.project.name}{listing.project.location ? ` · ${listing.project.location}` : ""}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {[listing.unit.area ? `${listing.unit.area} sqft` : null, listing.unit.floor ? `Floor ${listing.unit.floor}` : null].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
    </Link>
  );
}

export function StorefrontHome() {
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchListings({ search: search.trim(), max_price: maxPrice.trim() });
      setListings(rows);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [search, maxPrice]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 350);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <MarketingLayout>
      <section style={{ textAlign: "center", padding: "56px 20px 28px", maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 40, fontWeight: 900, margin: "0 0 12px" }}>Find a place you&apos;ll love to own</h1>
        <p className="muted" style={{ fontSize: 17, margin: "0 0 24px" }}>
          Browse verified off-plan and ready units from Center Estates. Enquire in one step — our sales team responds directly.
        </p>
        <form
          onSubmit={(event) => { event.preventDefault(); void load(); }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by project, unit or type…"
            aria-label="Search listings"
            style={{ flex: "2 1 240px", maxWidth: 380, padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 15 }}
          />
          <input
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Max price (KES)"
            aria-label="Maximum price"
            inputMode="numeric"
            style={{ flex: "1 1 140px", maxWidth: 200, padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 15 }}
          />
          <button type="submit" className="btn primary" style={{ padding: "12px 28px", fontSize: 15 }}>Search</button>
        </form>
        <div style={{ marginTop: 16 }}>
          <Link href="/login" style={{ fontSize: 14 }}>Staff sign-in →</Link>
        </div>
      </section>

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
    </MarketingLayout>
  );
}
