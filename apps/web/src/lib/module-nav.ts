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
    label: "PROPERTY",
    items: [
      { id: "properties", label: "Property Details", icon: "🏢" },
      { id: "owners", label: "Landlords & Owners", icon: "👑" },
      { id: "buildings", label: "Buildings", icon: "🏗️" },
      { id: "module-access", label: "Module Access", icon: "🧩" },
      { id: "feedback-qr", label: "Concierge QR Codes", icon: "▦" },
    ],
  },
  {
    label: "TENANCY",
    items: [
      { id: "tenants", label: "Tenant Register", icon: "👥" },
      { id: "units", label: "Units & Occupancy", icon: "🏢" },
      { id: "leases", label: "Lease Agreements", icon: "📄" },
      { id: "tenant-documents", label: "Compliance & Docs", icon: "📎" },
      { id: "handover-exit", label: "Handover & Exit", icon: "🔑" },
    ],
  },
  {
    label: "INVOICING",
    items: [
      { id: "billing", label: "Billing & Invoices", icon: "🧾" },
      { id: "receipting", label: "Receipting", icon: "💰" },
      { id: "bank-reconciliation", label: "Bank Reconciliation", icon: "🏦" },
      { id: "arrears", label: "Arrears & Recovery", icon: "⚠️" },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { id: "budgets", label: "Budgets & Estimates", icon: "📑" },
      { id: "expenses", label: "Expenses", icon: "💸" },
      { id: "fees", label: "Management Fees", icon: "🧾" },
    ],
  },
  {
    label: "SERVICE CHARGE",
    items: [
      { id: "service-charges", label: "Service Charge Schemes", icon: "⚡" },
      { id: "service-charge-allocations", label: "Charge Allocations", icon: "📊" },
      { id: "service-charge-reconciliations", label: "Reconciliations", icon: "⚖️" },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { id: "tenancy-reports", label: "Tenancy Analytics", icon: "🏘️" },
      { id: "financial-reports", label: "Financial Analytics", icon: "📊" },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { id: "forecast", label: "5-Year Forecast", icon: "📈" },
      { id: "critical-dates", label: "Critical Dates", icon: "⏰" },
    ],
  },
  {
    label: "WORKSPACE",
    items: [
      { id: "tickets", label: "Tickets & Issues", icon: "🎫" },
      { id: "calendar", label: "Calendar", icon: "📅" },
    ],
  },
];

export const facilityNav: ModuleNavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      { id: "overview",          label: "Facility Overview",   icon: "▦" },
      { id: "buildings",         label: "Buildings & Locations",icon: "🏢" },
    ],
  },
  {
    label: "ASSETS & STOCK",
    items: [
      { id: "assets", label: "Assets & Inventory", icon: "📦" },
      { id: "spare-parts", label: "Spare Parts", icon: "🔩" },
      { id: "consumables", label: "Consumables", icon: "🧴" },
    ],
  },
  {
    label: "VENDORS & CONTRACTS",
    items: [
      { id: "contractors",         label: "Vendors & Contracts",   icon: "🤝" },
      { id: "planned-maintenance", label: "Planned Maintenance",   icon: "📅" },
      { id: "service-lines",       label: "Service Lines & Scorecards", icon: "📋" },
      { id: "appraisals",          label: "Performance Appraisals", icon: "⭐" },
      { id: "corrective-actions",  label: "Corrective Actions",    icon: "🛠️" },
      { id: "vendor-reports",      label: "Scorecard Reports",     icon: "📈" },
    ],
  },
  {
    label: "MAINTENANCE",
    items: [
      { id: "work-orders",       label: "Work Orders",         icon: "🔧" },
      { id: "requisitions",      label: "Repair Requisitions", icon: "📝" },
      { id: "work-order-events", label: "Work History",        icon: "🕘" },
      { id: "work-order-cost-items", label: "Labor & Parts",   icon: "🧾" },
      { id: "work-order-attachments", label: "Work Media",     icon: "📎" },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { id: "service-requests", label: "Service Requests & Helpdesk", icon: "🎫" },
      { id: "incidents", label: "Incident Reporting", icon: "🔍" },
      { id: "inspections", label: "Inspections", icon: "🔎" },
      { id: "meters", label: "Energy & Utilities", icon: "⚡" },
      { id: "feedback-qr", label: "Public & Concierge QR Codes", icon: "▦" },
    ],
  },
  {
    label: "FINANCE & PROCUREMENT",
    items: [
      { id: "procurement",       label: "Procurement & LPOs",  icon: "🛒" },
      { id: "supplier-invoices", label: "Supplier Invoices",   icon: "🧾" },
      { id: "finance-control",   label: "Finance Control & Petty Cash", icon: "🏦" },
      { id: "expenditure",       label: "Expenditure & Floats", icon: "💰" },
    ],
  },
  {
    label: "REPORTS & BI",
    items: [
      { id: "reports", label: "Reporting Workspace", icon: "📊" },
    ],
  },
  {
    label: "GOVERNANCE",
    items: [
      { id: "strategic-plans", label: "Strategic FM Plan", icon: "🧭" },
      { id: "budgets", label: "Budgets & Commitments", icon: "💼" },
      { id: "compliance", label: "Statutory Compliance", icon: "🛡️" },
      { id: "risks", label: "Risk Register", icon: "⚠️" },
    ],
  },
  { label: "WORKSPACE", items: [{ id: "tickets", label: "Tickets & Issues", icon: "🎫" }, { id: "calendar", label: "Calendar", icon: "📅" }] },
];



export const salesNav: ModuleNavGroup[] = [
  { label: "OVERVIEW", icon: "▦", items: [{ id: "overview", label: "Sales Dashboard", icon: "▦" }] },
  {
    label: "GROWTH & MARKETING",
    icon: "⚡",
    items: [
      { id: "outreach", label: "AI Outreach & GTM", icon: "⚡" },
      { id: "cms", label: "Content & Marketing CMS", icon: "🎨" },
      { id: "leads", label: "Leads & Prospects", icon: "🎯" },
    ],
  },
  {
    label: "SALES PIPELINE",
    icon: "◈",
    items: [
      { id: "inventory", label: "Projects & Units", icon: "🏢" },
      { id: "buyers", label: "Buyers Registry", icon: "👥" },
      { id: "sales", label: "Deals & Sales Pipeline", icon: "🤝" },
      { id: "site-visits", label: "Site Visits", icon: "📍" },
    ],
  },
  {
    label: "COLLECTIONS & ESCROW",
    icon: "◎",
    items: [
      { id: "installments", label: "Payment Schedules", icon: "📅" },
      { id: "payments", label: "Buyer Payments", icon: "💰" },
      { id: "commissions", label: "Agent Commissions", icon: "🧾" },
      { id: "bank-reconciliation", label: "Bank Reconciliation", icon: "🏦" },
    ],
  },
  {
    label: "FIELD & CLOSING",
    icon: "📱",
    items: [
      { id: "clerk", label: "Sales Clerk (Mobile)", icon: "📱" },
      { id: "documents", label: "Legal Document Packs", icon: "📎" },
      { id: "handover", label: "Unit Handover", icon: "🔑" },
    ],
  },
  {
    label: "INSIGHTS & GOVERNANCE",
    icon: "◌",
    items: [
      { id: "performance", label: "Agent Performance", icon: "📊" },
      { id: "reports", label: "Sales Reports", icon: "📈" },
      { id: "audit-events", label: "Audit Trail", icon: "📜" },
    ],
  },
  { label: "WORKSPACE", icon: "◌", items: [{ id: "tickets", label: "Tickets & Issues", icon: "🎫" }, { id: "calendar", label: "Calendar", icon: "📅" }] },
];

export const tenderNav: ModuleNavGroup[] = [
  { label: "OVERVIEW", icon: "▦", items: [{ id: "overview", label: "Tender Dashboard", icon: "▦" }] },
  {
    label: "PURSUIT",
    icon: "◈",
    items: [
      { id: "tenders", label: "Invitations & RFPs", icon: "📩" },
      { id: "requirements", label: "AI Requirement Analysis", icon: "✦" },
      { id: "decisions", label: "Bid / No-Bid Decisions", icon: "⚖️" },
      { id: "tasks", label: "Proposal Planning", icon: "📋" },
    ],
  },
  {
    label: "PRODUCTION",
    icon: "▣",
    items: [
      { id: "company-documents", label: "Company Document Vault", icon: "📂" },
      { id: "proposals", label: "Proposal Sections", icon: "📄" },
      { id: "financial-items", label: "Financial BOQ", icon: "💰" },
      { id: "reviews", label: "Review & Approvals", icon: "🔍" },
      { id: "packaging", label: "Tender Packaging", icon: "📦" },
    ],
  },
  {
    label: "CLOSE-OUT",
    icon: "◌",
    items: [
      { id: "submissions", label: "Submissions Log", icon: "📤" },
      { id: "outcomes", label: "Awards & Regrets", icon: "🏆" },
      { id: "reports", label: "Tender Analytics", icon: "📊" },
      { id: "audit-events", label: "Audit Trail", icon: "📜" },
    ],
  },
  { label: "WORKSPACE", icon: "◌", items: [{ id: "tickets", label: "Tickets & Issues", icon: "🎫" }, { id: "calendar", label: "Calendar", icon: "📅" }] },
];

export const valuationNav: ModuleNavGroup[] = [
  { label: "OVERVIEW", icon: "▦", items: [{ id: "overview", label: "Valuation Overview", icon: "▦" }] },
  {
    label: "INSTRUCTIONS",
    icon: "◈",
    items: [
      { id: "instructions", label: "Valuation Instructions", icon: "📋" },
      { id: "inspections", label: "Site Inspections", icon: "🔍" },
      { id: "comparables", label: "Comparable Evidence", icon: "🏷️" },
    ],
  },
  {
    label: "REPORTING",
    icon: "▣",
    items: [
      { id: "draft-reports", label: "Draft Reports", icon: "📝" },
      { id: "final-reports", label: "Final Reports & Sign-off", icon: "📜" },
    ],
  },
  {
    label: "COMMERCIAL",
    icon: "◎",
    items: [
      { id: "invoices", label: "Client Invoicing", icon: "🧾" },
      { id: "payments", label: "Fee Collections", icon: "💰" },
      { id: "clients", label: "Client Directory", icon: "🏢" },
    ],
  },
  {
    label: "INSIGHTS",
    icon: "◌",
    items: [
      { id: "analytics", label: "Performance Analytics", icon: "📊" },
      { id: "reports", label: "Valuation Reports", icon: "📈" },
      { id: "audit-events", label: "Audit Trail", icon: "📜" },
    ],
  },
  { label: "WORKSPACE", icon: "◌", items: [{ id: "tickets", label: "Tickets & Issues", icon: "🎫" }, { id: "calendar", label: "Calendar", icon: "📅" }] },
];

export const constructionNav: ModuleNavGroup[] = [
  {
    label: "MAIN",
    icon: "⌂",
    items: [
      { id: "overview", label: "Executive Overview", icon: "📊" },
      { id: "projects", label: "Project Portfolio", icon: "🏗️" },
      { id: "project-memberships", label: "Project Command Center", icon: "🎯" },
      { id: "lifecycle", label: "Project Lifecycle", icon: "🔄" },
      { id: "calendar", label: "Calendar", icon: "📅" },
    ],
  },
  {
    label: "PROGRAMME & CONTROLS",
    icon: "◷",
    items: [
      { id: "work-plan", label: "Work Programme (Gantt)", icon: "⏱️" },
      { id: "milestones", label: "Stage-Gates & Mini-BoQ", icon: "🚩" },
      { id: "milestone-verifications", label: "Progress Verification", icon: "✅" },
      { id: "approvals", label: "Statutory Approvals", icon: "✍️" },
      { id: "requirement-waivers", label: "Requirement Waivers", icon: "📝" },
    ],
  },
  {
    label: "SITE OPERATIONS",
    icon: "◫",
    items: [
      { id: "daily-logs", label: "Daily Logs & HSE", icon: "📋" },
      { id: "site-visits", label: "Site Visits", icon: "👷" },
      { id: "quality-tests", label: "Quality & Cube Tests", icon: "🔬" },
      { id: "tickets", label: "Issues & Snags", icon: "🎫" },
      { id: "rfis", label: "RFIs", icon: "📑" },
      { id: "risks", label: "Risk Register", icon: "⚠️" },
    ],
  },
  {
    label: "COMMERCIAL & QS",
    icon: "◈",
    items: [
      { id: "cost-dashboard", label: "Cost & Cash Flow", icon: "📈" },
      { id: "boq", label: "Master BoQ & States", icon: "📐" },
      { id: "ingestion", label: "BoQ & Schedule Import", icon: "📥" },
      { id: "variations", label: "Variation Orders", icon: "🔀" },
      { id: "provisional-sums", label: "Provisional Sums", icon: "💼" },
      { id: "contingency-drawdowns", label: "Contingency Drawdowns", icon: "🛡️" },
      { id: "advance-payments", label: "Advances & Recovery", icon: "💵" },
      { id: "consultant-payments", label: "Consultant Fees", icon: "👔" },
      { id: "subcontractors", label: "Subcontractors", icon: "🤝" },
      { id: "work-orders", label: "Work Orders", icon: "📜" },
    ],
  },
  {
    label: "FINANCE & VALUATION",
    icon: "◎",
    items: [
      { id: "certificates", label: "Payment Certificates (IPC)", icon: "📜" },
      { id: "requisitions", label: "Payment Requisitions", icon: "💳" },
      { id: "disbursements", label: "Disbursements", icon: "💸" },
      { id: "drawdowns", label: "Funding Drawdowns", icon: "🏦" },
    ],
  },
  {
    label: "PROCUREMENT & STORES",
    icon: "▣",
    items: [
      { id: "materials", label: "BoQ Material Reconciliation", icon: "🚚" },
      { id: "store-items", label: "Site Store Inventory", icon: "📦" },
      { id: "material-requisitions", label: "Material Requests", icon: "📝" },
      { id: "purchase-orders", label: "Purchase Orders", icon: "🧾" },
      { id: "stock-movements", label: "Stock Ledger", icon: "📊" },
      { id: "store-suppliers", label: "Approved Suppliers", icon: "🏢" },
    ],
  },
  {
    label: "BIM, GIS & DOCUMENTS",
    icon: "◇",
    items: [
      { id: "documents", label: "Project Documents", icon: "📁" },
      { id: "bim-verification", label: "BIM & BoQ Verification Hub", icon: "📐" },
      { id: "iqsk-rates", label: "IQSK Cost Handbook", icon: "📖" },
      { id: "bim-models", label: "3D BIM Models", icon: "🧊" },
      { id: "bim-discrepancies", label: "BIM Discrepancies", icon: "⚠️" },
      { id: "drone-datasets", label: "Drone Surveys", icon: "🚁" },
      { id: "satellite-datasets", label: "Satellite Imagery", icon: "🛰️" },
    ],
  },
  {
    label: "GOVERNANCE & REPORTS",
    icon: "◌",
    items: [
      { id: "reports", label: "Executive Reports", icon: "📈" },
      { id: "stakeholders", label: "Project Team & Roles", icon: "👥" },
      { id: "chat", label: "Project Chat", icon: "💬" },
      { id: "notifications", label: "Notifications", icon: "🔔" },
      { id: "audit-log", label: "Audit Trail", icon: "📜" },
    ],
  },
];

export const companionNav: ModuleNavGroup[] = [
  {
    label: "Companion",
    icon: "🧭",
    items: [
      { id: "overview", label: "My Companion" },
      { id: "qm", label: "Quartermaster AI", icon: "✦" },
      { id: "dialogue", label: "Team Dialogue & Feedback", icon: "💬" },
    ],
  },
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
    label: "Field work",
    icon: "⌁",
    items: [{ id: "meter-readings", label: "Meter readings" }],
  },
  {
    label: "Team & Performance",
    icon: "◌",
    items: [
      { id: "hr-requests", label: "Leave & HR Portal", icon: "🌴" },
      { id: "performance", label: "Performance dashboard" },
      { id: "staff", label: "Staff history" },
    ],
  },
  { label: "Workspace", icon: "◌", items: [{ id: "tickets", label: "Tickets & Issues" }, { id: "calendar", label: "Calendar" }] },
];
