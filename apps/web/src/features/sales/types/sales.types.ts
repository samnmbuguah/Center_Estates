export type SalesTab =
  | "overview"
  | "inventory"
  | "buyers"
  | "leads"
  | "sales"
  | "installments"
  | "payments"
  | "site-visits"
  | "commissions"
  | "handover"
  | "performance"
  | "reports"
  | "documents"
  | "audit-events"
  | "tickets"
  | "calendar"
  | "bank-reconciliation";

export type Row = Record<string, unknown>;

export type Dashboard = {
  kpis?: Record<string, unknown>;
  recentSales?: Row[];
  pendingPayments?: Row[];
  inventoryByStatus?: Row[];
  salesByProject?: Row[];
  agentPerformance?: Row[];
  reports?: Row[];
  installmentExposure?: Record<string, unknown>;
};

export type Tone = "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray";

export const salesTabLabels: Record<SalesTab, string> = {
  overview: "Dashboard",
  inventory: "Projects & Units",
  buyers: "Buyers Registry",
  leads: "Leads & Prospects",
  sales: "Sales Pipeline",
  installments: "Installment Schedules",
  payments: "Payments & Verification",
  "site-visits": "Site Visits (Sales Clerk)",
  commissions: "Agent Commissions",
  handover: "Unit Handover",
  performance: "Agent Performance",
  reports: "Sales Reports",
  documents: "Legal Documents",
  "audit-events": "Audit Trail",
  tickets: "Tickets & Issues",
  calendar: "Calendar",
  "bank-reconciliation": "Bank Reconciliation",
};

export const BUYER_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  lead: [{ value: "qualified", label: "Qualify" }, { value: "cancelled", label: "Cancel" }],
  qualified: [{ value: "active", label: "Activate" }, { value: "cancelled", label: "Cancel" }],
  active: [{ value: "completed", label: "Complete" }, { value: "cancelled", label: "Cancel" }],
  completed: [],
  cancelled: [],
};

export const SALE_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  draft: [{ value: "reserved", label: "Reserve unit" }, { value: "cancelled", label: "Cancel" }],
  reserved: [{ value: "contracted", label: "Contract" }, { value: "cancelled", label: "Cancel" }],
  contracted: [{ value: "completed", label: "Complete" }, { value: "cancelled", label: "Cancel" }],
  completed: [],
  cancelled: [],
};
