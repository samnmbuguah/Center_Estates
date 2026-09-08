export type Candidate = {
  id: string; tenant_name: string; property_name: string; unit_code: string;
  lease_reference: string; due_date: string;
  billing_items: Array<{ code: string; description: string; total?: string; amount?: string; billed?: boolean; invoice_id?: string; invoice_number?: string }>;
  total: string; status: string;
  issue_summary: Array<{ code: string; message: string; severity: string }>;
  invoice_number?: string;
  meter_readings?: Array<{ meter_type: string; previous: number; current: number; units: number }>;
};

export type BillingIssue = {
  id: string; code: string; message: string; severity: string; status: string; resolution_notes?: string;
};

export type BillingRun = {
  id: string; period_start: string; period_end: string; status: string;
  totals: Record<string, string | number>; candidates: Candidate[]; issues: BillingIssue[];
};

export type Invoice = {
  id: string; number: string; tenant_name: string; unit_code: string; amount: string; status: string; issued_on: string;
  property_id?: string; property_name?: string; invoice_type?: string; charge_type?: string; amount_paid?: string | number; balance?: string | number;
  unit?: string; unit_id?: string; owner?: string; owner_id?: string; owner_name?: string; unit_owner_id?: string; unit_owner_name?: string;
  metadata?: Record<string, any>;
};

export type InvoiceChargeType = "rent" | "service_charge" | "utility" | "other";
export const CHARGE_TYPE_LABEL: Record<InvoiceChargeType, string> = {
  rent: "Rent",
  service_charge: "Service charge",
  utility: "Utility",
  other: "Other",
};

export function invoiceChargeType(code: string): InvoiceChargeType {
  const c = String(code || "").trim().toLowerCase();
  if (c === "rent") return "rent";
  if (c === "sc" || c === "service_charge" || c.includes("service")) return "service_charge";
  if (c === "water" || c === "electricity" || c === "utility" || c.includes("utility") || c.includes("meter")) return "utility";
  return "other";
}

export function candidateHasChargeType(candidate: Candidate, type: InvoiceChargeType): boolean {
  return candidate.billing_items.some((it) => invoiceChargeType(it.code) === type);
}

export function candidateChargeTypes(candidate: Candidate): InvoiceChargeType[] {
  return Array.from(new Set(candidate.billing_items.map((it) => invoiceChargeType(it.code))));
}

export const statusToneMap: Record<string, "green" | "red" | "yellow" | "blue" | "gray"> = {
  ready: "green", generated: "green", issued: "green", approved: "blue", paid: "green",
  issue: "red", overdue: "red", blocking: "red", review: "yellow", preparing: "yellow", warning: "yellow", excluded: "gray",
};

export function isMissingWaterReading(candidate: Candidate): boolean {
  return (candidate.issue_summary || []).some(
    (issue) => issue.code === "missing_water_reading" || ((issue.code || "").includes("water") && (issue.severity === "blocking" || issue.code.includes("missing")))
  );
}

export function issueResolution(code: string): { label: string; href: string } | null {
  const c = (code || "").toLowerCase();
  if (c.includes("water") || c.includes("meter") || c.includes("reading") || c.includes("utility")) {
    return { label: "Log Meter Readings in Facility", href: "/facility?tab=meters" };
  }
  if (c.includes("lease") || c.includes("rent") || c.includes("charge_rule") || c.includes("escalation")) {
    return { label: "Configure Lease & Charges", href: "/property?tab=leases" };
  }
  if (c.includes("duplicate") || c.includes("invoice") || c.includes("already_billed")) {
    return { label: "View Invoice Register", href: "/property?tab=rent" };
  }
  if (c.includes("tenant") || c.includes("contact") || c.includes("pin")) {
    return { label: "Update Tenant Details", href: "/property?tab=tenants" };
  }
  if (c.includes("bank") || c.includes("paybill") || c.includes("property")) {
    return { label: "Update Property Banking Details", href: "/property?tab=properties" };
  }
  return { label: "Review Property Setup", href: "/property?tab=properties" };
}
