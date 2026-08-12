"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

export type FacilityAsset = {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  location?: string;
  quantity?: number;
};

export type WorkOrder = {
  id: string;
  work_order_number: string;
  title: string;
  status: string;
  priority: string;
  assigned_to_name?: string;
  created_at: string;
};

export function useFacilityService() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<FacilityAsset[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [assetRes, woRes] = await Promise.all([
        apiFetch("/facility/assets/", {}, organizationId),
        apiFetch("/facility/work-orders/", {}, organizationId),
      ]);
      if (assetRes.ok) {
        const assetData = (await assetRes.json()) as { results?: FacilityAsset[] };
        setAssets(assetData.results || []);
      }
      if (woRes.ok) {
        const woData = (await woRes.json()) as { results?: WorkOrder[] };
        setWorkOrders(woData.results || []);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error loading facility data.");
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
    assets,
    workOrders,
    refresh: loadData,
  };
}
