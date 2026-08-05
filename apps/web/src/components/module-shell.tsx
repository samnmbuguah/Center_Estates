"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

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

export type SubTab = { id: string; label: string };

type ModuleShellProps = {
  moduleKey: string;
  moduleName: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accent?: string;
  /** Left-sidebar nav groups (top-level sections only) */
  groups: ModuleNavGroup[];
  /** Currently active left-nav section id */
  activeId: string;
  /** Called when user clicks a left-nav section */
  onSelect: (id: string) => void;
  /**
   * Sub-tabs shown in the horizontal bar beneath the heading.
   * When empty or omitted the horizontal bar is hidden entirely.
   */
  subTabs?: SubTab[];
  activeSubId?: string;
  onSelectSub?: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
  entityLabel?: string;
  entities?: EntityOption[];
  activeEntityId?: string;
  onSelectEntity?: (id: string) => void;
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
  const [navOpen, setNavOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");

  const visibleGroups = useMemo(() => {
    const query = navSearch.trim().toLowerCase();
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, navSearch]);

  const select = (id: string) => {
    onSelect(id);
    setNavOpen(false);
  };

  const hasSubTabs = Array.isArray(subTabs) && subTabs.length > 0;

  return (
    <div className={`module-workspace module-workspace-${moduleKey}`}>
      <button
        className={`module-nav-scrim ${navOpen ? "visible" : ""}`}
        aria-label="Close module navigation"
        onClick={() => setNavOpen(false)}
      />

      {/* LEFT SIDEBAR — top-level section navigation */}
      <aside className={`module-side-nav ${navOpen ? "open" : ""}`} aria-label={`${moduleName} navigation`}>

        {/* Brand header */}
        <div className="module-side-nav-title" style={{ padding: "14px 16px", minHeight: 64, borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="Center Estates" style={{ height: 34, width: "auto", objectFit: "contain", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em", color: "#ffffff", lineHeight: 1.1, display: "block" }}>
              {moduleKey === "monitoring" ? "Monitoring ERP" : `${moduleName.replace(" Management", "")} ERP`}
            </strong>
            <small style={{ color: "#f59e0b", fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase" }}>
              BY CENTER ESTATES
            </small>
          </div>
          <button type="button" aria-label="Close module navigation" onClick={() => setNavOpen(false)} style={{ color: "rgba(255,255,255,0.5)", background: "none", border: 0, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>
            ×
          </button>
        </div>

        {/* Back to workspace */}
        <div style={{ padding: "8px 10px 2px" }}>
          <Link
            href="/workspaces"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, color: "rgba(255,255,255,0.45)", textDecoration: "none", fontSize: 11, fontWeight: 600 }}
          >
            <span style={{ fontSize: 11 }}>←</span> All Workspaces
          </Link>
        </div>

        {/* Search */}
        <label className="module-side-search" style={{ margin: "4px 10px 6px" }}>
          <span aria-hidden="true">⌕</span>
          <input
            value={navSearch}
            onChange={(event) => setNavSearch(event.target.value)}
            placeholder="Find a section..."
            aria-label={`Search ${moduleName} sections`}
          />
        </label>

        {/* Nav groups */}
        <div className="module-side-scroll">
          {visibleGroups.map((group) => (
            <section className="module-side-group" key={group.label}>
              {groups.length > 1 && (
                <p style={{ padding: "8px 16px 2px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", margin: 0 }}>
                  {group.icon ? <span aria-hidden="true" style={{ marginRight: 4 }}>{group.icon}</span> : null}
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={isActive ? "active" : ""}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => select(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "calc(100% - 16px)",
                      margin: "1px 8px",
                      padding: "9px 12px",
                      background: isActive ? accent : "transparent",
                      color: isActive ? "#fff" : "rgba(255,255,255,0.68)",
                      border: 0,
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 400,
                      textAlign: "left",
                      boxSizing: "border-box",
                    }}
                  >
                    {item.icon && <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>

        {/* Quick Support footer */}
        <div style={{ padding: "10px", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "auto" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>🎧</span>
              <strong style={{ fontSize: 12, color: "white" }}>Quick Support</strong>
            </div>
            <span style={{ display: "block", fontSize: 11, color: "#e2e8f0", fontWeight: 600 }}>0722 574 400</span>
            <span style={{ display: "block", fontSize: 11, color: "#94a3b8" }}>support@ceest.co.ke</span>
            <small style={{ display: "block", fontSize: 10, color: "#64748b", marginTop: 2 }}>Mon - Fri 8:00AM - 6:00PM</small>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="module-workspace-main main">
        <div className="module-workspace-body" style={{ width: "100%", maxWidth: 1600, margin: "0 auto" }}>

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

          {/*
            HORIZONTAL SUB-TABS — second level of navigation.
            Only rendered when the active left-nav section has sub-pages.
            E.g. "Rent Collection" section → shows Dashboard · Invoices · Receipts · Arrears…
          */}
          {hasSubTabs && (
            <nav
              className="module-tabs-workspace"
              aria-label="Section sub-pages"
              style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 20, overflowX: "auto" }}
            >
              {subTabs!.map((tab) => {
                const isActive = activeSubId === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onSelectSub?.(tab.id)}
                    style={{
                      padding: "10px 18px",
                      background: "none",
                      border: 0,
                      borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
                      marginBottom: -2,
                      color: isActive ? accent : "var(--muted)",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "color 0.15s, border-color 0.15s",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          )}

          <div className="module-workspace-content" style={{ width: "100%" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
