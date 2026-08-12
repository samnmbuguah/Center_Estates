"use client";

import { KpiCard, KpiStrip, Panel } from "@/components/module-ui";
import type { PropertyDashboardData } from "../types";

export function PropertyOverviewView({
  dashboard,
  loading = false,
  onNavigate,
}: {
  dashboard?: PropertyDashboardData | null;
  loading?: boolean;
  onNavigate: (tab: string) => void;
}) {
  const kpis = dashboard?.kpis ?? {};
  const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <KpiStrip>
        <KpiCard
          icon="🏢"
          iconBg="#dbeafe"
          iconColor="#2563eb"
          label="Total Properties"
          value={String(kpis.total_properties ?? 0)}
          sub={`${kpis.total_units ?? 0} total units`}
          link="View properties"
          onClick={() => onNavigate("properties")}
        />
        <KpiCard
          icon="👥"
          iconBg="#dcfce7"
          iconColor="#16a34a"
          label="Occupancy Rate"
          value={`${kpis.occupancy_rate ?? 0}%`}
          sub={`${kpis.occupied_units ?? 0} occupied / ${kpis.vacant_units ?? 0} vacant`}
          link="View tenancy"
          onClick={() => onNavigate("tenancy")}
        />
        <KpiCard
          icon="💰"
          iconBg="#fef3c7"
          iconColor="#d97706"
          label="Monthly Rent Roll"
          value={money.format(kpis.monthly_rent ?? 0)}
          sub="Contracted monthly rent"
          link="View billing"
          onClick={() => onNavigate("billing")}
        />
        <KpiCard
          icon="⚠️"
          iconBg="#fee2e2"
          iconColor="#dc2626"
          label="Outstanding Arrears"
          value={money.format(kpis.outstanding_rent ?? 0)}
          sub={`Collection rate: ${kpis.collection_rate ?? 0}%`}
          link="View arrears"
          onClick={() => onNavigate("arrears")}
        />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <Panel title="Quick Workflow Actions">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            <button
              className="btn outlined"
              onClick={() => onNavigate("tenants")}
              style={{ padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              <span style={{ fontSize: 20 }}>👤</span>
              <span>Tenants</span>
            </button>
            <button
              className="btn outlined"
              onClick={() => onNavigate("billing")}
              style={{ padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              <span style={{ fontSize: 20 }}>🧾</span>
              <span>Billing</span>
            </button>
            <button
              className="btn outlined"
              onClick={() => onNavigate("service-charges")}
              style={{ padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              <span style={{ fontSize: 20 }}>⚡</span>
              <span>Service Charge</span>
            </button>
            <button
              className="btn outlined"
              onClick={() => onNavigate("reports")}
              style={{ padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              <span style={{ fontSize: 20 }}>📊</span>
              <span>Reports</span>
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
