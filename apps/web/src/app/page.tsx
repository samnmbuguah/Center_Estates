"use client";

import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { Home } from "@/components/monitoring/pages/Home";

export default function RootHomePage() {
  return (
    <MarketingLayout>
      <Home />
    </MarketingLayout>
  );
}
