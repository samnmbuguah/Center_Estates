"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Wrench,
  Tag,
  ClipboardList,
  Scale,
  HardHat,
  Sparkles,
  ArrowLeftRight,
  LayoutDashboard,
  Building,
} from "lucide-react";
import { Tooltip, IconButton, Box } from "@mui/material";
import { modules, type ErpModule } from "@/lib/modules";
import type { PropertyContextValue } from "@/lib/property-context";

interface ModuleIconSidebarProps {
  activeModuleSlug: string;
  allowedSlugs: string[];
  activeProperty: PropertyContextValue | null;
  onSwitchPropertyClick: () => void;
  onModuleClick: (slug: string) => void;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  property: <Building2 size={20} />,
  facility: <Wrench size={20} />,
  sales: <Tag size={20} />,
  tender: <ClipboardList size={20} />,
  valuation: <Scale size={20} />,
  monitoring: <HardHat size={20} />,
  companion: <Sparkles size={20} />,
};

export default function ModuleIconSidebar({
  activeModuleSlug,
  allowedSlugs,
  activeProperty,
  onSwitchPropertyClick,
  onModuleClick,
}: ModuleIconSidebarProps) {
  const allowedSet = useMemo(() => new Set(allowedSlugs), [allowedSlugs]);
  const accessibleModules = useMemo(
    () => modules.filter((m) => allowedSet.has(m.slug)),
    [allowedSet]
  );

  return (
    <aside
      className="module-icon-sidebar"
      aria-label="Module quick switcher"
      style={{
        width: 60,
        minWidth: 60,
        height: "100vh",
        position: "sticky",
        top: 0,
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 6px",
        background: "linear-gradient(180deg, #0b1e3b 0%, #15386f 40%, #1d4ed8 85%, #2563eb 100%)",
        borderRight: "1px solid rgba(59, 130, 246, 0.28)",
        boxShadow: "4px 0 18px rgba(11, 30, 59, 0.22)",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* Top Group: Switch Property trigger & Module list */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 1 }}>
        {/* Switch Property Icon Button */}
        <Tooltip
          title={
            <Box sx={{ p: 0.5 }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>Switch Property</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                Current: <strong>{activeProperty?.name || "None Selected"}</strong>
              </div>
              <div style={{ fontSize: 10, color: "#93c5fd", marginTop: 2 }}>Click to change property</div>
            </Box>
          }
          placement="right"
          arrow
        >
          <button
            type="button"
            onClick={onSwitchPropertyClick}
            aria-label="Switch property"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: "1px solid rgba(255, 255, 255, 0.35)",
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(8px)",
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
              transition: "all 0.18s ease-in-out",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.28)";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <Building size={18} />
            <ArrowLeftRight
              size={10}
              style={{
                position: "absolute",
                bottom: 4,
                right: 4,
                background: "#2563eb",
                borderRadius: "50%",
                padding: 1,
                border: "1px solid #ffffff",
              }}
            />
          </button>
        </Tooltip>

        {/* Small Divider */}
        <Box
          sx={{
            width: 32,
            height: "1px",
            background: "rgba(255, 255, 255, 0.2)",
            my: 0.5,
          }}
        />

        {/* Module Switcher Icons */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, width: "100%" }}>
          {accessibleModules.map((module) => {
            const isActive = activeModuleSlug === module.slug;
            return (
              <Tooltip key={module.slug} title={module.name} placement="right" arrow>
                <button
                  type="button"
                  onClick={() => onModuleClick(module.slug)}
                  aria-label={module.name}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: isActive
                      ? "1px solid #ffffff"
                      : "1px solid transparent",
                    background: isActive
                      ? "#ffffff"
                      : "rgba(255, 255, 255, 0.08)",
                    color: isActive ? "#1e40af" : "rgba(255, 255, 255, 0.88)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.18s ease-in-out",
                    boxShadow: isActive
                      ? "0 4px 14px rgba(0, 0, 0, 0.28)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.22)";
                      e.currentTarget.style.color = "#ffffff";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.color = "rgba(255, 255, 255, 0.88)";
                      e.currentTarget.style.transform = "scale(1)";
                    }
                  }}
                >
                  {MODULE_ICONS[module.slug] || <Building2 size={20} />}
                </button>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* Bottom Group: Portfolio / Workspaces link & Property initials */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 1 }}>
        <Tooltip title="Workspaces & Overview" placement="right" arrow>
          <Link
            href="/workspaces"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(255, 255, 255, 0.06)",
              color: "rgba(255, 255, 255, 0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              transition: "all 0.18s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.75)";
            }}
          >
            <LayoutDashboard size={18} />
          </Link>
        </Tooltip>

        {activeProperty && (
          <Tooltip title={`Current: ${activeProperty.name}`} placement="right" arrow>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "rgba(255, 255, 255, 0.9)",
                background: "rgba(0, 0, 0, 0.25)",
                borderRadius: 6,
                padding: "2px 5px",
                letterSpacing: "0.05em",
                maxWidth: 48,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "center",
              }}
            >
              {activeProperty.code || activeProperty.name.slice(0, 3).toUpperCase()}
            </div>
          </Tooltip>
        )}
      </Box>
    </aside>
  );
}
