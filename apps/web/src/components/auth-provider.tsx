"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  apiFetch,
  clearApiCache,
  clearServerSessionCookies,
  csrfFromCookie,
  type DemoIdentityGroup,
  type Session,
} from "@/lib/api";
import { isPublicRoute } from "@/lib/public-routes";
import { OrganizationBrandingSync } from "@/lib/organization-branding";

const QM_LOGIN_BRIEF_STORAGE_KEY = "ce_qm_brief_after_login";
const AUTH_FLAG_STORAGE_KEY = "ce_authenticated";

/** True when this browser has (or recently had) an authenticated platform session. */
function hasKnownSession() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(AUTH_FLAG_STORAGE_KEY) === "1";
}

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string, site: "sales" | "erp") => Promise<string>;
  logout: () => Promise<void>;
  selectOrganization: (id: string) => Promise<void>;
  can: (permission: string) => boolean;
  switchIdentity: (username: string) => Promise<void>;
  stopImpersonate: () => Promise<void>;
  loadDemoIdentities: () => Promise<DemoIdentityGroup[]>;
};

type SessionLoadResult = "authenticated" | "unauthenticated" | "unavailable";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const loadSession = useCallback(async (organizationId?: string | null): Promise<SessionLoadResult> => {
    try {
      // Public pages are visited by anonymous traffic far more often than by
      // signed-in users. Without a known session flag, skip the network
      // round-trips entirely instead of emitting /auth/me/ 401 +
      // /auth/refresh/ 400 noise for every anonymous page view. Auth cookies
      // live on the API subdomain, so document.cookie cannot be used as a
      // signal from the web origin.
      const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
      if (isPublicRoute(pathname) && !hasKnownSession()) {
        setSession(null);
        return "unauthenticated";
      }
      const selected = organizationId ?? localStorage.getItem("ce_organization");
      let response = await apiFetch("/auth/me/", {}, selected);
      // An organization choice belongs to a previous browser session.  It may
      // no longer be available to the user who has just signed in (for
      // example, when a shared computer changes from an administrator to a
      // property manager). Retry without that stale header before treating the
      // workspace as unavailable.
      if (response.status === 403 && selected && organizationId === undefined) {
        localStorage.removeItem("ce_organization");
        localStorage.removeItem("ce_organization_brand");
        response = await apiFetch("/auth/me/");
      }
      if (response.status === 401 || response.status === 403) {
        if (typeof window !== "undefined") sessionStorage.removeItem(AUTH_FLAG_STORAGE_KEY);
        setSession(null);
        return "unauthenticated";
      }
      // A deploy, proxy restart, timeout or upstream 5xx is not evidence that
      // the signed refresh cookie has expired. Preserve local session state and
      // let the bootstrap retry instead of forcing a new login.
      if (!response.ok) return "unavailable";
      const data = await response.json() as Session;
      setSession(data);
      if (typeof window !== "undefined") sessionStorage.setItem(AUTH_FLAG_STORAGE_KEY, "1");
      if (data.activeOrganizationId) localStorage.setItem("ce_organization", data.activeOrganizationId);
      // CSRF is only required for mutations.  Warming it immediately after
      // /auth/me used to add another competing request during the critical
      // post-login bootstrap burst (notifications, workspace and companion).
      // Defer it; apiFetch still refreshes it automatically before a mutation
      // if it has expired.
      if (typeof window !== "undefined") {
        window.setTimeout(() => void apiFetch("/auth/csrf/").catch(() => undefined), 5_000);
      }
      return "authenticated";
    } catch (error) {
      // Log the error but don't expose to user - treat as temporary network issue
      console.debug("Session load error (will retry):", error);
      return "unavailable";
    }
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setSession(null);
      sessionStorage.removeItem(AUTH_FLAG_STORAGE_KEY);
      if (isPublicRoute(pathname)) return;
      router.replace("/login?reason=session-expired");
    };
    window.addEventListener("ce:session-expired", handleExpiredSession);
    return () => window.removeEventListener("ce:session-expired", handleExpiredSession);
  }, [pathname, router]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const synchronize = async (attempt = 0) => {
      const result = await loadSession();
      if (cancelled) return;
      if (result === "unavailable" && attempt < 5) {
        timer = setTimeout(() => void synchronize(attempt + 1), Math.min(1000 * (2 ** attempt), 8000));
        return;
      }
      setLoading(false);
      if (result === "unauthenticated" && !isPublicRoute(pathname)) router.replace("/login");
      if (result === "authenticated" && (pathname === "/login" || pathname === "/sign-up")) router.replace("/workspaces");
    };
    void synchronize();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [loadSession, pathname, router]);

  const login = useCallback(async (username: string, password: string) => {
    clearApiCache();
    // Normal-window-only failures indicate stale browser-scoped session data.
    // Remove every historical API cookie variant before issuing fresh tokens.
    await clearServerSessionCookies();
    await apiFetch("/auth/csrf/").catch(() => undefined);
    const response = await apiFetch("/auth/login/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      let message = response.status === 401 ? "Incorrect username or password." : "Unable to sign in. Please try again.";
      try {
        const body = await response.json();
        if (body?.detail && typeof body.detail === "string") message = body.detail;
      } catch { /* non-JSON error body */ }
      throw new Error(message);
    }
    // Credentials verified: mark the browser as authenticated before the
    // post-login session load so the public-route bootstrap skip doesn't
    // short-circuit it while we are still on /login.
    sessionStorage.setItem(AUTH_FLAG_STORAGE_KEY, "1");
    // Never carry a different person's last selected organization through a
    // new login. The API selects this user's default organization first.
    localStorage.removeItem("ce_organization");
    localStorage.removeItem("ce_organization_brand");
    const sessionResult = await loadSession(undefined);
    if (sessionResult !== "authenticated") throw new Error("Signed in, but the workspace could not be loaded. Please retry.");
    sessionStorage.setItem(QM_LOGIN_BRIEF_STORAGE_KEY, "1");
    const returnTo = sessionStorage.getItem("ce_return_after_login");
    sessionStorage.removeItem("ce_return_after_login");
    router.replace(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/workspaces");
  }, [loadSession, router]);

  const loginWithGoogle = useCallback(async (credential: string, site: "sales" | "erp") => {
    clearApiCache();
    await clearServerSessionCookies();
    const response = await apiFetch("/auth/google/", {
      method: "POST",
      body: JSON.stringify({ credential, site }),
    });
    if (!response.ok) {
      let message = "Unable to sign in with Google.";
      try {
        const body = await response.json();
        if (body?.detail && typeof body.detail === "string") message = body.detail;
      } catch { /* non-JSON error body */ }
      throw new Error(message);
    }
    const data = await response.json().catch(() => ({}));
    sessionStorage.setItem(AUTH_FLAG_STORAGE_KEY, "1");
    localStorage.removeItem("ce_organization");
    localStorage.removeItem("ce_organization_brand");
    const sessionResult = await loadSession(undefined);
    if (sessionResult !== "authenticated") throw new Error("Signed in, but the session could not be established. Please retry.");
    sessionStorage.setItem(QM_LOGIN_BRIEF_STORAGE_KEY, "1");
    const returnTo = sessionStorage.getItem("ce_return_after_login");
    sessionStorage.removeItem("ce_return_after_login");
    const target = returnTo?.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : (data?.redirect_to || (site === "sales" ? "/client-portal" : "/workspaces"));
    router.replace(target);
    return target;
  }, [loadSession, router]);

  const logout = useCallback(async () => {
    try {
      clearApiCache();
      await clearServerSessionCookies();
    } finally {
      localStorage.removeItem("ce_organization");
      localStorage.removeItem("ce_organization_brand");
      sessionStorage.removeItem(AUTH_FLAG_STORAGE_KEY);
      sessionStorage.removeItem(QM_LOGIN_BRIEF_STORAGE_KEY);
      sessionStorage.removeItem("ce_return_after_login");
      setSession(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      } else {
        router.replace("/login");
      }
    }
  }, [router]);

  const selectOrganization = useCallback(async (id: string) => {
    clearApiCache();
    localStorage.setItem("ce_organization", id);
    await loadSession(id);
  }, [loadSession]);

  const switchIdentity = useCallback(async (username: string) => {
    clearApiCache();
    await apiFetch("/auth/csrf/");
    const organizationId = localStorage.getItem("ce_organization");
    const response = await apiFetch(
      "/auth/impersonate/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ username }),
      },
      organizationId,
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || "Unable to switch demo identity.");
    }
    await loadSession(organizationId);
    // Stay in the command center so the role-filtered sidebar remains visible.
    router.replace("/workspaces");
  }, [loadSession, router]);

  const stopImpersonate = useCallback(async () => {
    clearApiCache();
    await apiFetch("/auth/csrf/");
    const organizationId = localStorage.getItem("ce_organization");
    const response = await apiFetch(
      "/auth/stop-impersonate/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: "{}",
      },
      organizationId,
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || "Unable to return to administrator.");
    }
    await loadSession(organizationId);
    router.replace("/workspaces");
  }, [loadSession, router]);

  const loadDemoIdentities = useCallback(async () => {
    const organizationId = localStorage.getItem("ce_organization");
    const response = await apiFetch("/auth/demo-identities/", {}, organizationId);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.groups ?? []) as DemoIdentityGroup[];
  }, []);

  const can = useCallback((permission: string) => Boolean(
    session?.permissions.includes("*") || session?.permissions.includes(permission)
  ), [session]);
  const value = useMemo(
    () => ({
      session,
      loading,
      login,
      loginWithGoogle,
      logout,
      selectOrganization,
      can,
      switchIdentity,
      stopImpersonate,
      loadDemoIdentities,
    }),
    [session, loading, login, loginWithGoogle, logout, selectOrganization, can, switchIdentity, stopImpersonate, loadDemoIdentities],
  );
  return <AuthContext.Provider value={value}>
    <OrganizationBrandingSync session={session} loading={loading} />
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
