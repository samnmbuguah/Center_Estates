"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { modules } from "@/lib/modules";
import { useAuth } from "@/components/auth-provider";
import type { DemoIdentityGroup } from "@/lib/api";

import { AppSidebar } from "@/components/app-sidebar";
import { TelemetryProvider } from "@/components/telemetry-provider";

const QUICK_JUMP_ROUTES = [
  { name: "Projects Directory", href: "/monitoring/projects", module: "monitoring", icon: "🏗️", detail: "Active project workspaces & budgets" },
  { name: "Programme & Gantt Schedule", href: "/monitoring/projects/1/programme", module: "monitoring", icon: "📊", detail: "Critical path schedule & S-curves" },
  { name: "3D BIM Model Inspector", href: "/monitoring/projects/1/bim", module: "monitoring", icon: "🏢", detail: "WebGL 3D model & IFC GUID linking" },
  { name: "IPC Payment Builder", href: "/monitoring/projects/1/ipc", module: "monitoring", icon: "📄", detail: "Interim payment certificates & retention" },
  { name: "5x5 Risk Matrix & Heatmap", href: "/monitoring/projects/1/risks", module: "monitoring", icon: "⚠️", detail: "Risk likelihood vs impact matrix" },
  { name: "Property Portfolio Register", href: "/property/properties", module: "property", icon: "🏢", detail: "Properties, buildings & units" },
  { name: "Tenant Profiles & Accounts", href: "/property/tenants", module: "property", icon: "👥", detail: "Tenant directory & lease agreements" },
  { name: "Equipment & Asset Register", href: "/facility/assets", module: "facility", icon: "🔧", detail: "HVAC, elevators & generators" },
  { name: "Work Orders Dispatch Board", href: "/facility/work-orders", module: "facility", icon: "📋", detail: "Maintenance work orders & technicians" },
  { name: "Buyer CRM Directory", href: "/sales/buyers", module: "sales", icon: "🤝", detail: "Property buyers & KYC documents" },
  { name: "Tender RFP Register", href: "/tender/invitations", module: "tender", icon: "💼", detail: "Public & private tender invitations" },
  { name: "Valuation Instructions", href: "/valuation/instructions", module: "valuation", icon: "📜", detail: "Valuation jobs & inspection logs" },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [identityGroups, setIdentityGroups] = useState<DemoIdentityGroup[]>([]);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("light");

  const profileRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const {
    session,
    loading,
    logout,
    selectOrganization,
    switchIdentity,
    stopImpersonate,
    loadDemoIdentities,
  } = useAuth();

  const allowedSlugs = useMemo(
    () => session?.modules.map((module) => module.slug) ?? [],
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

  useEffect(() => {
    const savedTheme = (localStorage.getItem("ce-theme") as "dark" | "light") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("ce-theme", nextTheme);
    setTheme(nextTheme);
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
  const moduleWorkspaceActive = Boolean(activeModule) || pathname.startsWith("/tenant-portal");
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
        pathname={pathname}
        allowedSlugs={allowedSlugs}
        menuOpen={menuOpen}
        onCloseMobile={() => setMenuOpen(false)}
      />

      {menuOpen && !moduleWorkspaceActive && (
        <button className="mobile-nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      )}

      <div className="workspace" style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* MONITORING ERP FULL-WIDTH TOPBAR HEADER */}
        <header className="topbar" style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 60, width: "100%", borderBottom: "1px solid var(--border)", background: "var(--surface)", boxSizing: "border-box", margin: 0 }}>
          <div className="topbar-left" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link className="brand" href="/" style={{ margin: 0, textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/logo.png" alt="Center Estates" style={{ height: 32, width: "auto", objectFit: "contain" }} />
            </Link>

            {moduleWorkspaceActive && (
              <Link href="/workspaces" className="btn ghost sm" style={{ fontSize: 12, padding: "5px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                <span>←</span> Switch Workspace
              </Link>
            )}
          </div>

          <label className="global-search" style={{ flex: 1, maxWidth: 520, margin: "0 24px", position: "relative", display: "flex", alignItems: "center" }}>
            <span aria-hidden="true" style={{ position: "absolute", left: 12, color: "var(--muted)", fontSize: 14 }}>⌕</span>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules, projects, documents, sub-routes… (Ctrl+K)"
              aria-label="Search modules"
              style={{ width: "100%", padding: "7px 12px 7px 34px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, outline: "none" }}
            />
            {query && (
              <div className="global-search-results" role="listbox" style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, zIndex: 100, marginTop: 4, boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
                {filteredModules.map((module) => (
                  <Link
                    key={module.slug}
                    href={`/${module.slug}`}
                    role="option"
                    style={{ padding: "10px 14px", display: "flex", gap: 10, textDecoration: "none", color: "var(--text)", borderBottom: "1px solid var(--border)" }}
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
              </div>
            )}
          </label>

          <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/monitoring"
              className="system-live"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 20,
                background: "rgba(220, 38, 38, 0.12)",
                color: "#dc2626",
                fontSize: 11,
                fontWeight: 700,
                textDecoration: "none",
                border: "1px solid rgba(220, 38, 38, 0.2)",
              }}
              title="System-Wide Construction Monitoring & Operations Control Room"
            >
              <i style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
              System Monitoring
            </Link>

            <span className="system-live" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(16, 185, 129, 0.12)", color: "var(--success)", fontSize: 11, fontWeight: 700 }}>
              <i style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
              Live
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <small style={{ fontSize: 9, color: "var(--faint)", textTransform: "uppercase", fontWeight: 800 }}>Organization</small>
              <select
                aria-label="Active organization"
                value={activeOrganization?.id ?? ""}
                onChange={(event) => selectOrganization(event.target.value)}
                style={{ padding: "4px 10px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
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
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              aria-label="Toggle Theme"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                color: "var(--text)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>

            <div className="profile-menu" ref={profileRef} style={{ position: "relative" }}>
              <button
                type="button"
                className={`profile-trigger ${profileOpen ? "open" : ""}`}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                onClick={() => setProfileOpen((open) => !open)}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: 0, cursor: "pointer", padding: 0 }}
              >
                <div className="profile" title={session.user.username} style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(145deg, #1d2b44, #0f1a2c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>
                  {initials}
                </div>
                <div className="profile-copy" style={{ textAlign: "left" }}>
                  <strong style={{ display: "block", fontSize: 12, color: "var(--text)", lineHeight: 1.2 }}>{displayName}</strong>
                  <small style={{ display: "block", fontSize: 10, color: "var(--muted)" }}>{displayRole}</small>
                </div>
                <span className="profile-chevron" aria-hidden="true" style={{ fontSize: 10, color: "var(--muted)" }}>▾</span>
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
                    borderRadius: 10,
                    padding: 14,
                    width: 280,
                    maxHeight: 480,
                    overflowY: "auto",
                    zIndex: 100,
                    marginTop: 6,
                    boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
                  }}
                >
                  <div className="profile-dropdown-head" style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                    <strong style={{ display: "block", fontSize: 13, color: "var(--text)" }}>{displayName}</strong>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{session.user.email || session.user.username}</span>
                    <div style={{ marginTop: 4 }}>
                      <span className="status-pill" style={{ fontSize: 10, padding: "2px 8px", background: "rgba(229, 46, 46, 0.12)", color: "#e52e2e", fontWeight: 700, borderRadius: 10 }}>
                        {displayRole}
                      </span>
                    </div>
                  </div>

                  {session.impersonating && (
                    <button
                      type="button"
                      disabled={switching}
                      onClick={onReturnAdmin}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        marginBottom: 10,
                        background: "#dc2626",
                        color: "white",
                        border: 0,
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      ↩ Return to Admin User
                    </button>
                  )}

                  {switchError && (
                    <div style={{ padding: "6px 8px", background: "var(--danger-bg)", color: "var(--danger)", fontSize: 11, borderRadius: 6, marginBottom: 8 }}>
                      {switchError}
                    </div>
                  )}

                  {/* ROLE & IDENTITY SWITCHER DROPDOWN SECTION */}
                  {session.canSwitchIdentity && (
                    <div style={{ marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
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

                  <Link href="/workspaces" className="profile-dropdown-item" style={{ display: "block", padding: "8px 0", fontSize: 12, color: "var(--text)", textDecoration: "none", fontWeight: 600 }} onClick={() => setProfileOpen(false)}>
                    🏢 All Workspaces
                  </Link>

                  <button type="button" className="profile-dropdown-item danger" style={{ background: "none", border: 0, color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "8px 0", textAlign: "left", width: "100%" }} onClick={() => void logout()}>
                    🚪 Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}>
          {isKnownModule && !allowed.has(requestedModule) ? (
            <div className="page-wrap" style={{ padding: 24 }}>
              <div className="notice" style={{ padding: 16, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <strong>Module unavailable.</strong> Your active organization is not subscribed to this module.{" "}
                <Link href="/">Return to workspace selection.</Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  </TelemetryProvider>
  );
}
