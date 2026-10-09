import { headers } from "next/headers";
import type { Metadata } from "next";
import { isSalesOnlyHost } from "@/lib/site-mode";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { About } from "@/components/monitoring/pages/About";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";

  if (isSalesOnlyHost(host)) {
    return {
      title: "About Us | Center Estates Kenya",
      description: "Learn about Center Estates Kenya — verified homes, luxury villas, commercial developments, and real estate advisory across Kenya.",
    };
  }

  return {
    title: "About | CeEst ERP",
    description: "Learn about CeEst ERP construction management software.",
  };
}

export default async function AboutPage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const isSales = isSalesOnlyHost(host);

  return (
    <MarketingLayout isSales={isSales}>
      <About isSales={isSales} />
    </MarketingLayout>
  );
}
