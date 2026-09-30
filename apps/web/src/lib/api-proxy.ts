/**
 * Helpers for the same-origin /api/v1 proxy (app/api/v1/[...segments]).
 * The proxy exists so storefront (centerestates.co.ke) API calls stay
 * first-party — browsers that block third-party cookies would otherwise
 * reject the API's auth cookies and break login entirely.
 */

/** Hop-by-hop / recomputed headers that must not pass through verbatim. */
const SKIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
  "accept-encoding",
  "set-cookie",
]);

/**
 * Django stamps auth cookies with Domain=.centerestates.com. A response
 * served from centerestates.co.ke may not set cookies for another domain —
 * the browser silently discards them. Strip the Domain attribute so cookies
 * become host-only (first-party) for the storefront origin.
 */
export function stripCookieDomain(setCookie: string): string {
  return setCookie.replace(/;\s*Domain=[^;]*/i, "");
}

/** Request headers to forward upstream, minus hop-by-hop noise. */
export function forwardRequestHeaders(incoming: Headers): Headers {
  const outgoing = new Headers();
  incoming.forEach((value, key) => {
    if (!SKIP_HEADERS.has(key.toLowerCase())) outgoing.set(key, value);
  });
  return outgoing;
}

/** Response headers to return to the browser, minus hop-by-hop noise. */
export function buildResponseHeaders(upstream: Headers): Headers {
  const outgoing = new Headers();
  upstream.forEach((value, key) => {
    const name = key.toLowerCase();
    if (SKIP_HEADERS.has(name) || name === "set-cookie") return;
    outgoing.set(name, value);
  });
  return outgoing;
}

/**
 * Rebuild the upstream path from route segments, preserving the trailing
 * slash Django/DRF endpoints require. A slash-less path falls through to an
 * HTML catch-all (200 with no session), so add the slash back unless the
 * last segment looks like a file (e.g. /docs/usability-testing.pdf).
 */
export function buildUpstreamPath(segments: string[]): string {
  const cleaned = segments.filter((segment) => segment !== "." && segment !== "..");
  const path = cleaned.map((segment) => encodeURIComponent(segment)).join("/");
  const lastSegment = cleaned[cleaned.length - 1] ?? "";
  if (path && !path.endsWith("/") && !lastSegment.includes(".")) return `${path}/`;
  return path;
}
