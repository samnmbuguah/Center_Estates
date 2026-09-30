"use client";

import { Home } from "@/components/monitoring/pages/Home";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { StorefrontHome } from "@/components/storefront/StorefrontHome";
import { isSalesOnlyHost } from "@/lib/site-mode";

export default function MarketingHomePage() {
  // The sales domain opens directly on the public listings storefront.
  if (isSalesOnlyHost()) {
    return <StorefrontHome />;
  }
  return (
    <MarketingLayout>
      <Home />
    </MarketingLayout>
  );
}
