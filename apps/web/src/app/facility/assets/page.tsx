"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { facilityNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type AssetRow = Record<string, string | number | boolean | null>;

export default function AssetsDirectoryPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/facilities/assets/")
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as AssetRow[];
          setAssets(data || []);
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

  const filtered = assets.filter((a) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      String(a.name || "").toLowerCase().includes(term) ||
      String(a.asset_code || "").toLowerCase().includes(term) ||
      String(a.category || "").toLowerCase().includes(term)
    );
  });

  return (
    <ModuleShell
      moduleKey="facility"
      moduleName="Facility Management"
      eyebrow="Asset Management"
      title="Equipment & Asset Directory"
      subtitle="HVAC units, elevators, backup generators, plumbing pumps, and electrical transformers."
      accent="#16a34a"
      groups={facilityNav}
      activeId="assets"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/facility";
        else window.location.href = `/facility?tab=${id}`;
      }}
      contextLabel="Asset Scope"
      contextValue={`${assets.length} Registered Assets`}
    >
      <div className="facility-app">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search asset by name, code or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", width: 320, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <Link
            href="/facility?tab=assets"
            style={{ background: "#16a34a", color: "#fff", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}
          >
            + Register Asset
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading asset directory…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {filtered.map((asset) => (
              <div key={String(asset.id)} style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#16a34a", fontWeight: "bold" }}>{String(asset.asset_code || `AST-${asset.id}`)}</span>
                    <h4 style={{ margin: "2px 0 0 0", color: "#0f172a", fontSize: "1rem" }}>{String(asset.name)}</h4>
                  </div>
                  <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem", fontWeight: "bold", background: "#dcfce7", color: "#166534" }}>
                    OPERATIONAL
                  </span>
                </div>

                <p style={{ margin: "0 0 10px 0", color: "#64748b", fontSize: "0.85rem" }}>
                  Category: <strong>{String(asset.category || "Mechanical")}</strong>
                </p>

                <Link href={`/facility/assets/${asset.id}`} style={{ display: "block", textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", padding: "6px", borderRadius: 6, fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}>
                  Asset Details & History
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
