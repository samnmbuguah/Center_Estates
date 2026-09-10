export type PropertyTab =
  | "overview"
  | "properties"
  | "buildings"
  | "feedback-qr"
  | "units"
  | "owners"
  | "projects"
  | "tenancy"
  | "tenants"
  | "tenant-documents"
  | "leases"
  | "financials"
  | "billing"
  | "receipting"
  | "rent-schedules"
  | "rent"
  | "arrears"
  | "reminders"
  | "receipts"
  | "receipt-allocations"
  | "bank-reconciliation"
  | "credit-notes"
  | "payments"
  | "service-profiles"
  | "handover-exit"
  | "service-charges"
  | "service-charge-allocations"
  | "service-charge-reconciliations"
  | "budgets"
  | "expenses"
  | "reports"
  | "tenancy-reports"
  | "financial-reports"
  | "fees"
  | "owner-portal"
  | "forecast"
  | "critical-dates"
  | "module-access"
  | "tickets"
  | "calendar";

export type Row = Record<string, unknown>;
export type ID = string;

export const labels: Record<PropertyTab, string> = {
  overview: "Overview",
  properties: "Properties",
  buildings: "Buildings",
  "feedback-qr": "Concierge QR Codes",
  units: "Occupancy",
  owners: "Unit Landlords & Owners",
  projects: "Projects",
  tenancy: "Tenancy",
  tenants: "Tenants",
  "tenant-documents": "Tenant Documents",
  leases: "Leases",
  financials: "Financials",
  billing: "Billing & Invoices",
  receipting: "Receipting",
  "rent-schedules": "Rent Schedules",
  rent: "Invoice Register",
  arrears: "Arrears & Recovery",
  reminders: "Reminders",
  receipts: "Receipts & Credit Notes",
  "receipt-allocations": "Receipt Allocations",
  "bank-reconciliation": "Bank Reconciliation",
  "credit-notes": "Credit Notes",
  payments: "Payments & Credits",
  "service-profiles": "Service Profiles",
  "handover-exit": "Handover & Exit",
  "service-charges": "Service Charge Setup",
  "service-charge-allocations": "Charge Allocations",
  "service-charge-reconciliations": "Reconciliations",
  budgets: "Budgets & Estimates",
  expenses: "Property Expenses",
  reports: "Reports Catalogue",
  "tenancy-reports": "Tenancy & Occupancy Reports",
  "financial-reports": "Financial Reports",
  fees: "Fee Invoicing",
  "owner-portal": "Owner Portal",
  forecast: "5-Year Forecast",
  "critical-dates": "Critical Dates",
  "module-access": "Module Access",
  tickets: "Tickets & Issues",
  calendar: "Calendar",
};

export interface OwnerRow extends Row {
  id: ID;
  code?: string;
  name?: string;
  email?: string;
  phone?: string;
  id_or_registration_number?: string;
  pin_number?: string;
  settlement_bank_name?: string;
  settlement_bank_account?: string;
  settlement_bank_branch?: string;
  settlement_paybill_or_till?: string;
  notes?: string;
  units_count?: number;
  units_list?: Array<{
    id: string;
    code: string;
    property_id: string;
    property_name: string;
    sectional_title_number?: string;
    management_mandate?: string;
    ownership_share?: string;
    floor?: string;
    area?: string | null;
  }>;
  created_at?: string;
}

export interface PropertyCollectionAccountRow extends Row {
  id: ID;
  property?: ID;
  property_name?: string;
  charge_type?: "rent" | "service_charge" | "water" | "management_fee" | string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  branch?: string;
  mpesa_paybill?: string;
  mpesa_reference_format?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface PropertyFeeProfileRow extends Row {
  id: ID;
  property?: ID;
  property_name?: string;
  fee_type?: "common_area_fee" | "rental_commission" | "letting_fee" | "other" | string;
  calculation_basis?: "fixed" | "percentage" | "area_rate" | string;
  amount?: number;
  percentage_rate?: number;
  billing_frequency?: string;
  billed_to?: "unit_owner" | "tenant" | "manager" | string;
  vat_applicable?: boolean;
  vat_rate?: number;
  effective_from?: string;
  is_active?: boolean;
}

export interface PropertyRow extends Row {
  id: ID; code?: string; name?: string; property_type?: string; status?: string;
  city?: string; address?: string; country?: string; buildings_count?: number;
  units_count?: number; created_at?: string;
  occupied?: number; vacant?: number; occupancy?: number; monthlyRent?: number; outstanding?: number;
  is_sectional_title?: boolean; scheme_registration_number?: string;
  total_blocks?: number; total_units_count?: number;
  estate_manager_name?: string; management_commencement_date?: string;
  created_by?: string; created_by_username?: string; created_by_name?: string;
}

export interface BuildingRow extends Row {
  id: ID; code?: string; name?: string; floors?: number; property?: ID;
  property_name?: string; created_at?: string;
}

export interface UnitRow extends Row {
  id: ID; code?: string; property?: ID; building?: ID; floor?: string;
  unit_type?: string; status?: string; area?: number | null; property_name?: string;
  building_name?: string; created_at?: string;
  owner?: ID | null; owner_name?: string; owner_code?: string;
  sectional_title_number?: string; ownership_share?: number | string;
  management_mandate?: "common_area_only" | "rental_management" | "both" | "none" | string;
  service_charge_payer?: "owner" | "tenant" | string;
  water_payer?: "owner" | "tenant" | string;
  rental_commission_rate?: number | string;
  common_area_fee_amount?: number | string;
  letting_fee_amount?: number | string;
  tenant_name?: string;
  tenant_code?: string;
  lease_reference?: string;
  rent_collection_mode?: "estate_managed" | "direct_landlord" | "none" | string;
  effective_rent?: number | string;
  occupancy_state?: string;
  occupancy_state_display?: string;
  billing_isolation?: {
    bill_rent?: boolean;
    rent_amount?: string;
    rent_collection_mode?: string;
    rent_payer?: string;
    rent_destination?: string;
    bill_service_charge_to_tenant?: boolean;
    service_charge_payer?: string;
    bill_utilities_to_tenant?: boolean;
    utilities_payer?: string;
  };
}

export interface ProjectRow extends Row {
  id: ID; code?: string; name?: string; property?: ID; status?: string;
  starts_on?: string; ends_on?: string; created_at?: string;
}

export interface TenantRow extends Row {
  id: ID; code?: string; name?: string; tenant_type?: string; email?: string;
  phone?: string; tax_id?: string; registration_number?: string; directors?: string[]; status?: string; billing_address?: string;
  created_at?: string;
  property?: string; unit?: string; outstanding?: number; oldest_days?: number;
}

export interface TenantDocumentRow extends Row {
  id: ID; tenant?: ID; document_type?: string; document_number?: string;
  file_url?: string; issued_on?: string; expires_on?: string; status?: string;
  tenant_name?: string; created_at?: string;
}

export interface LeaseRow extends Row {
  id: ID; reference?: string; unit?: ID; tenant?: ID; starts_on?: string; ends_on?: string;
  monthly_rent?: number; deposit?: number; escalation_percent?: number; billing_day?: number;
  escalation_interval_months?: number;
  status?: string; tenant_name?: string; unit_code?: string; property_name?: string;
  created_at?: string; outstanding?: number;
}

export interface RentScheduleRow extends Row {
  id: ID; lease?: ID; period_start?: string; period_end?: string; due_on?: string;
  base_rent?: number; escalation_amount?: number; service_charge?: number; total?: number;
  status?: string; invoice?: ID; lease_reference?: string; tenant_name?: string;
}

export interface InvoiceRow extends Row {
  id: ID; number?: string; lease?: ID; invoice_type?: string; issued_on?: string;
  due_on?: string; subtotal?: number; tax_rate?: number; tax_amount?: number; amount?: number; balance?: number; status?: string;
  tenant_name?: string; tenant_id?: ID; prepared_by?: ID; reviewed_by?: ID; reviewed_at?: string;
  issued_by?: ID; issued_at?: string;
  recipient_type?: "tenant" | "owner" | string;
  owner?: ID | null; owner_name?: string; owner_id?: ID | null;
  unit?: ID | null; unit_code?: string; property_name?: string;
  charge_type?: string; mpesa_reference?: string;
  collection_account_details?: PropertyCollectionAccountRow;
}

export interface InvoicePreview {
  lease: ID; tenant: string; property: string; unit: string; invoice_type: string;
  subtotal: number; tax_rate: number; tax_amount: number; total: number; due_on?: string;
}

export interface ReceiptRow extends Row {
  id: ID; number?: string; tenant?: ID; invoice?: ID | null; received_on?: string;
  amount?: number; payment_method?: string; external_reference?: string;
  tenant_name?: string; created_at?: string;
}

export interface ReminderRow extends Row {
  id: ID; invoice?: ID; channel?: string; recipient?: string; message?: string;
  sent_at?: string; invoice_number?: string; tenant_name?: string;
}

export interface BankTransactionRow extends Row {
  id: ID; reference?: string; transacted_on?: string; description?: string;
  amount?: number; money_in?: number; money_out?: number; transaction_type?: string;
  extracted_mpesa_ref?: string; extracted_account?: string; extracted_payer_name?: string;
  extracted_phone?: string; raw_details?: string; balance_after?: number;
  status?: string; receipt?: ID; receipt_number?: string; receipt_payer?: string;
  receipt_tenant?: string; receipt_unit?: string; receipt_invoice_number?: string;
}

export interface ExpenseRow extends Row {
  id: ID; property?: ID; supplier?: string; category?: string; invoice_number?: string;
  incurred_on?: string; amount?: number; status?: string; description?: string;
  property_name?: string;
}

export interface BudgetRow extends Row {
  id: ID; property?: ID; year?: number; category?: string; amount?: number;
  status?: string; property_name?: string; actual_amount?: number; variance?: number;
  created_at?: string;
}

export interface ServiceChargeRow extends Row {
  id: ID; property?: ID; name?: string; method?: string; annual_budget?: number;
  starts_on?: string; is_active?: boolean; property_name?: string; allocation_count?: number;
}

export interface ServiceChargeAllocationRow extends Row {
  id: ID; service_charge?: ID; unit?: ID; ratio?: number; annual_amount?: number;
  monthly_amount?: number; service_charge_name?: string; property_name?: string;
  unit_code?: string; created_at?: string;
}

export interface ServiceChargeReconciliationRow extends Row {
  id: ID; service_charge?: ID; period_start?: string; period_end?: string;
  budgeted_amount?: number; actual_amount?: number; variance?: number; status?: string;
  service_charge_name?: string; property_name?: string;
}

export interface ReceiptAllocationRow extends Row {
  id: ID; receipt?: ID; invoice?: ID; amount?: number; receipt_number?: string;
  invoice_number?: string; tenant_name?: string; created_at?: string;
}

export interface CreditNoteRow extends Row {
  id: ID; number?: string; invoice?: ID; issued_on?: string; amount?: number;
  reason?: string; status?: string; void_reason?: string; invoice_number?: string;
  tenant_name?: string;
}

export interface AgingTenantRow {
  tenant?: string; property?: string; unit?: string; outstanding?: number;
  oldest_days?: number; invoice_count?: number;
}

export interface AgingAnalytics {
  as_of?: string; total?: number;
  summary?: Record<string, number>;
  tenants?: AgingTenantRow[];
}

export interface FinancialAnalytics {
  period?: { start: string; end: string };
  kpis?: { income: number; expenses: number; net: number };
  incomeByMethod?: { payment_method: string; total: number }[];
  expensesByCategory?: { category: string; total: number }[];
}

export interface ReportItem {
  key?: string; name?: string; category?: string; section?: string; description?: string; critical?: boolean;
}

export interface DashboardData {
  kpis?: Record<string, number | string>;
  collectionTrend?: {
    month: string;
    expected: number;
    actual: number;
    /** Backward-compatible aliases returned during the dashboard API transition. */
    billed?: number;
    collected?: number;
  }[];
  leaseExpiry?: { label: string; count: number }[];
  aging?: { label: string; amount: number }[];
  propertySummary?: PropertyRow | null;
  portfolio?: PropertyRow[];
  overdueInvoices?: InvoiceRow[];
  propertyMix?: { property_type: string; count: number }[];
}

export type RentSection = "invoices" | "receipts" | "arrears" | "reminders" | "ledger";
export type ScSection = "setup" | "allocations" | "reconciliations" | "budget";
export type TenancySection = "occupancy" | "tenants" | "leases" | "documents";
export type FinancialsSection = "schedules" | "invoices" | "receipts" | "allocations" | "reconciliation" | "credit-notes";
export type BillingSection = "pipeline" | "invoices" | "landlord-billing" | "credit-notes";
export type ReceiptingSection = "receipts" | "allocations" | "credit-notes" | "schedules";

export interface BillingContext {
  mode: "monthly" | "quarterly" | "custom" | string;
  period_start: string;
  period_end: string;
  months_count: number;
  label: string;
}
