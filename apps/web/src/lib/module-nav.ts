import type { ModuleNavGroup } from "@/components/module-shell";

/**
 * LEFT SIDEBAR NAV — top-level sections only.
 *
 * These drive which LEFT sidebar item is highlighted.
 * Sub-pages within each section are rendered as HORIZONTAL TABS
 * (passed via `subTabs` prop to ModuleShell), keeping the two levels separate.
 */

export const propertyNav: ModuleNavGroup[] = [
  {
    label: "PROPERTY MANAGEMENT",
    items: [
      { id: "overview",        label: "Overview",          icon: "▦" },
      { id: "properties",      label: "Properties",        icon: "🏢" },
      { id: "units",           label: "Occupancy",         icon: "🪟" },
      { id: "tenants",         label: "Tenants",           icon: "👥" },
      { id: "leases",          label: "Leases",            icon: "📄" },
      { id: "rent",            label: "Rent Collection",   icon: "💰" },
      { id: "service-charges", label: "Service Charge",    icon: "⚡" },
      { id: "expenses",        label: "Income & Expenses", icon: "📊" },
      { id: "reports",         label: "Reports",           icon: "📈" },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { id: "owner-portal", label: "Owner Portal" },
      { id: "forecast", label: "5-Year Forecast" },
      { id: "critical-dates",  label: "Critical Dates",     icon: "📅" },
    ],
  },
];

export const facilityNav: ModuleNavGroup[] = [
  {
    label: "FACILITY MANAGEMENT",
    items: [
      { id: "overview",          label: "Dashboard",           icon: "▦" },
      { id: "buildings",         label: "Buildings & Locations",icon: "🏢" },
      { id: "assets",            label: "Assets & Inventory",  icon: "📦" },
      { id: "work-orders",       label: "Maintenance",         icon: "🔧" },
      { id: "planned-maintenance",label: "Planned Maintenance",icon: "📅" },
      { id: "service-requests",  label: "Service Requests",    icon: "🎫" },
      { id: "inspections",       label: "Inspections",         icon: "🔍" },
      { id: "meters",            label: "Energy & Utilities",  icon: "⚡" },
      { id: "contractors",       label: "Vendors & Contracts", icon: "🤝" },
      { id: "reports",           label: "Reports & BI",        icon: "📈" },
    ],
  },
];



export const salesNav: ModuleNavGroup[] = [
  { label: "Overview", icon: "⌂", items: [{ id: "overview", label: "Dashboard" }] },
  {
    label: "Pipeline",
    icon: "◈",
    items: [
      { id: "inventory", label: "Projects & units" },
      { id: "buyers", label: "Buyers" },
      { id: "sales", label: "Sales" },
      { id: "site-visits", label: "Site visits" },
    ],
  },
  {
    label: "Collections",
    icon: "◎",
    items: [
      { id: "installments", label: "Installments" },
      { id: "payments", label: "Payments" },
      { id: "commissions", label: "Commissions" },
    ],
  },
  {
    label: "Insights",
    icon: "◌",
    items: [
      { id: "performance", label: "Agent performance" },
      { id: "reports", label: "Reports" },
      { id: "documents", label: "Legal documents" },
      { id: "audit-events", label: "Audit trail" },
    ],
  },
];

export const tenderNav: ModuleNavGroup[] = [
  { label: "Overview", icon: "⌂", items: [{ id: "overview", label: "Dashboard" }] },
  {
    label: "Pursuit",
    icon: "◈",
    items: [
      { id: "tenders", label: "Invitations" },
      { id: "requirements", label: "AI analysis" },
      { id: "decisions", label: "Bid / no-bid" },
      { id: "tasks", label: "Planning" },
    ],
  },
  {
    label: "Production",
    icon: "▣",
    items: [
      { id: "company-documents", label: "Company documents" },
      { id: "proposals", label: "Proposals" },
      { id: "financial-items", label: "Financial BOQ" },
      { id: "reviews", label: "Review & approval" },
      { id: "packaging", label: "Packaging" },
    ],
  },
  {
    label: "Close-out",
    icon: "◌",
    items: [
      { id: "submissions", label: "Submissions" },
      { id: "outcomes", label: "Awards & regrets" },
      { id: "reports", label: "Reports" },
      { id: "audit-events", label: "Audit trail" },
    ],
  },
];

export const valuationNav: ModuleNavGroup[] = [
  { label: "Overview", icon: "⌂", items: [{ id: "overview", label: "Overview" }] },
  {
    label: "Instructions",
    icon: "◈",
    items: [
      { id: "instructions", label: "Instructions" },
      { id: "inspections", label: "Site inspections" },
      { id: "comparables", label: "Comparable evidence" },
    ],
  },
  {
    label: "Reporting",
    icon: "▣",
    items: [
      { id: "draft-reports", label: "Draft reports" },
      { id: "final-reports", label: "Final reports" },
    ],
  },
  {
    label: "Commercial",
    icon: "◎",
    items: [
      { id: "invoices", label: "Client invoicing" },
      { id: "payments", label: "Payments" },
      { id: "clients", label: "Clients" },
    ],
  },
  {
    label: "Insights",
    icon: "◌",
    items: [
      { id: "analytics", label: "Analytics" },
      { id: "reports", label: "Reports" },
      { id: "audit-events", label: "Audit trail" },
    ],
  },
];

export const constructionNav: ModuleNavGroup[] = [  {
    label: "Main",
    icon: "⌂",
    items: [
      { id: "overview", label: "Dashboard" },
      { id: "projects", label: "Project Portfolio" },
      { id: "calendar", label: "Calendar" },
      { id: "chat", label: "AI Assistant" },
    ],
  },
  {
    label: "Site operations",
    icon: "◫",
    items: [
      { id: "milestones", label: "Progress" },
      { id: "daily-logs", label: "Daily logs" },
      { id: "tickets", label: "Issues" },
      { id: "ticket-comments", label: "Issue discussion" },
      { id: "risks", label: "Risks" },
      { id: "safety-incidents", label: "Safety" },
      { id: "quality-tests", label: "Quality" },
      { id: "rfis", label: "RFIs" },
    ],
  },
  {
    label: "Programme & controls",
    icon: "◷",
    items: [
      { id: "work-plan", label: "Programme" },
      { id: "milestone-verifications", label: "Progress verification" },
      { id: "requirement-waivers", label: "Requirement waivers" },
      { id: "approvals", label: "Approvals" },
    ],
  },
  {
    label: "Commercial",
    icon: "◈",
    items: [
      { id: "boq", label: "BoQ & cost" },
      { id: "variations", label: "Variations" },
      { id: "provisional-sums", label: "Provisional sums" },
      { id: "contingency-drawdowns", label: "Contingency" },
      { id: "advance-payments", label: "Advances" },
      { id: "advance-recoveries", label: "Advance recoveries" },
      { id: "consultant-payments", label: "Consultants" },
      { id: "work-orders", label: "Work orders" },
      { id: "subcontractors", label: "Subcontractors" },
    ],
  },
  {
    label: "Procurement & stores",
    icon: "▣",
    items: [
      { id: "materials", label: "Deliveries" },
      { id: "store-items", label: "Inventory" },
      { id: "store-suppliers", label: "Suppliers" },
      { id: "material-requisitions", label: "Material requests" },
      { id: "purchase-orders", label: "Purchase orders" },
      { id: "stock-movements", label: "Stock ledger" },
    ],
  },
  {
    label: "Finance",
    icon: "◎",
    items: [
      { id: "requisitions", label: "Requisitions" },
      { id: "certificates", label: "Certificates" },
      { id: "disbursements", label: "Payments" },
      { id: "drawdowns", label: "Drawdowns" },
    ],
  },
  {
    label: "Documents & digital",
    icon: "◇",
    items: [
      { id: "documents", label: "Documents" },
      { id: "document-versions", label: "Document revisions" },
      { id: "bim-models", label: "BIM models" },
      { id: "bim-discrepancies", label: "BIM issues" },
      { id: "drone-datasets", label: "Drone" },
      { id: "satellite-datasets", label: "Satellite" },
    ],
  },
  {
    label: "Insights & collaboration",
    icon: "◌",
    items: [
      { id: "reports", label: "Reports" },
      { id: "chat", label: "Project chat" },
      { id: "notifications", label: "Notifications" },
      { id: "audit-log", label: "Audit trail" },
    ],
  },
  {
    label: "Role Dashboards",
    icon: "👤",
    items: [
      { id: "role-pm", label: "Project Manager" },
      { id: "role-finance", label: "Finance" },
      { id: "role-site", label: "Site Agent" },
      { id: "role-dev", label: "Project Developer" },
      { id: "role-sales", label: "Sales" },
      { id: "role-marketing", label: "Buyer / Marketing" },
      { id: "role-clerk", label: "Clerk" },
      { id: "role-valuer", label: "Valuer" },
      { id: "role-facilities", label: "Facilities" },
      { id: "role-admin", label: "Administrator" },
    ],
  },
];

export const companionNav: ModuleNavGroup[] = [
  { label: "Companion", icon: "🧭", items: [{ id: "overview", label: "My Companion" }] },
  {
    label: "Tasks",
    icon: "◈",
    items: [
      { id: "tasks", label: "All tasks" },
      { id: "my-tasks", label: "My tasks" },
      { id: "templates", label: "Templates" },
      { id: "delegations", label: "Delegations" },
    ],
  },
  {
    label: "Performance",
    icon: "◌",
    items: [
      { id: "performance", label: "Performance dashboard" },
      { id: "staff", label: "Staff history" },
      { id: "audit-events", label: "Audit trail" },
    ],
  },
];
