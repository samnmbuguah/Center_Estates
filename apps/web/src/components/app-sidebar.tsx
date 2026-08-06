"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { modules } from "@/lib/modules";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import type { ModuleNavGroup } from "./module-shell";
import {
  propertyNav,
  facilityNav,
  salesNav,
  tenderNav,
  valuationNav,
  constructionNav,
  companionNav,
} from "@/lib/module-nav";
import { LayoutDashboard, HardHat, ClipboardCheck, CalendarDays, ClipboardList, Wrench, Shield, Settings, HelpCircle, ChevronDown, ChevronRight, Menu, X } from "lucide-react";

const MODULE_NAV_MAP: Record<string, ModuleNavGroup[]> = {
  property: propertyNav,
  facility: facilityNav,
  sales: salesNav,
  tender: tenderNav,
  valuation: valuationNav,
  monitoring: constructionNav,
  companion: companionNav,
};

type AppSidebarProps = {
  pathname: string;
  allowedSlugs: string[];
  menuOpen: boolean;
  onCloseMobile: () => void;
  activeModuleNavGroups?: ModuleNavGroup[];
  activeModuleSection?: string;
  onSelectSection?: (id: string) => void;
};

export function AppSidebar({
  pathname,
  allowedSlugs,
  menuOpen,
  onCloseMobile,
  activeModuleNavGroups,
  activeModuleSection,
  onSelectSection,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState({ tasks: 0, approvals: 0 });
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => setMounted(true), []);
  
  const { session } = useAuth();
  const allowedSet = new Set(allowedSlugs);
  const activeModuleSlug = modules.find((m) => pathname.startsWith(`/${m.slug}`))?.slug;

  const currentTab = mounted ? new URLSearchParams(window.location.search).get("tab") : null;

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setCollapsed(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const displayName = session?.user.firstName
    ? `${session.user.firstName}${session.user.lastName ? ` ${session.user.lastName}` : ""}`
    : session?.user.username || "";
  const displayRole = session?.user.isSuperuser
    ? "Super Administrator"
    : session?.roleNames?.[0] || session?.roles[0] || "Member";
  const userInitials = (session?.user.firstName || session?.user.username || "").slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!session?.activeOrganizationId) return;
    apiFetch("/companion/dashboard/", {}, session.activeOrganizationId)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.kpis) setBadgeCounts({ tasks: d.kpis.overdue + d.kpis.dueToday, approvals: d.kpis.escalated });
      })
      .catch(() => {});
  }, [session?.activeOrganizationId]);

  return (
    <>
      {/* Mobile Bottom Navigation - Only show Dashboard and More when in module */}
      {isMobile && (
        <div
          className="mobile-bottom-nav"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#0b1727",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "space-around",
            padding: "8px 0",
            zIndex: 1000,
            paddingBottom: "env(safe-area-inset-bottom, 8px)",
          }}
        >
          <Link
            href="/workspaces"
            onClick={onCloseMobile}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              color: (pathname === "/workspaces" || pathname === "/") ? "#e23b3b" : "#b8c8d7",
              textDecoration: "none",
              fontSize: 10,
              fontWeight: (pathname === "/workspaces" || pathname === "/") ? 700 : 500,
            }}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          
          {/* Only show Ops and Tasks on dashboard, not in modules */}
          {!activeModuleSlug && (
            <>
              <Link
                href="/facility"
                onClick={onCloseMobile}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  color: pathname.startsWith("/facility") ? "#e23b3b" : "#b8c8d7",
                  textDecoration: "none",
                  fontSize: 10,
                  fontWeight: pathname.startsWith("/facility") ? 700 : 500,
                }}
              >
                <HardHat size={20} />
                <span>Ops</span>
              </Link>
              <Link
                href="/companion"
                onClick={onCloseMobile}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  color: pathname.startsWith("/companion") ? "#e23b3b" : "#b8c8d7",
                  textDecoration: "none",
                  fontSize: 10,
                  fontWeight: pathname.startsWith("/companion") ? 700 : 500,
                }}
              >
                <ClipboardCheck size={20} />
                <span>Tasks</span>
              </Link>
            </>
          )}
          
          <button
            onClick={() => {
              // Trigger mobile menu open by calling the parent's menu open handler
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-mobile-menu'));
              }
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              color: "#b8c8d7",
              background: "none",
              border: "none",
              fontSize: 10,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <Menu size={20} />
            <span>More</span>
          </button>
        </div>
      )}

      {menuOpen && (
        <button
          className="mobile-nav-scrim"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 90,
            border: 0,
          }}
        />
      )}

      <aside
        className={`platform-sidebar ${menuOpen ? "mobile-open" : ""} ${collapsed ? "collapsed" : ""}`}
        role="navigation"
        aria-label="Main navigation"
        style={{
          width: isMobile ? "100%" : (collapsed ? 72 : 260),
          minWidth: isMobile ? "100%" : (collapsed ? 72 : 260),
          height: "100vh",
          position: isMobile ? "fixed" : "sticky",
          top: 0,
          left: isMobile ? (menuOpen ? 0 : "-100%") : 0,
          background: "#0f172a",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          zIndex: isMobile ? 1000 : 100,
          transition: isMobile ? "transform 0.3s ease" : "width 0.2s ease, min-width 0.2s ease",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        {/* Brand Header */}
        <div
          className="platform-brand-header"
          style={{
            padding: isMobile ? "16px" : (collapsed ? "16px 12px" : "14px 16px"),
            minHeight: 64,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {collapsed && !isMobile ? (
              <BrandLogo size="sm" showWordmark={false} dark />
            ) : (
              <BrandLogo size="sm" showWordmark dark />
            )}
          </div>
          {isMobile && (
            <button
              onClick={onCloseMobile}
              style={{
                background: "none",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: 8,
              }}
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Scrollable Nav Items */}
        <div
          className="platform-sidebar-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "16px" : (collapsed ? "12px 6px" : "12px 10px"),
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {/* WORKPLACE SECTION - Only show on dashboard/workspaces */}
          {!collapsed && !isMobile && !activeModuleSlug && (
            <p
              style={{
                padding: "6px 10px 4px",
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.35)",
                margin: 0,
              }}
            >
              WORKPLACE
            </p>
          )}

          {/* Dashboard link - always visible */}
          <Link
            className={`nav-link ${(pathname === "/workspaces" || pathname === "/") ? "active" : ""}`}
            href="/workspaces"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: isMobile ? "16px" : (collapsed ? "10px" : "9px 12px"),
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 6,
              background: (pathname === "/workspaces" || pathname === "/") ? "#e52e2e" : "transparent",
              color: "#ffffff",
              fontWeight: (pathname === "/workspaces" || pathname === "/") ? 700 : 500,
              textDecoration: "none",
              fontSize: isMobile ? 16 : 13,
            }}
            onClick={onCloseMobile}
            title="Dashboard"
          >
            <span style={{ fontSize: isMobile ? 20 : 15 }}><LayoutDashboard size={isMobile ? 24 : 18} /></span>
            {(!collapsed || isMobile) && <span>Dashboard</span>}
          </Link>

          {/* Operations Center - Only show on dashboard */}
          {!activeModuleSlug && (
            <Link
              className={`nav-link ${pathname.startsWith("/facility") ? "active" : ""}`}
              href="/facility"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: isMobile ? "16px" : (collapsed ? "10px" : "9px 12px"),
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 6,
                color: pathname.startsWith("/facility") ? "#fff" : "#b8c8d7",
                textDecoration: "none",
                fontSize: isMobile ? 16 : 13,
              }}
              onClick={onCloseMobile}
              title="Operations Center"
            >
              <span style={{ fontSize: isMobile ? 20 : 15 }}><HardHat size={isMobile ? 24 : 18} /></span>
              {(!collapsed || isMobile) && <span>Operations Center</span>}
            </Link>
          )}

          {/* My Companion - Only show on dashboard */}
          {!activeModuleSlug && (
            <Link
              className="nav-link"
              href="/companion"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "space-between",
                padding: isMobile ? "16px" : (collapsed ? "10px" : "9px 12px"),
                color: "#b8c8d7",
                textDecoration: "none",
                fontSize: isMobile ? 16 : 13,
                borderRadius: 6,
              }}
              onClick={onCloseMobile}
              title="My Companion"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: isMobile ? 20 : 15 }}><ClipboardCheck size={isMobile ? 24 : 18} /></span>
                {(!collapsed || isMobile) && <span>My Companion</span>}
              </div>
              {(!collapsed || isMobile) && badgeCounts.tasks > 0 && (
                <span style={{ background: "#e52e2e", color: "white", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "2px 6px" }}>
                  {badgeCounts.tasks}
                </span>
              )}
            </Link>
          )}

          <Link
            className="nav-link"
            href="/companion?tab=approvals"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "space-between",
              padding: collapsed ? "10px" : "9px 12px",
              color: "#b8c8d7",
              textDecoration: "none",
              fontSize: 13,
              borderRadius: 6,
            }}
            onClick={onCloseMobile}
            title="Approvals"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 15 }}><ClipboardCheck size={18} /></span>
              {!collapsed && <span>Approvals</span>}
            </div>
            {!collapsed && badgeCounts.approvals > 0 && (
              <span style={{ background: "#e52e2e", color: "white", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "2px 6px" }}>
                {badgeCounts.approvals}
              </span>
            )}
          </Link>

          <Link
            className="nav-link"
            href="/property?tab=critical-dates"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: collapsed ? "10px" : "9px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              color: "#b8c8d7",
              textDecoration: "none",
              fontSize: 13,
              borderRadius: 6,
            }}
            onClick={onCloseMobile}
            title="Calendar"
          >
            <span style={{ fontSize: 15 }}><CalendarDays size={18} /></span>
            {!collapsed && <span>Calendar</span>}
          </Link>

          {/* CROSS-MODULE HUBS */}
          <Link
            className="nav-link"
            href="/facility?tab=service-requests"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: collapsed ? "10px" : "9px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 6,
              color: pathname === "/facility" && currentTab === "service-requests" ? "#fff" : "#b8c8d7",
              background: pathname === "/facility" && currentTab === "service-requests" ? "rgba(229,46,46,0.35)" : "transparent",
              textDecoration: "none",
              fontSize: 13,
            }}
            onClick={onCloseMobile}
            title="Service Requests"
          >
            <span style={{ fontSize: 15 }}><ClipboardList size={18} /></span>
            {!collapsed && <span>Service Requests</span>}
          </Link>

          <Link
            className="nav-link"
            href="/facility?tab=assets"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: collapsed ? "10px" : "9px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 6,
              color: pathname === "/facility" && currentTab === "assets" ? "#fff" : "#b8c8d7",
              background: pathname === "/facility" && currentTab === "assets" ? "rgba(229,46,46,0.35)" : "transparent",
              textDecoration: "none",
              fontSize: 13,
            }}
            onClick={onCloseMobile}
            title="Building & Asset Onboarding"
          >
            <span style={{ fontSize: 15 }}><Wrench size={18} /></span>
            {!collapsed && <span>Building &amp; Asset Onboarding</span>}
          </Link>

          {/* MODULES SECTION */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "10px 0 6px" }} />
          {!collapsed && !isMobile && (
            <p
              style={{
                padding: "0 10px 4px",
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.35)",
                margin: 0,
              }}
            >
              MODULES
            </p>
          )}

          {modules
            .filter((m) => allowedSet.has(m.slug))
            .map((m) => {
              const isModuleActive = activeModuleSlug === m.slug;
              const moduleNav = activeModuleNavGroups || MODULE_NAV_MAP[m.slug];
              return (
                <div key={m.slug} style={{ display: "flex", flexDirection: "column" }}>
                  <Link
                    className={`nav-link ${isModuleActive ? "active" : ""}`}
                    href={`/${m.slug}`}
                    data-testid={`module-nav-${m.slug}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: isMobile ? "16px" : (collapsed ? "10px" : "9px 12px"),
                      justifyContent: collapsed ? "center" : "flex-start",
                      borderRadius: 6,
                      background: isModuleActive ? "#e52e2e" : "transparent",
                      color: isModuleActive ? "#fff" : "#b8c8d7",
                      textDecoration: "none",
                      fontSize: isMobile ? 16 : 13,
                      fontWeight: isModuleActive ? 700 : 400,
                    }}
                    onClick={onCloseMobile}
                    title={m.name}
                  >
                    <span style={{ fontSize: isMobile ? 20 : 15, flexShrink: 0 }}>{m.icon}</span>
                    {(!collapsed || isMobile) && <span style={{ flex: 1 }}>{m.name}</span>}
                    {(!collapsed || isMobile) && isModuleActive && <span style={{ fontSize: 10 }}>▼</span>}
                  </Link>

                  {/* If this module is active, automatically expand its nav items! */}
                  {(!collapsed || isMobile) && isModuleActive && moduleNav && moduleNav.length > 0 && (
                    <div
                      className="module-subnav-tree"
                      style={{
                        margin: isMobile ? "8px 0" : "4px 0 8px 16px",
                        paddingLeft: isMobile ? 16 : 10,
                        borderLeft: "2px solid rgba(229, 46, 46, 0.4)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      {moduleNav.flatMap((group) => group.items).map((item) => {
                        const isSectionActive = activeModuleSection === item.id || currentTab === item.id;
                        return (
                          <Link
                            key={item.id}
                            href={`/${m.slug}?tab=${item.id}`}
                            onClick={() => {
                              onSelectSection?.(item.id);
                              onCloseMobile();
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: isMobile ? "12px 16px" : "6px 10px",
                              borderRadius: 4,
                              background: isSectionActive ? "rgba(255,255,255,0.15)" : "transparent",
                              color: isSectionActive ? "#ffffff" : "rgba(255,255,255,0.75)",
                              textDecoration: "none",
                              fontSize: isMobile ? 14 : 12,
                              fontWeight: isSectionActive ? 700 : 400,
                            }}
                          >
                            {item.icon && <span style={{ fontSize: isMobile ? 16 : 13 }}>{item.icon}</span>}
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

          {/* SETTINGS SECTION */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "10px 0 6px" }} />
          {!collapsed && !isMobile && (
            <p
              style={{
                padding: "0 10px 4px",
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.35)",
                margin: 0,
              }}
            >
              SETTINGS
            </p>
          )}

          <Link
            className="nav-link"
            href="/companion"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: collapsed ? "10px" : "9px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              color: "#b8c8d7",
              textDecoration: "none",
              fontSize: 13,
              borderRadius: 6,
            }}
            onClick={onCloseMobile}
            title="Administration"
          >
            <span style={{ fontSize: 15 }}><Shield size={18} /></span>
            {!collapsed && <span>Administration</span>}
          </Link>

          <Link
            className="nav-link"
            href="/companion"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: collapsed ? "10px" : "9px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              color: "#b8c8d7",
              textDecoration: "none",
              fontSize: 13,
              borderRadius: 6,
            }}
            onClick={onCloseMobile}
            title="System Settings"
          >
            <span style={{ fontSize: 15 }}><Settings size={18} /></span>
            {!collapsed && <span>System Settings</span>}
          </Link>
        </div>

        {/* User Profile Card */}
        {mounted && session?.user && (
          <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(145deg, #1d2b44, #0f1a2c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
              {userInitials}
            </div>
            {!collapsed && (
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayRole}</div>
              </div>
            )}
          </div>
        )}

        {/* Support & Collapse Footer */}
        {!collapsed && (
          <div
            className="sidebar-support"
            style={{
              margin: "0 10px 10px",
              padding: 10,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <HelpCircle size={14} style={{ color: "white" }} />
              <strong style={{ fontSize: 11, color: "white" }}>Quick Support</strong>
            </div>
            <span style={{ display: "block", fontSize: 11, color: "#e2e8f0", fontWeight: 600 }}>0722 574 400</span>
            <span style={{ display: "block", fontSize: 10, color: "#94a3b8" }}>support@ceest.co.ke</span>
          </div>
        )}

        <button
          type="button"
          className="logout-button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          style={{
            margin: "0 10px 12px",
            padding: "8px 12px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "white",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 8,
            cursor: "pointer",
          }}
          title={collapsed ? "Expand Menu" : "Collapse Menu"}
        >
          <span>{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</span>
          {!collapsed && <span>Collapse Menu</span>}
        </button>
      </aside>
    </>
  );
}
