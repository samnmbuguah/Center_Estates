"use client";

import { useEffect, useState } from "react";
import { Home } from "@/components/monitoring/pages/Home";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { StorefrontHome } from "@/components/storefront/StorefrontHome";
import { isSalesOnlyHost } from "@/lib/site-mode";

export default function MarketingHomePage() {
  // Hostname detection is client-only; render the marketing page on the
  // server and swap to the storefront after mount to avoid hydration
  // mismatches on the sales domain.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (mounted && isSalesOnlyHost()) {
    return <StorefrontHome />;
  }
  return (
    <MarketingLayout>
      <Home />
    </MarketingLayout>
  );
}
