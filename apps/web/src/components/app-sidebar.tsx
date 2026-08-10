"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { LayoutDashboard, ClipboardCheck, Menu, X, ChartNoAxesCombined, CalendarDays, CircleAlert } from "lucide-react";
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

type AppSidebarProps = {
  menuOpen: boolean;
  onCloseMobile: () => void;
  onSelectSection?: (id: string) => void;
};

export default function AppSidebar({ menuOpen, onCloseMobile }: AppSidebarProps) {
  const pathname = usePathname();
  const { session } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

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

  const isAdministrator = Boolean(session?.user.isSuperuser || session?.permissions.includes("*") || session?.roles.includes("admin"));

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
          width: isMobile ? "100%" : 260,
          minWidth: isMobile ? "100%" : 260,
          height: "100vh",
          position: isMobile ? "fixed" : "sticky",
          alignSelf: "flex-start",
          top: 0,
          left: isMobile ? (menuOpen ? 0 : "-100%") : 0,
          background: "#0f172a",
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
            <BrandLogo size="sm" showWordmark dark />
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
                color: "rgba(255,255,255,0.35)",
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
              padding: isMobile ? "16px" : "9px 12px",
              justifyContent: "flex-start",
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
            <span>Dashboard</span>
          </Link>

          {!activeModuleSlug && (isAdministrator || session?.modules?.some((module) => module.slug === "monitoring")) && (
            <>
              <Link className="nav-link" href="/tickets" onClick={onCloseMobile} title="Tickets" style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "16px" : "9px 12px", justifyContent: "flex-start", borderRadius: 6, color: "#b8c8d7", textDecoration: "none", fontSize: isMobile ? 16 : 13 }}>
                <CircleAlert size={isMobile ? 24 : 18} /><span>Tickets</span>
              </Link>
              <Link className="nav-link" href="/calendar" onClick={onCloseMobile} title="Calendar" style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "16px" : "9px 12px", justifyContent: "flex-start", borderRadius: 6, color: "#b8c8d7", textDecoration: "none", fontSize: isMobile ? 16 : 13 }}>
                <CalendarDays size={isMobile ? 24 : 18} /><span>Calendar</span>
              </Link>
            </>
          )}

          {!activeModuleSlug && (isAdministrator || session?.modules?.some((module) => module.slug === "property")) && (
            <Link className="nav-link" data-testid="property-onboarding-link" href="/property-onboarding" onClick={onCloseMobile} title="Property onboarding" style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "16px" : "9px 12px", justifyContent: "flex-start", borderRadius: 6, color: "#b8c8d7", textDecoration: "none", fontSize: isMobile ? 16 : 13 }}>
              <span style={{ fontSize: isMobile ? 20 : 15 }}>🏗️</span><span>Property onboarding</span>
            </Link>
          )}

          {isAdministrator && !activeModuleSlug ? (
            <Link className="nav-link" href="/analytics" style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "16px" : "9px 12px", justifyContent: "flex-start", borderRadius: 6, color: "#fff", background: pathname === "/analytics" ? "rgba(229,46,46,0.35)" : "transparent", textDecoration: "none", fontSize: isMobile ? 16 : 13 }} onClick={onCloseMobile} title="Usage Analytics">
              <ChartNoAxesCombined size={isMobile ? 24 : 18} /><span>Usage Analytics</span>
            </Link>
          ) : null}

        </Box>
      </aside>
    </>
  );
}
