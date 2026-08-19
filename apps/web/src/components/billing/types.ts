export type Candidate = {
  id: string; tenant_name: string; property_name: string; unit_code: string;
  lease_reference: string; due_date: string;
  billing_items: Array<{ code: string; description: string; total?: string; amount?: string }>;
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
};

export const statusToneMap: Record<string, "green" | "red" | "yellow" | "blue" | "gray"> = {
  ready: "green", generated: "green", issued: "green", approved: "blue", paid: "green",
  issue: "red", overdue: "red", blocking: "red", review: "yellow", preparing: "yellow", warning: "yellow", excluded: "gray",
};

export function issueResolution(code: string): { label: string; href: string } | null {
  if (code.includes("water") || code.includes("meter")) return { label: "Inspect Water Meters", href: "/facility?tab=meters" };
  if (code.includes("lease") || code.includes("rent")) return { label: "Review Lease Terms", href: "/property?tab=leases" };
  if (code.includes("duplicate") || code.includes("invoice")) return { label: "Check Invoice Register", href: "/property?tab=rent" };
  return null;
}
