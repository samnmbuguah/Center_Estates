/**
 * Sales-only storefront mode. centerestates.co.ke serves the same build as
 * centerestates.com but locked to the sales module (CRM + public listings).
 * Detection is runtime (hostname), never build-time, so one deployment
 * serves both domains with zero drift.
 */
import { isSalesStorefrontHost } from "./domain-registry";

export const SALES_MODULE = "sales";

export function isSalesOnlyHost(hostname?: string): boolean {
  return isSalesStorefrontHost(hostname);
}

/**
 * Browser-facing API base. Browser requests are routed through the same-origin
 * /api/v1 proxy (see app/api/v1/[...segments]/route.ts) so all requests and
 * auth cookies are strictly first-party same-origin. This prevents CORS
 * preflight (OPTIONS) network failures and third-party cookie/storage blocks
 * across Microsoft Edge, Safari ITP, Brave, and enterprise privacy filters.
 *
 * In server-side rendering (SSR), it falls back to the configured upstream base
 * (process.env.NEXT_PUBLIC_API_BASE_URL) so server components can connect to
 * the API directly.
 */
export function resolveApiBaseUrl(hostname?: string): string {
  if (process.env.NEXT_PUBLIC_DIRECT_API === "true") {
    return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    if ((globalThis as { __TEST_SERVER_CONTEXT__?: boolean }).__TEST_SERVER_CONTEXT__) {
      return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
    }
    return "/api/v1";
  }
  if (isSalesOnlyHost(hostname)) return "/api/v1";
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
}
