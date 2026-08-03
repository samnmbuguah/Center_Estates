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
  accent = "#e23b3b",
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

  const activeLabel = allItems.find((item) => item.id === activeId)?.label ?? title;

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

      {/* SINGLE LEFT SIDEBAR FOR THIS MODULE */}
      <aside className={`module-side-nav ${navOpen ? "open" : ""}`} aria-label={`${moduleName} sections`}>
        {/* Switch Workspace Header */}
        <div style={{ padding: "12px 14px 4px 14px" }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--muted)",
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
            <small>Workspace</small>
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

      <div className="module-workspace-main">
        <header className="module-context-bar">
          <button
            type="button"
            className="module-menu"
            aria-label="Open module navigation"
            onClick={() => setNavOpen(true)}
          >
            ☰
          </button>
          <div className="module-breadcrumb">
            <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>Main Workspaces</Link>
            <b>/</b>
            <span>{moduleName}</span>
            <b>/</b>
            <strong>{activeLabel}</strong>
          </div>
          <div className="module-context-chip">
            <span className="context-health" />
            <div>
              <small>{contextLabel}</small>
              <strong>{contextValue ?? "Active Organization"}</strong>
            </div>
          </div>
        </header>

        <div className="module-workspace-body">
          <section className="module-page-heading">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {actions ? <div className="module-heading-actions">{actions}</div> : null}
          </section>

          {/* HORIZONTAL SECONDARY NAV TABS */}
          <nav className="module-tabs module-tabs-workspace" aria-label={`${moduleName} sections`}>
            {horizontalItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeId === item.id ? "active" : ""}
                onClick={() => select(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="module-workspace-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
