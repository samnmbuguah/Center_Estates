"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/monitoring/hooks/useToast";

export type PropertyItem = {
  id: string;
  code: string;
  name: string;
  status: string;
  city?: string;
  address?: string;
  monthly_rent?: number;
  occupancy_rate?: number;
  total_units?: number;
};

export type DashboardSummary = {
  total_properties: number;
  total_units: number;
  occupied_units: number;
  occupancy_rate: number;
  monthly_rent: number;
  outstanding_rent: number;
  collection_rate: number;
};

export function usePropertyService() {
  const { session } = useAuth();
  const { toast } = useToast();
  const organizationId = session?.activeOrganizationId ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/property/properties/", {}, organizationId);
      if (!response.ok) throw new Error("Failed to load property portfolio.");
      const data = (await response.json()) as { results?: PropertyItem[]; summary?: DashboardSummary };
      setProperties(data.results || []);
      setSummary(data.summary || null);
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : "Error loading property records.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    loading,
    error,
    properties,
    summary,
    refresh: loadData,
  };
}
