"use client";

import { useState } from "react";
import { Panel, Badge, EmptyState, KpiStrip, KpiCard } from "@/components/module-ui";
import { ViewToolbar, ListState, SubTabs } from "../PropertyToolbar";
import { PropertyTab, Row } from "../../types/property.types";

type ServiceProfile = {
  id: string; code: string; name: string; category: string; service_type: string;
  criticality: string; status: string; default_frequency: string;
  allocations?: Array<{ id: string; property_name: string; provider_name: string }>;
};

export function ServiceProfilesView({ rows, loading, search, setSearch, setTab }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void;
}) {
  const profiles = rows as ServiceProfile[];
  const active = profiles.filter(p => p.status === "active").length;
  const critical = profiles.filter(p => p.criticality === "critical").length;

  return (
    <>
      <KpiStrip>
        <KpiCard icon="📋" iconBg="rgba(79,70,229,0.12)" iconColor="#4f46e5" label="Total Profiles" value={String(profiles.length)} sub="Service definitions" />
        <KpiCard icon="✓" iconBg="rgba(22,163,74,0.12)" iconColor="#16a34a" label="Active" value={String(active)} sub="Currently in use" />
        <KpiCard icon="⚠️" iconBg="rgba(220,38,38,0.12)" iconColor="#dc2626" label="Critical" value={String(critical)} sub="High-priority services" />
      </KpiStrip>

      <ViewToolbar title="Service Profiles" subtitle="Define what services are required for each property" search={search} onSearch={setSearch} placeholder="Search service profile name or category…">
        <button className="btn ghost sm" onClick={() => setTab("properties")}>Properties →</button>
      </ViewToolbar>

      <Panel title="Service Profiles">
        <ListState loading={loading} empty={profiles.length === 0} emptyTitle="No service profiles" emptyDesc="Create service profiles to define what services each property requires.">
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Criticality</th>
                  <th>Frequency</th>
                  <th>Allocations</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{p.code}</td>
                    <td><strong style={{ fontSize: 13 }}>{p.name}</strong></td>
                    <td style={{ fontSize: 12 }}>{p.category || "—"}</td>
                    <td style={{ fontSize: 12 }}>{p.service_type?.replace(/_/g, " ") || "—"}</td>
                    <td><Badge tone={p.criticality === "critical" ? "red" : p.criticality === "high" ? "yellow" : "blue"}>{p.criticality || "—"}</Badge></td>
                    <td style={{ fontSize: 12 }}>{p.default_frequency?.replace(/_/g, " ") || "—"}</td>
                    <td><Badge tone={p.allocations?.length ? "green" : "gray"}>{p.allocations?.length || 0}</Badge></td>
                    <td><Badge tone={p.status === "active" ? "green" : "gray"}>{p.status || "—"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
    </>
  );
}
