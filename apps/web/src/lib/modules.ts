/**
 * ERP module catalogue.
 *
 * SCOPE RESTRICTION: Only the four approved core domains are ACTIVE.
 * Disabled modules (sales, tender, construction/monitoring) are kept in the
 * catalogue and their routes/code remain intact, but are hidden from all users
 * unless a feature flag or granular role permission explicitly enables them.
 */
export const modules = [
  { slug: "property", name: "Property Management", description: "Manage properties, leases, tenants, billing and collections.", accent: "var(--color-brand-red)", icon: "🏢", features: ["Properties", "Tenants", "Leases", "Rent collection", "Service charges", "Reports"], stats: [{ label: "Focus", value: "Leases & rent" }, { label: "Ledger", value: "Live billing" }] },
  { slug: "facility", name: "Facility Management", description: "Assets, maintenance, compliance, utilities and sustainability.", accent: "var(--color-success)", icon: "🔧", features: ["Buildings", "Assets", "Work orders", "Planned maintenance", "Inspections", "Utilities"], stats: [{ label: "Focus", value: "Work orders" }, { label: "Control", value: "PPM & SLA" }] },
  { slug: "sales", name: "Sales Management", description: "Inventory, buyers, payments, site visits and agent commissions.", accent: "var(--color-orange)", icon: "🏷️", features: ["Projects & units", "Buyers", "Payments", "Site visits", "Agents", "Commissions"], stats: [{ label: "Focus", value: "Units & buyers" }, { label: "Control", value: "Collections" }] },
  { slug: "tender", name: "Tender Management", description: "Manage tenders, evaluations and contract awards.", accent: "var(--color-violet)", icon: "📋", features: ["Invitations", "AI analysis", "Bid decision", "Planning", "Proposals", "Submission"], stats: [{ label: "Focus", value: "Pipeline" }, { label: "Control", value: "Approvals" }] },
  { slug: "valuation", name: "Valuation", description: "Track valuation instructions, inspections and reports.", accent: "var(--color-cyan)", icon: "📐", features: ["Instructions", "Site inspections", "Draft reports", "Final reports", "Invoicing", "Analytics"], stats: [{ label: "Focus", value: "Instructions" }, { label: "Output", value: "Reports" }] },
  { slug: "monitoring", name: "Construction Monitoring", description: "Construction evidence, progress, risks, quality, finance and reporting.", accent: "var(--color-danger)", icon: "🏗️", features: ["Projects", "Programme", "Site evidence", "Risks", "Finance", "Reports"], stats: [{ label: "Focus", value: "Site evidence" }, { label: "Control", value: "Cost & risk" }] },
  { slug: "companion", name: "Companion & Staff Performance", description: "Personal task command center, task assignment and staff productivity analytics.", accent: "var(--color-teal)", icon: "🧭", features: ["My Companion", "Task assignment", "Delegation", "Performance dashboard", "SLA escalation", "Adoption analytics"], stats: [{ label: "Focus", value: "Daily work" }, { label: "Control", value: "SLA & TAT" }] },
] as const;

/** Modules currently enabled for the whole system (scope restriction). */
export const ACTIVE_MODULES: readonly string[] = ["property", "facility", "valuation", "companion"];

/** Modules kept in the catalogue but hidden unless explicitly enabled by flag/role. */
export const DISABLED_MODULES: readonly string[] = modules
  .map((m) => m.slug)
  .filter((slug) => !ACTIVE_MODULES.includes(slug));

export type ErpModule = (typeof modules)[number];

/** The modules surfaced to the UI (sidebar, workspace cards, route guards). */
export const activeModules = modules.filter((module) => ACTIVE_MODULES.includes(module.slug));

export function isModuleActive(slug: string): boolean {
  return ACTIVE_MODULES.includes(slug);
}

export function getModule(slug: string): ErpModule | undefined {
  return modules.find((module) => module.slug === slug);
}
