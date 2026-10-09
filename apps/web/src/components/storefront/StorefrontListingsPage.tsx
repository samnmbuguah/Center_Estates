"use client";

import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { ListingsBrowser, type ListingFilters } from "./ListingsBrowser";

export function StorefrontListingsPage({
  heading,
  blurb,
  initial = {},
  autoFocus = false,
}: {
  heading: string;
  blurb?: string;
  initial?: ListingFilters;
  autoFocus?: boolean;
}) {
  return (
    <MarketingLayout isSales={true}>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "44px 20px 18px" }}>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 8px" }}>{heading}</h1>
        {blurb && <p className="muted" style={{ fontSize: 16, margin: 0, maxWidth: 720 }}>{blurb}</p>}
      </section>
      <ListingsBrowser initial={initial} autoFocus={autoFocus} />
    </MarketingLayout>
  );
}
