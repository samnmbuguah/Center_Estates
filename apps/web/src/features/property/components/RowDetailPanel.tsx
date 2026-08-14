"use client";

import { PropertyTab, Row } from "../types/property.types";

export function RowDetailPanel({ tab, row }: { tab: PropertyTab; row: Row }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {Object.entries(row)
        .filter(([k]) => !["id", "metadata"].includes(k))
        .map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
            <span className="muted">{k.replace(/_/g, " ")}</span>
            <span style={{ fontWeight: 600 }}>{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</span>
          </div>
        ))}
    </div>
  );
}
