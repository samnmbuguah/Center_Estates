"use client";

import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";
import { ProductShowcase } from "@/components/monitoring/pages/ProductShowcase";

export default function ProductPage() {
  return (
    <MarketingLayout>
      <ProductShowcase />
    </MarketingLayout>
  );
}
