"use client";

import { useEffect, useState } from "react";
import type { Session } from "@/lib/api";

export type OrganizationBrand = {
  organizationId?: string;
  name: string;
  logoUrl: string;
  primaryColor: string;
};

export const DEFAULT_ORGANIZATION_BRAND: OrganizationBrand = {
  name: "Center Estates",
  logoUrl: "/logo.png",
  primaryColor: "#e52e2e",
};

const STORAGE_KEY = "ce_organization_brand";
const BRAND_EVENT = "ce:organization-brand-changed";

export function readStoredOrganizationBrand(): OrganizationBrand {
  if (typeof window === "undefined") return DEFAULT_ORGANIZATION_BRAND;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<OrganizationBrand> | null;
    if (!stored?.logoUrl) return DEFAULT_ORGANIZATION_BRAND;
    return {
      organizationId: stored.organizationId,
      name: stored.name || DEFAULT_ORGANIZATION_BRAND.name,
      logoUrl: stored.logoUrl,
      primaryColor: stored.primaryColor || DEFAULT_ORGANIZATION_BRAND.primaryColor,
    };
  } catch {
    return DEFAULT_ORGANIZATION_BRAND;
  }
}

function brandFromSession(session: Session): OrganizationBrand {
  const organization = session.organizations.find(item => item.id === session.activeOrganizationId);
  return {
    organizationId: organization?.id,
    name: organization?.company_name || organization?.name || DEFAULT_ORGANIZATION_BRAND.name,
    logoUrl: organization?.logo_url || DEFAULT_ORGANIZATION_BRAND.logoUrl,
    primaryColor: organization?.primary_color || DEFAULT_ORGANIZATION_BRAND.primaryColor,
  };
}

function faviconUrl(brand: OrganizationBrand): string {
  const separator = brand.logoUrl.includes("?") ? "&" : "?";
  return `${brand.logoUrl}${separator}organization=${encodeURIComponent(brand.organizationId || "center-estates")}&brand=${Date.now()}`;
}

function applyBrandToDocument(brand: OrganizationBrand) {
  document.documentElement.style.setProperty("--organization-primary", brand.primaryColor);
  document.title = `${brand.name} ERP`;
  const href = faviconUrl(brand);
  const relations = ["icon", "shortcut icon", "apple-touch-icon"];
  for (const relation of relations) {
    const links = Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${relation}"]`));
    if (!links.length) {
      const link = document.createElement("link");
      link.rel = relation;
      links.push(link);
      document.head.appendChild(link);
    }
    for (const link of links) {
      link.href = href;
      if (relation === "icon") link.type = "image/png";
    }
  }
}

export function OrganizationBrandingSync({ session, loading }: { session: Session | null; loading: boolean }) {
  useEffect(() => {
    if (session) {
      const brand = brandFromSession(session);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
      applyBrandToDocument(brand);
      window.dispatchEvent(new CustomEvent(BRAND_EVENT, { detail: brand }));
      return;
    }
    if (loading) {
      applyBrandToDocument(readStoredOrganizationBrand());
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    applyBrandToDocument(DEFAULT_ORGANIZATION_BRAND);
    window.dispatchEvent(new CustomEvent(BRAND_EVENT, { detail: DEFAULT_ORGANIZATION_BRAND }));
  }, [loading, session]);
  return null;
}

export function useOrganizationBrand(): OrganizationBrand {
  const [brand, setBrand] = useState<OrganizationBrand>(() => readStoredOrganizationBrand());
  useEffect(() => {
    setBrand(readStoredOrganizationBrand());
    const update = (event: Event) => setBrand((event as CustomEvent<OrganizationBrand>).detail || readStoredOrganizationBrand());
    window.addEventListener(BRAND_EVENT, update);
    return () => window.removeEventListener(BRAND_EVENT, update);
  }, []);
  return brand;
}
