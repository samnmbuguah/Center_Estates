"use client";

import type { ReactNode } from "react";

export type PropertyTab =
  | "overview"
  | "properties"
  | "buildings"
  | "units"
  | "projects"
  | "tenants"
  | "tenancy"
  | "tenant-documents"
  | "leases"
  | "financials"
  | "billing"
  | "rent-schedules"
  | "rent"
  | "arrears"
  | "reminders"
  | "receipts"
  | "receipt-allocations"
  | "bank-reconciliation"
  | "credit-notes"
  | "income-expenses"
  | "fee-schedules"
  | "fee-settlements"
  | "service-charges"
  | "service-charge-budgets"
  | "service-charge-statements"
  | "service-charge-reconciliations"
  | "tenancy-reports"
  | "financial-reports"
  | "reports"
  | "forecast"
  | "critical-dates"
  | "owner-portal"
  | "tickets"
  | "calendar";

export type PropertyDashboardData = {
  kpis?: {
    total_properties?: number;
    total_units?: number;
    occupied_units?: number;
    vacant_units?: number;
    occupancy_rate?: number;
    monthly_rent?: number;
    outstanding_rent?: number;
    collection_rate?: number;
  };
  charts?: {
    monthly_collections?: Array<{ month: string; amount: number }>;
    occupancy_trend?: Array<{ month: string; rate: number }>;
  };
};

export type RecordReceiptModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  tenants?: Array<{ id: string; name: string }>;
};

export type AddTenantModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  properties?: Array<{ id: string; name: string }>;
};
