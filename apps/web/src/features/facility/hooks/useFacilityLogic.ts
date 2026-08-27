"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { usePropertyContext } from "@/lib/property-context";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
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
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [properties, setProperties] = useState<Row[]>([]);
  const [assets, setAssets] = useState<Row[]>([]);
  const [createModal, setCreateModalState] = useState<"asset" | "contractor" | "inspection" | "service-request" | "ppm" | null>(null);
  const [actionModal, setActionModal] = useState<ActionModal>(null);

  const load = useCallback(async () => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    if (tab === "tickets" || tab === "calendar") {
      setRows([]);
      setLoading(false);
      return;
    }
    let path: string;
    if (tab === "overview" || tab === "reports") {
      path = "/facility/dashboard/";
    } else if (tab === "buildings") {
      path = `/property/buildings/?search=${encodeURIComponent(search)}`;
    } else if (tab === "strategic-plans") {
      path = `/facility/strategic-plans/?search=${encodeURIComponent(search)}`;
    } else if (tab === "budgets") {
      path = `/facility/budgets/?search=${encodeURIComponent(search)}`;
    } else if (tab === "compliance") {
      path = `/facility/compliance/?search=${encodeURIComponent(search)}`;
    } else if (tab === "risks") {
      path = `/facility/risks/?search=${encodeURIComponent(search)}`;
    } else if (tab === "spare-parts" || tab === "consumables") {
      path = `/facility/assets/?search=${encodeURIComponent(search)}`;
    } else if (tab === "expenditure") {
      path = `/facility/expenses/?search=${encodeURIComponent(search)}`;
    } else if (tab === "procurement") {
      path = `/facility/procurements/?search=${encodeURIComponent(search)}`;
    } else if (tab === "finance-control") {
      path = `/facility/payment-requests/?search=${encodeURIComponent(search)}`;
    } else if (tab === "service-providers") {
      path = `/facility/contractors/?search=${encodeURIComponent(search)}`;
    } else {
      path = `/facility/${tab}/?search=${encodeURIComponent(search)}`;
    }
    try {
      const response = await apiFetch(path, {}, organizationId);
      if (!response.ok) {
        setError("Facility data could not be loaded. Please retry.");
        setLoading(false);
        return;
      }
      const data = await response.json().catch(() => (tab === "overview" || tab === "reports" ? {} : []));
      if (tab === "overview" || tab === "reports") setDashboard(data as FacilityDashboard);
      else setRows(Array.isArray(data) ? (data as Row[]) : []);
      setLoading(false);
    } catch {
      setError("Unable to reach the facility service. Check your connection and retry.");
      setLoading(false);
    }
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

  const setCreateModal = (value: "asset" | "contractor" | "inspection" | "service-request" | "ppm" | null) => {
    setCreateError("");
    setCreateModalState(value);
  };

  useEffect(() => {
    if ((createModal === "inspection" || createModal === "ppm") && organizationId)
      apiFetch("/facility/assets/", {}, organizationId)
        .then((r) => (r.ok ? r.json() : []))
        .then(setAssets);
  }, [createModal, organizationId]);

  async function createWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
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
      setCreateError(await apiErrorMessage(response, "The work order could not be created. Review the required fields and retry."));
      return;
    }
    setShowCreate(false);
    setCreateError("");
    setTab("work-orders");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createModal) return false;
    setCreating(true);
    setCreateError("");
    const form = new FormData(event.currentTarget);
    const path = {
      asset: "/facility/assets/",
      contractor: "/facility/contractors/",
      inspection: "/facility/inspections/",
      "service-request": "/facility/service-requests/",
      ppm: "/facility/planned-maintenance/",
    }[createModal];
    const raw = Object.fromEntries(Array.from(form.entries()).filter(([, value]) => !(value instanceof File)));
    let payload: Record<string, unknown> =
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

    if (createModal === "asset" || createModal === "contractor") {
      const saveMode = event.currentTarget.dataset.saveMode === "draft" ? "draft" : "submit";
      const metadata = Object.fromEntries(
        Object.entries(raw)
          .filter(([key, value]) => key.startsWith("meta__") && String(value).trim() !== "")
          .map(([key, value]) => [key.slice(6), value]),
      );
      payload = Object.fromEntries(Object.entries(raw).filter(([key, value]) => !key.startsWith("meta__") && String(value).trim() !== ""));
      payload.metadata = { ...metadata, onboarding_status: saveMode === "draft" ? "draft" : "complete" };
      if (createModal === "asset") {
        payload.is_active = saveMode === "draft" ? false : raw.is_active !== "false";
        for (const key of ["purchase_value", "replacement_cost", "expected_useful_life_years"])
          if (payload[key] !== undefined) payload[key] = Number(payload[key]);
      } else {
        payload.is_preferred = raw.is_preferred === "on";
        payload.is_blacklisted = raw.is_blacklisted === "on";
        payload.assigned_properties = form.getAll("assigned_properties").map(String);
        payload.rating = Number(raw.rating || 0);
        payload.approval_status = saveMode === "draft" ? "draft" : String(raw.approval_status || "pending");
      }
    }
    try {
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
        setCreateError(await apiErrorMessage(response, "The record could not be saved. Review the highlighted details and retry."));
        setCreating(false);
        return false;
      }
      const saved = await response.json() as { id?: string; name?: string; code?: string };
      const files = form.getAll("document_files").filter((value): value is File => value instanceof File && value.size > 0);
      const failedFiles: string[] = [];
      for (const file of files) {
        const body = new FormData();
        body.append("title", file.name);
        body.append("category", createModal === "asset" ? "facility_asset" : "facility_service_provider");
        body.append("file", file);
        body.append("original_filename", file.name);
        body.append("mime_type", file.type);
        body.append("metadata", JSON.stringify(createModal === "asset" ? { facility_asset_id: saved.id } : { facility_contractor_id: saved.id }));
        const upload = await apiFetch("/documents/documents/", { method: "POST", body }, organizationId);
        if (!upload.ok) failedFiles.push(file.name);
      }
      if (failedFiles.length) {
        setCreateError(`${saved.name || "The record"} was saved, but these documents could not be uploaded: ${failedFiles.join(", ")}.`);
        setCreating(false);
        await load();
        return false;
      }
      setCreateModal(null);
      await load();
      setCreating(false);
      return true;
    } catch {
      setCreateError("The service is temporarily unavailable. Your form details are still here; check your connection and retry.");
      setCreating(false);
      return false;
    }
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

  async function verifyWorkOrder(row: Row) {
    if (!organizationId || !row.id) return;
    setError("");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      `/facility/work-orders/${row.id}/verify/`,
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ notes: "Manager reviewed completion evidence and accepted the work." }),
      },
      organizationId,
    );
    if (!response.ok) {
      setError("Manager verification could not be completed. Confirm the work order is completed and you have approval access.");
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
    activePropertyId: activeProperty?.id ?? null,
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
    createError,
    setCreateError,
    creating,
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
    verifyWorkOrder,
  };
}
