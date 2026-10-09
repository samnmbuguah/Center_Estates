import { headers } from "next/headers";
import type { Metadata } from "next";
import { isSalesOnlyHost } from "@/lib/site-mode";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { Contact } from "@/components/monitoring/pages/Contact";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";

  if (isSalesOnlyHost(host)) {
    return {
      title: "Contact Sales Desk | Center Estates Kenya",
      description: "Connect with Center Estates property advisors, schedule a site viewing, or enquire about verified developments across Kenya.",
    };
  }

  return {
    title: "Contact Us | CeEst ERP",
    description: "Get in touch with the CeEst ERP team.",
  };
}

export default async function ContactPage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const isSales = isSalesOnlyHost(host);

  return (
    <MarketingLayout isSales={isSales}>
      <Contact isSales={isSales} />
    </MarketingLayout>
  );
}
