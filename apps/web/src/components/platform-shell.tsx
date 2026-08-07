"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { modules, ACTIVE_MODULES, activeModules } from "@/lib/modules";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie, type DemoIdentityGroup } from "@/lib/api";
import { useCallback } from "react";

import { HardHat, Search, Moon, Sun, ChevronDown, Building2, Settings, LogOut, HelpCircle, ClipboardCheck, FileSpreadsheet } from "lucide-react";
import AppSidebar from "@/components/app-sidebar";
import { TelemetryProvider } from "@/components/telemetry-provider";
import { TourLauncher } from "@/components/tour-launcher";
import { BrandLogo } from "@/components/brand-logo";
import { useTheme } from "@/theme/theme-provider";

const QUICK_JUMP_ROUTES: Array<{ name: string; href: string; module: string; icon: string; detail: string }> = [
  // Removed - duplicates sidebar navigation
];

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);

  // Listen for custom event to open mobile menu
  useEffect(() => {
    const handleOpenMobileMenu = () => setMenuOpen(true);
    window.addEventListener('open-mobile-menu', handleOpenMobileMenu);
    return () => window.removeEventListener('open-mobile-menu', handleOpenMobileMenu);
  }, []);

  const [identityGroups, setIdentityGroups] = useState<DemoIdentityGroup[]>([]);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [subscriptionsList, setSubscriptionsList] = useState<Array<{ id: string; module: string; is_active: boolean }>>([]);
  const [updatingSub, setUpdatingSub] = useState<string | null>(null);

  const profileRef = useRef<HTMLDivElement | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await apiFetch("/subscriptions/");
      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ id: string; module: string; is_active: boolean }> };
        setSubscriptionsList(data.results || (data as unknown as Array<{ id: string; module: string; is_active: boolean }>));
      }
    } catch (err) {
      console.error("Failed to fetch subscriptions", err);
    }
  }, []);

  const toggleModuleSubscription = async (moduleSlug: string, currentActive: boolean) => {
    setUpdatingSub(moduleSlug);
    try {
      const existing = subscriptionsList.find((s) => s.module === moduleSlug);
      if (existing) {
        await apiFetch(`/subscriptions/${existing.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({ is_active: !currentActive }),
        });
      }
      await fetchSubscriptions();
      window.location.reload();
    } catch (err) {
      console.error("Failed to update module subscription", err);
    } finally {
      setUpdatingSub(null);
    }
  };

  const {
    session,
    loading,
    logout,
    selectOrganization,
    switchIdentity,
    stopImpersonate,
    loadDemoIdentities,
  } = useAuth();
  const { mode, toggleTheme } = useTheme();

  const allowedSlugs = useMemo(
    () => (session?.modules.map((module) => module.slug) ?? []).filter((slug) => ACTIVE_MODULES.includes(slug)),
    [session?.modules],
  );

  const filteredModules = useMemo(() => {
    const term = query.trim().toLowerCase();
    const allowedSet = new Set(allowedSlugs);
    const base = modules.filter((module) => allowedSet.has(module.slug));
    if (!term) return base;
    return base.filter((module) =>
      [module.name, module.description, ...module.features].join(" ").toLowerCase().includes(term),
    );
  }, [allowedSlugs, query]);

  const filteredQuickJumps = useMemo(() => {
    const allowedSet = new Set(allowedSlugs);
    const term = query.trim().toLowerCase();
    const base = QUICK_JUMP_ROUTES.filter((r) => allowedSet.has(r.module));
    if (!term) return base;
    return base.filter((r) => `${r.name} ${r.detail}`.toLowerCase().includes(term));
  }, [allowedSlugs, query]);

  useEffect(() => {
    // Theme is now managed by useTheme hook
  }, []);

  const toggleThemeHandler = () => {
    toggleTheme();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!profileOpen || !session?.canSwitchIdentity) return;
    let cancelled = false;
    loadDemoIdentities().then((groups) => {
      if (!cancelled) setIdentityGroups(groups);
    });
    return () => {
      cancelled = true;
    };
  }, [profileOpen, session?.canSwitchIdentity, loadDemoIdentities]);

  useEffect(() => {
    if (!profileOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [profileOpen]);

  const isPublicRoute = [
    "/",
    "/login",
    "/sign-up",
    "/home",
    "/about",
    "/contact",
    "/pricing",
    "/product",
    "/demo",
    "/faq",
    "/docs",
    "/blog",
  ].some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));

  if (isPublicRoute) {
    if (session?.user && (pathname === "/login" || pathname === "/sign-up")) {
      if (typeof window !== "undefined") window.location.href = "/workspaces";
      return <div className="full-loading">Redirecting to your workspace…</div>;
    }
    return <>{children}</>;
  }
  if (loading || !session) return <div className="full-loading">Loading your workspace…</div>;

  const allowed = new Set(allowedSlugs);
  const requestedModule = pathname.split("/")[1];
  const isKnownModule = modules.some((module) => module.slug === requestedModule);
  const activeOrganization = session.organizations.find((item) => item.id === session.activeOrganizationId);
  const activeModule = modules.find((module) => pathname.startsWith(`/${module.slug}`));
  const moduleWorkspaceActive = Boolean(activeModule) || pathname.startsWith("/tenant-portal") || pathname.startsWith("/facility-portal");
  const displayName = session.user.firstName
    ? `${session.user.firstName}${session.user.lastName ? ` ${session.user.lastName}` : ""}`
    : session.user.username;
  const displayRole = session.user.isSuperuser
    ? "Super Administrator"
    : session.roleNames?.[0] || session.roles[0] || "Organization member";
  const initials = (session.user.firstName || session.user.username).slice(0, 2).toUpperCase();

  async function onSwitchIdentity(username: string) {
    setSwitching(true);
    setSwitchError("");
    try {
      await switchIdentity(username);
      setProfileOpen(false);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Unable to switch identity.");
    } finally {
      setSwitching(false);
    }
  }

  async function onReturnAdmin() {
    setSwitching(true);
    setSwitchError("");
    try {
      await stopImpersonate();
      setProfileOpen(false);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Unable to return to admin.");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <TelemetryProvider>
      <div className="platform" style={{ display: "flex", minHeight: "100vh", width: "100vw", overflowX: "hidden" }}>
      {/* UNIFIED PERSISTENT APP SIDEBAR FOR ALL PAGES */}
      <AppSidebar
        menuOpen={menuOpen}
        onCloseMobile={() => setMenuOpen(false)}
      />

      {menuOpen && (
        <button className="mobile-nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      )}

      <div className="workspace" style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: 0, paddingBottom: "60px" }}>
        {/* MONITORING ERP TOPBAR HEADER — starts where the fixed module sidebar ends */}
        <header className="topbar header-responsive" role="banner" style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", height: "clamp(56px, 8vw, 60px)", width: "100%", borderBottom: "1px solid var(--border)", background: "var(--surface)", boxSizing: "border-box", margin: 0 }}>
          <div className="topbar-left" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <BrandLogo size="sm" href="/" showWordmark={false} />
          </div>

          <label className="global-search search-responsive" style={{ flex: 1, margin: "0 16px", position: "relative", display: "flex", alignItems: "center" }}>
            <span aria-hidden="true" style={{ position: "absolute", left: 12, color: "var(--muted)", fontSize: 14 }}><Search size={14} /></span>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules, properties, tenants… (Ctrl+K)"
              aria-label="Search modules"
              className="input-touch"
              style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14, outline: "none" }}
            />
            {query && (
              <div className="global-search-results" role="listbox" style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, zIndex: 100, marginTop: 4, boxShadow: "0 10px 25px rgba(0,0,0,0.15)", maxHeight: 420, overflowY: "auto" }}>
                {filteredModules.length > 0 && (
                  <>
                    <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Modules</div>
                    {filteredModules.map((module) => (
                      <Link
                        key={module.slug}
                        href={`/${module.slug}`}
                        role="option"
                        style={{ padding: "12px 14px", display: "flex", gap: 10, textDecoration: "none", color: "var(--text)", borderBottom: "1px solid var(--border)", minHeight: "48px", alignItems: "center" }}
                        onClick={() => {
                          setQuery("");
                          setMenuOpen(false);
                        }}
                      >
                        <span style={{ color: module.accent, fontSize: 16 }}>{module.icon}</span>
                        <span>
                          <strong style={{ display: "block", fontSize: 13 }}>{module.name}</strong>
                          <small style={{ color: "var(--muted)", fontSize: 11 }}>{module.description}</small>
                        </span>
                      </Link>
                    ))}
                  </>
                )}
                {filteredQuickJumps.length > 0 && (
                  <>
                    <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Quick Jumps</div>
                    {filteredQuickJumps.map((r) => (
                      <Link
                        key={r.href}
                        href={r.href}
                        role="option"
                        style={{ padding: "12px 14px", display: "flex", gap: 10, textDecoration: "none", color: "var(--text)", borderBottom: "1px solid var(--border)", minHeight: "48px", alignItems: "center" }}
                        onClick={() => {
                          setQuery("");
                          setMenuOpen(false);
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{r.icon}</span>
                        <span>
                          <strong style={{ display: "block", fontSize: 13 }}>{r.name}</strong>
                          <small style={{ color: "var(--muted)", fontSize: 11 }}>{r.detail}</small>
                        </span>
                      </Link>
                    ))}
                  </>
                )}
                {filteredModules.length === 0 && filteredQuickJumps.length === 0 && (
                  <div style={{ padding: "16px 14px", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                    No results for &quot;{query}&quot;
                  </div>
                )}
              </div>
            )}
          </label>

          <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <TourLauncher />
            
            {/* Hide Operations link on smaller screens */}
            <Link
              href="/facility"
              className="desktop-only"
              style={{
                display: "none",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid var(--border)",
                transition: "border-color 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              title="Facility Operations — Assets, Work Orders, Maintenance"
            >
              <HardHat size={14} style={{ color: "var(--primary)" }} />
              <span style={{ display: "none" }}>Operations</span>
            </Link>

            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 140 }}>
              <small style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Organization</small>
              <select
                aria-label="Active organization"
                value={activeOrganization?.id ?? ""}
                onChange={(event) => selectOrganization(event.target.value)}
                style={{ padding: "6px 10px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", minWidth: 140 }}
              >
                {session.organizations.map((organization) => (
                  <option value={organization.id} key={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleThemeHandler}
              title={`Switch to ${mode === "dark" ? "Light" : "Dark"} Mode`}
              aria-label="Toggle Theme"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                color: "var(--text)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
              }}
            >
              {mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <div className="profile-menu" ref={profileRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                className={`profile-trigger ${profileOpen ? "open" : ""}`}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                onClick={() => setProfileOpen((open) => !open)}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: 0, cursor: "pointer", padding: 0 }}
              >
                <div className="profile" title={session.user.username} style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(145deg, #1d2b44, #0f1a2c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                  {initials}
                </div>
                <div className="profile-copy desktop-only" style={{ textAlign: "left", maxWidth: 140, overflow: "hidden", display: "none" }}>
                  <strong style={{ display: "block", fontSize: 13, color: "var(--text)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</strong>
                  <small style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayRole}</small>
                </div>
                <span className="profile-chevron desktop-only" aria-hidden="true" style={{ fontSize: 11, color: "var(--text-secondary)", display: "none" }}>
                  <ChevronDown size={14} />
                </span>
              </button>
              {profileOpen && (
                <div
                  className="profile-dropdown"
                  role="menu"
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    width: 280,
                    zIndex: 100,
                    marginTop: 8,
                    boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
                    overflow: "hidden",
                  }}
                >
                  {/* User info header */}
                  <div style={{ padding: 16, background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(145deg, #1d2b44, #0f1a2c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>{initials}</div>
                      <div>
                        <strong style={{ fontSize: 13, color: "var(--text)", display: "block" }}>{displayName}</strong>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{session.user.email || session.user.username}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "rgba(13, 148, 136, 0.12)", color: "#0d9488", fontWeight: 700 }}>{displayRole}</span>
                      {session.organizations.length > 1 && (
                        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)", fontWeight: 600 }}>{activeOrganization?.name}</span>
                      )}
                    </div>
                  </div>

                  {/* Identity switcher */}
                  {session.impersonating && (
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                      <button
                        type="button"
                        disabled={switching}
                        onClick={onReturnAdmin}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          background: "#dc2626",
                          color: "white",
                          border: 0,
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        ↩ Return to Admin User
                      </button>
                    </div>
                  )}

                  {switchError && (
                    <div style={{ padding: "6px 12px", background: "var(--danger-bg)", color: "var(--danger)", fontSize: 11, borderRadius: 6, margin: "8px 16px 0" }}>
                      {switchError}
                    </div>
                  )}

                  {/* ROLE & IDENTITY SWITCHER */}
                  {session.canSwitchIdentity && (
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", margin: "0 0 6px" }}>
                        {requestedModule && isKnownModule
                          ? `Switch Role (${modules.find((m) => m.slug === requestedModule)?.name ?? requestedModule})`
                          : "Switch Role / Identity"}
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {identityGroups
                          .filter((group) => !requestedModule || !isKnownModule || group.module === requestedModule)
                          .flatMap((group) =>
                            group.identities.map((identity) => (
                              <button
                                key={identity.username}
                                type="button"
                                disabled={switching || identity.username === session.user.username}
                                onClick={() => void onSwitchIdentity(identity.username)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  textAlign: "left",
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  border: "1px solid var(--border)",
                                  background: identity.username === session.user.username ? "var(--surface-2)" : "transparent",
                                  cursor: identity.username === session.user.username ? "default" : "pointer",
                                  opacity: identity.username === session.user.username ? 0.7 : 1,
                                }}
                              >
                                <strong style={{ fontSize: 12, color: "var(--text)" }}>{identity.label}</strong>
                                <small style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>@{identity.username}</small>
                              </button>
                            )),
                          )}
                      </div>
                    </div>
                  )}

                  {/* Quick module switcher (active modules) */}
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", margin: "0 0 8px" }}>
                      Quick Modules
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {activeModules.filter((m) => allowed.has(m.slug)).map((m) => (
                        <Link
                          key={m.slug}
                          href={`/${m.slug}`}
                          onClick={() => setProfileOpen(false)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "7px 10px",
                            borderRadius: 8,
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                            textDecoration: "none",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ fontSize: 13 }}>{m.icon}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {m.name.replace(" Management", "")}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div style={{ padding: 6 }}>
                    <Link href="/companion?tab=my-tasks" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      onClick={() => setProfileOpen(false)}>
                      <ClipboardCheck size={15} style={{ color: "var(--muted)" }} /> My Tasks
                    </Link>
                    <Link href="/workspaces" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      onClick={() => setProfileOpen(false)}>
                      <Building2 size={15} style={{ color: "var(--muted)" }} /> All Workspaces
                    </Link>
                    <div style={{ height: 1, background: "var(--border)", margin: "6px 12px" }} />
                    <Link href="/companion" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      onClick={() => setProfileOpen(false)}>
                      <Settings size={15} style={{ color: "var(--muted)" }} /> Settings
                    </Link>
                    <button
                      type="button"
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "none", border: 0, color: "var(--text)", fontSize: 13, fontWeight: 500, width: "100%", textAlign: "left", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      onClick={() => { setProfileOpen(false); window.location.href = "/companion?tab=performance"; }}
                    >
                      <HelpCircle size={15} style={{ color: "var(--muted)" }} /> Help &amp; Support
                    </button>
                    {session.canSwitchIdentity && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          setSubModalOpen(true);
                          void fetchSubscriptions();
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "none", border: 0, color: "var(--text)", fontSize: 13, fontWeight: 500, width: "100%", textAlign: "left", cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <FileSpreadsheet size={15} style={{ color: "var(--muted)" }} /> Module Access
                      </button>
                    )}
                    <div style={{ height: 1, background: "var(--border)", margin: "6px 12px" }} />
                    <button
                      type="button"
                      onClick={() => { setProfileOpen(false); logout(); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "none", border: 0, color: "#dc2626", fontSize: 13, fontWeight: 600, width: "100%", textAlign: "left", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.06)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}>
          {isKnownModule && !allowed.has(requestedModule) ? (
            <div className="page-wrap" style={{ padding: 24 }}>
              <div className="notice" style={{ padding: 16, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <strong>Module unavailable.</strong> This module is not part of the active workspace.{" "}
                <Link href="/workspaces">Return to workspace selection.</Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>

    {subModalOpen && (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>⚙️ Module Access & Subscriptions</h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>Enable or disable active platform modules for organization {session?.activeOrganizationId}.</p>
            </div>
            <button type="button" onClick={() => setSubModalOpen(false)} style={{ background: "none", border: 0, fontSize: 18, color: "var(--muted)", cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
            {[
              { slug: "property", name: "🏢 Property Management", desc: "Leases, rent roll & tenant accounts" },
              { slug: "facility", name: "🔧 Facility Management", desc: "Work orders & maintenance schedules" },
              { slug: "sales", name: "💳 Sales & Leasing", desc: "Listings, buyers & CRM pipelines" },
              { slug: "tender", name: "📝 Tender Engine", desc: "RFP invitations & contractor bids" },
              { slug: "valuation", name: "📈 Valuation Services", desc: "Site inspections & RICS reports" },
              { slug: "construction", name: "🏗️ Construction Control", desc: "Projects, IPCs & site monitoring" },
              { slug: "companion", name: "📱 Companion Tasks", desc: "Field staff task management" },
            ].map((mod) => {
              const sub = subscriptionsList.find((s) => s.module === mod.slug);
              const isActive = sub ? sub.is_active : true;
              const isPending = updatingSub === mod.slug;
              return (
                <div key={mod.slug} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <div>
                    <strong style={{ display: "block", fontSize: 13, color: "var(--text)" }}>{mod.name}</strong>
                    <small style={{ fontSize: 11, color: "var(--muted)" }}>{mod.desc}</small>
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void toggleModuleSubscription(mod.slug, isActive)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      border: 0,
                      cursor: isPending ? "wait" : "pointer",
                      background: isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(220, 38, 38, 0.15)",
                      color: isActive ? "var(--success)" : "#dc2626",
                    }}
                  >
                    {isPending ? "Updating…" : isActive ? "✓ Active" : "✕ Disabled"}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, textAlign: "right" }}>
            <button type="button" onClick={() => setSubModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: 0, fontWeight: 700, cursor: "pointer" }}>Done</button>
          </div>
        </div>
      </div>
    )}
  </TelemetryProvider>
  );
}
