export const modules = [
  { slug: "property", name: "Property Management", description: "Properties, tenants, leases, rent, service charges and financial reporting.", accent: "#2563eb", features: ["Properties", "Tenants", "Leases", "Rent collection", "Service charges", "Reports"] },
  { slug: "facility", name: "Facility Management", description: "Assets, maintenance, work orders, inspections, service requests and utilities.", accent: "#16a34a", features: ["Buildings", "Assets", "Work orders", "Planned maintenance", "Inspections", "Utilities"] },
  { slug: "sales", name: "Sales Management", description: "Buyers, units, payments, site visits, sales agents and commissions.", accent: "#ea580c", features: ["Projects & units", "Buyers", "Payments", "Site visits", "Agents", "Commissions"] },
  { slug: "tender", name: "Tender Management", description: "Tender intelligence from invitation and analysis through submission and award.", accent: "#7c3aed", features: ["Invitations", "AI analysis", "Bid decision", "Planning", "Proposals", "Submission"] },
  { slug: "valuation", name: "Valuation", description: "Instructions, inspections, comparable evidence, reports, invoicing and analytics.", accent: "#0891b2", features: ["Instructions", "Site inspections", "Draft reports", "Final reports", "Invoicing", "Analytics"] },
  { slug: "monitoring", name: "Construction Monitoring", description: "Construction evidence, progress, risks, quality, finance and reporting.", accent: "#dc2626", features: ["Projects", "Programme", "Site evidence", "Risks", "Finance", "Reports"] },
] as const;

export type ErpModule = (typeof modules)[number];
export function getModule(slug: string): ErpModule | undefined {
  return modules.find((module) => module.slug === slug);
}
