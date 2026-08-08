"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode } from "react";
import {
  propertyNav,
  facilityNav,
  salesNav,
  tenderNav,
  valuationNav,
  constructionNav,
  companionNav,
} from "@/lib/module-nav";

const MODULE_NAV_BY_KEY: Record<string, ModuleNavGroup[]> = {
  property: propertyNav,
  facility: facilityNav,
  sales: salesNav,
  tender: tenderNav,
  valuation: valuationNav,
  construction: constructionNav,
  companion: companionNav,
};

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
  const resolvedGroups = groups ?? MODULE_NAV_BY_KEY[moduleKey];
  const hasGroups = Array.isArray(resolvedGroups) && resolvedGroups.length > 0;
  const activeGroup = resolvedGroups?.find((group) => group.items.some((item) => item.id === activeId)) ?? resolvedGroups?.[0];

  return (
    <div
      className={`module-workspace module-workspace-${moduleKey}`}
      style={{ display: "block", width: "100%", minHeight: "100vh", position: "relative" }}
    >
      {/* MAIN CONTENT — with horizontal navigation bar */}
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
              fontSize: 13,
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            <Link href="/workspaces" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Home</Link>
            <span aria-hidden="true" style={{ opacity: 0.6 }}>&gt;</span>
            <span style={{ color: "var(--text-primary)" }}>{moduleName}</span>
          </nav>

          {/* Page heading */}
          <section className="page-head portfolio-head" style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p className="eyebrow" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brand-primary)", margin: "0 0 4px", fontWeight: 600 }}>
                {eyebrow}
              </p>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: "2px 0 4px", color: "var(--text-primary)", lineHeight: 1.2 }}>{title}</h1>
              {subtitle ? <p className="muted" style={{ fontSize: 14, margin: 0, color: "var(--text-secondary)", lineHeight: 1.4 }}>{subtitle}</p> : null}
            </div>
            <div className="portfolio-toolbar module-context-actions" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {actions}
            </div>
          </section>

          {/* Two-level module navigation: workflow groups, then pages in the active group. */}
          {hasGroups && (
            <nav className="module-nav-bar" aria-label={`${moduleName} navigation`}>
              <label className="module-nav-mobile-select">
                <span>Module page</span>
                <select value={activeId ?? ""} onChange={(event) => onSelect?.(event.target.value)}>
                  {resolvedGroups.flatMap((group) => group.items.map((item) => (
                    <option value={item.id} key={item.id}>{group.label} — {item.label}</option>
                  )))}
                </select>
              </label>

              <div className="module-nav-groups" role="tablist" aria-label="Workflow sections">
                {resolvedGroups.map((group) => {
                  const selected = group === activeGroup;
                  return (
                    <button
                      key={group.label}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={selected ? "active" : ""}
                      onClick={() => onSelect?.(group.items[0].id)}
                      style={selected ? { "--module-accent": accent } as CSSProperties : undefined}
                    >
                      {group.icon ? <span aria-hidden="true">{group.icon}</span> : null}
                      {group.label}
                      <small>{group.items.length}</small>
                    </button>
                  );
                })}
              </div>

              {activeGroup && (
                <div className="module-nav-pages" aria-label={`${activeGroup.label} pages`}>
                  {activeGroup.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={activeId === item.id ? "page" : undefined}
                      className={activeId === item.id ? "active" : ""}
                      onClick={() => onSelect?.(item.id)}
                      style={activeId === item.id ? { "--module-accent": accent } as CSSProperties : undefined}
                    >
                      {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </nav>
          )}

          {/* Entity context switcher */}
          {entities && entities.length > 0 && (
            <div
              className="module-entity-context-bar"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "10px 16px", background: "var(--bg-app)", border: "1px solid var(--border-color)", borderRadius: 8, marginBottom: 14 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
                  Viewing {entityLabel}:
                </span>
                <strong style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>
                  {entities.find((e) => e.id === activeEntityId)?.name ?? `All ${entityLabel}s`}
                </strong>
                <span style={{ fontSize: 11, padding: "2px 8px", background: "var(--success-bg)", color: "var(--success)", fontWeight: 700, borderRadius: 12 }}>
                  {entities.find((e) => e.id === activeEntityId)?.status ?? "Active"}
                </span>
                {entities.find((e) => e.id === activeEntityId)?.location && (
                  <small style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    📍 {entities.find((e) => e.id === activeEntityId)?.location}
                  </small>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Switch {entityLabel}:</label>
                <select
                  value={activeEntityId ?? ""}
                  onChange={(e) => onSelectEntity?.(e.target.value)}
                  style={{ fontSize: 13, fontWeight: 700, padding: "5px 12px", borderRadius: 6, border: `1.5px solid var(--brand-primary)`, background: "var(--bg-surface)", color: "var(--text-primary)", cursor: "pointer", outline: "none" }}
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
