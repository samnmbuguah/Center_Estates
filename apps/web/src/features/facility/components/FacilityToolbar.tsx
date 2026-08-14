"use client";

import { ReactNode } from "react";
import { SearchInput, LoadingState, EmptyState } from "@/components/module-ui";

export function ViewToolbar({
  title,
  subtitle,
  search,
  onSearch,
  placeholder = "Search records…",
  searchTestid,
  children,
}: {
  title: string;
  subtitle?: string;
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  searchTestid?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        {subtitle && <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>{subtitle}</p>}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        {searchTestid ? (
          <input
            type="text"
            data-testid={searchTestid}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder ?? "Search records…"}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, minWidth: 240 }}
          />
        ) : (
          <SearchInput value={search} onChange={onSearch} placeholder={placeholder} />
        )}
        {children}
      </div>
    </div>
  );
}

export function FcStatus({ value }: { value: unknown }) {
  const s = String(value ?? "").toLowerCase().replace(/[\s_]/g, "-");
  const display = String(value ?? "").replace(/_/g, " ");
  return <span className={`fc-status fc-status-${s}`}>{display || "—"}</span>;
}

export function HealthBar({ pct }: { pct: number }) {
  const cls = pct >= 75 ? "good" : pct >= 50 ? "fair" : "poor";
  return (
    <div className="fc-health-bar">
      <div className="fc-health-track">
        <i className={`fc-health-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="fc-health-label mono">{pct}%</span>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: unknown }) {
  const p = String(priority ?? "").toLowerCase();
  const cls = p === "emergency" ? "danger" : p === "high" ? "warning" : p === "medium" ? "primary" : "neutral";
  return <span className={`pill pill-${cls}`}>{String(priority ?? "—")}</span>;
}

export function ListState({
  loading,
  empty,
  emptyTitle,
  emptyDesc,
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
  children: ReactNode;
}) {
  if (loading) return <LoadingState rows={5} />;
  if (empty) return <EmptyState icon="🏢" title={emptyTitle ?? "No records"} description={emptyDesc ?? "No records found matching your criteria."} />;
  return <>{children}</>;
}
