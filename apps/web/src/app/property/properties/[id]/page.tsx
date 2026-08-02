"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { propertyNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type PropertyRow = Record<string, string | number | boolean | null>;

export default function SinglePropertyWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/property/properties/${id}/`)
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as PropertyRow;
          setProperty(data);
        } else if (active) {
          setProperty({ id, code: `PROP-${id.slice(0, 4)}`, name: "Kilimani Heights Towers", city: "Nairobi", units_count: 48, property_type: "Commercial & Residential" });
        }
      })
      .catch(() => {
        if (active) setProperty({ id, code: `PROP-${id.slice(0, 4)}`, name: "Kilimani Heights Towers", city: "Nairobi", units_count: 48, property_type: "Commercial & Residential" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const propName = property ? String(property.name || "Property Workspace") : "Property Workspace";

  return (
    <ModuleShell
      moduleKey="property"
      moduleName="Property Management"
      eyebrow="Property Workspace"
      title={propName}
      subtitle="Unified control center for buildings, units occupancy, lease contracts, arrears, and maintenance."
      accent="#00a3ff"
      groups={propertyNav}
      activeId="properties"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/property";
        else window.location.href = `/property?tab=${tabId}`;
      }}
      contextLabel="Active Property"
      contextValue={propName}
    >
      <div className="property-app">
        <div style={{ marginBottom: 14 }}>
          <Link href="/property/properties" style={{ color: "#00a3ff", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Property Register
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading property workspace…</div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Property Code</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#00a3ff", fontFamily: "monospace" }}>{String(property?.code)}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Total Units</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#0f172a" }}>{String(property?.units_count || 48)} Units</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Occupancy Rate</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#16a34a" }}>94.2%</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>City / Location</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#0f172a" }}>{String(property?.city || "Nairobi")}</h3>
              </div>
            </div>

            <h3 style={{ fontSize: "1.1rem", margin: "0 0 12px 0", color: "#0f172a" }}>Property Sub-Workspaces & Management Areas</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              <Link href={`/property/tenants`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "#00a3ff" }}>👥 Tenant Directory & Profiles</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Active tenants, contact details, lease agreements, and arrears ledgers.</p>
                </div>
              </Link>

              <Link href={`/property/leases`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "#16a34a" }}>📜 Lease Contracts & Escalations</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Active leases, rent escalation dates, security deposits, and contract expiry tracking.</p>
                </div>
              </Link>

              <Link href={`/property/collections`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "#7c3aed" }}>💳 Rent Collections & Arrears</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Monthly rent invoicing, receipt allocations, bank reconciliation, and automated reminders.</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
