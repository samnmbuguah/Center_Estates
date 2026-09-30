import type { NextRequest } from "next/server";
import {
  buildResponseHeaders,
  buildUpstreamPath,
  forwardRequestHeaders,
  stripCookieDomain,
} from "@/lib/api-proxy";

/**
 * Same-origin API proxy. Browser requests to /api/v1/* on this origin are
 * forwarded to the platform API and returned verbatim except that Set-Cookie
 * Domain attributes are stripped, so the browser stores auth cookies
 * first-party for this host (Safari and strict profiles reject cross-site
 * cookies; without this, login from centerestates.co.ke fails).
 */
const UPSTREAM_BASE = (() => {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const absolute = configured.startsWith("http") ? configured : "";
  return (absolute || "https://api.centerestates.com/api/v1").replace(/\/$/, "");
})();

type HandlerContext = { params: Promise<{ segments: string[] }> };

async function handle(request: NextRequest, ctx: HandlerContext): Promise<Response> {
  const { segments } = await ctx.params;
  const target = `${UPSTREAM_BASE}/${buildUpstreamPath(segments)}${request.nextUrl.search}`;
  const method = request.method.toUpperCase();

  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: forwardRequestHeaders(request.headers),
    redirect: "manual",
    cache: "no-store",
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return Response.json(
      { detail: "The API could not be reached. Please retry." },
      { status: 502 },
    );
  }

  const headers = buildResponseHeaders(upstream.headers);
  const setCookies =
    (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const cookie of setCookies) headers.append("Set-Cookie", stripCookieDomain(cookie));

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;

export const dynamic = "force-dynamic";
