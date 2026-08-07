"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePropertyContext } from "@/lib/property-context";

/**
 * MonitoringERP-style persistent property context bar.
 * Rendered above module workspaces (Property / Facility / Companion) so a
 * selected property stays in context while working across modules.
 */
export function PropertyContextBar() {
  const { activeProperty } = usePropertyContext();

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
          <Link
            href="/workspaces"
            className="btn ghost sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, textDecoration: "none" }}
          >
            <ArrowLeft size={14} /> Workspaces
          </Link>
          <span style={{ color: "var(--border)" }}>|</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {activeProperty.code ?? "PROPERTY"}
          </span>
          <strong style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{activeProperty.name}</strong>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 12,
              background: "rgba(16,185,129,0.15)",
              color: "#10b981",
              fontWeight: 700,
              border: "1px solid rgba(16,185,129,0.3)",
            }}
          >
            {activeProperty.status ?? "Active"}
          </span>
          {activeProperty.location && (
            <small style={{ fontSize: 11, color: "var(--muted)" }}>📍 {activeProperty.location}</small>
          )}
        </div>
      </div>
    </section>
  );
}
