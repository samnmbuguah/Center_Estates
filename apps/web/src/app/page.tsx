import { headers } from "next/headers";
import { Home } from "@/components/monitoring/pages/Home";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { StorefrontHome } from "@/components/storefront/StorefrontHome";
import { isSalesOnlyHost } from "@/lib/site-mode";

export default async function MarketingHomePage() {
  const headerList = await headers();
  const host = headerList.get("host") || "";

  if (isSalesOnlyHost(host)) {
    return <StorefrontHome />;
  }

  return (
    <MarketingLayout>
      <Home />
    </MarketingLayout>
  );
}
