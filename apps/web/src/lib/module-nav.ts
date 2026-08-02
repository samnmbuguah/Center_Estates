import type { ModuleNavGroup } from "@/components/module-shell";

/** Design-aligned left-rail groups. Labels must match e2e button names. */
export const propertyNav: ModuleNavGroup[] = [
  {
    label: "Portfolio",
    icon: "⌂",
    items: [
      { id: "overview", label: "Overview" },
      { id: "properties", label: "Properties" },
      { id: "buildings", label: "Buildings" },
      { id: "units", label: "Units" },
      { id: "projects", label: "Projects" },
    ],
  },
  {
    label: "Tenancy",
    icon: "◈",
    items: [
      { id: "tenants", label: "Tenants" },
      { id: "tenant-documents", label: "Tenant documents" },
      { id: "leases", label: "Leases" },
    ],
  },
  {
    label: "Collections",
    icon: "◎",
    items: [
      { id: "rent-schedules", label: "Rent schedules" },
      { id: "rent", label: "Rent & invoices" },
      { id: "arrears", label: "Arrears" },
      { id: "reminders", label: "Reminders" },
      { id: "receipts", label: "Receipts" },
      { id: "receipt-allocations", label: "Receipt allocations" },
      { id: "bank-reconciliation", label: "Bank reconciliation" },
      { id: "credit-notes", label: "Credit notes" },
    ],
  },
  {
    label: "Charges & costs",
    icon: "▣",
    items: [
      { id: "service-charges", label: "Service charge" },
      { id: "service-charge-allocations", label: "Charge allocations" },
      { id: "service-charge-reconciliations", label: "Reconciliations" },
      { id: "budgets", label: "Budgets" },
      { id: "expenses", label: "Expenses" },
    ],
  },
  {
    label: "Insights",
    icon: "◌",
    items: [{ id: "reports", label: "Reports" }],
  },
];

export const facilityNav: ModuleNavGroup[] = [
  { label: "Overview", icon: "⌂", items: [{ id: "overview", label: "Dashboard" }] },
  {
    label: "Assets & locations",
    icon: "▣",
    items: [{ id: "assets", label: "Assets" }],
  },
  {
    label: "Maintenance",
    icon: "🔧",
    items: [
      { id: "work-orders", label: "Work orders" },
      { id: "work-order-events", label: "Work history" },
      { id: "work-order-cost-items", label: "Labor & parts" },
      { id: "work-order-attachments", label: "Work media" },
      { id: "planned-maintenance", label: "Planned maintenance" },
    ],
  },
  {
    label: "Operations",
    icon: "◷",
    items: [
      { id: "service-requests", label: "Service requests" },
      { id: "inspections", label: "Inspections" },
      { id: "meters", label: "Utilities" },
      { id: "contractors", label: "Contractors" },
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

export const constructionNav: ModuleNavGroup[] = [
  {
    label: "Portfolio",
    icon: "⌂",
    items: [
      { id: "overview", label: "Command center" },
      { id: "projects", label: "Projects" },
      { id: "project-memberships", label: "Project team" },
      { id: "lifecycle", label: "Lifecycle" },
      { id: "calendar", label: "Calendar" },
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
];
