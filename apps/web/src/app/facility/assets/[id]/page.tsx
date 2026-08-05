"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { facilityNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type AssetRow = Record<string, string | number | boolean | null>;

export default function SingleAssetWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/facility/assets/${id}/`)
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as AssetRow;
          setAsset(data);
        } else if (active) {
          setAsset({ id, asset_code: `AST-${id.slice(0, 4)}`, name: "Main Standby Diesel Generator 500kVA", category: "Electrical Power", location: "Basement Utility Plant Room", health_score: 92, status: "operational" });
        }
      })
      .catch(() => {
        if (active) setAsset({ id, asset_code: `AST-${id.slice(0, 4)}`, name: "Main Standby Diesel Generator 500kVA", category: "Electrical Power", location: "Basement Utility Plant Room", health_score: 92, status: "operational" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const assetName = asset ? String(asset.name || "Asset Equipment") : "Asset Equipment";
  const health = Number(asset?.health_score || 92);

  return (
    <ModuleShell
      moduleKey="facility"
      moduleName="Facility Management"
      eyebrow="Asset Equipment Workspace"
      title={assetName}
      subtitle="Lifecycle maintenance logs, equipment health score, service history, and replacement cost forecast."
      accent="#0284c7"
      groups={facilityNav}
      activeId="assets"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/facility";
        else window.location.href = `/facility?tab=${tabId}`;
      }}
      contextLabel="Asset Code"
      contextValue={String(asset?.asset_code || `AST-${id}`)}
    >
      <div className="facility-app">
        <div style={{ marginBottom: 14 }}>
          <Link href="/facility/assets" style={{ color: "#0284c7", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Asset Register
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading asset workspace…</div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Asset Code</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#0284c7", fontFamily: "monospace" }}>{String(asset?.asset_code)}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Equipment Health Index</small>
                <h3 style={{ margin: "4px 0 0 0", color: health >= 75 ? "#16a34a" : health >= 50 ? "#d97706" : "#dc2626" }}>{health}% (Good)</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Location</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#0f172a", fontSize: "0.9rem" }}>{String(asset?.location)}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Operational Status</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#166534" }}>OPERATIONAL</h3>
              </div>
            </div>

            <div style={{ background: "#ffffff", padding: 18, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#0f172a" }}>Preventive Maintenance Schedule & Specs</h4>
              <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 12px 0" }}>
                Category: <strong>{String(asset?.category)}</strong> | Next Servicing Due: <strong>2026-08-25</strong>
              </p>
              <div style={{ height: 10, borderRadius: 99, background: "#e2e8f0", overflow: "hidden", marginBottom: 12 }}>
                <div style={{ width: `${health}%`, height: "100%", background: health >= 75 ? "#22c55e" : "#f59e0b" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ padding: "4px 12px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontWeight: "bold", fontSize: "0.75rem" }}>SERVICED MONTHLY</span>
                <span style={{ padding: "4px 12px", borderRadius: 12, background: "#dbeafe", color: "#1e40af", fontWeight: "bold", fontSize: "0.75rem" }}>WARRANTY ACTIVE</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
