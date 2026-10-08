/**
 * Domain & Module Routing Registry
 * Adheres to SOLID Open/Closed and Single Responsibility principles.
 * Defines extensible rules for mapping domain names and subdomains to module entry points.
 */

export type ModuleScope =
  | "storefront"
  | "sales"
  | "property"
  | "tenant-portal"
  | "owner-portal"
  | "client-portal"
  | "caretaker-portal"
  | "erp-dashboard"
  | "general";

export interface DomainRule {
  id: string;
  scope: ModuleScope;
  defaultRewritePath?: string;
  matches: (hostname: string) => boolean;
}

/**
 * Clean and normalize host string (lowercase, remove port if present)
 */
export function normalizeHost(rawHost?: string): string {
  if (!rawHost) {
    if (typeof window !== "undefined") {
      return window.location.hostname.toLowerCase();
    }
    return "";
  }
  return rawHost.toLowerCase().split(":")[0].trim();
}

function getCustomSalesHosts(): string[] {
  return (process.env.NEXT_PUBLIC_SALES_HOSTS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Extensible Domain Routing Registry.
 * Easily extended without modifying middleware or component code.
 */
export const DOMAIN_RULES: DomainRule[] = [
  // 1. Sales-only Public Storefront (.co.ke)
  {
    id: "sales-storefront",
    scope: "storefront",
    matches: (host) => {
      const salesHosts = ["centerestates.co.ke", "www.centerestates.co.ke", ...getCustomSalesHosts()];
      return salesHosts.some((h) => host === h || host.endsWith(`.${h}`));
    },
  },

  // 2. Client / Buyer Portal Subdomain
  {
    id: "client-portal",
    scope: "client-portal",
    defaultRewritePath: "/client-portal",
    matches: (host) =>
      host.startsWith("buyer.") ||
      host.startsWith("buyers.") ||
      host.startsWith("portal.") ||
      host.startsWith("client."),
  },

  // 3. Tenant Portal Subdomain
  {
    id: "tenant-portal",
    scope: "tenant-portal",
    defaultRewritePath: "/tenant-portal",
    matches: (host) => host.startsWith("tenant.") || host.startsWith("tenants."),
  },

  // 4. Landlord / Property Owner Portal Subdomain
  {
    id: "owner-portal",
    scope: "owner-portal",
    defaultRewritePath: "/owner-portal",
    matches: (host) =>
      host.startsWith("owner.") ||
      host.startsWith("owners.") ||
      host.startsWith("landlord.") ||
      host.startsWith("landlords."),
  },

  // 5. Caretaker Field Portal Subdomain
  {
    id: "caretaker-portal",
    scope: "caretaker-portal",
    defaultRewritePath: "/caretaker-portal",
    matches: (host) => host.startsWith("caretaker.") || host.startsWith("caretakers."),
  },

  // 6. Dedicated Sales ERP Subdomain
  {
    id: "sales-erp",
    scope: "sales",
    defaultRewritePath: "/sales",
    matches: (host) => host.startsWith("sales."),
  },

  // 7. Dedicated Property ERP Subdomain
  {
    id: "property-erp",
    scope: "property",
    defaultRewritePath: "/property",
    matches: (host) => host.startsWith("property.") || host.startsWith("properties."),
  },

  // 8. ERP Staff Dashboard Subdomain
  {
    id: "erp-dashboard",
    scope: "erp-dashboard",
    defaultRewritePath: "/workspaces",
    matches: (host) => host.startsWith("dashboard.") || host.startsWith("app."),
  },
];

/**
 * Resolves the active domain rule for a given hostname.
 */
export function resolveDomainRule(hostname?: string): DomainRule | undefined {
  const host = normalizeHost(hostname);
  if (!host) return undefined;
  return DOMAIN_RULES.find((rule) => rule.matches(host));
}

/**
 * Check if the host is locked to the sales-only storefront mode.
 */
export function isSalesStorefrontHost(hostname?: string): boolean {
  const rule = resolveDomainRule(hostname);
  return rule?.scope === "storefront";
}
