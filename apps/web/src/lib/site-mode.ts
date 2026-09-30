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
