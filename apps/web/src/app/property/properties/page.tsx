"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { propertyNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type PropertyRow = Record<string, string | number | boolean | null>;

const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function PropertiesDirectoryPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/property/properties/")
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as PropertyRow[];
          setProperties(data || []);
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

  const filtered = properties.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      String(p.name || "").toLowerCase().includes(term) ||
      String(p.code || "").toLowerCase().includes(term) ||
      String(p.city || "").toLowerCase().includes(term)
    );
  });

  return (
    <ModuleShell
      moduleKey="property"
      moduleName="Property Management"
      eyebrow="Portfolio Directory"
      title="Property & Asset Register"
      subtitle="Real estate assets, building structures, units breakdown, and occupancy metrics."
      accent="#00a3ff"
      groups={propertyNav}
      activeId="properties"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/property";
        else window.location.href = `/property?tab=${id}`;
      }}
      contextLabel="Portfolio Scope"
      contextValue={`${properties.length} Properties`}
    >
      <div className="property-app">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search property by name, code or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", width: 320, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <Link
            href="/property?tab=properties"
            style={{ background: "#00a3ff", color: "#fff", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}
          >
            + Add Property
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading property directory…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {filtered.map((prop) => (
              <div
                key={String(prop.id)}
                style={{
                  background: "#ffffff",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  padding: 16,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#00a3ff", fontWeight: "bold" }}>{String(prop.code)}</span>
                      <h4 style={{ margin: "2px 0 0 0", fontSize: "1.05rem", color: "#0f172a" }}>{String(prop.name)}</h4>
                    </div>
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem", fontWeight: "bold",
                      background: "#dcfce7", color: "#166534"
                    }}>
                      {String(prop.property_type || "Commercial").replaceAll("_", " ")}
                    </span>
                  </div>

                  <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 12px 0" }}>
                    📍 {String(prop.city || "Nairobi")} | Units: <strong>{String(prop.units_count || 0)} Total Units</strong>
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    href={`/property/properties/${prop.id}`}
                    style={{ flex: 1, textAlign: "center", background: "#0f172a", color: "#ffffff", padding: "8px", borderRadius: 6, fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}
                  >
                    Open Workspace
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
