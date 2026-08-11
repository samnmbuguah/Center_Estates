export type Organization = { id: string; name: string; slug: string; is_default: boolean; is_admin: boolean };
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

const GET_CACHE_MS = 750;
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
const getResponseCache = new Map<string, { expiresAt: number; response: Response }>();
const inFlightGets = new Map<string, Promise<Response>>();
let csrfTokenCache = "";
let refreshPromise: Promise<boolean> | null = null;

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
  try {
    const body = await response.clone().json();
    const messages = flattenError(body).filter(Boolean);
    if (messages.length) return [...new Set(messages)].join(" ");
  } catch { /* non-JSON response */ }
  if (response.status === 401) return "Your session has expired. Sign in again to continue.";
  if (response.status === 403) return "You do not have permission to perform this action.";
  if (response.status >= 500) return "The service encountered an error. Your entered data has been retained; please retry.";
  return fallback;
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
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
    try {
      return await fetch(`${API_BASE_URL}${fullPath}`, { ...init, headers, credentials: "include" });
    } catch (error) {
      if (!fullPath.includes("/telemetry/")) announceApiError("The server could not be reached. Your entered data has been retained; check your connection and retry.");
      throw error;
    }
  };
  let response = await execute();
  const isAuthenticationRequest = ["/auth/login/", "/auth/refresh/", "/auth/logout/", "/auth/csrf/"].includes(fullPath);
  if (response.status === 401 && !isAuthenticationRequest) {
    if (await refreshAccessToken()) response = await execute();
    if (response.status === 401 && fullPath !== "/auth/me/") announceExpiredSession();
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
  if (organizationId) headers.set("X-Organization-ID", organizationId);
  if (typeof window !== "undefined" && !headers.has("X-Property-Scope") && !headers.has("X-Property-ID")) {
    const activeOrganization = organizationId ?? localStorage.getItem("ce_organization");
    const raw = localStorage.getItem(activeOrganization ? `ce-active-property:${activeOrganization}` : "ce-active-property");
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

  const cacheKey = [
    fullPath,
    headers.get("X-Organization-ID") ?? "",
    headers.get("X-Property-ID") ?? "",
    headers.get("X-Property-Scope") ?? "",
  ].join("|");
  const cached = getResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.response.clone();
  if (cached) getResponseCache.delete(cacheKey);

  const existing = inFlightGets.get(cacheKey);
  if (existing) return (await existing).clone();

  const request = fetchWithSession(fullPath, init, headers)
    .then(async (response) => {
      if (response.ok) {
        getResponseCache.set(cacheKey, { expiresAt: Date.now() + GET_CACHE_MS, response: response.clone() });
      } else if (!fullPath.startsWith("/auth/") && !fullPath.includes("/telemetry/")) {
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
