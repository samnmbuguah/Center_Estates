"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { propertyNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type TenantRow = Record<string, string | number | boolean | null>;

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/property/tenants/")
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as TenantRow[];
          setTenants(data || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = tenants.filter((t) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      String(t.first_name || "").toLowerCase().includes(term) ||
      String(t.last_name || "").toLowerCase().includes(term) ||
      String(t.company_name || "").toLowerCase().includes(term) ||
      String(t.email || "").toLowerCase().includes(term)
    );
  });

  return (
    <ModuleShell
      moduleKey="property"
      moduleName="Property Management"
      eyebrow="Tenancy Directory"
      title="Tenant Profiles & Accounts"
      subtitle="Commercial and residential tenant profiles, contact info, active leases, and arrears balances."
      accent="#00a3ff"
      groups={propertyNav}
      activeId="tenants"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/property";
        else window.location.href = `/property?tab=${id}`;
      }}
      contextLabel="Tenants Scope"
      contextValue={`${tenants.length} Active Tenants`}
    >
      <div className="property-app">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search tenant by name, company, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", width: 320, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <Link
            href="/property?tab=tenants"
            style={{ background: "#00a3ff", color: "#fff", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}
          >
            + Onboard Tenant
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading tenant directory…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 10, textAlign: "left" }}>Tenant Name / Company</th>
                <th style={{ padding: 10, textAlign: "left" }}>Email & Contact</th>
                <th style={{ padding: 10, textAlign: "center" }}>Status</th>
                <th style={{ padding: 10, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={String(t.id)} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 10, fontWeight: "bold" }}>
                    {String(t.company_name || `${t.first_name || ""} ${t.last_name || ""}`.trim() || "Tenant Account")}
                  </td>
                  <td style={{ padding: 10, color: "#64748b" }}>
                    {String(t.email || "No email")} | {String(t.phone_number || "No phone")}
                  </td>
                  <td style={{ padding: 10, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem", fontWeight: "bold", background: "#dcfce7", color: "#166534" }}>
                      ACTIVE
                    </span>
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }}>
                    <Link href={`/property/tenants/${t.id}`} style={{ color: "#00a3ff", fontWeight: 600, textDecoration: "none" }}>
                      View Account $\rightarrow$
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ModuleShell>
  );
}
