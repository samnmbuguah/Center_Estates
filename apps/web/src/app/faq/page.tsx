import { headers } from "next/headers";
import type { Metadata } from "next";
import { isSalesOnlyHost } from "@/lib/site-mode";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { Faq } from "@/components/monitoring/pages/Faq";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";

  if (isSalesOnlyHost(host)) {
    return {
      title: "FAQ | Center Estates Kenya",
      description: "Frequently asked questions about purchasing property, Sectional Titles, diaspora purchasing, and payment plans in Kenya.",
    };
  }

  return {
    title: "FAQ | CeEst ERP",
    description: "Frequently asked questions about CeEst ERP construction management software.",
  };
}

export default async function FaqPage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const isSales = isSalesOnlyHost(host);

  return (
    <MarketingLayout isSales={isSales}>
      <Faq isSales={isSales} />
    </MarketingLayout>
  );
}
