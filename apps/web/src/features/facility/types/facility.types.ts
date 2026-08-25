export type FacilityTab =
  | "overview"
  | "strategic-plans"
  | "buildings"
  | "assets"
  | "planned-maintenance"
  | "work-orders"
  | "requisitions"
  | "work-order-events"
  | "work-order-cost-items"
  | "work-order-attachments"
  | "contractors"
  | "service-providers"
  | "budgets"
  | "compliance"
  | "risks"
  | "inspections"
  | "service-requests"
  | "service-profiles"
  | "incidents"
  | "meters"
  | "reports"
  | "operations-reports"
  | "asset-reports"
  | "compliance-reports"
  | "energy-reports"
  | "expenditure"
  | "supplier-invoices"
  | "spare-parts"
  | "consumables"
  | "tickets"
  | "calendar";

export type ID = string | number;

export type Row = Record<string, string | number | boolean | null | undefined | unknown>;

export type ActionModal =
  | { type: "inspection" | "resolve"; row: Row }
  | { type: "request-decision"; row: Row; decision: "approve" | "reject" }
  | { type: "condition-assessment"; row: Row }
  | { type: "lifecycle-analysis"; row: Row }
  | { type: "scorecard"; row: Row }
  | { type: "plan-performance"; row: Row }
  | null;

export type FacilityDashboard = {
  kpis: Record<string, string | number>;
  recentWorkOrders: Row[];
  urgentWorkOrders: Row[];
  requestSummary: { status: string; count: number }[];
  assetCategories: { category: string; count: number }[];
  dueMaintenance: Row[];
};

export type ManagerCommandCenterData = {
  portfolio_summary: {
    properties_count: number;
    buildings_count: number;
    assets_count: number;
    active_contracts_count: number;
  };
  today_work_orders: {
    today_created: number;
    active_total: number;
    overdue_escalations: number;
  };
  pm_compliance: {
    compliance_percent: number;
    due_now_count: number;
    total_schedules: number;
  };
  critical_asset_health: {
    critical_total: number;
    critical_down: number;
    uptime_percent: number;
  };
  budget_control: {
    allocated: number;
    spent_and_committed: number;
    utilization_percent: number;
  };
  risk_and_compliance: {
    high_risks_count: number;
    overdue_compliance_count: number;
    expiring_contracts_count: number;
  };
  active_flags: Row[];
  urgent_escalations: Row[];
  top_recurring_faults: { category: string; count: number }[];
  due_maintenance_tasks: Row[];
};

export type ClientExecutiveSummaryData = {
  fm_score: number;
  fm_grade: string;
  service_kpis: {
    sla_achievement: number;
    total_requests_handled: number;
    major_incidents: number;
  };
  maintenance_kpis: {
    pm_compliance: number;
    active_assets_monitored: number;
    critical_uptime: number;
  };
  cost_and_budget: {
    annual_budget_allocated: number;
    actual_and_committed_spend: number;
    budget_utilization_percent: number;
    estimated_annual_savings: number;
  };
  compliance_and_governance: {
    statutory_compliance_rate: number;
    active_obligations: number;
    high_risk_exceptions: number;
  };
  utility_performance: {
    total_electricity_kwh: number;
    total_water_m3: number;
    total_utility_cost: number;
  };
  strategic_recommendations: {
    priority: string;
    title: string;
    impact: string;
    action: string;
    capex_estimate: string;
  }[];
};

export const facilityLabels: Record<FacilityTab, string> = {
  overview: "Command Centre & Client View",
  "strategic-plans": "Strategic FM Plans",
  buildings: "Buildings, Areas & Floor Plans",
  assets: "Asset Master & Lifecycle",
  "planned-maintenance": "Planned Maintenance",
  "work-orders": "Work Orders & Helpdesk",
  requisitions: "Repair Requisitions",
  "work-order-events": "Work History",
  "work-order-cost-items": "Labor & Parts",
  "work-order-attachments": "Work Media",
  contractors: "Service Providers & Scorecards",
  "service-providers": "Service Providers",
  budgets: "FM Budget & Commitments",
  compliance: "Statutory Compliance Register",
  risks: "Risk Register & Mitigations",
  inspections: "Inspections & Audits",
  "service-requests": "Service Requests",
  "service-profiles": "Service Profiles",
  incidents: "Incident Reporting",
  meters: "Energy & Utilities",
  reports: "Executive FM Reports",
  "operations-reports": "Work Orders & SLA",
  "asset-reports": "Asset Lifecycle & CAPEX",
  "compliance-reports": "Statutory & Compliance",
  "energy-reports": "Energy & Utilities",
  expenditure: "Expenditure & Floats",
  "supplier-invoices": "Supplier Invoices",
  "spare-parts": "Spare Parts",
  consumables: "Consumables",
  tickets: "Tickets & Issues",
  calendar: "Calendar",
};
