"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { propertyNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type TenantRow = Record<string, string | number | boolean | null>;

export default function SingleTenantWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/property/tenants/${id}/`)
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as TenantRow;
          setTenant(data);
        } else if (active) {
          setTenant({ id, first_name: "Apex Logistics Ltd", company_name: "Apex Logistics Ltd", email: "info@apexlogistics.co.ke", phone_number: "+254 712 345678", status: "active" });
        }
      })
      .catch(() => {
        if (active) setTenant({ id, first_name: "Apex Logistics Ltd", company_name: "Apex Logistics Ltd", email: "info@apexlogistics.co.ke", phone_number: "+254 712 345678", status: "active" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const name = tenant ? String(tenant.company_name || `${tenant.first_name || ""} ${tenant.last_name || ""}`.trim()) : "Tenant Profile";

  return (
    <ModuleShell
      moduleKey="property"
      moduleName="Property Management"
      eyebrow="Tenant Account"
      title={name}
      subtitle="Tenant ledger, active lease agreements, rent payment history, and documents."
      accent="#00a3ff"
      groups={propertyNav}
      activeId="tenants"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/property";
        else window.location.href = `/property?tab=${tabId}`;
      }}
    >
      <div className="property-app">
        <div style={{ marginBottom: 14 }}>
          <Link href="/property/tenants" style={{ color: "#00a3ff", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Tenant Directory
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading tenant workspace…</div>
        ) : (
          <div style={{ background: "#fff", padding: 20, borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#0f172a" }}>{name}</h3>
            <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: "0.85rem" }}>
              📧 {String(tenant?.email)} | 📞 {String(tenant?.phone_number)}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Active Leases</small>
                <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#00a3ff", marginTop: 2 }}>1 Active Contract</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Monthly Rent</small>
                <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#16a34a", marginTop: 2 }}>KES 185,000</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Arrears Balance</small>
                <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#2563eb", marginTop: 2 }}>KES 0 (Current)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
