"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { usePermissions } from "@/hooks/usePermissions";
import { BrandLogo } from "@/components/brand-logo";
import {
  LayoutDashboard,
  ClipboardCheck,
  Menu,
  X,
  ChartNoAxesCombined,
  CalendarDays,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";

const modules = [
  { slug: "property", name: "Property", icon: "🏢", accent: "var(--color-brand-red)" },
  { slug: "facility", name: "Facility", icon: "🔧", accent: "var(--color-brand-blue)" },
  { slug: "sales", name: "Sales", icon: "💰", accent: "var(--color-emerald)" },
  { slug: "tender", name: "Tender", icon: "📋", accent: "var(--color-amber)" },
  { slug: "valuation", name: "Valuation", icon: "📜", accent: "var(--color-violet-strong)" },
  { slug: "monitoring", name: "Monitoring", icon: "📊", accent: "#06b6d4" },
  { slug: "companion", name: "Companion", icon: "🧭", accent: "#ec4899" },
];

const SETTINGS_SUBITEMS = [
  { id: "profile", label: "Profile & Account", icon: "👤", href: "/settings?tab=profile" },
  { id: "security", label: "Security & Password", icon: "🔒", href: "/settings?tab=security" },
  { id: "notifications", label: "Notifications & Alerts", icon: "🔔", href: "/settings?tab=notifications" },
  { id: "appearance", label: "Display & Regional", icon: "🎨", href: "/settings?tab=appearance" },
];

const ADMIN_SUBITEMS = [
  { id: "users", label: "Users & Staff Accounts", icon: "👥", href: "/administration?tab=users" },
  { id: "roles", label: "Roles & Permissions", icon: "🔐", href: "/administration?tab=roles" },
  { id: "orgs", label: "Organization & Modules", icon: "🏢", href: "/administration?tab=orgs" },
  { id: "mpesa", label: "M-Pesa & Payment Hub", icon: "💳", href: "/administration?tab=mpesa" },
  { id: "smtp", label: "Email SMTP Gateway", icon: "✉️", href: "/administration?tab=smtp" },
  { id: "tax", label: "KRA Tax & E-TIMS", icon: "📜", href: "/administration?tab=tax" },
  { id: "audit", label: "Security Audit Trail", icon: "🛡️", href: "/administration?tab=audit" },
  { id: "system-health", label: "System Health", icon: "🩺", href: "/administration?tab=system-health" },
  { id: "testing", label: "Testing Hub", icon: "🧪", href: "/testing" },
];

type AppSidebarProps = {
  menuOpen: boolean;
  onCloseMobile: () => void;
  onSelectSection?: (id: string) => void;
};

export default function AppSidebar({ menuOpen, onCloseMobile }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams ? searchParams.get("tab") : null;
  const { session, can } = useAuth();
  const permissions = usePermissions();
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [settingsExpanded, setSettingsExpanded] = useState(pathname.startsWith("/settings"));
  const [adminExpanded, setAdminExpanded] = useState(pathname.startsWith("/administration") || pathname === "/testing");

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ce_sidebar_collapsed");
      if (stored === "1") setCollapsed(true);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ce_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/settings")) setSettingsExpanded(true);
    if (pathname.startsWith("/administration") || pathname === "/testing") setAdminExpanded(true);
  }, [pathname]);

  const activeModuleSlug = modules.find((m) => (
    pathname === `/${m.slug}` || pathname.startsWith(`/${m.slug}/`)
  ))?.slug;

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const isAdministrator = permissions.isSuperAdmin;
  const canFinance = Boolean(
    isAdministrator ||
    session?.roles?.some((r) => r.includes("finance") || r.includes("admin") || r.includes("manager"))
  );
  const showAdministration = true;
  const activeOrganization = session?.organizations.find((organization) => organization.id === session.activeOrganizationId);

  const sidebarWidth = isMobile ? "min(85vw, 320px)" : collapsed ? 74 : 280;

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
              color: (pathname === "/workspaces" || pathname === "/") ? "#60a5fa" : "#ffffff",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: (pathname === "/workspaces" || pathname === "/") ? 700 : 600,
            }}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>

          {!activeModuleSlug && (
            <Link
              className="nav-link"
              href="/overview"
              onClick={onCloseMobile}
              title="Overview"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "16px",
                justifyContent: "flex-start",
                borderRadius: 6,
                color: "#b8c8d7",
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              <span>◉</span>
              <span>Overview</span>
            </Link>
          )}
          
          {!activeModuleSlug && (
            <Link
              href="/companion"
              onClick={onCloseMobile}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                color: pathname.startsWith("/companion") ? "#60a5fa" : "#ffffff",
                textDecoration: "none",
                fontSize: 12,
                fontWeight: pathname.startsWith("/companion") ? 700 : 600,
              }}
            >
              <ClipboardCheck size={20} />
              <span>Tasks</span>
            </Link>
          )}
          
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-mobile-menu"));
              }
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              color: "#ffffff",
              background: "none",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
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
        className={`platform-sidebar ${menuOpen ? "mobile-open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}
        role="navigation"
        aria-label="Main navigation"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          height: "100vh",
          position: isMobile ? "fixed" : "sticky",
          alignSelf: "flex-start",
          top: 0,
          left: isMobile ? (menuOpen ? 0 : "-100%") : 0,
          background: "var(--bg-sidebar, var(--color-slate-900))",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          zIndex: isMobile ? 1000 : 100,
          transition: isMobile
            ? "transform 0.3s ease"
            : "width 0.22s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          userSelect: "none",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* Brand Header */}
        <Box
          className="platform-brand-header"
          sx={{
            padding: isMobile ? 2 : (collapsed ? "14px 10px" : "14px 16px"),
            minHeight: 64,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 1,
            boxSizing: "border-box",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflow: "hidden" }}>
            <BrandLogo
              size="sm"
              showWordmark={!collapsed}
              dark
              brandName={activeOrganization?.company_name || activeOrganization?.name}
              logoUrl={activeOrganization?.logo_url}
              primaryColor={activeOrganization?.primary_color}
            />
          </Box>
          
          {isMobile ? (
            <IconButton
              onClick={onCloseMobile}
              aria-label="Close navigation"
              sx={{ color: "white" }}
            >
              <X size={24} />
            </IconButton>
          ) : (
            <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
              <IconButton
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                sx={{
                  color: "rgba(255,255,255,0.6)",
                  padding: "6px",
                  borderRadius: 1.5,
                  "&:hover": { color: "#ffffff", bgcolor: "rgba(255,255,255,0.1)" },
                }}
              >
                {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Scrollable Nav Items — Clean custom invisible scrollbar */}
        <Box
          className="platform-sidebar-scroll"
          sx={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: isMobile ? 2 : (collapsed ? "12px 6px" : "12px 10px"),
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": { display: "none" },
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* WORKPLACE SECTION - Only show on dashboard/workspaces when expanded */}
          {!isMobile && !activeModuleSlug && !collapsed && (
            <Typography
              sx={{
                padding: "6px 10px 4px",
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.4,
              }}
            >
              WORKPLACE
            </Typography>
          )}

          {/* Dashboard link - always visible */}
          <Tooltip title={collapsed ? "Dashboard" : ""} placement="right" disableHoverListener={!collapsed}>
            <Link
              className={`nav-link ${(pathname === "/workspaces" || pathname === "/") ? "active" : ""}`}
              href="/workspaces"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: isMobile ? "14px 16px" : (collapsed ? "10px 0" : "9px 12px"),
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 6,
                background: (pathname === "/workspaces" || pathname === "/") ? "var(--brand-primary, var(--color-brand-red))" : "transparent",
                color: (pathname === "/workspaces" || pathname === "/") ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, var(--color-slate-300))",
                fontWeight: (pathname === "/workspaces" || pathname === "/") ? 700 : 500,
                textDecoration: "none",
                fontSize: isMobile ? 15 : 13,
                transition: "background 0.15s ease, color 0.15s ease",
              }}
              onClick={onCloseMobile}
              title={collapsed ? "" : "Dashboard"}
            >
              <span style={{ fontSize: isMobile ? 20 : 15, display: "flex" }}><LayoutDashboard size={isMobile ? 22 : 18} /></span>
              {!collapsed && <span>Dashboard</span>}
            </Link>
          </Tooltip>

          {/* Portfolio Overview link */}
          <Tooltip title={collapsed ? "Portfolio Overview" : ""} placement="right" disableHoverListener={!collapsed}>
            <Link
              className={`nav-link ${pathname === "/overview" ? "active" : ""}`}
              href="/overview"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: isMobile ? "14px 16px" : (collapsed ? "10px 0" : "9px 12px"),
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 6,
                background: pathname === "/overview" ? "var(--brand-primary, var(--color-brand-red))" : "transparent",
                color: pathname === "/overview" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, var(--color-slate-300))",
                fontWeight: pathname === "/overview" ? 700 : 500,
                textDecoration: "none",
                fontSize: isMobile ? 15 : 13,
                transition: "background 0.15s ease, color 0.15s ease",
              }}
              onClick={onCloseMobile}
              title={collapsed ? "" : "Portfolio Overview"}
            >
              <span style={{ fontSize: isMobile ? 18 : 15 }}>🏢</span>
              {!collapsed && <span>Portfolio Overview</span>}
            </Link>
          </Tooltip>


          {!activeModuleSlug && (isAdministrator || session?.modules?.some((module) => module.slug === "monitoring")) && (
            <>
              <Tooltip title={collapsed ? "Tickets" : ""} placement="right" disableHoverListener={!collapsed}>
                <Link
                  className={`nav-link ${pathname === "/tickets" ? "active" : ""}`}
                  href="/tickets"
                  onClick={onCloseMobile}
                  title={collapsed ? "" : "Tickets"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: isMobile ? "14px 16px" : (collapsed ? "10px 0" : "9px 12px"),
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: 6,
                    background: pathname === "/tickets" ? "var(--brand-primary, var(--color-brand-red))" : "transparent",
                    color: pathname === "/tickets" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, var(--color-slate-300))",
                    fontWeight: pathname === "/tickets" ? 700 : 500,
                    textDecoration: "none",
                    fontSize: isMobile ? 15 : 13,
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  <CircleAlert size={isMobile ? 22 : 18} />
                  {!collapsed && <span>Tickets</span>}
                </Link>
              </Tooltip>

              <Tooltip title={collapsed ? "Calendar" : ""} placement="right" disableHoverListener={!collapsed}>
                <Link
                  className={`nav-link ${pathname === "/calendar" ? "active" : ""}`}
                  href="/calendar"
                  onClick={onCloseMobile}
                  title={collapsed ? "" : "Calendar"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: isMobile ? "14px 16px" : (collapsed ? "10px 0" : "9px 12px"),
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: 6,
                    background: pathname === "/calendar" ? "var(--brand-primary, var(--color-brand-red))" : "transparent",
                    color: pathname === "/calendar" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, var(--color-slate-300))",
                    fontWeight: pathname === "/calendar" ? 700 : 500,
                    textDecoration: "none",
                    fontSize: isMobile ? 15 : 13,
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  <CalendarDays size={isMobile ? 22 : 18} />
                  {!collapsed && <span>Calendar</span>}
                </Link>
              </Tooltip>
            </>
          )}

          {/* Modular Onboarding (Property, Construction, Sales) */}
          {!activeModuleSlug && (isAdministrator || session?.modules?.some((module) => module.slug === "property" || module.slug === "sales" || module.slug === "monitoring")) && (
            <Tooltip title={collapsed ? "Modular Onboarding" : ""} placement="right" disableHoverListener={!collapsed}>
              <Link
                className={`nav-link ${pathname === "/property-onboarding" || pathname === "/onboarding" ? "active" : ""}`}
                data-testid="property-onboarding-link"
                href="/property-onboarding"
                onClick={onCloseMobile}
                title={collapsed ? "" : "Modular onboarding (Property, Construction, Sales)"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: isMobile ? "14px 16px" : (collapsed ? "10px 0" : "9px 12px"),
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 6,
                  background: pathname === "/property-onboarding" || pathname === "/onboarding" ? "var(--brand-primary, var(--color-brand-red))" : "transparent",
                  color: pathname === "/property-onboarding" || pathname === "/onboarding" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, var(--color-slate-300))",
                  fontWeight: pathname === "/property-onboarding" || pathname === "/onboarding" ? 700 : 500,
                  textDecoration: "none",
                  fontSize: isMobile ? 15 : 13,
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                <span style={{ fontSize: isMobile ? 18 : 15, display: "flex", alignItems: "center" }}>
                  <Layers size={isMobile ? 20 : 17} color="var(--color-amber)" />
                </span>
                {!collapsed && <span>Modular Onboarding</span>}
              </Link>
            </Tooltip>
          )}

          {isAdministrator && !activeModuleSlug ? (
            <Tooltip title={collapsed ? "Usage Analytics" : ""} placement="right" disableHoverListener={!collapsed}>
              <Link
                className={`nav-link ${pathname === "/analytics" ? "active" : ""}`}
                href="/analytics"
                onClick={onCloseMobile}
                title={collapsed ? "" : "Usage Analytics"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: isMobile ? "14px 16px" : (collapsed ? "10px 0" : "9px 12px"),
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 6,
                  background: pathname === "/analytics" ? "var(--brand-primary, var(--color-brand-red))" : "transparent",
                  color: pathname === "/analytics" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, var(--color-slate-300))",
                  fontWeight: pathname === "/analytics" ? 700 : 500,
                  textDecoration: "none",
                  fontSize: isMobile ? 15 : 13,
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                <ChartNoAxesCombined size={isMobile ? 22 : 18} />
                {!collapsed && <span>Usage Analytics</span>}
              </Link>
            </Tooltip>
          ) : null}



          {/* Tenant Portal Link */}
          {!activeModuleSlug && (
            <Tooltip title={collapsed ? "Tenant Portal" : ""} placement="right" disableHoverListener={!collapsed}>
              <Link
                className={`nav-link ${pathname === "/tenant-portal" ? "active" : ""}`}
                href="/tenant-portal"
                onClick={onCloseMobile}
                title={collapsed ? "" : "Tenant Portal"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: isMobile ? "14px 16px" : (collapsed ? "10px 0" : "9px 12px"),
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 6,
                  background: pathname === "/tenant-portal" ? "var(--brand-primary, var(--color-brand-red))" : "transparent",
                  color: pathname === "/tenant-portal" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, var(--color-slate-300))",
                  fontWeight: pathname === "/tenant-portal" ? 700 : 500,
                  textDecoration: "none",
                  fontSize: isMobile ? 15 : 13,
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                <span style={{ fontSize: isMobile ? 18 : 15 }}>🔑</span>
                {!collapsed && <span>Tenant Portal</span>}
              </Link>
            </Tooltip>
          )}

          {/* Settings & Administration Links with Retractable Suboptions */}
          <div style={{ marginTop: "12px", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 6 }}>
            {/* SETTINGS SECTION */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={settingsExpanded}
                onClick={() => {
                  if (collapsed) {
                    setCollapsed(false);
                    setSettingsExpanded(true);
                  } else {
                    setSettingsExpanded((prev) => !prev);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSettingsExpanded((prev) => !prev);
                  }
                }}
                title={collapsed ? "Settings" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "space-between",
                  borderRadius: 6,
                  background: pathname.startsWith("/settings") ? "rgba(37, 99, 235, 0.20)" : "transparent",
                  color: pathname.startsWith("/settings") ? "#ffffff" : "var(--color-slate-300)",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                  padding: isMobile ? "12px 14px" : (collapsed ? "10px 0" : "8px 10px"),
                  userSelect: "none",
                }}
              >
                <Tooltip title={collapsed ? "Settings" : ""} placement="right" disableHoverListener={!collapsed}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      justifyContent: collapsed ? "center" : "flex-start",
                      flex: 1,
                      fontWeight: pathname.startsWith("/settings") ? 700 : 500,
                      fontSize: isMobile ? 15 : 13,
                    }}
                  >
                    <span style={{ fontSize: isMobile ? 18 : 15 }}>⚙️</span>
                    {!collapsed && <span>Settings</span>}
                  </div>
                </Tooltip>
                
                {!collapsed && (
                  <div
                    style={{
                      color: "var(--text-ghost)",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 4,
                    }}
                  >
                    {settingsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                )}
              </div>

              {settingsExpanded && !collapsed && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    paddingLeft: 14,
                    borderLeft: "2px solid rgba(255, 255, 255, 0.12)",
                    marginLeft: 14,
                    marginTop: 2,
                    marginBottom: 4,
                  }}
                >
                  {SETTINGS_SUBITEMS.map((item) => {
                    const isItemActive = pathname === "/settings" && (currentTab === item.id || (!currentTab && item.id === "profile"));
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={onCloseMobile}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px",
                          borderRadius: 5,
                          fontSize: 12,
                          textDecoration: "none",
                          background: isItemActive ? "var(--brand-primary, #2563eb)" : "transparent",
                          color: isItemActive ? "#ffffff" : "var(--color-slate-400)",
                          fontWeight: isItemActive ? 700 : 500,
                          transition: "all 0.12s ease",
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ADMINISTRATION SECTION */}
            {showAdministration && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={adminExpanded}
                  onClick={() => {
                    if (collapsed) {
                      setCollapsed(false);
                      setAdminExpanded(true);
                    } else {
                      setAdminExpanded((prev) => !prev);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setAdminExpanded((prev) => !prev);
                    }
                  }}
                  title={collapsed ? "Administration" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "space-between",
                    borderRadius: 6,
                    background: pathname.startsWith("/administration") ? "rgba(37, 99, 235, 0.20)" : "transparent",
                    color: pathname.startsWith("/administration") ? "#ffffff" : "var(--color-slate-300)",
                    transition: "all 0.15s ease",
                    cursor: "pointer",
                    padding: isMobile ? "12px 14px" : (collapsed ? "10px 0" : "8px 10px"),
                    userSelect: "none",
                  }}
                >
                  <Tooltip title={collapsed ? "Administration" : ""} placement="right" disableHoverListener={!collapsed}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        justifyContent: collapsed ? "center" : "flex-start",
                        flex: 1,
                        fontWeight: pathname.startsWith("/administration") ? 700 : 500,
                        fontSize: isMobile ? 15 : 13,
                      }}
                    >
                      <span style={{ fontSize: isMobile ? 18 : 15 }}>🛡️</span>
                      {!collapsed && <span>Administration</span>}
                    </div>
                  </Tooltip>
                  
                  {!collapsed && (
                    <div
                      style={{
                        color: "var(--text-ghost)",
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: 4,
                      }}
                    >
                      {adminExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  )}
                </div>

                {adminExpanded && !collapsed && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      paddingLeft: 14,
                      borderLeft: "2px solid rgba(255, 255, 255, 0.12)",
                      marginLeft: 14,
                      marginTop: 2,
                      marginBottom: 4,
                    }}
                  >
                    {ADMIN_SUBITEMS.filter((item) => isAdministrator || ["mpesa", "smtp", "tax", "testing"].includes(item.id)).map((item) => {
                      const isItemActive = (pathname === "/testing" && item.id === "testing") || (pathname === "/administration" && (currentTab === item.id || (!currentTab && item.id === (isAdministrator ? "users" : "mpesa"))));
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={onCloseMobile}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            borderRadius: 5,
                            fontSize: 12,
                            textDecoration: "none",
                            background: isItemActive ? "var(--brand-primary, #2563eb)" : "transparent",
                            color: isItemActive ? "#ffffff" : "var(--color-slate-400)",
                            fontWeight: isItemActive ? 700 : 500,
                            transition: "all 0.12s ease",
                          }}
                        >
                          <span style={{ fontSize: 13 }}>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        </Box>
      </aside>
    </>
  );
}
