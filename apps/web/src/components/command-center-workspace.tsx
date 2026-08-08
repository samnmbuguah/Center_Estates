"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { modules, ACTIVE_MODULES } from "@/lib/modules";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type Pulse = {
  property?: { properties: number; outstanding: number; occupancy: number; tenants: number };
  facility?: { openWorkOrders: number; compliance: number; assets: number };
  sales?: { availableUnits: number; salesValue: number; pendingPayments: number };
  monitoring?: { activeProjects: number; openTickets: number; highRisks: number; budgetUtilization: number };
  tender?: { activeTenders: number; pipelineValue: number };
  valuation?: { activeInstructions: number; outstanding: number };
  companion?: { dueToday: number; overdue: number; escalated: number };
};

const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export function CommandCenterWorkspace() {
  const { session } = useAuth();
  const allowed = new Set(
    (session?.modules?.map((module) => module.slug) ?? modules.map((m) => m.slug)).filter((slug) => ACTIVE_MODULES.includes(slug)),
  );
  const subscribedModules = modules.filter((module) => allowed.has(module.slug));
  const name = session?.user?.firstName || session?.user?.username || "there";
  const organization = session?.organizations?.find((item) => item.id === session?.activeOrganizationId);
  const organizationId = session?.activeOrganizationId ?? null;
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const roleLabel = session?.permissions?.includes("*")
    ? "Platform administrator"
    : session?.roles?.join(", ") || "Organization member";
  const [pulse, setPulse] = useState<Pulse>({});
  const [pulseLoading, setPulseLoading] = useState(true);
  const moduleSlugs = session?.modules?.map((module) => module.slug).join(",") ?? "";

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    async function loadPulse() {
      setPulseLoading(true);
      const response = await apiFetch(
        "/workspace/pulse/",
        { headers: { "X-Property-Scope": "portfolio" } },
        organizationId,
      );
      const data = response.ok ? await response.json() : { pulse: {} };
      if (!cancelled) {
        setPulse(data.pulse ?? {});
        setPulseLoading(false);
      }
    }
    void loadPulse();
    return () => {
      cancelled = true;
    };
  }, [organizationId, moduleSlugs]);

  const moduleStats = (slug: string) => {
    if (slug === "property" && pulse.property) {
      return [
        { label: "Properties", value: String(pulse.property.properties) },
        { label: "Occupancy", value: `${pulse.property.occupancy}%` },
      ];
    }
    if (slug === "facility" && pulse.facility) {
      return [
        { label: "Open WOs", value: String(pulse.facility.openWorkOrders) },
        { label: "PPM", value: `${pulse.facility.compliance}%` },
      ];
    }
    if (slug === "sales" && pulse.sales) {
      return [
        { label: "Units", value: String(pulse.sales.availableUnits) },
        { label: "Pending pay", value: String(pulse.sales.pendingPayments) },
      ];
    }
    if (slug === "monitoring" && pulse.monitoring) {
      return [
        { label: "Projects", value: String(pulse.monitoring.activeProjects) },
        { label: "Issues", value: String(pulse.monitoring.openTickets) },
      ];
    }
    if (slug === "tender" && pulse.tender) {
      return [
        { label: "Active", value: String(pulse.tender.activeTenders) },
        { label: "Pipeline", value: money.format(pulse.tender.pipelineValue) },
      ];
    }
    if (slug === "valuation" && pulse.valuation) {
      return [
        { label: "Jobs", value: String(pulse.valuation.activeInstructions) },
        { label: "Fees due", value: money.format(pulse.valuation.outstanding) },
      ];
    }
    if (slug === "companion" && pulse.companion) {
      return [
        { label: "Due today", value: String(pulse.companion.dueToday) },
        { label: "Overdue", value: String(pulse.companion.overdue) },
      ];
    }
    return null;
  };

  return (
    <div className="page-wrap command-center">
      <section className="command-welcome">
        <div>
          <p className="eyebrow">CeEst Workplace</p>
          <h1>
            {greeting()}, {name} 👋
          </h1>
          <p>Here&apos;s what&apos;s happening across your operations today.</p>
          <div className="command-context">
            <span>
              <i />
              Live workspace
            </span>
            <strong>{organization?.name ?? "Active organization"}</strong>
            <small>{roleLabel}</small>
          </div>
        </div>
        <aside className="command-date-card">
          <p>Today</p>
          <strong>{today}</strong>
          <span>
            {subscribedModules.length} subscribed module{subscribedModules.length === 1 ? "" : "s"}
            {pulseLoading ? " · refreshing…" : " · live KPIs"}
          </span>
          <div className="module-dot-row">
            {subscribedModules.slice(0, 6).map((module) => (
              <i key={module.slug} title={module.name} style={{ background: module.accent }} />
            ))}
          </div>
          {allowed.has("property") ? (
            <Link className="command-onboard-action" href="/property?tab=properties&action=add-property">
              + Onboard property
            </Link>
          ) : null}
        </aside>
      </section>

      <div className="command-layout">
        <div className="command-main">
          <section aria-labelledby="modules-heading">
            <div className="section-heading command-section-heading">
              <div>
                <p className="eyebrow">Access your modules</p>
                <h2 id="modules-heading">ERP modules</h2>
                <span>Open a module to continue where your team left off.</span>
              </div>
              <span className="status-pill">{subscribedModules.length} active</span>
            </div>

            <div className="module-grid">
              {subscribedModules.map((module) => {
                const live = moduleStats(module.slug);
                const stats = live ?? module.stats.map((stat) => ({ label: stat.label, value: stat.value }));
                return (
                  <Link className="module-card design-module-card" href={`/${module.slug}`} key={module.slug}>
                    <header>
                      <span className="module-icon" style={{ background: `${module.accent}18`, color: module.accent }}>
                        {module.icon}
                      </span>
                      <span className="module-live">
                        <i style={{ background: module.accent }} />
                        {live ? "Live" : "Available"}
                      </span>
                    </header>
                    <h3>{module.name}</h3>
                    <p>{module.description}</p>
                    <div className="module-stat-row">
                      {stats.map((stat) => (
                        <span key={stat.label}>
                          <small>{stat.label}</small>
                          <b>{stat.value}</b>
                        </span>
                      ))}
                    </div>
                    <div className="module-features">
                      {module.features.slice(0, 3).map((feature) => (
                        <span key={feature}>{feature}</span>
                      ))}
                    </div>
                    <span className="open-link">
                      Open workspace <span aria-hidden>→</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

        </div>

        <aside className="command-rail">
          <article className="rail-card command-pulse-card" aria-labelledby="glance-heading">
            <header>
              <div>
                <p className="eyebrow">Portfolio pulse</p>
                <h3 id="glance-heading">At a glance</h3>
              </div>
              <span className="module-live"><i /> Live</span>
            </header>
            <div className="glance-grid">
              {[
                ["🏢", "Properties", pulse.property?.properties, allowed.has("property")],
                ["👥", "Tenants", pulse.property?.tenants, allowed.has("property")],
                ["💰", "Outstanding rent", pulse.property ? money.format(pulse.property.outstanding) : undefined, allowed.has("property")],
                ["🔧", "Open maintenance", pulse.facility?.openWorkOrders, allowed.has("facility")],
                ["✅", "PPM compliance", pulse.facility ? `${pulse.facility.compliance}%` : undefined, allowed.has("facility")],
              ].map(([icon, label, value, enabled]) => (
                <article key={String(label)}>
                  <span className="glance-icon">{String(icon)}</span>
                  <div><small>{String(label)}</small><strong>{value ?? (enabled ? "…" : "Locked")}</strong></div>
                </article>
              ))}
            </div>
          </article>

          <section className="command-help compact">
            <div>
              <span>?</span>
              <p>
                <strong>Tasks, alerts and approvals live in Companion.</strong>
                <small>Open it for your daily priorities without duplicating them here.</small>
              </p>
            </div>
            {allowed.has("companion") ? <Link href="/companion">Open Companion →</Link> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
