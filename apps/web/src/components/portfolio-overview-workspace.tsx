"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { modules, ACTIVE_MODULES } from "@/lib/modules";
import { useAuth } from "@/components/auth-provider";

type Pulse = { property?: { properties: number; tenants: number; outstanding: number }; facility?: { openWorkOrders: number; compliance: number } };

export function PortfolioOverviewWorkspace() {
  const [pulse, setPulse] = useState<Pulse>({});
  const { session } = useAuth();
  const sessionOrganization = session?.activeOrganizationId ?? null;
  useEffect(() => {
    void apiFetch("/workspace/pulse/", { headers: { "X-Property-Scope": "portfolio" } }, sessionOrganization).then(async (response) => {
      if (response.ok) setPulse((await response.json()).pulse ?? {});
    });
  }, [sessionOrganization]);
  const enabled = new Set(modules.filter((module) => ACTIVE_MODULES.includes(module.slug)).map((module) => module.slug));
  const cards = [
    ["🏢", "Properties", pulse.property?.properties, enabled.has("property")],
    ["👥", "Tenants", pulse.property?.tenants, enabled.has("property")],
    ["💰", "Outstanding rent", pulse.property ? `KES ${pulse.property.outstanding.toLocaleString()}` : undefined, enabled.has("property")],
    ["🔧", "Open maintenance", pulse.facility?.openWorkOrders, enabled.has("facility")],
    ["✅", "PPM compliance", pulse.facility ? `${pulse.facility.compliance}%` : undefined, enabled.has("facility")],
  ];
  return <main className="page-wrap command-center"><div className="section-heading"><div><p className="eyebrow">Portfolio</p><h1>Overview</h1><span>Live overview of the properties and operations you can access.</span></div></div><div className="glance-grid" style={{ marginTop: 22 }}>{cards.map(([icon, label, value, access]) => <article className="rail-card" key={String(label)}><span className="glance-icon">{String(icon)}</span><div><small>{String(label)}</small><strong>{value ?? (access ? "Loading…" : "Locked")}</strong></div></article>)}</div></main>;
}
