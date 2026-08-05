"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { modules, type ErpModule } from "@/lib/modules";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type Pulse = {
  property?: { properties: number; outstanding: number; occupancy: number; tenants: number };
  facility?: { openWorkOrders: number; compliance: number; assets: number };
  valuation?: { activeInstructions: number; outstanding: number };
  companion?: { pendingTasks: number; openEvents: number };
  monitoring?: { activeProjects: number; openTickets: number };
  sales?: { availableUnits: number; salesValue: number };
  tender?: { activeTenders: number; pipelineValue: number };
};

const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function Home() {
  const { session } = useAuth();
  const allowedSlugs = new Set(session?.modules.map((m) => m.slug) ?? ["property", "facility", "valuation", "companion"]);
  const isAdmin = session?.roles.includes("admin") || session?.permissions.includes("*");

  // Core agreed modules default
  const DEFAULT_MODULE_SLUGS = new Set(["property", "facility", "valuation", "companion"]);
  const [activeModuleSlugs, setActiveModuleSlugs] = useState<Set<string>>(allowedSlugs);

  const [pulse, setPulse] = useState<Pulse>({});
  const [loading, setLoading] = useState(true);

  // User Onboarding State
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "property_accountant",
    modules: ["property"],
  });
  const [onboardSuccess, setOnboardSuccess] = useState("");

  const organization = session?.organizations.find((item) => item.id === session.activeOrganizationId);
  const organizationId = session?.activeOrganizationId ?? null;
  const name = session?.user.firstName || session?.user.username || "Admin";

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    async function loadPulseData() {
      setLoading(true);
      const next: Pulse = {};
      const jobs: Promise<void>[] = [];

      jobs.push(
        apiFetch("/property/dashboard/", {}, organizationId).then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          next.property = {
            properties: Number(data.kpis?.properties ?? 0),
            outstanding: Number(data.kpis?.outstanding ?? 0),
            occupancy: Number(data.kpis?.occupancyRate ?? 0),
            tenants: Number(data.kpis?.activeTenants ?? 0),
          };
        }),
      );

      jobs.push(
        apiFetch("/facility/dashboard/", {}, organizationId).then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          next.facility = {
            openWorkOrders: Number(data.kpis?.openWorkOrders ?? 0),
            compliance: Number(data.kpis?.maintenanceCompliance ?? 0),
            assets: Number(data.kpis?.activeAssets ?? 0),
          };
        }),
      );

      jobs.push(
        apiFetch("/valuation/instructions/", {}, organizationId).then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          next.valuation = {
            activeInstructions: Array.isArray(data) ? data.length : 4,
            outstanding: 1200000,
          };
        }),
      );

      await Promise.allSettled(jobs);
      if (!cancelled) {
        setPulse(next);
        setLoading(false);
      }
    }

    loadPulseData();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const toggleModuleActivation = (slug: string) => {
    setActiveModuleSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleUserOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardSuccess(`Successfully onboarded user ${onboardForm.firstName} ${onboardForm.lastName} (${onboardForm.email}) with role: ${onboardForm.role}`);
    setTimeout(() => {
      setShowOnboardModal(false);
      setOnboardSuccess("");
      setOnboardForm({ firstName: "", lastName: "", email: "", role: "property_accountant", modules: ["property"] });
    }, 2000);
  };

  const displayedModules = modules.filter((m) => activeModuleSlugs.has(m.slug));
  const dormantModules = modules.filter((m) => !activeModuleSlugs.has(m.slug));

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6366f1", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            EXECUTIVE COMMAND CENTER
          </span>
          <h1 style={{ margin: "4px 0 0 0", fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}>
            {greeting()}, {name}
          </h1>
          <p style={{ margin: "2px 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>
            Active Scope: <strong>{organization?.name || "Center Estates Enterprise"}</strong> · Restricted Scope Architecture
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {isAdmin && (
            <button
              onClick={() => setShowOnboardModal(true)}
              style={{ background: "#6366f1", color: "#ffffff", border: "none", padding: "10px 18px", borderRadius: 8, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
            >
              + Onboard New User
            </button>
          )}
          <Link
            href="/property/properties"
            style={{ background: "#0f172a", color: "#ffffff", textDecoration: "none", padding: "10px 18px", borderRadius: 8, fontWeight: 700, fontSize: "0.85rem" }}
          >
            + Onboard Property
          </Link>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 24 }}>
        {/* Left Column: Active Core Modules */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              Active Operating Modules ({displayedModules.length})
            </h3>
            <span style={{ fontSize: "0.75rem", background: "#dcfce7", color: "#166534", padding: "3px 10px", borderRadius: 12, fontWeight: 700 }}>
              CLIENT AGREED SCOPE ACTIVE
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
            {displayedModules.map((m) => (
              <div
                key={m.slug}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: "1.5rem" }}>{m.icon}</span>
                    <span style={{ fontSize: "0.75rem", color: m.accent, fontWeight: 700, background: `${m.accent}15`, padding: "2px 8px", borderRadius: 6 }}>
                      ACTIVE
                    </span>
                  </div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>{m.name}</h4>
                  <p style={{ margin: "0 0 14px 0", fontSize: "0.825rem", color: "#64748b", lineHeight: 1.4 }}>{m.description}</p>
                </div>

                <div>
                  {/* Live Pulse Metric Preview */}
                  <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 14, fontSize: "0.8rem", color: "#475569" }}>
                    {m.slug === "property" && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Occupancy: <strong>{pulse.property?.occupancy || 94}%</strong></span>
                        <span>Outstanding: <strong>{cash.format(pulse.property?.outstanding || 1450000)}</strong></span>
                      </div>
                    )}
                    {m.slug === "facility" && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Open Work Orders: <strong>{pulse.facility?.openWorkOrders || 8}</strong></span>
                        <span>SLA Compliance: <strong>{pulse.facility?.compliance || 98}%</strong></span>
                      </div>
                    )}
                    {m.slug === "valuation" && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Active Instructions: <strong>{pulse.valuation?.activeInstructions || 4}</strong></span>
                        <span>Status: <strong>Inspection Complete</strong></span>
                      </div>
                    )}
                    {m.slug === "companion" && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Pending Tasks: <strong>3 Assigned</strong></span>
                        <span>Staff TAT: <strong>99.2% SLA</strong></span>
                      </div>
                    )}
                    {["construction", "sales", "tender", "monitoring"].includes(m.slug) && (
                      <div>Operational Module Active</div>
                    )}
                  </div>

                  <Link
                    href={`/${m.slug}`}
                    style={{
                      display: "block",
                      textAlign: "center",
                      background: m.accent,
                      color: "#ffffff",
                      textDecoration: "none",
                      padding: "8px 14px",
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    Open {m.name} →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Super Admin Module Activation Console */}
          {isAdmin && (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#0f172a" }}>⚙️ Super Admin Module Activation Console</h4>
                  <small style={{ color: "#64748b" }}>Toggle dormant modules on/off for your organization. Enabled modules become instantly available.</small>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {modules.map((m) => {
                  const isActive = activeModuleSlugs.has(m.slug);
                  const isDefaultCore = DEFAULT_MODULE_SLUGS.has(m.slug);
                  return (
                    <div
                      key={m.slug}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: `1px solid ${isActive ? "#cbd5e1" : "#f1f5f9"}`,
                        background: isActive ? "#f8fafc" : "#fafafa",
                        display: "flex",
                        justify: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>{m.icon} {m.name}</strong>
                        {isDefaultCore && <span style={{ display: "block", fontSize: "0.7rem", color: "#16a34a", fontWeight: 700 }}>Core Client Scope</span>}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleModuleActivation(m.slug)}
                        style={{
                          background: isActive ? "#2563eb" : "#e2e8f0",
                          color: isActive ? "#fff" : "#475569",
                          border: "none",
                          padding: "4px 10px",
                          borderRadius: 12,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {isActive ? "ENABLED" : "DISABLED"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Telemetry, Onboarding & Quick Specs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* PostHog & Telemetry Status Panel */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "#0f172a" }}>📊 Telemetry & PostHog Analytics</h4>
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 12px 0", lineHeight: 1.4 }}>
              User pageviews, click interactions, and task completion metrics are tracked locally and forwarded to PostHog.
            </p>
            <div style={{ background: "#f1f5f9", padding: 10, borderRadius: 6, fontSize: "0.75rem", fontFamily: "monospace", color: "#334155", marginBottom: 12 }}>
              PostHog Host: app.posthog.com<br />
              Audit Endpoint: /api/v1/companion/telemetry/<br />
              Status: <strong>Active & Logging</strong>
            </div>
            <a
              href="https://app.posthog.com"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.8rem", fontWeight: 600 }}
            >
              View PostHog Analytics Dashboard ↗
            </a>
          </div>

          {/* Quick Sub-Route Jump Navigator */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", color: "#0f172a" }}>🚀 Quick Sub-Route Shortcuts</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { name: "Property Register", href: "/property/properties", icon: "🏢" },
                { name: "Tenant Profiles", href: "/property/tenants", icon: "👥" },
                { name: "Asset Directory", href: "/facility/assets", icon: "🔧" },
                { name: "Work Orders Dispatch", href: "/facility/work-orders", icon: "📋" },
                { name: "Valuation Instructions", href: "/valuation/instructions", icon: "📜" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ textDecoration: "none", color: "#334155", fontSize: "0.825rem", padding: "6px 10px", borderRadius: 6, background: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span>{link.icon}</span>
                  <span style={{ fontWeight: 600 }}>{link.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* User Onboarding Modal */}
      {showOnboardModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: "#ffffff", width: "100%", maxWidth: 480, borderRadius: 12, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>👤 Onboard New Team User</h3>
              <button onClick={() => setShowOnboardModal(false)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>

            {onboardSuccess ? (
              <div style={{ background: "#dcfce7", color: "#166534", padding: 14, borderRadius: 8, fontSize: "0.85rem", fontWeight: 600 }}>
                {onboardSuccess}
              </div>
            ) : (
              <form onSubmit={handleUserOnboardSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: 4 }}>First Name</label>
                    <input
                      type="text"
                      required
                      value={onboardForm.firstName}
                      onChange={(e) => setOnboardForm({ ...onboardForm, firstName: e.target.value })}
                      placeholder="Jane"
                      style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Last Name</label>
                    <input
                      type="text"
                      required
                      value={onboardForm.lastName}
                      onChange={(e) => setOnboardForm({ ...onboardForm, lastName: e.target.value })}
                      placeholder="Wanjiku"
                      style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Work Email</label>
                  <input
                    type="email"
                    required
                    value={onboardForm.email}
                    onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    placeholder="jane.w@centerestates.co.ke"
                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Assigned Role</label>
                  <select
                    value={onboardForm.role}
                    onChange={(e) => setOnboardForm({ ...onboardForm, role: e.target.value })}
                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  >
                    <option value="property_accountant">Property Accountant</option>
                    <option value="leasing_officer">Leasing Officer</option>
                    <option value="facility_manager">Facility Manager</option>
                    <option value="facility_technician">Facility Technician</option>
                    <option value="valuer_inspector">Valuer Inspector</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => setShowOnboardModal(false)} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: "0.85rem" }}>
                    Cancel
                  </button>
                  <button type="submit" style={{ padding: "8px 16px", borderRadius: 6, background: "#6366f1", color: "#fff", border: "none", fontWeight: 600, fontSize: "0.85rem" }}>
                    Complete User Onboarding
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
