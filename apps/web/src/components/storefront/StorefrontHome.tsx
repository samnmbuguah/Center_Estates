"use client";

import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { ListingsBrowser } from "./ListingsBrowser";

export { formatKES } from "./ListingsBrowser";
export type { PublicListing } from "./ListingsBrowser";

export function StorefrontHome() {
  return (
    <MarketingLayout>
      <section style={{ textAlign: "center", padding: "56px 20px 24px", maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 40, fontWeight: 900, margin: "0 0 12px" }}>Find a place you&apos;ll love to own</h1>
        <p className="muted" style={{ fontSize: 17, margin: "0 0 8px" }}>
          Browse verified off-plan and ready units from Center Estates. Enquire in one step — our sales team responds directly.
        </p>
      </section>

      <ListingsBrowser />
    </MarketingLayout>
  );
}
