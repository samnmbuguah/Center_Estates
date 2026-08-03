"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

export type ModuleNavItem = {
  id: string;
  label: string;
  /** When true, only shown in the left rail (not top horizontal strip). */
  sideOnly?: boolean;
};

export type ModuleNavGroup = {
  label: string;
  icon?: string;
  items: ModuleNavItem[];
};

type ModuleShellProps = {
  moduleKey: string;
  moduleName: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accent?: string;
  groups: ModuleNavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
  /** Optional secondary context line (e.g. active project). */
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
  actions,
  children,
  contextLabel = "Workspace",
  contextValue,
}: ModuleShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");

  const allItems = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    [groups],
  );

  const horizontalItems = useMemo(
    () => allItems.filter((item) => !item.sideOnly),
    [allItems],
  );

  const visibleGroups = useMemo(() => {
    const query = navSearch.trim().toLowerCase();
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(query)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, navSearch]);

  const select = (id: string) => {
    onSelect(id);
    setNavOpen(false);
  };

  return (
    <div className={`module-workspace module-workspace-${moduleKey}`}>
      <button
        className={`module-nav-scrim ${navOpen ? "visible" : ""}`}
        aria-label="Close module navigation"
        onClick={() => setNavOpen(false)}
      />

      {/* MONITORING ERP SINGLE LEFT SIDEBAR */}
      <aside className={`module-side-nav ${navOpen ? "open" : ""}`} aria-label={`${moduleName} sections`}>
        <div style={{ padding: "12px 14px 4px 14px" }}>
          <Link
            href="/workspaces"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.75)",
              background: "rgba(255,255,255,0.06)",
              padding: "6px 10px",
              borderRadius: 6,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            title="Return to Main Workspace Selection Page"
          >
            <span aria-hidden="true">←</span>
            <span>Switch Workspace</span>
          </Link>
        </div>

        <div className="module-side-nav-title">
          <span className="module-side-mark" style={{ background: `linear-gradient(145deg, ${accent}, ${accent}cc)` }}>
            {moduleName.slice(0, 1)}
          </span>
          <div>
            <strong>{moduleName}</strong>
            <small>WORKSPACE</small>
          </div>
          <button type="button" aria-label="Close module navigation" onClick={() => setNavOpen(false)}>
            ×
          </button>
        </div>

        <label className="module-side-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={navSearch}
            onChange={(event) => setNavSearch(event.target.value)}
            placeholder="Find a section..."
            aria-label={`Search ${moduleName} sections`}
          />
        </label>

        <div className="module-side-scroll">
          {visibleGroups.map((group) => (
            <section className="module-side-group" key={group.label}>
              <p>
                <span aria-hidden="true">{group.icon ?? "▪"}</span>
                {group.label}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activeId === item.id ? "active" : ""}
                  aria-label={item.label}
                  aria-current={activeId === item.id ? "page" : undefined}
                  onClick={() => select(item.id)}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </section>
          ))}
        </div>

        <div className="module-side-footer">
          <span className="sync-dot" />
          Live Organization Data
          <small>Role & Scope Filtered</small>
        </div>
      </aside>

      {/* MONITORING ERP MAIN PAGE SHELL */}
      <div className="module-workspace-main main">
        <div className="module-workspace-body" style={{ width: "100%", maxWidth: 1600, margin: "0 auto" }}>
          <section className="page-head portfolio-head" style={{ marginBottom: 20 }}>
            <div>
              <p className="eyebrow" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--primary)", margin: "0 0 4px" }}>
                {eyebrow}
              </p>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: "2px 0 4px", color: "var(--text)" }}>{title}</h1>
              {subtitle ? <p className="muted" style={{ fontSize: 13, margin: 0, color: "var(--muted)" }}>{subtitle}</p> : null}
            </div>
            {actions ? <div className="portfolio-toolbar" style={{ display: "flex", gap: 10, alignItems: "center" }}>{actions}</div> : null}
          </section>

          {/* MONITORING ERP SECONDARY HORIZONTAL TABS */}
          <nav className="project-workspace-tabs" style={{ display: "flex", gap: 6, padding: "8px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, overflowX: "auto", marginBottom: 20 }}>
            {horizontalItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`btn sm ${activeId === item.id ? "primary" : "ghost"}`}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, fontWeight: 600 }}
                onClick={() => select(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="module-workspace-content" style={{ width: "100%" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
