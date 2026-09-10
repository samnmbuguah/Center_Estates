import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  // Multi-tenant subdomain routing
  // 1. Tenant Portal Subdomain (e.g. tenant.centerestates.com)
  if (host.startsWith("tenant.") || host.startsWith("tenants.")) {
    if (pathname === "/" || pathname === "") {
      const url = request.nextUrl.clone();
      url.pathname = "/tenant-portal";
      return NextResponse.rewrite(url);
    }
  }

  // 2. Unit Owner / Landlord Subdomain (e.g. owner.centerestates.com or landlord.centerestates.com)
  if (
    host.startsWith("owner.") ||
    host.startsWith("owners.") ||
    host.startsWith("landlord.") ||
    host.startsWith("landlords.")
  ) {
    if (pathname === "/" || pathname === "") {
      const url = request.nextUrl.clone();
      url.pathname = "/owner-portal";
      return NextResponse.rewrite(url);
    }
  }

  // 3. Manager / ERP Dashboard Subdomain (e.g. dashboard.centerestates.com or app.centerestates.com)
  if (host.startsWith("dashboard.") || host.startsWith("app.")) {
    if (pathname === "/" || pathname === "") {
      const url = request.nextUrl.clone();
      url.pathname = "/workspaces";
      return NextResponse.rewrite(url);
    }
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
