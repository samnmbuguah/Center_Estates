"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  apiFetch,
  clearApiCache,
  csrfFromCookie,
  type DemoIdentityGroup,
  type Session,
} from "@/lib/api";
import { isPublicRoute } from "@/lib/public-routes";
import { OrganizationBrandingSync } from "@/lib/organization-branding";

const QM_LOGIN_BRIEF_STORAGE_KEY = "ce_qm_brief_after_login";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
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
      const selected = organizationId ?? localStorage.getItem("ce_organization");
      const response = await apiFetch("/auth/me/", {}, selected);
      if (response.status === 401 || response.status === 403) {
        setSession(null);
        return "unauthenticated";
      }
      // A deploy, proxy restart, timeout or upstream 5xx is not evidence that
      // the signed refresh cookie has expired. Preserve local session state and
      // let the bootstrap retry instead of forcing a new login.
      if (!response.ok) return "unavailable";
      const data = await response.json() as Session;
      setSession(data);
      if (data.activeOrganizationId) localStorage.setItem("ce_organization", data.activeOrganizationId);
      // Warm the CSRF token for the next mutation without making a temporary
      // CSRF endpoint failure invalidate an otherwise healthy session.
      void apiFetch("/auth/csrf/").catch(() => undefined);
      return "authenticated";
    } catch {
      return "unavailable";
    }
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setSession(null);
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
    await apiFetch("/auth/csrf/");
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
    const sessionResult = await loadSession(null);
    if (sessionResult !== "authenticated") throw new Error("Signed in, but the workspace could not be loaded. Please retry.");
    sessionStorage.setItem(QM_LOGIN_BRIEF_STORAGE_KEY, "1");
    const returnTo = sessionStorage.getItem("ce_return_after_login");
    sessionStorage.removeItem("ce_return_after_login");
    router.replace(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/workspaces");
  }, [loadSession, router]);

  const logout = useCallback(async () => {
    try {
      clearApiCache();
      await apiFetch("/auth/csrf/").catch(() => undefined);
      await apiFetch("/auth/logout/", { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() } }).catch(() => undefined);
    } finally {
      localStorage.removeItem("ce_organization");
      sessionStorage.removeItem(QM_LOGIN_BRIEF_STORAGE_KEY);
      sessionStorage.removeItem("ce_return_after_login");
      setSession(null);
      if (typeof window !== "undefined") {
        window.location.replace("/login");
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
      logout,
      selectOrganization,
      can,
      switchIdentity,
      stopImpersonate,
      loadDemoIdentities,
    }),
    [session, loading, login, logout, selectOrganization, can, switchIdentity, stopImpersonate, loadDemoIdentities],
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
