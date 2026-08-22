"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { usePermissions } from "@/hooks/usePermissions";
import { BrandLogo } from "@/components/brand-logo";
import { LayoutDashboard, ClipboardCheck, Menu, X, ChartNoAxesCombined, CalendarDays, CircleAlert, ChevronDown, ChevronRight } from "lucide-react";
import {
  Box,
  Typography,
  IconButton,
} from "@mui/material";

const modules = [
  { slug: "property", name: "Property", icon: "🏢", accent: "#e23b3b" },
  { slug: "facility", name: "Facility", icon: "🔧", accent: "#00a3ff" },
  { slug: "sales", name: "Sales", icon: "💰", accent: "#10b981" },
  { slug: "tender", name: "Tender", icon: "📋", accent: "#f59e0b" },
  { slug: "valuation", name: "Valuation", icon: "📜", accent: "#8b5cf6" },
  { slug: "monitoring", name: "Monitoring", icon: "📊", accent: "#06b6d4" },
  { slug: "companion", name: "Companion", icon: "🧭", accent: "#ec4899" },
];

const SETTINGS_SUBITEMS = [
  { id: "profile", label: "Profile & Account", icon: "👤", href: "/settings?tab=profile" },
  { id: "mpesa-test", label: "M-Pesa STK Test", icon: "📱", href: "/settings?tab=mpesa-test" },
  { id: "notifications", label: "Notifications & Alerts", icon: "🔔", href: "/settings?tab=notifications" },
  { id: "appearance", label: "Display & Regional", icon: "🎨", href: "/settings?tab=appearance" },
];

const ADMIN_SUBITEMS = [
  { id: "users", label: "Users & Staff Accounts", icon: "👥", href: "/administration?tab=users" },
  { id: "roles", label: "Roles & Permissions", icon: "🔐", href: "/administration?tab=roles" },
  { id: "mpesa", label: "M-Pesa STK Push Gateway", icon: "💳", href: "/administration?tab=mpesa" },
  { id: "smtp", label: "Email SMTP Gateway", icon: "✉️", href: "/administration?tab=smtp" },
  { id: "orgs", label: "Organization & Modules", icon: "🏢", href: "/administration?tab=orgs" },
  { id: "tax", label: "KRA Tax & E-TIMS", icon: "📜", href: "/administration?tab=tax" },
  { id: "audit", label: "Security Audit Trail", icon: "🛡️", href: "/administration?tab=audit" },
  { id: "feedback-qr", label: "Public Feedback QR Codes", icon: "▦", href: "/administration?tab=feedback-qr" },
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

  const [settingsExpanded, setSettingsExpanded] = useState(pathname.startsWith("/settings"));
  const [adminExpanded, setAdminExpanded] = useState(pathname.startsWith("/administration"));

  useEffect(() => {
    if (pathname.startsWith("/settings")) setSettingsExpanded(true);
    if (pathname.startsWith("/administration")) setAdminExpanded(true);
  }, [pathname]);

  const activeModuleSlug = modules.find((m) => (
    pathname === `/${m.slug}` || pathname.startsWith(`/${m.slug}/`)
  ))?.slug;

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isAdministrator = permissions.isSuperAdmin;
  const canFinance = Boolean(
    isAdministrator ||
    session?.roles?.some((r) => r.includes("finance") || r.includes("admin") || r.includes("manager"))
  );
  const showAdministration = isAdministrator || canFinance;
  const activeOrganization = session?.organizations.find((organization) => organization.id === session.activeOrganizationId);

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
              color: (pathname === "/workspaces" || pathname === "/") ? "#e23b3b" : "#ffffff",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: (pathname === "/workspaces" || pathname === "/") ? 700 : 600,
            }}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>

          {!activeModuleSlug && <Link className="nav-link" href="/overview" onClick={onCloseMobile} title="Overview" style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "16px" : "9px 12px", justifyContent: "flex-start", borderRadius: 6, color: "#b8c8d7", textDecoration: "none", fontSize: isMobile ? 16 : 13 }}><span>◉</span><span>Overview</span></Link>}
          
          {/* Companion is the daily task hub; facility operations remain in its module. */}
          {!activeModuleSlug && (
            <>
              <Link
                href="/companion"
                onClick={onCloseMobile}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  color: pathname.startsWith("/companion") ? "#e23b3b" : "#ffffff",
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: pathname.startsWith("/companion") ? 700 : 600,
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
        className={`platform-sidebar ${menuOpen ? "mobile-open" : ""}`}
        role="navigation"
        aria-label="Main navigation"
        style={{
          width: isMobile ? "min(85vw, 320px)" : 260,
          minWidth: isMobile ? "min(85vw, 320px)" : 260,
          height: "100vh",
          position: isMobile ? "fixed" : "sticky",
          alignSelf: "flex-start",
          top: 0,
          left: isMobile ? (menuOpen ? 0 : "-100%") : 0,
          background: "var(--bg-sidebar, #0f172a)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          zIndex: isMobile ? 1000 : 100,
          transition: isMobile ? "transform 0.3s ease" : undefined,
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        {/* Brand Header */}
        <Box
          className="platform-brand-header"
          sx={{
            padding: isMobile ? 2 : "14px 16px",
            minHeight: 64,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            boxSizing: "border-box",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BrandLogo
              size="sm"
              showWordmark
              dark
              brandName={activeOrganization?.company_name || activeOrganization?.name}
              logoUrl={activeOrganization?.logo_url}
              primaryColor={activeOrganization?.primary_color}
            />
          </Box>
          {isMobile && (
            <IconButton
              onClick={onCloseMobile}
              aria-label="Close navigation"
              sx={{ color: "white" }}
            >
              <X size={24} />
            </IconButton>
          )}
        </Box>

        {/* Scrollable Nav Items */}
        <Box
          className="platform-sidebar-scroll"
          sx={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? 2 : "12px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          }}
        >
          {/* WORKPLACE SECTION - Only show on dashboard/workspaces */}
          {!isMobile && !activeModuleSlug && (
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
          <Link
            className={`nav-link ${(pathname === "/workspaces" || pathname === "/") ? "active" : ""}`}
            href="/workspaces"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: isMobile ? "14px 16px" : "9px 12px",
              justifyContent: "flex-start",
              borderRadius: 6,
              background: (pathname === "/workspaces" || pathname === "/") ? "var(--brand-primary, #e23b3b)" : "transparent",
              color: (pathname === "/workspaces" || pathname === "/") ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, #cbd5e1)",
              fontWeight: (pathname === "/workspaces" || pathname === "/") ? 700 : 500,
              textDecoration: "none",
              fontSize: isMobile ? 15 : 13,
            }}
            onClick={onCloseMobile}
            title="Dashboard"
          >
            <span style={{ fontSize: isMobile ? 20 : 15, display: "flex" }}><LayoutDashboard size={isMobile ? 22 : 18} /></span>
            <span>Dashboard</span>
          </Link>

          {/* Portfolio Overview link — Displays property register, statistics, and edit details */}
          <Link
            className={`nav-link ${pathname === "/overview" ? "active" : ""}`}
            href="/overview"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: isMobile ? "14px 16px" : "9px 12px",
              justifyContent: "flex-start",
              borderRadius: 6,
              background: pathname === "/overview" ? "var(--brand-primary, #e23b3b)" : "transparent",
              color: pathname === "/overview" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, #cbd5e1)",
              fontWeight: pathname === "/overview" ? 700 : 500,
              textDecoration: "none",
              fontSize: isMobile ? 15 : 13,
            }}
            onClick={onCloseMobile}
            title="Portfolio Overview"
          >
            <span style={{ fontSize: isMobile ? 18 : 15 }}>🏢</span>
            <span>Portfolio Overview</span>
          </Link>

          {!activeModuleSlug && (isAdministrator || session?.modules?.some((module) => module.slug === "monitoring")) && (
            <>
              <Link
                className={`nav-link ${pathname === "/tickets" ? "active" : ""}`}
                href="/tickets"
                onClick={onCloseMobile}
                title="Tickets"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: isMobile ? "14px 16px" : "9px 12px",
                  justifyContent: "flex-start",
                  borderRadius: 6,
                  background: pathname === "/tickets" ? "var(--brand-primary, #e23b3b)" : "transparent",
                  color: pathname === "/tickets" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, #cbd5e1)",
                  fontWeight: pathname === "/tickets" ? 700 : 500,
                  textDecoration: "none",
                  fontSize: isMobile ? 15 : 13,
                }}
              >
                <CircleAlert size={isMobile ? 22 : 18} /><span>Tickets</span>
              </Link>

              <Link
                className={`nav-link ${pathname === "/calendar" ? "active" : ""}`}
                href="/calendar"
                onClick={onCloseMobile}
                title="Calendar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: isMobile ? "14px 16px" : "9px 12px",
                  justifyContent: "flex-start",
                  borderRadius: 6,
                  background: pathname === "/calendar" ? "var(--brand-primary, #e23b3b)" : "transparent",
                  color: pathname === "/calendar" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, #cbd5e1)",
                  fontWeight: pathname === "/calendar" ? 700 : 500,
                  textDecoration: "none",
                  fontSize: isMobile ? 15 : 13,
                }}
              >
                <CalendarDays size={isMobile ? 22 : 18} /><span>Calendar</span>
              </Link>
            </>
          )}

          {!activeModuleSlug && (isAdministrator || session?.modules?.some((module) => module.slug === "property")) && (
            <Link
              className={`nav-link ${pathname === "/property-onboarding" ? "active" : ""}`}
              data-testid="property-onboarding-link"
              href="/property-onboarding"
              onClick={onCloseMobile}
              title="Property onboarding"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: isMobile ? "14px 16px" : "9px 12px",
                justifyContent: "flex-start",
                borderRadius: 6,
                background: pathname === "/property-onboarding" ? "var(--brand-primary, #e23b3b)" : "transparent",
                color: pathname === "/property-onboarding" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, #cbd5e1)",
                fontWeight: pathname === "/property-onboarding" ? 700 : 500,
                textDecoration: "none",
                fontSize: isMobile ? 15 : 13,
              }}
            >
              <span style={{ fontSize: isMobile ? 18 : 15 }}>🏗️</span><span>Property onboarding</span>
            </Link>
          )}

          {isAdministrator && !activeModuleSlug ? (
            <Link
              className={`nav-link ${pathname === "/analytics" ? "active" : ""}`}
              href="/analytics"
              onClick={onCloseMobile}
              title="Usage Analytics"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: isMobile ? "14px 16px" : "9px 12px",
                justifyContent: "flex-start",
                borderRadius: 6,
                background: pathname === "/analytics" ? "var(--brand-primary, #e23b3b)" : "transparent",
                color: pathname === "/analytics" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, #cbd5e1)",
                fontWeight: pathname === "/analytics" ? 700 : 500,
                textDecoration: "none",
                fontSize: isMobile ? 15 : 13,
              }}
            >
              <ChartNoAxesCombined size={isMobile ? 22 : 18} /><span>Usage Analytics</span>
            </Link>
          ) : null}

          {/* Settings & Administration Links with Retractable Suboptions */}
          <div style={{ marginTop: "12px", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 6 }}>
            {/* SETTINGS SECTION */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 6,
                  background: pathname === "/settings" ? "rgba(226, 59, 59, 0.15)" : "transparent",
                  color: pathname === "/settings" ? "#ffffff" : "#cbd5e1",
                  transition: "all 0.15s ease",
                }}
              >
                <Link
                  className={`nav-link ${pathname === "/settings" ? "active" : ""}`}
                  href="/settings"
                  onClick={() => {
                    setSettingsExpanded(true);
                    onCloseMobile();
                  }}
                  title="Settings"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: isMobile ? "12px 14px" : "8px 10px",
                    flex: 1,
                    borderRadius: 6,
                    color: pathname === "/settings" ? "var(--text-on-brand, #ffffff)" : "var(--text-on-dark, #cbd5e1)",
                    fontWeight: pathname === "/settings" ? 700 : 500,
                    textDecoration: "none",
                    fontSize: isMobile ? 15 : 13,
                  }}
                >
                  <span style={{ fontSize: isMobile ? 18 : 15 }}>⚙️</span>
                  <span>Settings</span>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSettingsExpanded(!settingsExpanded);
                  }}
                  aria-label="Toggle settings sub-options"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    padding: "8px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {settingsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>

              {settingsExpanded && (
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
                          background: isItemActive ? "#e23b3b" : "transparent",
                          color: isItemActive ? "#ffffff" : "#94a3b8",
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: 6,
                    background: pathname === "/administration" ? "rgba(226, 59, 59, 0.15)" : "transparent",
                    color: pathname === "/administration" ? "#ffffff" : "#cbd5e1",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Link
                    className={`nav-link ${pathname === "/administration" ? "active" : ""}`}
                    href={isAdministrator ? "/administration" : "/administration?tab=mpesa"}
                    onClick={() => {
                      setAdminExpanded(true);
                      onCloseMobile();
                    }}
                    title="Administration"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: isMobile ? "12px 14px" : "8px 10px",
                      flex: 1,
                      borderRadius: 6,
                      color: pathname === "/administration" ? "#ffffff" : "#cbd5e1",
                      fontWeight: pathname === "/administration" ? 700 : 500,
                      textDecoration: "none",
                      fontSize: isMobile ? 15 : 13,
                    }}
                  >
                    <span style={{ fontSize: isMobile ? 18 : 15 }}>🛡️</span>
                    <span>Administration</span>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAdminExpanded(!adminExpanded);
                    }}
                    aria-label="Toggle administration sub-options"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      padding: "8px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {adminExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>

                {adminExpanded && (
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
                    {ADMIN_SUBITEMS.filter((item) => isAdministrator || item.id === "mpesa").map((item) => {
                      const isItemActive = pathname === "/administration" && (currentTab === item.id || (!currentTab && item.id === "users"));
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
                            background: isItemActive ? "#e23b3b" : "transparent",
                            color: isItemActive ? "#ffffff" : "#94a3b8",
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
