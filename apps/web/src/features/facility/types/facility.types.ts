export type FacilityTab =
  | "overview"
  | "buildings"
  | "assets"
  | "work-orders"
  | "work-order-events"
  | "work-order-cost-items"
  | "work-order-attachments"
  | "planned-maintenance"
  | "inspections"
  | "service-requests"
  | "meters"
  | "contractors"
  | "reports"
  | "expenditure"
  | "spare-parts"
  | "consumables"
  | "tickets"
  | "calendar";

export type ID = string | number;

export type Row = Record<string, string | number | boolean | null | undefined | unknown>;

export type ActionModal =
  | { type: "inspection" | "resolve"; row: Row }
  | { type: "request-decision"; row: Row; decision: "approve" | "reject" }
  | null;

export type FacilityDashboard = {
  kpis: Record<string, string | number>;
  recentWorkOrders: Row[];
  urgentWorkOrders: Row[];
  requestSummary: { status: string; count: number }[];
  assetCategories: { category: string; count: number }[];
  dueMaintenance: Row[];
};

export const facilityLabels: Record<FacilityTab, string> = {
  overview: "Dashboard",
  buildings: "Buildings & Locations",
  assets: "Assets & Inventory",
  "work-orders": "Work Orders",
  "work-order-events": "Work History",
  "work-order-cost-items": "Labor & Parts",
  "work-order-attachments": "Work Media",
  "planned-maintenance": "Planned Maintenance",
  inspections: "Inspections",
  "service-requests": "Service Requests",
  meters: "Utility Management",
  contractors: "Contractors",
  reports: "Reports & BI",
  expenditure: "Expenditure & Floats",
  "spare-parts": "Spare Parts",
  consumables: "Consumables",
  tickets: "Tickets & Issues",
  calendar: "Calendar",
};
