"use client";

import { KpiCard, KpiStrip, Panel } from "@/components/module-ui";

export function FacilityOverviewView({
  kpis = {},
  onNavigate,
  onNewWorkOrder,
}: {
  kpis?: {
    openWorkOrders?: number;
    ppmCompliance?: number;
    totalAssets?: number;
    openInspections?: number;
  };
  onNavigate: (tab: string) => void;
  onNewWorkOrder: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <KpiStrip>
        <KpiCard
          icon="🔧"
          iconBg="var(--color-blue-bg)"
          iconColor="var(--color-info)"
          label="Open Work Orders"
          value={String(kpis.openWorkOrders ?? 0)}
          sub="Active maintenance jobs"
          link="View work orders"
          onClick={() => onNavigate("work-orders")}
        />
        <KpiCard
          icon="📅"
          iconBg="var(--color-green-bg)"
          iconColor="var(--color-success)"
          label="PPM Compliance"
          value={`${kpis.ppmCompliance ?? 0}%`}
          sub="Planned maintenance target"
          link="View planned maintenance"
          onClick={() => onNavigate("planned-maintenance")}
        />
        <KpiCard
          icon="📦"
          iconBg="var(--color-amber-bg)"
          iconColor="var(--color-warning)"
          label="Registered Assets"
          value={String(kpis.totalAssets ?? 0)}
          sub="Equipment & inventory"
          link="View assets"
          onClick={() => onNavigate("assets")}
        />
        <KpiCard
          icon="🔍"
          iconBg="#f3e8ff"
          iconColor="var(--color-violet)"
          label="Pending Inspections"
          value={String(kpis.openInspections ?? 0)}
          sub="Audits due"
          link="View inspections"
          onClick={() => onNavigate("inspections")}
        />
      </KpiStrip>

      <Panel title="Facility Quick Actions">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
          <button
            className="btn primary"
            onClick={onNewWorkOrder}
            style={{ padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 800 }}
          >
            <span style={{ fontSize: 20 }}>🔧</span>
            <span>+ New Work Order</span>
          </button>
          <button
            className="btn outlined"
            onClick={() => onNavigate("assets")}
            style={{ padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 700 }}
          >
            <span style={{ fontSize: 20 }}>📦</span>
            <span>Assets & Inventory</span>
          </button>
          <button
            className="btn outlined"
            onClick={() => onNavigate("meters")}
            style={{ padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 700 }}
          >
            <span style={{ fontSize: 20 }}>⚡</span>
            <span>Energy & Utilities</span>
          </button>
          <button
            className="btn outlined"
            onClick={() => onNavigate("contractors")}
            style={{ padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 700 }}
          >
            <span style={{ fontSize: 20 }}>🤝</span>
            <span>Vendors & Contracts</span>
          </button>
        </div>
      </Panel>
    </div>
  );
}
