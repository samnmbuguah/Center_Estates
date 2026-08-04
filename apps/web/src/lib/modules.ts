export const modules = [
  { slug: "property", name: "Property Management", description: "Manage properties, leases, tenants, billing and collections.", accent: "#e23b3b", icon: "🏢", features: ["Properties", "Tenants", "Leases", "Rent collection", "Service charges", "Reports"], stats: [{ label: "Focus", value: "Leases & rent" }, { label: "Ledger", value: "Live billing" }] },
  { slug: "facility", name: "Facility Management", description: "Assets, maintenance, compliance, utilities and sustainability.", accent: "#16a34a", icon: "🔧", features: ["Buildings", "Assets", "Work orders", "Planned maintenance", "Inspections", "Utilities"], stats: [{ label: "Focus", value: "Work orders" }, { label: "Control", value: "PPM & SLA" }] },
  { slug: "sales", name: "Sales Management", description: "Inventory, buyers, payments, site visits and agent commissions.", accent: "#ea580c", icon: "🏷️", features: ["Projects & units", "Buyers", "Payments", "Site visits", "Agents", "Commissions"], stats: [{ label: "Focus", value: "Units & buyers" }, { label: "Control", value: "Collections" }] },
  { slug: "tender", name: "Tender Management", description: "Manage tenders, evaluations and contract awards.", accent: "#7c3aed", icon: "📋", features: ["Invitations", "AI analysis", "Bid decision", "Planning", "Proposals", "Submission"], stats: [{ label: "Focus", value: "Pipeline" }, { label: "Control", value: "Approvals" }] },
  { slug: "valuation", name: "Valuation", description: "Track valuation instructions, inspections and reports.", accent: "#0891b2", icon: "📐", features: ["Instructions", "Site inspections", "Draft reports", "Final reports", "Invoicing", "Analytics"], stats: [{ label: "Focus", value: "Instructions" }, { label: "Output", value: "Reports" }] },
  { slug: "monitoring", name: "Construction Monitoring", description: "Construction evidence, progress, risks, quality, finance and reporting.", accent: "#dc2626", icon: "🏗️", features: ["Projects", "Programme", "Site evidence", "Risks", "Finance", "Reports"], stats: [{ label: "Focus", value: "Site evidence" }, { label: "Control", value: "Cost & risk" }] },
  { slug: "companion", name: "Companion & Staff Performance", description: "Personal task command center, task assignment and staff productivity analytics.", accent: "#0d9488", icon: "🧭", features: ["My Companion", "Task assignment", "Delegation", "Performance dashboard", "SLA escalation", "Adoption analytics"], stats: [{ label: "Focus", value: "Daily work" }, { label: "Control", value: "SLA & TAT" }] },
] as const;

export type ErpModule = (typeof modules)[number];
export function getModule(slug: string): ErpModule | undefined {
  return modules.find((module) => module.slug === slug);
}
