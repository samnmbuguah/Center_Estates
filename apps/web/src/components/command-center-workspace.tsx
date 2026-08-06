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

type InboxAlert = { module: string; severity: string; title: string; detail: string; href: string };
type InboxTask = { module: string; title: string; href: string; priority: number };

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
  const [alerts, setAlerts] = useState<InboxAlert[]>([]);
  const [tasks, setTasks] = useState<InboxTask[]>([]);
  const [pulseLoading, setPulseLoading] = useState(true);
  const moduleSlugs = session?.modules?.map((module) => module.slug).join(",") ?? "";

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    const slugSet = new Set(moduleSlugs.split(",").filter(Boolean));
    async function loadPulse() {
      setPulseLoading(true);
      const next: Pulse = {};
      const jobs: Promise<void>[] = [];
      if (slugSet.has("property")) {
        jobs.push(
          apiFetch("/property/dashboard/", {}, organizationId).then(async (response) => {
            if (!response.ok) return;
            const data = await response.json();
            next.property = {
              properties: Number(data.kpis?.properties ?? 0),
              outstanding: Number(data.kpis?.outstanding ?? 0),
              occupancy: Number(data.kpis?.occupancyRate ?? 0),
              tenants: Number(data.kpis?.activeTenants ?? 0),
            };
          }),
        );
      }
      if (slugSet.has("facility")) {
        jobs.push(
          apiFetch("/facility/dashboard/", {}, organizationId).then(async (response) => {
            if (!response.ok) return;
            const data = await response.json();
            next.facility = {
              openWorkOrders: Number(data.kpis?.openWorkOrders ?? 0),
              compliance: Number(data.kpis?.maintenanceCompliance ?? 0),
              assets: Number(data.kpis?.activeAssets ?? 0),
            };
          }),
        );
      }
      if (slugSet.has("sales")) {
        jobs.push(
          apiFetch("/sales/dashboard/", {}, organizationId).then(async (response) => {
            if (!response.ok) return;
            const data = await response.json();
            next.sales = {
              availableUnits: Number(data.kpis?.availableUnits ?? 0),
              salesValue: Number(data.kpis?.salesValue ?? 0),
              pendingPayments: Number(data.kpis?.pendingPayments ?? 0),
            };
          }),
        );
      }
      if (slugSet.has("monitoring")) {
        jobs.push(
          apiFetch("/construction/dashboard/", {}, organizationId).then(async (response) => {
            if (!response.ok) return;
            const data = await response.json();
            next.monitoring = {
              activeProjects: Number(data.kpis?.activeProjects ?? 0),
              openTickets: Number(data.kpis?.openTickets ?? 0),
              highRisks: Number(data.kpis?.highRisks ?? 0),
              budgetUtilization: Number(data.kpis?.budgetUtilization ?? 0),
            };
          }),
        );
      }
      if (slugSet.has("tender")) {
        jobs.push(
          apiFetch("/tender/dashboard/", {}, organizationId).then(async (response) => {
            if (!response.ok) return;
            const data = await response.json();
            next.tender = {
              activeTenders: Number(data.kpis?.activeTenders ?? 0),
              pipelineValue: Number(data.kpis?.pipelineValue ?? 0),
            };
          }),
        );
      }
      if (slugSet.has("valuation")) {
        jobs.push(
          apiFetch("/valuation/dashboard/", {}, organizationId).then(async (response) => {
            if (!response.ok) return;
            const data = await response.json();
            next.valuation = {
              activeInstructions: Number(data.kpis?.activeInstructions ?? 0),
              outstanding: Number(data.kpis?.outstanding ?? 0),
            };
          }),
        );
      }
      if (slugSet.has("companion")) {
        jobs.push(
          apiFetch("/companion/dashboard/", {}, organizationId).then(async (response) => {
            if (!response.ok) return;
            const data = await response.json();
            next.companion = {
              dueToday: Number(data.kpis?.dueToday ?? 0),
              overdue: Number(data.kpis?.overdue ?? 0),
              escalated: Number(data.kpis?.escalated ?? 0),
            };
          }),
        );
      }
      jobs.push(
        apiFetch("/workspace/inbox/", {}, organizationId).then(async (response) => {
          if (!response.ok) return;
          const data = await response.json();
          if (!cancelled) {
            setAlerts(data.alerts ?? []);
            setTasks(data.tasks ?? []);
          }
        }),
      );
      await Promise.all(jobs);
      if (!cancelled) {
        setPulse(next);
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

  const quickLinks = [
    { href: "/property", label: "Add New Property", icon: "🏢", show: allowed.has("property") },
    { href: "/facility", label: "New Maintenance Request", icon: "🔧", show: allowed.has("facility") },
    { href: "/valuation", label: "New Valuation Instruction", icon: "📐", show: allowed.has("valuation") },
  ].filter((item) => item.show);

  const severityClass = (severity: string) => {
    if (severity === "high") return "danger";
    if (severity === "medium") return "warning";
    return "info";
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

          <section className="at-a-glance" aria-labelledby="glance-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Portfolio pulse</p>
                <h2 id="glance-heading">At a glance</h2>
              </div>
            </div>
            <div className="glance-grid">
              <article>
                <span className="glance-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>🏢</span>
                <div>
                  <small>Properties</small>
                  <strong>{pulse.property ? pulse.property.properties : allowed.has("property") ? "…" : "Locked"}</strong>
                </div>
              </article>
              <article>
                <span className="glance-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>👥</span>
                <div>
                  <small>Tenants</small>
                  <strong>{pulse.property ? pulse.property.tenants : allowed.has("property") ? "…" : "Locked"}</strong>
                </div>
              </article>
              <article>
                <span className="glance-icon" style={{ background: "#ffedd5", color: "#ea580c" }}>💰</span>
                <div>
                  <small>Outstanding rent</small>
                  <strong>{pulse.property ? money.format(pulse.property.outstanding) : allowed.has("property") ? "…" : "Locked"}</strong>
                </div>
              </article>
              <article>
                <span className="glance-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>🔧</span>
                <div>
                  <small>Open maintenance</small>
                  <strong>{pulse.facility ? pulse.facility.openWorkOrders : allowed.has("facility") ? "…" : "Locked"}</strong>
                </div>
              </article>
              <article>
                <span className="glance-icon" style={{ background: "#ede9fe", color: "#7c3aed" }}>✅</span>
                <div>
                  <small>PPM compliance</small>
                  <strong>{pulse.facility ? `${pulse.facility.compliance}%` : allowed.has("facility") ? "…" : "Locked"}</strong>
                </div>
              </article>
            </div>
          </section>
        </div>

        <aside className="command-rail">
          <article className="rail-card">
            <header>
              <h3>Critical Alerts</h3>
              <span className="badge-count">{alerts.length}</span>
            </header>
            <ul className="rail-list">
              {alerts.length ? (
                alerts.map((item) => (
                  <li key={`${item.href}-${item.title}`}>
                    <span className={`rail-dot ${severityClass(item.severity)}`} />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </div>
                    <Link href={item.href}>→</Link>
                  </li>
                ))
              ) : (
                <li>
                  <span className="rail-dot info" />
                  <div>
                    <strong>{pulseLoading ? "Loading live alerts…" : "No critical alerts right now"}</strong>
                    <small>Organization-scoped inbox API</small>
                  </div>
                </li>
              )}
            </ul>
          </article>

          <article className="rail-card">
            <header>
              <h3>My Tasks</h3>
              <span className="badge-count">{tasks.length || quickLinks.length}</span>
            </header>
            <ul className="rail-list task-list">
              {(tasks.length ? tasks : quickLinks.map((item) => ({ title: item.label, href: item.href, module: item.href, priority: 5 }))).slice(0, 5).map((item) => (
                <li key={`${item.href}-${item.title}`}>
                  <span aria-hidden="true">☐</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.module}</small>
                  </div>
                  <Link href={item.href}>→</Link>
                </li>
              ))}
            </ul>
          </article>

          <article className="rail-card">
            <header>
              <h3>Quick Links</h3>
            </header>
            <div className="quick-link-stack">
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                  <b>→</b>
                </Link>
              ))}
            </div>
          </article>

          <section className="command-help compact">
            <div>
              <span>?</span>
              <p>
                <strong>Need help finding a workflow?</strong>
                <small>Access is filtered by subscription and role.</small>
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
