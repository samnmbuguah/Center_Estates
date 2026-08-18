"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { modules, ACTIVE_MODULES } from "@/lib/modules";
import { useSearchParams } from "next/navigation";
import { ModuleCalendarView, ModuleTicketsView } from "@/components/module-activity";
import { Box, Grid, Typography } from "@mui/material";
import { TrendingUp, AlertCircle, CheckCircle, Clock, Activity, Users, Building2 } from "lucide-react";

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

const quickActions: Record<string, Array<{ label: string; href: string; permission?: string }>> = {
  property: [
    { label: "Portfolio", href: "/overview" },
    { label: "Onboard property", href: "/property-onboarding", permission: "property.operations" },
    { label: "Add tenant", href: "/property?tab=tenancy&action=add-tenant", permission: "property.leasing" },
  ],
  facility: [
    { label: "Work orders", href: "/facility?tab=work-orders" },
    { label: "Assets", href: "/facility?tab=assets" },
    { label: "Inspections", href: "/facility?tab=inspections" },
  ],
  valuation: [
    { label: "Instructions", href: "/valuation?tab=instructions" },
    { label: "Inspections", href: "/valuation?tab=inspections" },
    { label: "Final reports", href: "/valuation?tab=final-reports" },
  ],
  companion: [
    { label: "My tasks", href: "/companion?tab=my-tasks" },
    { label: "All tasks", href: "/companion?tab=tasks" },
    { label: "Performance", href: "/companion?tab=performance" },
  ],
};

export function CommandCenterWorkspace() {
  const { session } = useAuth();
  // Ensure companion module is always included as it's a universal module
  const allowed = new Set(
    (session?.modules?.map((module) => module.slug) ?? modules.map((m) => m.slug)).filter((slug) => ACTIVE_MODULES.includes(slug)),
  );
  
  // Always add companion as a universal module
  allowed.add("companion");
  
  const subscribedModules = modules.filter((module) => allowed.has(module.slug));
  const organizationId = session?.activeOrganizationId ?? null;
  const [pulse, setPulse] = useState<Pulse>({});
  const searchParams = useSearchParams();
  const portfolioView = searchParams.get("view");
  const moduleSlugs = session?.modules?.map((module) => module.slug).join(",") ?? "";

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    async function loadPulse() {
      const response = await apiFetch(
        "/workspace/pulse/",
        { headers: { "X-Property-Scope": "portfolio" } },
        organizationId,
      );
      const data = response.ok ? await response.json() : { pulse: {} };
      if (!cancelled) {
        setPulse(data.pulse ?? {});
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
        { label: "Outstanding", value: money.format(pulse.property.outstanding) },
      ];
    }
    if (slug === "facility" && pulse.facility) {
      return [
        { label: "Open WOs", value: String(pulse.facility.openWorkOrders) },
        { label: "PPM", value: `${pulse.facility.compliance}%` },
        { label: "Assets", value: String(pulse.facility.assets) },
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
        { label: "Escalated", value: String(pulse.companion.escalated) },
      ];
    }
    return null;
  };

  return (
    <div className="page-wrap command-center">

      <div className="command-layout">
        <div className="command-main">
          {portfolioView === "tickets" ? <ModuleTicketsView moduleName="Portfolio" portfolio /> : null}
          {portfolioView === "calendar" ? <ModuleCalendarView moduleName="Portfolio" portfolio /> : null}
          {portfolioView ? <div style={{ height: 24 }} /> : null}
          
          <section aria-labelledby="modules-heading" style={{ textAlign: "center" }}>
            <div className="module-grid command-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24, justifyContent: "center" }}>
              {subscribedModules.map((module) => {
                const live = moduleStats(module.slug);
                const stats = (live ?? module.stats.map((stat) => ({ label: stat.label, value: stat.value }))).slice(0, 3);
                return (
                  <Link
                    key={module.slug}
                    href={`/${module.slug}`}
                    className="module-card design-module-card portrait-module-card"
                    style={{
                      "--module-accent": module.accent,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      padding: "32px 24px 24px",
                      borderRadius: 18,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      textDecoration: "none",
                      color: "inherit",
                      position: "relative",
                      transition: "all 0.2s ease-in-out",
                      minHeight: 220,
                    } as CSSProperties}
                  >
                    <div
                      className="module-icon-circle"
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: "50%",
                        background: `${module.accent}18`,
                        color: module.accent,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 40,
                        marginBottom: 20,
                      }}
                    >
                      {module.icon}
                    </div>

                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px", lineHeight: 1.25 }}>
                      {module.name}
                    </h3>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 24px", minHeight: 40, lineHeight: 1.5, maxWidth: 260 }}>
                      {module.description}
                    </p>

                    {stats.length > 0 && (
                      <div
                        className="module-card-kpis"
                        style={{
                          width: "100%",
                          display: "grid",
                          gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
                          gap: 10,
                          paddingTop: 16,
                          borderTop: "1px solid var(--border-subtle)",
                          marginTop: "auto",
                          textAlign: "center",
                        }}
                      >
                        {stats.map((stat) => (
                          <div key={stat.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ fontSize: 17, fontWeight: 900, color: "var(--text-primary)" }}>{stat.value}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginTop: 2 }}>{stat.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <span
                      className="card-arrow-indicator"
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        bottom: 16,
                        right: 18,
                        fontSize: 18,
                        fontWeight: 800,
                        color: "var(--text-primary)",
                        opacity: 0.5,
                        transition: "opacity 0.15s ease, transform 0.15s ease",
                      }}
                    >
                      ›
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
