"use client";

import { ReactNode } from "react";
import { Paper, Tabs, Tab } from "@mui/material";
import { SearchInput, LoadingState, EmptyState } from "@/components/module-ui";

export function ViewToolbar({
  title, subtitle, search, onSearch, placeholder = "Search records…", searchTestid, children,
}: {
  title: string; subtitle?: string; search?: string; onSearch?: (v: string) => void;
  placeholder?: string; searchTestid?: string; children?: ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{title}</h3>
        {subtitle && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{subtitle}</p>}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        {onSearch && searchTestid ? (
          <input
            type="text"
            data-testid={searchTestid}
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder ?? "Search records…"}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, minWidth: 240 }}
          />
        ) : onSearch ? (
          <SearchInput value={search ?? ""} onChange={onSearch} placeholder={placeholder} />
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function ListState({
  loading, empty, emptyTitle = "No records", emptyDesc, children,
}: {
  loading: boolean; empty: boolean; emptyTitle?: string; emptyDesc?: string; children: ReactNode;
}) {
  if (loading) return <LoadingState rows={6} />;
  if (empty) {
    return <EmptyState icon="📋" title={emptyTitle} description={emptyDesc ?? "There are no records to display for this view yet."} />;
  }
  return <>{children}</>;
}

export function SubTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <Paper
      variant="outlined"
      sx={{ borderColor: "divider", borderRadius: 2, overflow: "hidden", width: "fit-content", maxWidth: "100%" }}
    >
      <Tabs
        value={active}
        onChange={(_, value: string) => onChange(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Workspace sections"
        sx={{
          minHeight: 44,
          "& .MuiTab-root": {
            minHeight: 44,
            px: 2.5,
            py: 1,
            fontSize: 14,
            fontWeight: 800,
            textTransform: "none",
            color: "var(--text-primary)",
            "&.Mui-selected": {
              color: "var(--brand-primary)",
              fontWeight: 800,
            },
          },
          "& .MuiTabs-indicator": {
            backgroundColor: "var(--brand-primary)",
            height: 3,
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.id} value={tab.id} label={tab.label} />
        ))}
      </Tabs>
    </Paper>
  );
}
