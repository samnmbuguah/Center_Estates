"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { apiFetch, csrfFromCookie, type Session } from "@/lib/api";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (id: string) => Promise<void>;
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const loadSession = useCallback(async (organizationId?: string | null) => {
    const selected = organizationId ?? localStorage.getItem("ce_organization");
    let response = await apiFetch("/auth/me/", {}, selected);
    if (response.status === 401) {
      await apiFetch("/auth/csrf/");
      const refresh = await apiFetch("/auth/refresh/", { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() } });
      if (refresh.ok) response = await apiFetch("/auth/me/", {}, selected);
    }
    if (!response.ok) {
      setSession(null);
      return false;
    }
    const data = await response.json() as Session;
    setSession(data);
    if (data.activeOrganizationId) localStorage.setItem("ce_organization", data.activeOrganizationId);
    return true;
  }, []);

  useEffect(() => {
    // Session state is synchronized from the external authentication API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession().then((authenticated) => {
      setLoading(false);
      if (!authenticated && pathname !== "/login") router.replace("/login");
      if (authenticated && pathname === "/login") router.replace("/");
    });
  }, [loadSession, pathname, router]);

  const login = useCallback(async (username: string, password: string) => {
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/auth/login/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error(response.status === 401 ? "Incorrect username or password." : "Unable to sign in.");
    await loadSession(null);
    router.replace("/");
  }, [loadSession, router]);

  const logout = useCallback(async () => {
    await apiFetch("/auth/csrf/");
    await apiFetch("/auth/logout/", { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() } });
    localStorage.removeItem("ce_organization");
    setSession(null);
    router.replace("/login");
  }, [router]);

  const selectOrganization = useCallback(async (id: string) => {
    localStorage.setItem("ce_organization", id);
    await loadSession(id);
  }, [loadSession]);

  const can = useCallback((permission: string) => Boolean(
    session?.permissions.includes("*") || session?.permissions.includes(permission)
  ), [session]);
  const value = useMemo(() => ({ session, loading, login, logout, selectOrganization, can }), [session, loading, login, logout, selectOrganization, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
