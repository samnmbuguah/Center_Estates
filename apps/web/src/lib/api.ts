import { resolveApiBaseUrl } from "@/lib/site-mode";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  is_admin: boolean;
  company_name?: string;
  logo_url?: string;
  primary_color?: string;
};
export type ModuleEntitlement = { slug: string; name: string; limits: Record<string, unknown> };
export type DemoIdentity = {
  id: number;
  username: string;
  label: string;
  roleSlug: string;
  roleName: string;
  module: string;
  isAdmin: boolean;
  isCurrent: boolean;
};
export type DemoIdentityGroup = {
  module: string;
  label: string;
  identities: DemoIdentity[];
};
export type Session = {
  user: {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    isSuperuser?: boolean;
  };
  organizations: Organization[];
  activeOrganizationId: string | null;
  modules: ModuleEntitlement[];
  roles: string[];
  roleNames?: string[];
  permissions: string[];
  impersonating?: boolean;
  canSwitchIdentity?: boolean;
};

const GET_CACHE_MS = 30_000;
const MAX_GET_CACHE_ENTRIES = 120;
const READ_TIMEOUT_MS = 20_000;
const READ_RETRY_DELAYS_MS = [350];
export const API_BASE_URL = resolveApiBaseUrl();
const getResponseCache = new Map<string, { expiresAt: number; response: Response }>();
const inFlightGets = new Map<string, Promise<Response>>();
let csrfTokenCache = "";
let refreshPromise: Promise<boolean> | null = null;

export function clearApiCache() {
  getResponseCache.clear();
  inFlightGets.clear();
}

/** Remove current and legacy API cookie variants before creating a session. */
export async function clearServerSessionCookies() {
  clearApiCache();
  csrfTokenCache = "";
  const variants = ["access", "refresh", "root"].flatMap((path) =>
    ["host", "parent"].map((domain) => ({ path, domain })),
  );
  await Promise.allSettled(variants.map(({ path, domain }) =>
    fetch(`${API_BASE_URL}/auth/logout/?path=${path}&domain=${domain}`, {
      method: "POST",
      credentials: "include",
    }),
  ));
}

function rememberGet(cacheKey: string, response: Response) {
  const now = Date.now();
  for (const [key, entry] of getResponseCache) {
    if (entry.expiresAt <= now) getResponseCache.delete(key);
  }
  while (getResponseCache.size >= MAX_GET_CACHE_ENTRIES) {
    const oldest = getResponseCache.keys().next().value;
    if (!oldest) break;
    getResponseCache.delete(oldest);
  }
  getResponseCache.set(cacheKey, { expiresAt: now + GET_CACHE_MS, response: response.clone() });
}

function announceExpiredSession() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("ce_return_after_login", `${window.location.pathname}${window.location.search}`);
  window.dispatchEvent(new CustomEvent("ce:session-expired"));
}

function announceApiError(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ce:api-error", { detail: { message } }));
}

function flattenError(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenError);
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenError);
  return [];
}

export async function apiErrorMessage(response: Response, fallback = "The request could not be completed.") {
  // A 5xx response is an operational failure, not a validation message. Never
  // render a server payload here: proxy/framework error bodies can otherwise
  // disclose internal field names or stack details to users.
  if (response.status >= 500) {
    let errorReference = "";
    try {
      const body = await response.clone().json() as { error_id?: unknown };
      if (typeof body.error_id === "string" && body.error_id.trim()) {
        errorReference = ` Support reference: ${body.error_id.trim()}.`;
      }
    } catch { /* a non-JSON 5xx still receives the same safe message */ }
    return `${fallback} Your information has been retained where possible. Please retry.${errorReference}`;
  }
  try {
    const body = await response.clone().json();
    const messages = flattenError(body).filter(Boolean);
    if (messages.length) return [...new Set(messages)].join(" ");
  } catch { /* non-JSON response */ }
  if (response.status === 400) return "The submitted data is invalid. Please verify all required fields and try again.";
  if (response.status === 401) return "Your session has expired. Sign in again to continue.";
  if (response.status === 403) return "You do not have permission to perform this action.";
  if (response.status === 404) return "The requested record or service endpoint was not found.";
  if (response.status === 409) return "A conflict occurred with this record. Please refresh the page and retry.";
  if (response.status === 502 || response.status === 503) return "The backend service is temporarily restarting or updating. Please wait a moment and retry.";
  if (response.status === 504) return "The request timed out while processing on the server. Please retry in a moment.";
  return fallback;
}

/** Download an authenticated PDF from the configured API origin. */
export async function downloadApiPdf(path: string, filename: string, organizationId?: string | null) {
  // DRF negotiates the action before it returns the binary response. Leaving
  // Accept at its normal value avoids a 406 from JSON-rendered viewsets while
  // the PDF signature/content-type checks below still reject invalid files.
  const response = await apiFetch(path, {}, organizationId ?? undefined);
  if (!response.ok) throw new Error(await apiErrorMessage(response, "The PDF could not be generated."));
  const bytes = new Uint8Array(await response.arrayBuffer());
  const signature = new TextDecoder().decode(bytes.slice(0, 5));
  if (!String(response.headers.get("content-type") || "").includes("application/pdf") || signature !== "%PDF-") {
    throw new Error("The server did not return a valid PDF document.");
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      // No known session on this browser — skip the refresh round-trip entirely.
      if (typeof window !== "undefined" && sessionStorage.getItem("ce_authenticated") !== "1") return false;
      const csrfResponse = await fetch(`${API_BASE_URL}/auth/csrf/`, { credentials: "include" });
      await rememberCsrfToken(csrfResponse);
      if (!csrfResponse.ok || !csrfTokenCache) return false;
      const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfTokenCache },
      });
      return response.ok;
    } catch {
      return false;
    }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function fetchWithSession(fullPath: string, init: RequestInit, headers: Headers) {
  const execute = async () => {
    const method = String(init.method ?? "GET").toUpperCase();
    const isSafeRead = method === "GET" || method === "HEAD";
    const delays = isSafeRead ? [0, ...READ_RETRY_DELAYS_MS] : [0];
    let lastError: unknown;
    for (const delay of delays) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const controller = !init.signal && isSafeRead ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), READ_TIMEOUT_MS) : null;
      try {
        return await fetch(`${API_BASE_URL}${fullPath}`, {
          ...init,
          headers,
          credentials: "include",
          signal: init.signal ?? controller?.signal,
        });
      } catch (error) {
        lastError = error;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
    if (!fullPath.includes("/telemetry/")) announceApiError("The server could not be reached. Your entered data has been retained; check your connection and retry.");
    throw lastError;
  };
  let response = await execute();
  const isAuthenticationRequest = ["/auth/login/", "/auth/refresh/", "/auth/logout/", "/auth/csrf/"].includes(fullPath);
  if (response.status === 401 && !isAuthenticationRequest) {
    if (await refreshAccessToken()) response = await execute();
    // Only announce expiry for users who were previously authenticated;
    // first-visit 401s on protected pages are normal and not session loss.
    const hadSession = typeof window !== "undefined" && sessionStorage.getItem("ce_authenticated") === "1";
    if (response.status === 401 && fullPath !== "/auth/me/" && hadSession) announceExpiredSession();
  }
  return response;
}

async function rememberCsrfToken(response: Response) {
  if (!response.ok) return;
  try {
    const payload = await response.clone().json() as { csrfToken?: string };
    if (payload.csrfToken) csrfTokenCache = payload.csrfToken;
  } catch { /* CSRF response was not JSON; cookie fallback remains available */ }
}

export async function apiFetch(path: string, init: RequestInit = {}, organizationId?: string | null) {
  const headers = new Headers(init.headers);
  const normalizedPath = path.replace(/\/{2,}/g, "/");
  const authPath = normalizedPath.startsWith("/auth/");
  const authContextAllowed = normalizedPath.startsWith("/auth/me/");
  const activeOrgId = organizationId ?? (typeof window !== "undefined" ? localStorage.getItem("ce_organization") : null);
  if ((!authPath || authContextAllowed) && activeOrgId && !headers.has("X-Organization-ID")) {
    headers.set("X-Organization-ID", activeOrgId);
  }
  const isPropertiesList =
    normalizedPath === "/properties/" ||
    normalizedPath.startsWith("/properties/?") ||
    normalizedPath === "/property/properties/" ||
    normalizedPath.startsWith("/property/properties/?");
  if (!authPath && !isPropertiesList && typeof window !== "undefined" && !headers.has("X-Property-Scope") && !headers.has("X-Property-ID")) {
    const raw = localStorage.getItem(activeOrgId ? `ce-active-property:${activeOrgId}` : "ce-active-property");
    if (raw) {
      try {
        const property = JSON.parse(raw) as { id?: string };
        if (property.id) headers.set("X-Property-ID", property.id);
      } catch { /* ignore malformed local context */ }
    }
  }
  const csrf = csrfFromCookie();
  if (csrf && !headers.has("X-CSRFToken")) headers.set("X-CSRFToken", csrf);
  const isMultipart = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isMultipart && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let p = path.replace(/\/+/g, "/");
  p = p.replace(/^\/hs-incidents/, "/safety-incidents");
  p = p.replace(/^\/calendar\/events/, "/calendar");
  p = p.replace(/^\/store\/items/, "/store-items");
  p = p.replace(/^\/projects\/[^/]*\/lifecycle/, "/lifecycle");
  p = p.replace(/^\/projects\/[^/]*\/milestones/, "/milestones");
  p = p.replace(/^\/projects\/[^/]*\/quality-tests/, "/quality-tests");
  p = p.replace(/^\/projects\/[^/]*\/advance-payments/, "/advance-payments");

  const [base, query] = p.split("?");
  const slashedBase = base.endsWith("/") ? base : `${base}/`;
  const cleanPath = query ? `${slashedBase}?${query}` : slashedBase;

  const isConstruction = [
    "/projects",
    "/milestones",
    "/milestone-verifications",
    "/evidence",
    "/daily-logs",
    "/risks",
    "/tickets",
    "/work-plan",
    "/boq",
    "/variations",
    "/quality-tests",
    "/rfis",
    "/safety-incidents",
    "/calendar",
    "/documents",
    "/lifecycle",
    "/materials",
    "/requisitions",
    "/certificates",
    "/disbursements",
    "/drawdowns",
  ].some((ep) => cleanPath === `${ep}/` || cleanPath.startsWith(`${ep}/?`) || cleanPath.startsWith(`${ep}/`));

  const fullPath = isConstruction ? `/construction${cleanPath}` : cleanPath;
  const method = String(init.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    getResponseCache.clear();
    let response = await fetchWithSession(fullPath, init, headers);
    // Sessions created before the frontend/API domain split can retain an old
    // or missing CSRF cookie. Refresh it once and replay the mutation instead
    // of leaving background requests (notably telemetry and token refresh) in
    // a permanent 403 retry loop. A genuine permission denial still returns
    // the second 403 to the caller.
    if (response.status === 403 && fullPath !== "/auth/csrf/") {
      const csrfResponse = await fetch(`${API_BASE_URL}/auth/csrf/`, { credentials: "include" });
      if (csrfResponse.ok) {
        await rememberCsrfToken(csrfResponse);
        const refreshedCsrf = csrfFromCookie();
        if (refreshedCsrf) headers.set("X-CSRFToken", refreshedCsrf);
        response = await fetchWithSession(fullPath, init, headers);
      }
    }
    if (!response.ok && !fullPath.startsWith("/auth/") && !fullPath.includes("/telemetry/")) {
      announceApiError(await apiErrorMessage(response));
    }
    if (response.ok && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ce:mutation-success"));
    return response;
  }

  // Authentication mutations (login, logout, refresh) bypass GET deduplication
  // and clear the cache so new credentials immediately take effect.
  if (fullPath.startsWith("/auth/") && method !== "GET") {
    clearApiCache();
    const response = await fetchWithSession(fullPath, init, headers);
    if (cleanPath === "/auth/csrf/") await rememberCsrfToken(response);
    return response.clone();
  }

  const cacheKey = [
    fullPath,
    headers.get("X-Organization-ID") ?? "",
    headers.get("X-Property-ID") ?? "",
    headers.get("X-Property-Scope") ?? "",
  ].join("|");

  // Auth reads (/auth/me/, /auth/csrf/) are not cached long-term, but MUST dedupe in-flight
  // so concurrent component mounts share a single network request.
  const isAuthRead = fullPath.startsWith("/auth/");

  if (!isAuthRead) {
    const cached = getResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response.clone();
    if (cached) getResponseCache.delete(cacheKey);
  }

  const existing = inFlightGets.get(cacheKey);
  if (existing) return (await existing).clone();

  const request = fetchWithSession(fullPath, init, headers)
    .then(async (response) => {
      if (response.ok && !isAuthRead) {
        rememberGet(cacheKey, response);
      } else if (!fullPath.startsWith("/auth/") && !fullPath.includes("/telemetry/")) {
        if (response.status === 403 && typeof window !== "undefined" && headers.has("X-Property-ID")) {
          try {
            localStorage.removeItem(activeOrgId ? `ce-active-property:${activeOrgId}` : "ce-active-property");
          } catch {}
        }
        announceApiError(await apiErrorMessage(response, "The requested information could not be loaded."));
      }
      return response;
    })
    .finally(() => inFlightGets.delete(cacheKey));
  inFlightGets.set(cacheKey, request);
  const response = (await request).clone();
  if (cleanPath === "/auth/csrf/") await rememberCsrfToken(response);
  return response;
}

export function csrfFromCookie() {
  if (csrfTokenCache) return csrfTokenCache;
  if (typeof document === "undefined") return "";
  return document.cookie.split("; ").find((value) => value.startsWith("csrftoken="))?.split("=")[1] ?? "";
}
