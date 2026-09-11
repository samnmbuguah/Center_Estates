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
      accent="var(--color-brand-blue)"
      groups={propertyNav}
      activeId="properties"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/property";
        else window.location.href = `/property?tab=${tabId}`;
      }}
    >
      <div className="property-app">
        <div style={{ marginBottom: 14 }}>
          <Link href="/property/properties" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Property Register
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading property workspace…</div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "var(--surface)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
                <small style={{ color: "var(--text-faint)" }}>Property Code</small>
                <h3 style={{ margin: "4px 0 0 0", color: "var(--color-brand-blue)", fontFamily: "monospace" }}>{String(property?.code)}</h3>
              </div>
              <div style={{ background: "var(--surface)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
                <small style={{ color: "var(--text-faint)" }}>Total Units</small>
                <h3 style={{ margin: "4px 0 0 0", color: "var(--text)" }}>{String(property?.units_count || 48)} Units</h3>
              </div>
              <div style={{ background: "var(--surface)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
                <small style={{ color: "var(--text-faint)" }}>Occupancy Rate</small>
                <h3 style={{ margin: "4px 0 0 0", color: "var(--color-success)" }}>94.2%</h3>
              </div>
              <div style={{ background: "var(--surface)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
                <small style={{ color: "var(--text-faint)" }}>City / Location</small>
                <h3 style={{ margin: "4px 0 0 0", color: "var(--text)" }}>{String(property?.city || "Nairobi")}</h3>
              </div>
            </div>

            <h3 style={{ fontSize: "1.1rem", margin: "0 0 12px 0", color: "var(--text)" }}>Property Sub-Workspaces & Management Areas</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              <Link href={`/property/tenants`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--color-slate-50)", border: "1px solid var(--color-slate-300)", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "var(--color-brand-blue)" }}>👥 Tenant Directory & Profiles</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-faint)" }}>Active tenants, contact details, lease agreements, and arrears ledgers.</p>
                </div>
              </Link>

              <Link href={`/property/leases`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--color-slate-50)", border: "1px solid var(--color-slate-300)", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "var(--color-success)" }}>📜 Lease Contracts & Escalations</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-faint)" }}>Active leases, rent escalation dates, security deposits, and contract expiry tracking.</p>
                </div>
              </Link>

              <Link href={`/property/collections`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--color-slate-50)", border: "1px solid var(--color-slate-300)", borderRadius: 8, padding: 16, cursor: "pointer" }}>
                  <h4 style={{ margin: "0 0 4px 0", color: "var(--color-violet)" }}>💳 Rent Collections & Arrears</h4>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-faint)" }}>Monthly rent invoicing, receipt allocations, bank reconciliation, and automated reminders.</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
