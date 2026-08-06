"use client";

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

export type SubTab = { id: string; label: string };

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

  return (
    <div
      className={`module-workspace module-workspace-${moduleKey}`}
      style={{ display: "grid", gridTemplateColumns: "248px minmax(0, 1fr)", gap: 0, flex: 1, width: "100%", minHeight: 0 }}
    >
      {/* LEFT SIDEBAR NAVIGATION (from groups) */}
      {hasGroups && (
        <aside
          className="module-side-nav"
          aria-label={`${moduleName} sections`}
          style={{ background: "#0b1727", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflow: "hidden", overflowY: "auto" }}
        >
          <div
            className="module-side-nav-title"
            style={{ padding: "16px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span
              className="module-side-mark"
              style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", background: `linear-gradient(145deg, ${accent}, ${accent}cc)`, color: "#fff", fontWeight: 800 }}
            >
              {moduleName.slice(0, 1)}
            </span>
            <div>
              <strong style={{ fontSize: 13, color: "#fff", display: "block" }}>{moduleName}</strong>
              <small style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Workspace</small>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {groups.map((group) => (
              <div key={group.label} style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", padding: "10px 10px 4px", margin: 0 }}>
                  {group.icon ? `${group.icon} ` : ""}
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const isActive = activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect?.(item.id)}
                      aria-current={isActive ? "page" : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: 8,
                        marginBottom: 2,
                        cursor: "pointer",
                        background: isActive ? "linear-gradient(90deg, rgba(229,46,46,0.25), rgba(229,46,46,0.05))" : "transparent",
                        border: "1px solid" + (isActive ? " rgba(229,46,46,0.4)" : " transparent"),
                        color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{item.icon ?? "•"}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div
            className="module-side-footer"
            style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#10b981", fontWeight: 700 }}>
              <span className="sync-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              Live Organization Data
            </div>
            <small>Role &amp; Scope Filtered</small>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT */}
      <div className="module-workspace-main main" style={{ width: "100%", minWidth: 0, padding: "20px 24px" }}>
        <div className="module-workspace-body" style={{ width: "100%" }}>

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

          {/* HORIZONTAL SUB-TABS */}
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
                    role="tab"
                    aria-selected={isActive}
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
