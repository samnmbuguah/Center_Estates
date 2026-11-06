/** Quality Test record (URS-QUAL-01) */
export interface QualityTest {
  id: number;
  project_id: string;
  test_type: string;
  sample_id: string;
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

/** Consultant Payment (URS-FIN-CON-01) */
export interface ConsultantPayment {
  id: number;
  project_id: string;
  consultant_name: string;
  consultant_role: string;
  certificate_number: string;
  amount: string;
  retention_percent: string;
  status: "pending" | "approved" | "paid" | "void";
  invoice_url: string;
  approved_by: string | null;
  paid_at: number | null;
  created_at: number;
  updated_at: number;
}

/** BIM Model (URS-BIM-01) */
export interface BimModel {
  id: number;
  project_id: string;
  name: string;
  discipline: string;
  file_format: string;
  version: string;
  remote_url: string;
  uploaded_by: string | null;
  uploaded_at: number;
  is_current: boolean;
}

/** Drone / Satellite Dataset (URS-DRONE-01) */
export interface DroneDataset {
  id: number;
  project_id: string;
  data_type: string;
  operator_id: string;
  flight_date: string;
  classification: string;
  external_url: string;
  thumbnail_url: string;
  file_hash: string;
  file_size_bytes: number | null;
  compliance_declared: boolean;
  milestone_id: string;
  uploaded_by: string | null;
  uploaded_at: number;
  is_archived: boolean;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: number | null;
  sales_campaign_id: string;
  storage_tier: string;
  signed_url_expires_at: number | null;
  key_outputs: Record<string, unknown>;
}

/** IGP Safeguard (E&S) record */
export interface IgpSafeguard {
  risk_classification: string;
  eia_status: string;
  esia_document_url: string;
  esmp_url: string;
  stakeholder_plan_url: string;
  grievance_mechanism_url: string;
  land_acquisition_status: string;
  updated_at: number;
}

/** IGP Procurement record */
export interface IgpProcurement {
  procurement_method: string;
  procurement_plan_url: string;
  tender_document_url: string;
  signed_contract_url: string;
  approved_budget_url: string;
  baseline_boq_url: string;
  updated_at: number;
}

/** Project module config (tolerance thresholds) */
export interface ProjectModuleConfig {
  project_id: string;
  module_key: string;
  settings: Record<string, unknown>;
}
