"use client";

import { usePropertyContext } from "@/lib/property-context";

/**
 * MonitoringERP-style persistent property context bar.
 * Rendered above module workspaces (Property / Facility / Companion) so a
 * selected property stays in context while working across modules.
 */
export function PropertyContextBar() {
  const { activeProperty, properties, loadingProperties, selectProperty } = usePropertyContext();

  if (!activeProperty) return null;

  return (
    <section
      aria-label="Property workspace"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        marginBottom: 16,
        overflow: "hidden",
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label className="module-property-switcher">
            <select
              aria-label="Current property"
              value={activeProperty.id}
              disabled={loadingProperties || properties.length === 0}
              onChange={(event) => {
                const selected = properties.find((property) => property.id === event.target.value) ?? null;
                selectProperty(selected);
              }}
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.code ? `${property.code} — ` : ""}{property.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}
