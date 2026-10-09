import { headers } from "next/headers";
import type { Metadata } from "next";
import { Home } from "@/components/monitoring/pages/Home";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { StorefrontHome } from "@/components/storefront/StorefrontHome";
import { isSalesOnlyHost } from "@/lib/site-mode";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";

  if (isSalesOnlyHost(host)) {
    return {
      title: "Center Estates | Real Estate & Property Listings Kenya",
      description:
        "Explore verified off-plan developments, sectional-title apartments, villas, and prime property listings across Kenya.",
    };
  }

  return {
    title: "CeEst ERP | Unified Estate & Property Operations Platform",
    description: "Unified estate and property operations platform for managing leases, utilities, facilities, and sales.",
  };
}

export default async function MarketingHomePage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";

  if (isSalesOnlyHost(host)) {
    return <StorefrontHome />;
  }

  return (
    <MarketingLayout isSales={false}>
      <Home />
    </MarketingLayout>
  );
}
