"use client";

import type { CSSProperties } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { useOrganizationBrand } from "@/lib/organization-branding";

type BrandedLoaderProps = {
  message?: string;
  compact?: boolean;
};

export function BrandedLoader({ message = "Preparing your workspace", compact = false }: BrandedLoaderProps) {
  const brand = useOrganizationBrand();
  const customLogo = brand.logoUrl !== "/logo.png";
  return (
    <div className={`ce-loader${compact ? " ce-loader--compact" : ""}`} role="status" aria-live="polite" aria-label={message} style={{ "--primary": brand.primaryColor } as CSSProperties}>
      <div className="ce-loader-stage" aria-hidden="true">
        <span className="ce-loader-orbit ce-loader-orbit--outer" />
        <span className="ce-loader-orbit ce-loader-orbit--inner" />
        <span className="ce-loader-beacon ce-loader-beacon--one" />
        <span className="ce-loader-beacon ce-loader-beacon--two" />
        <div className={`ce-loader-logo${customLogo ? " ce-loader-logo--wide" : ""}`}>
          {customLogo
            ? <img src={brand.logoUrl} alt={brand.name} width={118} height={58} loading="eager" />
            : <BrandLogo showWordmark={false} dark={false} size="lg" />}
        </div>
        <div className="ce-loader-skyline"><i /><i /><i /><i /><i /></div>
        <span className="ce-loader-scan" />
      </div>
      <div className="ce-loader-copy">
        <strong>{message}</strong>
        <span>{brand.name} · connecting properties, people and operations</span>
        <span className="ce-loader-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    </div>
  );
}
