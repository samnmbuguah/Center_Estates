"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Building2, HardHat, ClipboardCheck, Users2, FileText, Wallet, PieChart } from "lucide-react";
import { usePropertyContext } from "@/lib/property-context";

/**
 * MonitoringERP-style persistent property context bar.
 * Rendered above module workspaces (Property / Facility / Companion) so a
 * selected property stays in context while working across modules, with
 * horizontal cross-module tabs.
 */
export function PropertyContextBar() {
  const pathname = usePathname();
  const { activeProperty } = usePropertyContext();

  if (!activeProperty) return null;

  const tabs = [
    { label: "Overview", path: "/property", icon: <Building2 size={13} /> },
    { label: "Tenants", path: "/property?tab=tenants", icon: <Users2 size={13} /> },
    { label: "Leases", path: "/property?tab=leases", icon: <FileText size={13} /> },
    { label: "Rent & Invoices", path: "/property?tab=rent", icon: <Wallet size={13} /> },
    { label: "Service Charge", path: "/property?tab=service-charges", icon: <PieChart size={13} /> },
    { label: "Facility", path: "/facility", icon: <HardHat size={13} /> },
    { label: "Companion", path: "/companion", icon: <ClipboardCheck size={13} /> },
  ];

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
          borderBottom: "1px solid var(--border)",
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

      {/* Horizontal cross-module tabs */}
      <div
        role="tablist"
        aria-label="Property navigation"
        style={{ display: "flex", gap: 0, padding: "6px 12px", overflowX: "auto" }}
      >
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              role="tab"
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? "#fff" : "var(--muted)",
                background: isActive ? "var(--primary)" : "transparent",
                transition: "all 0.15s ease",
                textDecoration: "none",
              }}
            >
              {tab.icon}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
