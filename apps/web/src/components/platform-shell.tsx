"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { modules } from "@/lib/modules";
import { useAuth } from "@/components/auth-provider";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, loading, logout, selectOrganization } = useAuth();
  if (pathname === "/login") return children;
  if (loading || !session) return <div className="full-loading">Loading your workspace…</div>;
  const allowed = new Set(session.modules.map((module) => module.slug));
  const requestedModule = pathname.split("/")[1];
  const isKnownModule = modules.some((module) => module.slug === requestedModule);
  const activeOrganization = session.organizations.find((item) => item.id === session.activeOrganizationId);
  const constructionWorkspace = pathname.startsWith("/monitoring");
  return <div className={`platform ${constructionWorkspace ? "construction-workspace" : ""}`}>
    <aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}>
      <Link className="brand" href="/" onClick={() => setMenuOpen(false)}><span className="brand-mark">CE</span><span>Center Estates<br /><small>ERP Platform</small></span></Link>
      <nav aria-label="Platform modules">
        <Link className={`nav-link ${pathname === "/" ? "active" : ""}`} href="/" title="Command Center" onClick={() => setMenuOpen(false)}><span className="platform-nav-icon">⌂</span><span className="nav-label">Command Center</span></Link>
        {modules.filter((module) => allowed.has(module.slug)).map((module) => <Link className={`nav-link ${pathname.startsWith(`/${module.slug}`) ? "active" : ""}`} href={`/${module.slug}`} title={module.name} key={module.slug} onClick={() => setMenuOpen(false)}><span className="nav-dot" style={{ background: module.accent }} /><span className="nav-label">{module.name.replace(" Management", "")}</span></Link>)}
        {allowed.has("property") && <Link className={`nav-link ${pathname.startsWith("/tenant-portal") ? "active" : ""}`} href="/tenant-portal" title="Tenant Portal" onClick={() => setMenuOpen(false)}><span className="nav-dot" style={{ background: "#7c3aed" }} /><span className="nav-label">Tenant Portal</span></Link>}
      </nav>
      <button className="logout-button" onClick={() => logout()}>Sign out</button>
    </aside>
    {menuOpen && <button className="mobile-nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="workspace">
      <header className="topbar">
        <button className="mobile-menu-button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
        <div className="topbar-workspace"><small>Active organization</small><select aria-label="Active organization" value={activeOrganization?.id ?? ""} onChange={(event) => selectOrganization(event.target.value)}>
          {session.organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}
        </select></div>
        <div className="topbar-actions"><span className="system-live"><i/>Systems operational</span><div className="profile-copy"><strong>{session.user.firstName || session.user.username}</strong><small>{session.permissions.includes("*") ? "Platform administrator" : session.roles[0] || "Organization member"}</small></div><div className="profile" title={session.user.username}>{session.user.username.slice(0, 2).toUpperCase()}</div></div>
      </header>
      <main>{isKnownModule && !allowed.has(requestedModule)
        ? <div className="page-wrap"><div className="notice"><strong>Module unavailable.</strong> Your active organization is not subscribed to this module. <Link href="/">Return to the command center.</Link></div></div>
        : children}</main>
    </div>
  </div>;
}
