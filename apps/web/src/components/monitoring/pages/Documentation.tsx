import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  Camera,
  CheckCircle,
  ClipboardList,
  Coins,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  HandCoins,
  HardHat,
  HelpCircle,
  Images,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Scale,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  ShieldHalf,
  SlidersHorizontal,
  Sparkles,
  TestTube,
  Ticket,
  Umbrella,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link, useOutletContext } from "@/components/monitoring/react-router-shim";
import { useAuth } from "../auth";
import { type TourAPI } from "../components/tour";

interface DocSection {
  id: string;
  title: string;
  icon: any;
  description: string;
  modules: DocModule[];
}

interface DocModule {
  name: string;
  path?: string;
  description: string;
  features: string[];
  perm?: string;
  tourStep?: { role: string; stepIndex: number };
  roles: string[];
}

const ROLES: Array<{ key: string; label: string }> = [
  { key: "all", label: "All Roles" },
  { key: "property_manager", label: "Property Manager" },
  { key: "property_accountant", label: "Property Accountant" },
  { key: "clerk_of_works", label: "Clerk of Works" },
  { key: "project_manager", label: "Project Manager" },
  { key: "qs", label: "Quantity Surveyor" },
  { key: "engineer", label: "Engineer" },
  { key: "financier", label: "Financier" },
  { key: "contractor", label: "Contractor" },
  { key: "admin", label: "Administrator" },
];

const DOC_SECTIONS: DocSection[] = [
  {
    id: "property-mgmt",
    title: "Property & Tenancy",
    icon: Building2,
    description: "Multi-estate management, unit inventory, tenant onboarding, leases, and utility billing.",
    modules: [
      {
        name: "Property Registry & Context",
        path: "/app/property",
        description: "Organize properties into commercial, residential, or sectional titles with isolated scoping.",
        features: [
          "Switch between assigned estates with context dialog",
          "Property-level isolation for financial safety",
          "Sectional title & Body Corporate configurations",
          "Unit registers with real-time status tracking"
        ],
        perm: "properties.view",
        roles: ["property_manager", "admin", "all"]
      },
      {
        name: "Tenancy & Leases",
        path: "/app/property",
        description: "End-to-end tenant lifecycle management from initial KYC to lease renewals and terminations.",
        features: [
          "Tenant profile creation and legal identity capture",
          "Lease tenure, rent escalation, and service charge definitions",
          "Escrow deposit registers (rent & utility deposits)",
          "Direct upload of countersigned lease contracts"
        ],
        perm: "properties.view",
        roles: ["property_manager", "admin", "all"]
      },
      {
        name: "Utility Billing & Invoicing",
        path: "/app/property",
        description: "Automated monthly recurring invoices, water meter logs, and payment receipts.",
        features: [
          "End-of-month water meter reading capture with variance check",
          "One-click batch generation of monthly tax invoices",
          "M-Pesa, EFT, and Bank transfer receipting with FIFO allocation",
          "Automatic rent arrears and reminder notifications"
        ],
        perm: "properties.view",
        roles: ["property_manager", "property_accountant", "admin", "all"]
      }
    ]
  },
  {
    id: "facility-mgmt",
    title: "Facility Management",
    icon: Settings,
    description: "Asset registers, preventative maintenance, vendor management, and work order dispatch.",
    modules: [
      {
        name: "Work Orders & Tickets",
        path: "/app/facility",
        description: "Dispatch maintenance requests to in-house technicians or external contractors.",
        features: [
          "Service request intake from tenants or caretakers",
          "SLA priority matrix (Emergency, High, Medium, Low)",
          "Work order assignment and photo completion evidence",
          "Asset warranty and maintenance history tracking"
        ],
        perm: "facility.view",
        roles: ["property_manager", "admin", "all"]
      }
    ]
  },
  {
    id: "dashboard",
    title: "Dashboard & Overview",
    icon: LayoutDashboard,
    description: "Role-based home pages with key stats, quick actions, and compliance data.",
    modules: [
      { name: "Role Dashboard", path: "/app", description: "Your personalized home page showing relevant stats, quick actions, and project summaries based on your role.", features: ["Key performance indicators", "Role-specific stat cards", "Quick action buttons", "Compliance overview", "Issue summary", "Finance snapshot (for QS/Financier)"], perm: "dashboard.view", roles: ["all"] },
      { name: "Executive Dashboard", path: "/app/client-dashboard", description: "High-level project overview for financiers and executives. S-curves, cost charts, and risk indicators.", features: ["S-curve progress (planned vs actual)", "Cost charts (budget vs forecast vs certified vs paid)", "Risk summary with ticket counts", "Color-coded status indicators"], perm: "site.reporting.view", roles: ["financier", "project_manager"] },
    ],
  },
  {
    id: "projects",
    title: "Project Management",
    icon: Building2,
    description: "Create, onboard, and manage construction projects across their lifecycle.",
    modules: [
      { name: "Projects Register", path: "/app/projects", description: "View all projects across your portfolio. Filter by status, search by name, and access project-specific features.", features: ["Project list with search and filters", "Status indicators and progress summary", "Quick access to project modules", "Archive completed projects"], perm: "projects.view", roles: ["all"] },
      { name: "Project Onboarding", path: "/app/onboarding", description: "4-step guided wizard to set up new projects: metadata, stakeholders, documents, and review.", features: ["Project metadata (name, location, type, budget, dates)", "Mandatory stakeholder assignment (Developer, Financier, Architect, QS, Engineers, CoW, Contractor)", "Baseline document upload (plans, BoQs, workplans, contracts, permits)", "Regulatory approval tracking", "On-boarding completion status"], perm: "projects.create", tourStep: { role: "project_manager", stepIndex: 4 }, roles: ["project_manager", "admin"] },
    ],
  },
  {
    id: "site-reporting",
    title: "Site Reporting",
    icon: ClipboardList,
    description: "Daily site activities, progress photos, issue tracking, and evidence capture.",
    modules: [
      { name: "Daily Logs", path: "/app/daily-logs", description: "Record site conditions daily: weather, materials, labour deployment, plant & equipment, visitors, and information received. Consistent logging builds compliance streaks.", features: ["Weather (AM/PM) with rainfall tracking", "Materials delivered with conformance", "Labour deployment adequacy", "Plant & equipment status", "Visitor logging", "Information received tracking", "Compliance streak monitoring"], perm: "site.reporting.view", tourStep: { role: "clerk_of_works", stepIndex: 2 }, roles: ["clerk_of_works", "contractor"] },
      { name: "Site Records", path: "/app/site-records", description: "Log material deliveries and health & safety incidents separately from daily diary entries.", features: ["Material delivery logging with photo evidence", "H&S incident recording (near miss, first aid, serious, lost time)", "Photo attachment for evidence", "Incident severity escalation"], perm: "site.reporting.view", tourStep: { role: "clerk_of_works", stepIndex: 6 }, roles: ["clerk_of_works", "contractor"] },
      { name: "Photo Timeline", path: "/app/timeline", description: "GPS-tagged progress photos grouped by visit date. Creates a visual history of site progress.", features: ["Auto-timestamped and GPS-tagged photos", "Grouped by visit date", "Full-screen photo view", "Metadata display (timestamp, GPS, device ID)"], perm: "site.reporting.view", tourStep: { role: "clerk_of_works", stepIndex: 9 }, roles: ["clerk_of_works", "project_manager", "engineer"] },
      { name: "Tickets", path: "/app/tickets", description: "Raise and track site issues with risk/sensitivity escalation matrix.", features: ["Ticket creation (topic, description, assignee, risk level, sensitivity)", "Risk × Sensitivity escalation matrix", "SLA tracking and escalation levels (L1/L2/L3)", "Multi-project view", "Photo attachment"], perm: "site.reporting.view", tourStep: { role: "clerk_of_works", stepIndex: 14 }, roles: ["clerk_of_works", "project_manager", "engineer"] },
      { name: "Issues Dashboard", path: "/app/issues", description: "Consolidated view of flagged issues across all projects.", features: ["Filtered issue list", "Urgent-first ordering", "Issue flag visualization", "Cross-project aggregation"], perm: "site.reporting.view", roles: ["project_manager", "engineer"] },
    ],
  },
  {
    id: "verification",
    title: "Milestone Verification & Certification",
    icon: ShieldCheck,
    description: "Review, approve, or reject Clerk of Works submissions. Engineer/QS certification workflow.",
    modules: [
      { name: "Verification Dashboard", path: "/app/verifications", description: "Review pending milestone submissions from Clerks of Works. Approve, reject, or request clarification.", features: ["Pending verification queue", "Evidence photo review with GPS/geofence badges", "Clerk observations and notes", "Approve / Reject / Request Clarification decisions", "Digitally signed and timestamped certification", "Rejected milestones suspend payment triggers"], perm: "site.reporting.milestone.verify", tourStep: { role: "project_manager", stepIndex: 9 }, roles: ["project_manager", "engineer"] },
    ],
  },
  {
    id: "reports",
    title: "Reports & Analysis",
    icon: FileText,
    description: "Auto-generated weekly reports with S-curves, compliance streaks, and AI-drafted narratives.",
    modules: [
      { name: "Reports", path: "/app/reports", description: "Weekly and monthly reports auto-generated from daily logs and milestone submissions. Export to PDF/Excel.", features: ["S-curve progress charts (planned vs actual)", "Compliance streak monitoring", "AI-drafted narrative summaries", "Milestone completion tracking", "PDF and Excel export", "Full traceability to original evidence"], perm: "site.reporting.view", tourStep: { role: "project_manager", stepIndex: 13 }, roles: ["all"] },
    ],
  },
  {
    id: "finance",
    title: "Finance & Cost Management",
    icon: Wallet,
    description: "Comprehensive financial management: requisitions, certificates, IPC, BoQ, variations, retention, and advance payments.",
    modules: [
      { name: "Finance Hub", path: "/app/finance", description: "Central finance page with requisitions, certificates, disbursements, and retention summary. Filter by project.", features: ["Requisition management (submitted → reviewed → approved → paid)", "Certificate register (interim and final)", "Disbursement tracking with void audit trail", "Project filter for focused view", "Retention summary panel"], perm: "finance.view", tourStep: { role: "qs", stepIndex: 2 }, roles: ["qs", "financier", "project_manager"] },
      { name: "Cost Dashboard", path: "/app/projects", description: "Full cost picture per project: CPI/SPI, budget vs forecast, BoQ state breakdown, retention, and advance payments.", features: ["Cost Performance Index (CPI) and Schedule Performance Index (SPI)", "Budget vs forecast vs certified vs paid charts", "BoQ state breakdown (counts and KES per state)", "Retention held and outstanding", "Advance payments outstanding", "Burn rate with labeled scale", "Project selector dropdown"], perm: "finance.view", tourStep: { role: "qs", stepIndex: 6 }, roles: ["qs", "financier", "project_manager", "engineer"] },
      { name: "IPC Generation", path: "/app/projects", description: "Generate Interim Payment Certificates with full breakdown: previous certified, work done, variations, advance recovery, retention.", features: ["Previous certified amount input", "Work done this period", "Approved variations and adjustments", "Provisional sum adjustments", "Contingency drawdowns", "Advance recovery calculation", "Retention auto-calculation", "Live preview panel", "BoQ snapshot"], perm: "finance.certificate.issue", tourStep: { role: "qs", stepIndex: 10 }, roles: ["qs"] },
      { name: "BoQ Cost States", path: "/app/projects", description: "Manage the cost state machine: Budgeted → Ascertained → Committed → Certified → Paid. Single and bulk transitions.", features: ["State summary cards with counts and amounts", "Section-grouped BoQ table", "Single-item state transition", "Bulk state transitions", "Inline certified amount editing", "Color-coded state badges", "Full audit trail"], perm: "finance.view", tourStep: { role: "qs", stepIndex: 18 }, roles: ["qs"] },
      { name: "Variations", path: "/app/projects", description: "Create and approve variation orders. Tracks additions, omissions, PS crystallisation, and administrative items.", features: ["Construction variations", "Provisional sum crystallisation", "Contingency-funded variations", "Administrative items (fees, charges, overheads)", "Approval workflow", "Revised budget updates"], perm: "finance.view", tourStep: { role: "qs", stepIndex: 23 }, roles: ["qs", "project_manager"] },
      { name: "Provisional Sums", path: "/app/projects", description: "Track provisional sum allowances with progressive ascertainment and variance tracking.", features: ["PS allowance recording", "Scope assumptions", "Progressive ascertainment", "Variance tracking against original allowance", "Exposure and risk indicators"], perm: "finance.view", tourStep: { role: "qs", stepIndex: 26 }, roles: ["qs"] },
      { name: "Contingency", path: "/app/projects", description: "Manage contingency drawdowns with justification and approval requirements.", features: ["Project-level and element-level contingencies", "Controlled drawdown workflow", "Drawdown justification", "Professional approval requirement", "Available vs consumed tracking"], perm: "finance.view", tourStep: { role: "qs", stepIndex: 28 }, roles: ["qs", "project_manager"] },
      { name: "Advance Payments", path: "/app/projects", description: "Track mobilisation advances and automatic recovery from certificates.", features: ["Advance recording (amount, purpose, date, recovery conditions)", "Multiple recovery methods (% of IPC, fixed, milestone, time-based, threshold)", "Recovery balance tracking", "Coverage ratio calculation"], perm: "finance.view", tourStep: { role: "qs", stepIndex: 30 }, roles: ["qs", "financier"] },
      { name: "Consultant Payments", path: "/app/projects", description: "Structured payments to professional consultants (Architects, Engineers, QS, MEP).", features: ["Milestone-based, retainer, or time-based payments", "Approval workflow (single or multi-level)", "Scope change adjustments", "Full reporting and audit-ready export"], perm: "consultant.payments.view", roles: ["qs", "project_manager"] },
    ],
  },
  {
    id: "bim",
    title: "BIM & Drone Integration",
    icon: ScanLine,
    description: "Building Information Models and drone data for independent progress verification.",
    modules: [
      { name: "BIM Models", path: "/app/projects", description: "View BIM models linked to projects. Milestone-BIM mappings with discrepancy alerts.", features: ["BIM model viewer", "Milestone-to-BIM element mapping", "Discrepancy detection (alerts, not auto-rejection)", "Progress visualization against BIM elements"], perm: "bim.view", tourStep: { role: "engineer", stepIndex: 7 }, roles: ["engineer", "project_manager"] },
      { name: "Drone Datasets", path: "/app/projects", description: "Upload and review drone imagery for independent site verification.", features: ["Drone dataset upload", "Key output generation (thumbnails, stills, orthomosaics)", "Hybrid storage (metadata in-system, datasets external)", "Milestone/project linking", "Sales & Marketing read-only access", "Audit trail for all actions"], perm: "drone.view", roles: ["engineer", "project_manager"] },
    ],
  },
  {
    id: "quality",
    title: "Quality Assurance",
    icon: TestTube,
    description: "Quality test results tracking and review for materials and workmanship.",
    modules: [
      { name: "Quality Tests", path: "/app/projects", description: "Review quality test results for materials and workmanship. Linked to specific milestones.", features: ["Test result dashboard", "Material and workmanship tests", "Milestone-linked results", "Pass/fail tracking", "Supporting document attachment"], perm: "quality.view", tourStep: { role: "engineer", stepIndex: 10 }, roles: ["engineer", "project_manager"] },
    ],
  },
  {
    id: "ai",
    title: "AI Assistant",
    icon: Zap,
    description: "Conversational AI helper that answers questions about your projects and data.",
    modules: [
      { name: "AI Assistant", path: "/app/assistant", description: "Ask natural language questions about your projects: status, milestones, tickets, photos, and more.", features: ["Project status queries", "Milestone and ticket summaries", "Photo and evidence counts", "Natural language interface", "Context-aware responses per project"], perm: "site.reporting.view", tourStep: { role: "clerk_of_works", stepIndex: 21 }, roles: ["all"] },
    ],
  },
  {
    id: "store",
    title: "Store & Procurement",
    icon: BarChart3,
    description: "Procurement catalog with items, pricing, and purchase orders.",
    modules: [
      { name: "Store", path: "/app/store", description: "Browse the procurement catalog. Manage items, pricing, and purchase orders.", features: ["Item catalog with pricing", "Purchase order management", "Supplier tracking", "Inventory overview"], perm: "store.view", tourStep: { role: "contractor", stepIndex: 8 }, roles: ["contractor", "admin"] },
    ],
  },
  {
    id: "notices",
    title: "Communication & Notices",
    icon: Megaphone,
    description: "System announcements, site instructions, and safety alerts.",
    modules: [
      { name: "Notices", path: "/app/notices", description: "View system-wide announcements, site instructions, and safety alerts posted by administrators.", features: ["System announcements", "Site instructions", "Safety alerts", "Policy updates"], perm: "communication.view", tourStep: { role: "clerk_of_works", stepIndex: 23 }, roles: ["all"] },
    ],
  },
  {
    id: "sales",
    title: "Sales & Off-Plan Developments",
    icon: Coins,
    description: "Buyer management, off-plan unit allocations, installment schedules, agent commissions, and buyer self-service portal.",
    modules: [
      {
        name: "Off-Plan Unit Sales & KYC",
        path: "/app/sales",
        description: "Capture prospective buyers, configure sales prices, reserve units, and issue formal reservation agreements.",
        features: [
          "Prospective buyer directory with KYC identity verification",
          "Unit reservation workflow with expiry lock timers",
          "Automatic generation of offer letters & purchase agreements",
          "Support for individual, joint, and corporate buyers"
        ],
        perm: "sales.view",
        roles: ["property_manager", "admin", "all"]
      },
      {
        name: "Installment Schedules & Collections",
        path: "/app/sales",
        description: "Automated payment plans based on calendar schedules or construction milestone completions.",
        features: [
          "Milestone-linked and calendar-based installment schedules",
          "Automated payment reminders and arrears escalation",
          "Buyer statement of accounts with payment receipts",
          "Integrated M-Pesa, bank wire, and RTGS payment recording"
        ],
        perm: "sales.view",
        roles: ["property_manager", "property_accountant", "admin", "all"]
      },
      {
        name: "Sales Agent Commissions",
        path: "/app/sales",
        description: "Calculate and disburse tiered commissions for internal sales reps and external agency brokers.",
        features: [
          "Configurable percentage rates per project or agent agreement",
          "Trigger payouts upon down payment or milestone qualification",
          "Multi-tier approval workflow for agent disbursements",
          "Tax deduction and withholding tax audit trails"
        ],
        perm: "sales.manage",
        roles: ["property_manager", "property_accountant", "admin"]
      },
      {
        name: "Buyer Self-Service Portal",
        path: "/pay",
        description: "Dedicated client-facing portal for buyers to review their purchase balances and upload proof of payments.",
        features: [
          "Client login with PIN and mobile OTP verification",
          "Instant statement and milestone progress overview",
          "Live photo timeline of property development progress",
          "Direct receipt downloads and customer support messaging"
        ],
        perm: "sales.view",
        roles: ["property_manager", "admin", "all"]
      },
    ],
  },
  {
    id: "tenders",
    title: "Tenders & Bid Management",
    icon: Scale,
    description: "End-to-end tender lifecycle from RFP intake and criteria evaluation to gate reviews and formal proposal submission.",
    modules: [
      {
        name: "Tender Opportunity Pipeline",
        path: "/app/tenders",
        description: "Track upcoming public and private tenders with submission deadlines, bonds, and tender requirements.",
        features: [
          "Tender intake with client, sector, budget, and bid bond values",
          "Mandatory criteria checklist & compliance matrix",
          "Bid/No-Bid decision gate workflow with risk assessment",
          "Calendar timeline and countdown to submission deadlines"
        ],
        perm: "tenders.view",
        roles: ["project_manager", "qs", "admin", "all"]
      },
      {
        name: "Proposal Assembly & Gate Reviews",
        path: "/app/tenders",
        description: "Collaborative drafting of technical and financial proposals with multi-stage governance signoffs.",
        features: [
          "Section assignment to QS, engineers, and financial teams",
          "Gate 1 (Opportunity), Gate 2 (Pricing), and Gate 3 (Final Signoff)",
          "Consensus scoring and executive management approval",
          "Compiled digital submission packages with tamper-evident audit logs"
        ],
        perm: "tenders.manage",
        roles: ["project_manager", "qs", "admin"]
      },
    ],
  },
  {
    id: "valuations",
    title: "Valuations & Advisory",
    icon: ScanLine,
    description: "Professional property valuations, field inspection capture, market comparables, and certified valuation reports.",
    modules: [
      {
        name: "Valuation Instructions",
        path: "/app/valuations",
        description: "Log instructions from banks, corporations, and private clients with formal surveyor dispatch.",
        features: [
          "Client engagement intake with loan/mortgage references",
          "Property identification, title deed, and survey map linking",
          "Valuer site visit scheduling and surveyor assignment",
          "Fee quotations, retainer billing, and invoice tracking"
        ],
        perm: "valuations.view",
        roles: ["property_manager", "qs", "admin", "all"]
      },
      {
        name: "Inspections, Evidence & Reports",
        path: "/app/valuations",
        description: "Record physical field observations, link market comparable transactions, and generate certified reports.",
        features: [
          "Structural condition assessment and building measurements",
          "Comparable sales & rental transaction database",
          "Automated replacement cost and market value computation",
          "Digitally stamped and sealed valuation certificate export"
        ],
        perm: "valuations.manage",
        roles: ["property_manager", "qs", "admin"]
      },
    ],
  },
  {
    id: "companion",
    title: "Companion Operational AI",
    icon: Sparkles,
    description: "Intelligent daily nudges, field task dispatch, team performance metrics, and cross-departmental operations.",
    modules: [
      {
        name: "Daily Workload Nudges",
        path: "/app/companion",
        description: "Contextual morning briefings, workload task summaries, and operational reminders tailored to each staff member.",
        features: [
          "Role-based task prioritization based on due dates and urgency",
          "Automated quiet mode when operating with zero pending tasks",
          "Company leadership broadcast campaigns & operational notices",
          "Customizable card features with one-click user preferences"
        ],
        perm: "companion.view",
        roles: ["all"]
      },
      {
        name: "Team Tasks & Feedback Hub",
        path: "/app/companion",
        description: "Operational task delegation across maintenance, leasing, and site teams with SLA performance monitoring.",
        features: [
          "Task assignment with priority badges and location tagging",
          "Real-time status tracking (Pending → In Progress → Done)",
          "Threaded communication and resolution notes",
          "Team workload distribution analytics"
        ],
        perm: "companion.view",
        roles: ["all"]
      },
    ],
  },
  {
    id: "admin",
    title: "Administration",
    icon: SlidersHorizontal,
    description: "User management, roles, tenants, and system configuration.",
    modules: [
      { name: "User Management", path: "/app/users", description: "Create and manage user accounts. Assign roles, invite to tenants, edit profiles, and disable accounts.", features: ["User creation with role assignment", "Multi-role support", "Email invitations", "Tenant assignment", "Account enable/disable"], perm: "users.view", tourStep: { role: "admin", stepIndex: 2 }, roles: ["admin"] },
      { name: "Role Management", path: "/app/roles", description: "Create custom roles with granular permissions. 44+ permissions across all modules.", features: ["Custom role creation", "44+ granular permissions", "Role presets for quick setup", "Permission format: module.action"], perm: "roles.manage", tourStep: { role: "admin", stepIndex: 5 }, roles: ["admin"] },
      { name: "Tenant Management", path: "/app/tenants", description: "Create and configure tenant organizations with branding and settings.", features: ["Tenant creation", "Branding configuration (logo, primary color, company name)", "SSO settings", "Tenant-level isolation"], perm: "tenants.view", tourStep: { role: "admin", stepIndex: 8 }, roles: ["admin"] },
      { name: "System Settings", path: "/app/settings", description: "Configure SMTP email settings for notifications and invitations.", features: ["SMTP configuration (host, port, username, password)", "Test email delivery", "Notification system configuration"], perm: "settings.manage", tourStep: { role: "admin", stepIndex: 11 }, roles: ["admin"] },
      { name: "Audit Trail", path: "/app/audit-log", description: "Comprehensive audit log of admin actions and system events across all modules.", features: ["Category filtering (system, users, tenants, permissions, data, financial, certificates, exports)", "Outcome filtering (success, error, blocked, partial)", "Full-text search on actions and details", "Pagination with 50-entry pages", "IP address and user agent tracking", "Before/after state snapshots"], perm: "audit.view", roles: ["admin"] },
    ],
  },
  {
    id: "mobile",
    title: "Mobile App (Clerk of Works)",
    icon: Camera,
    description: "Field capture app for on-site progress recording, evidence capture, and daily logs.",
    modules: [
      { name: "Mobile Projects", path: undefined, description: "View assigned projects on your mobile device. Tap to select and access project-specific modules.", features: ["Assigned project list", "Offline-cached project data", "Project status and progress summary", "Filter by site/work area"], roles: ["clerk_of_works"] },
      { name: "Mobile Milestones", path: undefined, description: "Record progress per milestone with status, percentage, evidence photos, and observations.", features: ["Progress slider (0-100%)", "Regression control (justification required for decrease)", "Artificial inflation detection (>40% jump alert)", "Status auto-update (100% = Completed)", "Verification questions (drawings, defects)"], roles: ["clerk_of_works"] },
      { name: "Mobile Evidence Capture", path: undefined, description: "Capture photos and videos with automatic GPS tagging and geofence classification.", features: ["Camera capture (no gallery import)", "Auto GPS tagging and timestamp", "Geofence classification (on-site/off-site/unknown)", "Background multipart upload with progress"], roles: ["clerk_of_works"] },
      { name: "Mobile Observations", path: undefined, description: "Add text observations with issue flagging (Note / Issue / Urgent).", features: ["Short text observations", "Issue/Urgent flagging", "Visual badge coloring", "Dashboard visibility for flagged issues"], roles: ["clerk_of_works"] },
      { name: "Mobile Submission", path: undefined, description: "Sign and submit milestone progress with Ed25519 cryptographic seal.", features: ["Biometric-gated Ed25519 signing", "Integrity hash computation", "Submission seal with device verification", "Offline save with auto-sync"], roles: ["clerk_of_works"] },
      { name: "Mobile Daily Log", path: undefined, description: "Complete site diary with weather, materials, labour, plant, visitors, and H&S tabs.", features: ["Weather logging (AM/PM/rainfall)", "Materials delivery with receipt photos", "Labour deployment adequacy", "Plant & equipment status", "Visitor logging", "H&S incident recording"], roles: ["clerk_of_works"] },
      { name: "Mobile Reports", path: undefined, description: "View S-curves, submission counts, and open issues on mobile.", features: ["S-curve progress charts", "Weekly submission summary", "Open issues overview", "Report export"], roles: ["clerk_of_works"] },
    ],
  },
];

function moduleIcon(name: string) {
  const icons: Record<string, any> = {
    "Role Dashboard": LayoutDashboard,
    "Executive Dashboard": LayoutDashboard,
    "Projects Register": Building2,
    "Project Onboarding": Building2,
    "Daily Logs": ClipboardList,
    "Site Records": FileText,
    "Photo Timeline": Images,
    "Tickets": Ticket,
    "Issues Dashboard": AlertTriangle,
    "Verification Dashboard": ShieldCheck,
    "Reports": FileText,
    "Finance Hub": Wallet,
    "Cost Dashboard": BarChart3,
    "IPC Generation": Coins,
    "BoQ Cost States": Coins,
    "Variations": GitCompareArrows,
    "Provisional Sums": Scale,
    "Contingency": Umbrella,
    "Advance Payments": HandCoins,
    "Consultant Payments": Wallet,
    "BIM Models": Building2,
    "Drone Datasets": ScanLine,
    "Quality Tests": TestTube,
    "AI Assistant": Zap,
    "Store": BarChart3,
    "Notices": Megaphone,
    "Off-Plan Unit Sales & KYC": Coins,
    "Installment Schedules & Collections": Coins,
    "Sales Agent Commissions": Wallet,
    "Buyer Self-Service Portal": Users,
    "Tender Opportunity Pipeline": Scale,
    "Proposal Assembly & Gate Reviews": FileSpreadsheet,
    "Valuation Instructions": ScanLine,
    "Inspections, Evidence & Reports": FileText,
    "Daily Workload Nudges": Sparkles,
    "Team Tasks & Feedback Hub": CheckCircle,
    "User Management": Users,
    "Role Management": ShieldHalf,
    "Tenant Management": Building2,
    "System Settings": Settings,
    "Mobile Projects": HardHat,
    "Mobile Milestones": CheckCircle,
    "Mobile Evidence Capture": Camera,
    "Mobile Observations": BookOpen,
    "Mobile Submission": ShieldCheck,
    "Mobile Daily Log": ClipboardList,
    "Mobile Reports": FileText,
  };
  const Icon = icons[name];
  return Icon ? <Icon size={18} /> : <HelpCircle size={18} />;
}

export function Documentation() {
  const { me, can } = useAuth();
  const userRole = me?.roles?.[0] || "all";
  const tour = useOutletContext<TourAPI>();
  const [activeSection, setActiveSection] = useState<string>("property-mgmt");
  const [activeRole, setActiveRole] = useState<string>(userRole);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const roleLabel = ROLES.find((r) => r.key === activeRole)?.label || "All Roles";

  const roleFilteredSections = useMemo(() => {
    return DOC_SECTIONS.map((section) => ({
      ...section,
      modules: section.modules.filter((m) => activeRole === "all" || m.roles.includes("all") || m.roles.includes(activeRole)),
    })).filter((s) => s.modules.length > 0);
  }, [activeRole]);

  const q = searchQuery.toLowerCase().trim();
  const visibleSections = useMemo(() => {
    if (!q) return roleFilteredSections;
    return roleFilteredSections.map((section) => ({
      ...section,
      modules: section.modules.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.features.some((f) => f.toLowerCase().includes(q))
      ),
    })).filter((s) => s.modules.length > 0);
  }, [roleFilteredSections, q]);

  function handleStartTour(stepIndex: number) {
    if (tour?.startFromStep) {
      tour.startFromStep(stepIndex);
    } else {
      window.location.assign("/app");
    }
  }

  const totalMatchingModules = visibleSections.reduce((acc, s) => acc + s.modules.length, 0);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 12px" }}>
      <style>{`
        @media (max-width: 820px) {
          .doc-main-layout { flex-direction: column !important; }
          .doc-sidebar-col { width: 100% !important; }
          .doc-sidebar-card { position: static !important; margin-bottom: 12px; }
          .doc-sidebar-buttons {
            display: flex !important;
            overflow-x: auto !important;
            white-space: nowrap !important;
            gap: 8px !important;
            padding-bottom: 6px !important;
            -webkit-overflow-scrolling: touch;
          }
          .doc-sidebar-buttons button {
            flex-shrink: 0 !important;
            width: auto !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div className="eyebrow">Documentation</div>
        <h2>System Documentation & User Guides</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Comprehensive operating guides across all modules. Search any workflow, filter by role, or read the downloadable guide.
        </p>
      </div>

      {/* Official PDF User Guide Banner */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
          color: "#FFFFFF",
          padding: "22px 24px",
          borderRadius: "14px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "18px",
          flexWrap: "wrap",
          boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.25)",
        }}
      >
        <div style={{ maxWidth: 660 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                background: "rgba(255,255,255,0.2)",
                padding: "2px 8px",
                borderRadius: 4,
                textTransform: "uppercase",
              }}
            >
              Official Guide
            </span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>Release 2026.1 Enterprise</span>
          </div>
          <h3 style={{ margin: "0 0 6px", color: "#FFFFFF", fontSize: 20, fontWeight: 800 }}>
            Center Estates ERP — User & Operational Guide (PDF)
          </h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "#E0E7FF", lineHeight: 1.55 }}>
            Complete downloadable operational manual for Property Managers, Accountants, and Administrators. Covers multi-estate scoping, unit readiness, tenant leases, utility billing, rent invoicing, and maintenance workflows.
          </p>
        </div>
        <div>
          <a
            href="/guides/Center_Estates_User_Guide.pdf"
            download="Center_Estates_User_Guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              background: "#FFFFFF",
              color: "#1E3A8A",
              fontWeight: 800,
              fontSize: 13.5,
              padding: "11px 22px",
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
            }}
          >
            <FileText size={18} />
            Download PDF Guide
          </a>
        </div>
      </div>

      {/* Search & Role Filter Header */}
      <div className="card" style={{ padding: 18, marginBottom: 20, borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search documentation, modules, features, or workflows…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 42px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}
              >
                Clear
              </button>
            )}
          </div>
          {searchQuery && (
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
              Found {totalMatchingModules} matching module{totalMatchingModules === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 8, textTransform: "uppercase" }}>
          Filter by Role
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {ROLES.map((role) => (
            <button
              key={role.key}
              className={`btn sm ${activeRole === role.key ? "primary" : "ghost"}`}
              onClick={() => { setActiveRole(role.key); }}
              style={{ borderRadius: 6, fontWeight: activeRole === role.key ? 700 : 500 }}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      <div className="doc-main-layout" style={{ display: "flex", gap: 20 }}>
        {/* Sidebar Quick Nav (Hidden when searching so all results stream cleanly) */}
        {!q && (
          <div className="doc-sidebar-col" style={{ width: 250, flexShrink: 0 }}>
            <div className="card doc-sidebar-card" style={{ padding: 12, position: "sticky", top: 20, borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: "var(--muted)", marginBottom: 10, textTransform: "uppercase" }}>
                {roleLabel} — Quick Nav
              </div>
              <div className="doc-sidebar-buttons">
                {visibleSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className="doc-nav-btn"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "9px 12px",
                      border: "none",
                      borderRadius: 8,
                      background: activeSection === section.id ? "var(--accent)" : "transparent",
                      color: activeSection === section.id ? "#fff" : "var(--text)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: activeSection === section.id ? 700 : 500,
                      textAlign: "left",
                      marginBottom: 3,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <section.icon size={16} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{section.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {visibleSections.length === 0 ? (
            <div className="card" style={{ padding: 36, textAlign: "center", borderRadius: 12 }}>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: 15 }}>
                No modules found matching &ldquo;{searchQuery}&rdquo; for {roleLabel}.
              </p>
              <button
                className="btn sm ghost"
                onClick={() => { setSearchQuery(""); setActiveRole("all"); }}
                style={{ marginTop: 12 }}
              >
                Reset Search and Role Filters
              </button>
            </div>
          ) : (
            visibleSections.map((section) => (
              <div
                key={section.id}
                style={{
                  display: q || activeSection === section.id ? "block" : "none",
                  marginBottom: q ? 28 : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <section.icon size={24} style={{ color: "var(--accent)" }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{section.title}</h3>
                    <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>{section.description}</p>
                  </div>
                </div>

                {section.modules.map((mod) => {
                  const hasAccess = !mod.perm || can(mod.perm);
                  const Icon = moduleIcon(mod.name);

                  return (
                    <div key={mod.name} className="card" style={{ padding: 20, marginBottom: 16, borderRadius: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
                            {Icon}
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                              {mod.name}
                              {!hasAccess && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>(no access)</span>}
                            </h4>
                            {mod.path && hasAccess && (
                              <Link to={mod.path} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                <ExternalLink size={12} /> {mod.path}
                              </Link>
                            )}
                            {!mod.path && (
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>Mobile app feature</span>
                            )}
                          </div>
                        </div>
                        {mod.tourStep && (mod.tourStep.role === activeRole || activeRole === "all") && (
                          <button
                            className="btn sm ghost"
                            onClick={() => handleStartTour(mod.tourStep!.stepIndex)}
                            style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, borderRadius: 6 }}
                          >
                            <MapPin size={14} /> Start Tour
                          </button>
                        )}
                      </div>

                      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, marginBottom: 12 }}>{mod.description}</p>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                        {mod.features.map((f, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-2)" }}>
                            <CheckCircle size={13} style={{ color: "var(--success)", flexShrink: 0 }} />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
