import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveDomainRule } from "./lib/domain-registry";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").toLowerCase();
  const { pathname } = request.nextUrl;

  // Bypass Next.js internals, API, and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Extensible domain and subdomain routing (SOLID Open/Closed Principle)
  const matchedRule = resolveDomainRule(host);
  if (matchedRule?.defaultRewritePath && (pathname === "/" || pathname === "")) {
    const url = request.nextUrl.clone();
    url.pathname = matchedRule.defaultRewritePath;
    return NextResponse.rewrite(url);
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
  response.headers.set("CDN-Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo.png
     */
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
