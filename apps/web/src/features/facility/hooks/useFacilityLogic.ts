"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { usePropertyContext } from "@/lib/property-context";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { ActionModal, FacilityDashboard, FacilityTab, Row, facilityLabels } from "../types/facility.types";

export function useFacilityLogic(defaultTab: FacilityTab = "overview") {
  const { session, can } = useAuth();
  const { activeProperty } = usePropertyContext();
  const organizationId = session?.activeOrganizationId ?? null;
  const canWork = can("facility.work") || can("facility.manage");
  const canInspect = can("facility.inspect") || can("facility.manage");
  const canAdminister = can("facility.administer") || can("facility.manage");
  const canApprove = can("facility.approve") || can("facility.manage");

  const [tab, setTab] = useState<FacilityTab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab") as FacilityTab | null;
      if (q && facilityLabels[q]) return q;
    }
    return defaultTab;
  });

  const [dashboard, setDashboard] = useState<FacilityDashboard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [properties, setProperties] = useState<Row[]>([]);
  const [assets, setAssets] = useState<Row[]>([]);
  const [createModal, setCreateModal] = useState<"asset" | "contractor" | "inspection" | "service-request" | "ppm" | null>(null);
  const [actionModal, setActionModal] = useState<ActionModal>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    const apiTab = tab === "buildings" ? "assets" : tab;
    let path: string;
    if (tab === "overview" || tab === "reports") {
      path = "/facility/dashboard/";
    } else if (tab === "spare-parts" || tab === "consumables") {
      path = `/facility/assets/?search=${encodeURIComponent(search)}`;
    } else if (tab === "expenditure") {
      path = `/facility/work-order-cost-items/?search=${encodeURIComponent(search)}`;
    } else {
      path = `/facility/${apiTab}/?search=${encodeURIComponent(search)}`;
    }
    const response = await apiFetch(path, {}, organizationId);
    if (!response.ok) {
      setError("Facility data could not be loaded. Please retry.");
      setLoading(false);
      return;
    }
    const data = await response.json();
    if (tab === "overview" || tab === "reports") setDashboard(data as FacilityDashboard);
    else setRows(data as Row[]);
    setLoading(false);
  }, [organizationId, activeProperty?.id, search, tab]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    if ((showCreate || createModal) && organizationId)
      apiFetch("/property/properties/", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then(setProperties);
  }, [showCreate, createModal, organizationId]);

  useEffect(() => {
    if ((createModal === "inspection" || createModal === "ppm") && organizationId)
      apiFetch("/facility/assets/", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then(setAssets);
  }, [createModal, organizationId]);

  async function createWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      "/facility/work-orders/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          ...Object.fromEntries(form.entries()),
          reported_at: new Date().toISOString(),
          progress: 0,
        }),
      },
      organizationId
    );
    if (!response.ok) {
      setError("The work order could not be created. Check its number and required fields.");
      return;
    }
    setShowCreate(false);
    setTab("work-orders");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createModal) return;
    const form = new FormData(event.currentTarget);
    const path = {
      asset: "/facility/assets/",
      contractor: "/facility/contractors/",
      inspection: "/facility/inspections/",
      "service-request": "/facility/service-requests/",
      ppm: "/facility/planned-maintenance/",
    }[createModal];
    const raw = Object.fromEntries(form.entries());
    const payload =
      createModal === "service-request"
        ? {
            reference: String(raw.reference ?? "").trim() || `SR-${Date.now()}`,
            subject: String(raw.subject ?? "").trim(),
            description: String(raw.description ?? "").trim(),
            category: String(raw.category ?? "").trim() || "General",
            priority: String(raw.priority ?? "medium"),
            property: String(raw.property ?? properties[0]?.id ?? ""),
            submitted_at: String(raw.submitted_at ?? "").trim() || new Date().toISOString(),
          }
        : Object.fromEntries(Object.entries(raw).filter(([, value]) => String(value).trim() !== ""));
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      path,
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      organizationId
    );
    if (!response.ok) {
      setError("The record could not be created. Check required fields.");
      return;
    }
    setCreateModal(null);
    await load();
  }

  async function runAction(row: Row, action: string) {
    if (tab === "inspections" && action === "complete") {
      setActionModal({ type: "inspection", row });
      return;
    }
    if (tab === "service-requests" && action === "resolve") {
      setActionModal({ type: "resolve", row });
      return;
    }
    if (tab === "service-requests" && (action === "approve" || action === "reject")) {
      setActionModal({ type: "request-decision", row, decision: action });
      return;
    }
    await apiFetch("/auth/csrf/");
    let path = "";
    const payload: Record<string, string | number | boolean> = {};
    if (tab === "planned-maintenance") path = `/facility/planned-maintenance/${row.id}/${action}/`;
    if (tab === "service-requests") path = `/facility/service-requests/${row.id}/${action}/`;
    if (tab === "inspections") path = `/facility/inspections/${row.id}/complete/`;
    const response = await apiFetch(
      path,
      { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) },
      organizationId
    );
    if (!response.ok) {
      setError("The facility workflow action could not be completed.");
      return;
    }
    await load();
  }

  async function submitActionModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionModal) return;
    const { type, row } = actionModal;
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const path = type === "inspection"
      ? `/facility/inspections/${row.id}/complete/`
      : type === "request-decision"
        ? `/facility/service-requests/${row.id}/${actionModal.decision}/`
        : `/facility/service-requests/${row.id}/resolve/`;
    const payload: Record<string, string | number | boolean> =
      type === "inspection"
        ? {
            score: Number(form.get("score")),
            violations: Number(form.get("violations") ?? 0),
            findings: String(form.get("findings") ?? ""),
            create_work_order: form.get("create_work_order") === "on",
          }
        : type === "request-decision"
          ? { notes: String(form.get("notes") ?? "") }
          : { satisfaction_score: Number(form.get("satisfaction_score")) };
    const response = await apiFetch(
      path,
      { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify(payload) },
      organizationId
    );
    if (!response.ok) {
      setError("The facility workflow action could not be completed.");
      return;
    }
    setActionModal(null);
    await load();
  }

  async function runWorkTransition(row: Row, target: string, notes: string) {
    if (!organizationId || !row.id) return;
    setError("");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      `/facility/work-orders/${row.id}/transition/`,
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ status: target, notes }),
      },
      organizationId,
    );
    if (!response.ok) {
      setError("The work order transition could not be completed.");
      return;
    }
    await load();
  }

  const selectTab = (id: string) => {
    if (id === tab) return;
    setSearch("");
    setRows([]);
    setTab(id as FacilityTab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const onPopState = () => {
      const next = new URLSearchParams(window.location.search).get("tab") as FacilityTab | null;
      if (next && facilityLabels[next]) setTab(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return {
    organizationId,
    canWork,
    canInspect,
    canAdminister,
    canApprove,
    tab,
    setTab,
    selectTab,
    dashboard,
    rows,
    search,
    setSearch,
    loading,
    error,
    showCreate,
    setShowCreate,
    properties,
    assets,
    createModal,
    setCreateModal,
    actionModal,
    setActionModal,
    load,
    createWorkOrder,
    handleCreate,
    runAction,
    submitActionModal,
    runWorkTransition,
  };
}
