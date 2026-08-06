"use client";

import Link from "next/link";
import { type ReactNode } from "react";

export type ModuleNavItem = {
  id: string;
  label: string;
  icon?: string;
};

export type ModuleNavGroup = {
  label: string;
  icon?: string;
  items: ModuleNavItem[];
};

export type EntityOption = {
  id: string;
  name: string;
  code?: string;
  type?: string;
  location?: string;
  status?: string;
};

export type SubTab = { id: string; label: string; icon?: string };

type ModuleShellProps = {
  moduleKey: string;
  moduleName: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accent?: string;
  groups?: ModuleNavGroup[];
  activeId?: string;
  onSelect?: (id: string) => void;
  subTabs?: SubTab[];
  activeSubId?: string;
  onSelectSub?: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
  entityLabel?: string;
  entities?: EntityOption[];
  activeEntityId?: string;
  onSelectEntity?: (id: string) => void;
  contextLabel?: string;
  contextValue?: string;
};

export function ModuleShell({
  moduleKey,
  moduleName,
  eyebrow = "Module workspace",
  title,
  subtitle,
  accent = "#00a3ff",
  groups,
  activeId,
  onSelect,
  subTabs,
  activeSubId,
  onSelectSub,
  actions,
  children,
  entityLabel = "Item",
  entities,
  activeEntityId,
  onSelectEntity,
}: ModuleShellProps) {
  const hasSubTabs = Array.isArray(subTabs) && subTabs.length > 0;
  const hasGroups = Array.isArray(groups) && groups.length > 0;

  // Navigation is handled by the app sidebar - no horizontal tabs needed
  // This eliminates duplication between sidebar and horizontal navigation


  return (
    <div
      className={`module-workspace module-workspace-${moduleKey}`}
      style={{ display: "block", width: "100%", minHeight: "100vh", position: "relative" }}
    >
      {/* MAIN CONTENT — no module sidebar, using app sidebar for navigation */}
      <div className="module-workspace-main main" style={{ width: "100%", minWidth: 0, padding: "clamp(16px, 4vw, 24px)" }}>
        <div className="module-workspace-body" style={{ width: "100%" }}>

          {/* Breadcrumb */}
          <nav
            className="module-breadcrumb"
            aria-label="Breadcrumb"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              margin: "0 0 12px",
              fontSize: 12,
              color: "var(--muted)",
              fontWeight: 500,
            }}
          >
            <Link href="/workspaces" style={{ color: "var(--muted)", textDecoration: "none" }}>Home</Link>
            <span aria-hidden="true" style={{ opacity: 0.6 }}>&gt;</span>
            <span>{moduleName}</span>
          </nav>

          {/* Page heading */}
          <section className="page-head portfolio-head" style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p className="eyebrow" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: accent, margin: "0 0 4px" }}>
                {eyebrow}
              </p>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: "2px 0 4px", color: "var(--text)", lineHeight: 1.2 }}>{title}</h1>
              {subtitle ? <p className="muted" style={{ fontSize: 13, margin: 0, color: "var(--muted)" }}>{subtitle}</p> : null}
            </div>
            {actions ? <div className="portfolio-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{actions}</div> : null}
          </section>

          {/* Entity context switcher */}
          {entities && entities.length > 0 && (
            <div
              className="module-entity-context-bar"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "10px 16px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 14 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                  Viewing {entityLabel}:
                </span>
                <strong style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
                  {entities.find((e) => e.id === activeEntityId)?.name ?? `All ${entityLabel}s`}
                </strong>
                <span style={{ fontSize: 11, padding: "2px 8px", background: "#dcfce7", color: "#15803d", fontWeight: 700, borderRadius: 12 }}>
                  {entities.find((e) => e.id === activeEntityId)?.status ?? "Active"}
                </span>
                {entities.find((e) => e.id === activeEntityId)?.location && (
                  <small style={{ fontSize: 11, color: "var(--muted)" }}>
                    📍 {entities.find((e) => e.id === activeEntityId)?.location}
                  </small>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>Switch {entityLabel}:</label>
                <select
                  value={activeEntityId ?? ""}
                  onChange={(e) => onSelectEntity?.(e.target.value)}
                  style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${accent}`, background: "var(--surface)", color: "var(--text)", cursor: "pointer", outline: "none" }}
                >
                  <option value="">All {entityLabel}s</option>
                  {entities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.code ? `(${item.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="module-workspace-content" style={{ width: "100%" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
