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
  return <div className="platform">
    <aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}>
      <Link className="brand" href="/" onClick={() => setMenuOpen(false)}><span className="brand-mark">CE</span><span>Center Estates<br /><small>ERP Platform</small></span></Link>
      <nav aria-label="Platform modules">
        <Link className={`nav-link ${pathname === "/" ? "active" : ""}`} href="/" onClick={() => setMenuOpen(false)}>Command Center</Link>
        {modules.filter((module) => allowed.has(module.slug)).map((module) => <Link className={`nav-link ${pathname.startsWith(`/${module.slug}`) ? "active" : ""}`} href={`/${module.slug}`} key={module.slug} onClick={() => setMenuOpen(false)}><span className="nav-dot" style={{ background: module.accent }} />{module.name.replace(" Management", "")}</Link>)}
      </nav>
      <button className="logout-button" onClick={() => logout()}>Sign out</button>
    </aside>
    {menuOpen && <button className="mobile-nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="workspace">
      <header className="topbar">
        <button className="mobile-menu-button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
        <select aria-label="Active organization" value={activeOrganization?.id ?? ""} onChange={(event) => selectOrganization(event.target.value)}>
          {session.organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}
        </select>
        <div className="profile" title={session.user.username}>{session.user.username.slice(0, 2).toUpperCase()}</div>
      </header>
      <main>{isKnownModule && !allowed.has(requestedModule)
        ? <div className="page-wrap"><div className="notice"><strong>Module unavailable.</strong> Your active organization is not subscribed to this module. <Link href="/">Return to the command center.</Link></div></div>
        : children}</main>
    </div>
  </div>;
}
