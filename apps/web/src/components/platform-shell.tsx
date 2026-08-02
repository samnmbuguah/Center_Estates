"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { modules } from "@/lib/modules";
import { useAuth } from "@/components/auth-provider";
import type { DemoIdentityGroup } from "@/lib/api";

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

  if (pathname === "/login") return children;
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
    <div className={`platform ${moduleWorkspaceActive ? "module-workspace-active construction-workspace" : ""}`}>
      <aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-mark-bars"><i /><i /><i /></span>
          </span>
          <span>
            CeEst
            <br />
            <small>Center Estates · ERP</small>
          </span>
        </Link>

        <nav aria-label="Platform modules">
          <p className="nav-section-label">Workplace</p>
          <Link
            className={`nav-link ${pathname === "/" ? "active" : ""}`}
            href="/"
            title="Command Center"
            onClick={() => setMenuOpen(false)}
          >
            <span className="platform-nav-icon">⌂</span>
            <span className="nav-label">Command Center</span>
          </Link>

          <p className="nav-section-label">Modules</p>
          {modules
            .filter((module) => allowed.has(module.slug))
            .map((module) => (
              <Link
                className={`nav-link ${pathname.startsWith(`/${module.slug}`) ? "active" : ""}`}
                href={`/${module.slug}`}
                title={module.name}
                key={module.slug}
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-module-icon" style={{ color: module.accent }} aria-hidden="true">
                  {module.icon}
                </span>
                <span className="nav-label">{module.name.replace(" Management", "")}</span>
              </Link>
            ))}
          {allowed.has("property") && (
            <Link
              className={`nav-link ${pathname.startsWith("/tenant-portal") ? "active" : ""}`}
              href="/tenant-portal"
              title="Tenant Portal"
              onClick={() => setMenuOpen(false)}
            >
              <span className="nav-module-icon" style={{ color: "#7c3aed" }} aria-hidden="true">
                🔑
              </span>
              <span className="nav-label">Tenant Portal</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-support">
          <strong>Quick Support</strong>
          <span>support@ceest.co.ke</span>
          <small>Mon – Fri 8:00AM – 6:00PM</small>
        </div>
        <button className="logout-button" onClick={() => logout()}>
          Sign out
        </button>
      </aside>

      {menuOpen && (
        <button className="mobile-nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      )}

      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>

          <div className="topbar-context">
            <div className="topbar-workspace">
              <small>Active organization</small>
              <select
                aria-label="Active organization"
                value={activeOrganization?.id ?? ""}
                onChange={(event) => selectOrganization(event.target.value)}
              >
                {session.organizations.map((organization) => (
                  <option value={organization.id} key={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
            {activeModule && (
              <div className="topbar-module-crumb">
                <small>Workspace</small>
                <strong>{activeModule.name}</strong>
              </div>
            )}
          </div>

          <label className="global-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules, projects, documents, sub-routes… (Ctrl+K)"
              aria-label="Search modules"
            />
            {query && (
              <div className="global-search-results" role="listbox">
                {filteredModules.map((module) => (
                  <Link
                    key={module.slug}
                    href={`/${module.slug}`}
                    role="option"
                    onClick={() => {
                      setQuery("");
                      setMenuOpen(false);
                    }}
                  >
                    <span style={{ color: module.accent }}>{module.icon}</span>
                    <span>
                      <strong>{module.name}</strong>
                      <small>{module.description}</small>
                    </span>
                  </Link>
                ))}
                {QUICK_JUMP_ROUTES.filter((r) =>
                  [r.name, r.detail, r.module].join(" ").toLowerCase().includes(query.trim().toLowerCase())
                ).map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    role="option"
                    onClick={() => {
                      setQuery("");
                      setMenuOpen(false);
                    }}
                  >
                    <span>{route.icon}</span>
                    <span>
                      <strong>{route.name}</strong>
                      <small>{route.detail}</small>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </label>

          <div className="topbar-actions">
            <span className="system-live">
              <i />
              Systems operational
            </span>
            {session.impersonating && (
              <button type="button" className="impersonation-pill" onClick={() => void onReturnAdmin()}>
                Demo identity · Return to admin
              </button>
            )}
            <button className="topbar-icon-button" type="button" aria-label="Notifications" title="Notifications">
              🔔
            </button>
            <button className="topbar-icon-button" type="button" aria-label="Messages" title="Messages">
              ✉
            </button>
            <div className="profile-menu" ref={profileRef}>
              <button
                type="button"
                className={`profile-trigger ${profileOpen ? "open" : ""}`}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                onClick={() => setProfileOpen((open) => !open)}
              >
                <div className="profile" title={session.user.username}>
                  {initials}
                </div>
                <div className="profile-copy">
                  <strong>{displayName}</strong>
                  <small>{displayRole}</small>
                </div>
                <span className="profile-chevron" aria-hidden="true">▾</span>
              </button>
              {profileOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-head">
                    <strong>{displayName}</strong>
                    <span>{session.user.email || session.user.username}</span>
                    <em>{displayRole}</em>
                  </div>
                  <Link href="/" className="profile-dropdown-item" onClick={() => setProfileOpen(false)}>
                    Command Center
                  </Link>
                  {session.canSwitchIdentity && (
                    <div className="profile-role-switcher">
                      <p>Demo identity / role</p>
                      {switchError && <div className="form-error compact">{switchError}</div>}
                      {session.impersonating && (
                        <button type="button" className="profile-dropdown-item accent" disabled={switching} onClick={() => void onReturnAdmin()}>
                          ↩ Return to Super Administrator
                        </button>
                      )}
                      <div className="profile-role-scroll">
                        {identityGroups.length === 0 && (
                          <small className="profile-role-empty">Loading demo identities…</small>
                        )}
                        {identityGroups.map((group) => (
                          <div key={group.module} className="profile-role-group">
                            <small>{group.label}</small>
                            {group.identities.map((identity) => (
                              <button
                                key={identity.username}
                                type="button"
                                className={`profile-dropdown-item ${identity.isCurrent ? "current" : ""}`}
                                disabled={switching || identity.isCurrent}
                                onClick={() => void onSwitchIdentity(identity.username)}
                              >
                                <span>
                                  <strong>{identity.label}</strong>
                                  <small>{identity.roleName}</small>
                                </span>
                                <code>{identity.username}</code>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button type="button" className="profile-dropdown-item danger" onClick={() => void logout()}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main>
          {isKnownModule && !allowed.has(requestedModule) ? (
            <div className="page-wrap">
              <div className="notice">
                <strong>Module unavailable.</strong> Your active organization is not subscribed to this module.{" "}
                <Link href="/">Return to the command center.</Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
