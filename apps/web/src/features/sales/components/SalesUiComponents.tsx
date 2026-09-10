"use client";

import { type ReactNode } from "react";
import { SearchInput } from "@/components/module-ui";

export function DataTable({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="table-scroll">
      <table className="fc-data-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TableChrome({
  search,
  setSearch,
  placeholder,
  chips,
  actions,
  children,
}: {
  search: string;
  setSearch: (v: string) => void;
  placeholder: string;
  chips?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="fc-table-toolbar">
        <div className="fc-table-toolbar-left">
          <SearchInput value={search} onChange={setSearch} placeholder={placeholder} />
          {chips}
        </div>
        <div className="fc-table-toolbar-right">{actions}</div>
      </div>
      {children}
    </>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T | "") => void;
}) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`btn sm ${value === o.value ? "primary" : "ghost"}`}
          style={{ fontSize: 11, padding: "4px 10px" }}
          onClick={() => onChange(value === o.value ? "" : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="fc-detail-field">
      <label>{label}</label>
      <span>{value}</span>
    </div>
  );
}

export function ProgressBar({ pct, color = "var(--color-orange)" }: { pct: number; color?: string }) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
      <div style={{ background: "var(--color-surface-alt)", borderRadius: 99, flex: 1, height: 6, minWidth: 60, overflow: "hidden" }}>
        <i style={{ background: color, borderRadius: "inherit", display: "block", height: "100%", width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700 }}>{Math.round(pct)}%</span>
    </div>
  );
}

export function RefText({ value }: { value: unknown }) {
  return <span className="mono" style={{ color: "var(--primary)", fontSize: 11, fontWeight: 700 }}>{String(value ?? "—")}</span>;
}

export function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", marginBottom: 12, fontSize: 12 }}>
      ⚠️ {error}
    </div>
  );
}
