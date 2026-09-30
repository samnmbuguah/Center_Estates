/**
 * Sales-only storefront mode. centerestates.co.ke serves the same build as
 * centerestates.com but locked to the sales module (CRM + public listings).
 * Detection is runtime (hostname), never build-time, so one deployment
 * serves both domains with zero drift.
 */
export const SALES_MODULE = "sales";

function salesOnlyHosts(): string[] {
  const extra = (process.env.NEXT_PUBLIC_SALES_HOSTS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return ["centerestates.co.ke", "www.centerestates.co.ke", ...extra];
}

export function isSalesOnlyHost(hostname?: string): boolean {
  const host = (
    hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  ).toLowerCase();
  if (!host) return false;
  return salesOnlyHosts().some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/**
 * Browser-facing API base. On the storefront the API is reached through the
 * same-origin /api/v1 proxy (see app/api/v1/[...segments]/route.ts) so auth
 * cookies are first-party: Safari and strict browser profiles reject
 * cross-site cookies, which silently breaks login from centerestates.co.ke.
 * The ERP keeps the direct cross-subdomain base (same registrable domain,
 * already first-party) to avoid re-routing its traffic through Next.js.
 */
export function resolveApiBaseUrl(hostname?: string): string {
  if (typeof window !== "undefined" && isSalesOnlyHost(hostname)) return "/api/v1";
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
}
