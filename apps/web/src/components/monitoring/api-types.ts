/**
 * TypeScript interfaces for API response types used in api.ts.
 *
 * Field names follow the camelCase convention used in consuming pages.
 * Types already defined in shared-types are re-exported from there.
 */

// Re-export types already in shared-types
export type {
  QualityTest,
  ConsultantPayment,
  BimModel,
  DroneDataset,
  IgpSafeguard,
  IgpProcurement,
  ProjectModuleConfig,
} from "./shared-types";

// ─── Auth & Identity ─────────────────────────────────────────────────────────

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  is_tenant_admin: boolean;
  branding?: TenantBranding;
}

export interface Me {
  username: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  is_superuser: boolean;
  roles: string[];
  permissions: string[];
  tenants: TenantInfo[];
  tenant_id: string | null;
  must_change_password: boolean;
}

// ─── Plans (public registration) ─────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  code: string;
  location: string;
  stage: string;
  project_type: string;
  contract_type: string;
  description: string;
  client_name: string;
  budget: number | null;
  tender_amount?: number | null;
  modules: string[];
  onboarding_complete: boolean;
  country: string;
  county: string;
  town: string;
  planned_start_date: string | null;
  planned_completion_date: string | null;
  documents: ProjectDocument[];
  approvals: ProjectApproval[];
  members: ProjectMember[];
  // IGP fields
  eia_status: string;
  esmp_exists: boolean;
  sep_exists: boolean;
  grm_contact: string;
  land_acquisition: boolean;
  procurement_method: string;
  procurement_plan_url: string;
  tender_doc_url: string;
  signed_contract_url: string;
  approved_budget: number | null;
  baseline_boq_ref: string;
  safeguards_party: string;
  procurement_oversight: string;
  financial_approval: string;
  audit_role: string;
}

export interface ProjectDocument {
  id: number;
  title: string;
  doc_type: string;
  remote_url: string;
  latest_url: string | null;
  current_version: number;
  discipline: string;
  revision_number: string;
}

export interface ProjectApproval {
  id: number;
  approval_type: string;
  authority: string;
  status: "pending" | "approved" | "rejected" | "expired";
  expired: boolean;
  issue_date: string;
}

export interface ProjectMember {
  id: number;
  username: string;
  email: string;
  role: string;
  role_name: string;
  label: string;
  user_id: string;
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

export interface OnboardingStatus {
  checklist: OnboardingChecklistItem[];
  all_requirements_met: boolean;
  wizard_step: number;
}

export interface OnboardingChecklistItem {
  key: string;
  type: string;
  label: string;
  met: boolean;
}

export interface OnboardingStep1Data {
  name: string;
  client_name: string;
  location: string;
  project_type: string;
  description: string;
  budget?: number;
  modules: string[];
  country: string;
  county: string;
  town: string;
  planned_start_date?: string;
  planned_completion_date?: string;
  eia_status: string;
  esmp_exists: boolean;
  sep_exists: boolean;
  grm_contact: string;
  land_acquisition: boolean;
  procurement_method: string;
  procurement_plan_url: string;
  tender_doc_url: string;
  signed_contract_url: string;
  approved_budget?: number;
  baseline_boq_ref: string;
  safeguards_party: string;
  procurement_oversight: string;
  financial_approval: string;
  audit_role: string;
}

export interface OnboardingStep3Data {
  document?: {
    doc_type: string;
    title: string;
    remote_url: string;
    discipline: string;
    revision_number: string;
  };
  approval?: {
    approval_type: string;
    authority: string;
    status: string;
    issue_date: string;
  };
}

export interface AvailableModule {
  key: string;
  label: string;
  description: string;
}

// ─── Waivers ─────────────────────────────────────────────────────────────────

export interface Waiver {
  id: number;
  requirement_key: string;
  requirement_type: string;
  reason: string;
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_tenant_admin: boolean;
  domain: string | null;
  settings: TenantSettings;
  members: TenantMember[];
}

export interface TenantSettings {
  sso_url: string | null;
  website_sync_enabled: boolean;
  branding?: TenantBranding;
  [key: string]: unknown;
}

export interface TenantBranding {
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_pin?: string;
}

export interface TenantMember {
  user_id: string;
  username: string;
  email: string;
  is_tenant_admin: boolean;
  is_default: boolean;
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  timestamp: number;
  user: string;
  category: string;
  action: string;
  resource: string;
  outcome: "success" | "error" | "blocked" | "partial";
  details: string;
  ip_address: string;
}

export interface AuditLogResponse {
  total: number;
  offset: number;
  limit: number;
  results: AuditLog[];
}

// ─── Documents ───────────────────────────────────────────────────────────────

export interface Document {
  id: number;
  title: string;
  doc_type: string;
  remote_url: string;
  latest_url: string | null;
  current_version: number;
}

// ─── Approvals ───────────────────────────────────────────────────────────────

export interface Approval {
  id: number;
  approval_type: string;
  authority: string;
  status: "pending" | "approved" | "rejected" | "expired";
  expired: boolean;
}

// ─── Milestones & Verification ───────────────────────────────────────────────

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string;
  percent_complete: number;
  status: string;
  milestone_id: string;
}

export interface MilestoneVerification {
  id: string;
  milestone_id: string;
  project_id: string;
  percent_complete: number;
  submitted_at: number;
  evidence_hashes: string[];
  observation_bodies: string[];
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export interface Requisition {
  id: number;
  project_id: string;
  title: string;
  amount: string;
  status: "submitted" | "reviewed" | "approved" | "rejected" | "paid";
  raised_by: string;
}

export interface Certificate {
  id: number;
  project_id: string;
  number: string;
  contractor_name: string;
  cert_type: "interim" | "final";
  amount: string;
  retention_percent: string;
  net_amount: string | null;
  status: "issued" | "void";
  issued_by: string;
}

export interface Disbursement {
  id: number;
  project_id: string;
  certificate_id: number | null;
  amount: string;
  status: "pending" | "paid" | "void";
  managed_by: string;
}

export interface RetentionSummary {
  total_gross: string;
  total_retained: string;
  certificate_count: number;
  certificates: RetentionCertificate[];
}

export interface RetentionCertificate {
  id: number;
  number: string;
  gross: string;
  retention_amount: string;
  net_payable: string;
}

/** IPC Generation Result */
export interface IpcResult {
  certificate_id: number;
  certificate_number: string;
  previous_certified: string;
  work_done_this_period: string;
  variations_additions: string;
  variations_omissions: string;
  ps_adjustments: string;
  contingency_adjustments: string;
  advance_recovery: string;
  retention_deducted: string;
  retention_released: string;
  gross_payable: string;
  deductions_total: string;
  net_payable: string;
  boq_items: BoqItem[];
}

// ─── Construction Cost Management ────────────────────────────────────────────

export interface Variation {
  id: number;
  variation_number: string;
  description: string;
  variation_type: "addition" | "omission" | "administrative";
  target: "boq" | "work_plan";
  quantity: string | null;
  unit: string;
  unit_rate: string | null;
  amount: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  approved_by: string | null;
}

export interface ProvisionalSum {
  id: number;
  item_number: string;
  description: string;
  budgeted_amount: string;
  ascertained_amount: string;
  status: "open" | "ascertained" | "closed";
}

export interface ContingencyDrawdown {
  id: number;
  drawdown_number: string;
  reason: string;
  category: "design_development" | "unforeseen" | "escalation" | "client_instruction" | "other";
  amount: string;
  status: "requested" | "approved" | "rejected";
  approved_by: string | null;
}

export interface AdvancePayment {
  id: number;
  contractor_name: string;
  amount: string;
  recovery_rate: string;
  recovered_amount: string;
  status: "active" | "fully_recovered" | "cancelled";
}

// ─── BoQ Items ───────────────────────────────────────────────────────────────

export interface BoqItem {
  id: number;
  project_id: string;
  item_number: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string;
  cost_state: "budgeted" | "ascertained" | "committed" | "certified" | "paid";
  certified_quantity: string | null;
  certified_amount: string | null;
  section: string;
}

export interface IngestionStatus {
  boq_item_count?: number;
  work_plan_task_count?: number;
  milestones_generated?: boolean;
  boq_items?: BoqItem[];
  work_plan_tasks?: unknown[];
}

export interface IngestionPreview {
  boq_items: BoqDraftItem[];
  work_plan_tasks: WorkPlanDraftTask[];
}

/** Result of committing an ingestion */
export interface IngestionCommitResult {
  boq_items: BoqDraftItem[];
  work_plan_tasks: WorkPlanDraftTask[];
  milestones_created: number;
  status: string;
}

export interface BoqDraftItem {
  item_number: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  section?: string;
}

export interface WorkPlanDraftTask {
  task_name: string;
  description: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  dependencies?: string[];
}

// ─── Store & Procurement ─────────────────────────────────────────────────────

export interface StoreItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  category: string;
  quantity_on_hand: number;
}

export interface PurchaseOrder {
  id: number;
  project_id: string;
  item_id: number;
  quantity: string;
  unit_price: string;
  status: string;
  created_at: number;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export interface Ticket {
  id: number;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  risk_level: "low" | "medium" | "high";
  sensitivity: "normal" | "urgent";
  escalation_level: number;
  due_date: string | null;
  status: "open" | "acknowledged" | "resolved" | "closed";
  raised_by: string;
  assigned_to: string | null;
  acknowledged_at: number | null;
  project_id: string;
  plan_document_id: number | null;
  pin_x: number | null;
  pin_y: number | null;
  created_at: number;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  author: string;
  body: string;
  attachment_url: string;
  attachment_name: string;
  created_at: number;
}

// ─── Notices ─────────────────────────────────────────────────────────────────

export interface Notice {
  id: number;
  title: string;
  body: string;
  posted_by: string;
}

// ─── Daily Logs ──────────────────────────────────────────────────────────────

export interface DailyLog {
  id: number;
  project_id: string;
  log_date: string;
  weather: string;
  labour_count: number;
  notes: string;
  author: string;
  details: Record<string, unknown>;
}

// ─── Site Records ────────────────────────────────────────────────────────────

export interface QualitySample {
  id: number;
  project_id: string;
  sample_id: string;
  test_type: string;
  location: string;
  grade: string;
  test_date: string;
  result_date: string;
  result_value: string;
  passed: boolean | null;
  notes: string;
  tested_by: string | null;
  created_at: number;
}

// ─── Weekly Report ───────────────────────────────────────────────────────────

export interface WeeklyReportData {
  project_id: string;
  project_name: string;
  period_start: string;
  period_end: string;
  summary: string;
  schedule: {
    planned_percent: number;
    actual_percent: number;
    variance: number;
  };
  cost: {
    budget: string;
    certified_to_date: string;
    paid_to_date: string;
    forecast_final_cost: string;
  };
  risks: RiskItem[];
  issues: IssueItem[];
  materials: MaterialDelivery[];
  incidents: SafetyIncident[];
  daily_logs: DailyLog[];
}

export interface RiskItem {
  id: string;
  title: string;
  likelihood: string;
  impact: string;
  mitigation: string;
  status: string;
}

export interface IssueItem {
  id: string;
  title: string;
  description: string;
  status: string;
  raised_by: string;
}

// ─── Executive Dashboard ─────────────────────────────────────────────────────

export interface ExecDashboard {
  schedule: {
    planned_percent: number;
    actual_percent: number;
    variance: number;
  };
  cost: {
    budget: string;
    approved_variations: string;
    certified_to_date: string;
    paid_to_date: string;
    forecast_final_cost: string;
    cost_variance: string;
  };
  risk: {
    high_risk_tickets: number;
    overdue_tickets: number;
    critical_issues: number;
  };
}

// ─── Compliance ──────────────────────────────────────────────────────────────

export interface ComplianceRow {
  project_id: string;
  project_name: string;
  days_window: number;
  days_logged: number;
  missing_dates: string[];
  streak_days: number;
  last_log_date: string | null;
}

// ─── Material Delivery & H&S Incident ────────────────────────────────────────

export interface MaterialDelivery {
  id: number;
  project_id: string;
  delivery_date: string;
  material: string;
  quantity: string;
  unit: string;
  supplier: string;
  remarks: string;
  receipt_url: string;
  received_by: string;
  created_at: number;
}

export interface SafetyIncident {
  id: number;
  project_id: string;
  incident_date: string;
  severity: "near_miss" | "first_aid" | "lost_time" | "serious";
  description: string;
  action_taken: string;
  photo_urls: string[];
  reported_by: string;
  created_at: number;
}

// ─── Cost Dashboard ──────────────────────────────────────────────────────────

export interface CostDashboardData {
  budget: string;
  tender_amount: string;
  budget_vs_tender: string;
  approved_variations: string;
  forecast_final_cost: string;
  cost_variance: string;
  provisional_sums_budget: string;
  provisional_sums_ascertained: string;
  contingency_drawn: string;
  certified_to_date: string;
  paid_to_date: string;
  total_retention_held: string;
  total_advance_recovery: string;
  advance_payments_outstanding: string;
  advance_payments_total: string;
  boq_total: string;
  boq_certified_total: string;
  boq_by_state: Record<string, { total: string; count: number }>;
}

// ─── Cash Flow Forecast ──────────────────────────────────────────────────────

export interface CashFlowMonth {
  month: string;
  planned: string;
  actual: string;
  cumulative_planned: string;
  cumulative_actual: string;
  task_count: number;
}

export interface CashFlowForecast {
  months: CashFlowMonth[];
  total_planned: string;
  total_actual: string;
  remaining: string;
  forecast_completion: string | null;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
  roles: string[];
  tenants: { id: string; name: string }[];
}

export interface Role {
  slug: string;
  name: string;
  permissions: string[];
}

export interface Permission {
  key: string;
  label: string;
  module: string;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  from_email: string;
  use_tls: boolean;
  enabled: boolean;
  has_password: boolean;
}

export interface WhatsAppConfig {
  account_sid: string;
  from_number: string;
  enabled: boolean;
  has_auth_token: boolean;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  link: string;
  read_at: number | null;
  created_at: number;
}

// ─── AI Assistant ────────────────────────────────────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AIModel {
  id: string;
  name: string;
  vision: boolean;
}

export interface AIStatus {
  configured: boolean;
  provider: string | null;
  base_url: string | null;
  model: string | null;
  message?: string;
}

// ─── SSO ─────────────────────────────────────────────────────────────────────

export interface SsoUrl {
  sso_url: string | null;
  enabled: boolean;
}

export interface WebsiteSyncResult {
  synced: number;
  total: number;
}

// ─── Subcontractors & Work Orders ──────────────────────────────────────────────

export interface Subcontractor {
  id: number;
  project_id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  created_at: number;
}

export interface WorkOrder {
  id: number;
  project_id: string;
  subcontractor_id: number;
  subcontractor_name: string;
  order_number: string;
  boq_section: string;
  description: string;
  unit_rate: string;
  quantity_cap: string | null;
  total_value: string;
  status: string;
  issued_date: string;
  completed_date: string;
  certified_quantity: string;
  certified_value: string;
  paid_value: string;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface WorkOrderSummary {
  by_subcontractor: {
    subcontractor_id: number;
    subcontractor_name: string;
    total_capped: string;
    total_certified: string;
    total_paid: string;
    count: number;
  }[];
  by_section: {
    section: string;
    total_capped: string;
    total_certified: string;
    total_paid: string;
    count: number;
  }[];
  variance: {
    total_capped: string;
    total_certified: string;
    total_paid: string;
    variance_certified_vs_capped: string;
    variance_paid_vs_certified: string;
  };
}
