"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { usePropertyContext } from "@/lib/property-context";
import {
  BUYER_TRANSITIONS,
  Dashboard,
  Row,
  SALE_TRANSITIONS,
  SalesTab,
  salesTabLabels,
} from "../types/sales.types";
import { readError } from "../utils/sales.utils";

export type ReportPreview = {
  key: string;
  period: { start: string; end: string };
  columns: string[];
  rows: Row[];
  count: number;
  meta: { title: string; organization: string; generated_by: string; generated_at: string };
};

export function useSalesLogic(initialTab = "overview") {
  const { session, can } = useAuth();
  const { activeProperty } = usePropertyContext();
  const org = session?.activeOrganizationId ?? null;
  const canSell = can("sales.selling");
  const canVisit = can("sales.visits");

  const [tab, setTab] = useState<SalesTab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q && q in salesTabLabels) return q as SalesTab;
    }
    return initialTab in salesTabLabels ? (initialTab as SalesTab) : "overview";
  });

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  // Modals
  const [showRegisterBuyer, setShowRegisterBuyer] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("register") === "1",
  );
  const [showNewSale, setShowNewSale] = useState(false);
  const [showRecordVisit, setShowRecordVisit] = useState(false);
  const [showNewListing, setShowNewListing] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [paymentAction, setPaymentAction] = useState<Row | null>(null);
  const [transitionSaleRow, setTransitionSaleRow] = useState<Row | null>(null);
  const [transitionBuyerRow, setTransitionBuyerRow] = useState<Row | null>(null);

  const [options, setOptions] = useState<{
    buyers: Row[];
    listings: Row[];
    projects: Row[];
    units: Row[];
    properties: Row[];
    constructionProjects: Row[];
  }>({
    buyers: [],
    listings: [],
    projects: [],
    units: [],
    properties: [],
    constructionProjects: [],
  });
  const [recentExports, setRecentExports] = useState<Row[]>([]);
  const [reportPreview, setReportPreview] = useState<ReportPreview | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportKey, setReportKey] = useState("");

  const loadVersion = useRef(0);

  const loadData = useCallback(async () => {
    if (!org) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");

    if (tab === "tickets" || tab === "calendar") {
      setRows([]);
      setDashboard(null);
      setLoading(false);
      return;
    }

    const isAnalytics = tab === "performance" || tab === "reports";
    const isHandover = tab === "handover";
    const isBankRecon = tab === "bank-reconciliation";
    let path = "/sales/dashboard/";
    if (isAnalytics) path = "/sales/analytics/";
    else if (isHandover) path = "/sales/sales/?status=completed";
    else if (isBankRecon) path = `/sales/payments/?search=${encodeURIComponent(search)}${status ? `&status=${encodeURIComponent(status)}` : ""}`;
    else if (tab === "clerk") path = `/sales/site-visits/?search=${encodeURIComponent(search)}`;
    else if (tab === "leads") path = `/sales/buyers/?search=${encodeURIComponent(search)}${status ? `&status=${encodeURIComponent(status)}` : ""}`;
    else if (tab !== "overview") path = `/sales/${tab}/?search=${encodeURIComponent(search)}${status ? `&status=${encodeURIComponent(status)}` : ""}`;

    try {
      const res = await apiFetch(path, {}, org);
      if (version !== loadVersion.current) return;
      if (!res.ok) {
        setRows([]);
        setDashboard(null);
        setError(await apiErrorMessage(res, `The ${salesTabLabels[tab]} could not be loaded.`));
        return;
      }
      const data = (await res.json()) as Dashboard;
      if (version !== loadVersion.current) return;
      if (tab === "overview" || isAnalytics) setDashboard(data);
      if (tab === "performance") setRows(data.agentPerformance ?? []);
      else if (tab === "reports") setRows(data.reports ?? []);
      else if (tab === "overview") setRows([]);
      else setRows(Array.isArray(data) ? (data as unknown as Row[]) : []);
    } catch {
      if (version === loadVersion.current) setError("Unable to connect to the property sales service.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, status, org, activeProperty?.id]);

  useEffect(() => {
    const timer = setTimeout(loadData, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadData, search]);

  // Load dependent options when a creation modal opens.
  useEffect(() => {
    if (!org || !showNewSale) return;
    let active = true;
    apiFetch("/sales/buyers/", {}, org).then((r) => (r.ok ? r.json() : [])).then((d) => active && setOptions((o) => ({ ...o, buyers: Array.isArray(d) ? d : [] })));
    apiFetch("/sales/inventory/", {}, org).then((r) => (r.ok ? r.json() : [])).then((d) => active && setOptions((o) => ({ ...o, listings: Array.isArray(d) ? d : [] })));
    return () => { active = false; };
  }, [org, showNewSale]);

  useEffect(() => {
    if (!org) return;
    if (showRecordVisit || showNewListing || showNewProject) {
      let active = true;
      apiFetch("/sales/projects/", {}, org)
        .then((r) => (r.ok ? r.json() : apiFetch("/property/projects/", {}, org).then((r2) => (r2.ok ? r2.json() : []))))
        .then((d) => active && setOptions((o) => ({ ...o, projects: Array.isArray(d) ? d : [] })));

      apiFetch("/property/properties/", {}, org)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => active && setOptions((o) => ({ ...o, properties: Array.isArray(d) ? d : [] })));

      apiFetch("/construction/projects/", {}, org)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => active && setOptions((o) => ({ ...o, constructionProjects: Array.isArray(d) ? d : [] })));

      return () => { active = false; };
    }
  }, [org, showRecordVisit, showNewListing, showNewProject]);

  useEffect(() => {
    if (!org || !showNewListing) return;
    let active = true;
    apiFetch("/property/units/", {}, org).then((r) => (r.ok ? r.json() : [])).then((d) => active && setOptions((o) => ({ ...o, units: Array.isArray(d) ? d : [] })));
    return () => { active = false; };
  }, [org, showNewListing]);

  const selectTab = (id: string) => {
    setSearch("");
    setStatus("");
    setRows([]);
    setTab(id as SalesTab);
  };

  async function submitRegisterBuyer(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/buyers/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowRegisterBuyer(false);
      setFormError("");
      setTab("buyers");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitNewSale(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/sales/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowNewSale(false);
      setFormError("");
      setTab("sales");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitRecordVisit(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/site-visits/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowRecordVisit(false);
      setFormError("");
      setTab("site-visits");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitNewListing(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/inventory/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowNewListing(false);
      setFormError("");
      setTab("inventory");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitNewProject(payload: Record<string, any>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/projects/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowNewProject(false);
      setFormError("");
      apiFetch("/sales/projects/", {}, org)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setOptions((o) => ({ ...o, projects: Array.isArray(d) ? d : [] })));
      setTab("inventory");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitBatchListing(payload: Record<string, any>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/inventory/batch-create/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowNewListing(false);
      setFormError("");
      setTab("inventory");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitPaymentAction(payload: { action: "verify" | "reject" | "reverse"; reason?: string }) {
    if (!paymentAction) return;
    const endpoint = payload.action === "verify" ? "verify" : payload.action === "reject" ? "reject" : "reverse";
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/payments/${paymentAction.id}/${endpoint}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: payload.action === "verify" ? "{}" : JSON.stringify({ reason: payload.reason ?? "" }),
    }, org);
    if (res.ok) {
      setPaymentAction(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitTransitionSale(payload: { status: string; notes?: string }) {
    if (!transitionSaleRow) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/sales/${transitionSaleRow.id}/transition/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setTransitionSaleRow(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitTransitionBuyer(payload: { status: string; notes?: string }) {
    if (!transitionBuyerRow) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/buyers/${transitionBuyerRow.id}/transition/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ status: payload.status }),
    }, org);
    if (res.ok) {
      setTransitionBuyerRow(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function quickTransitionBuyer(row: Row, targetStatus: string) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/buyers/${row.id}/transition/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ status: targetStatus }),
    }, org);
    if (res.ok) {
      loadData();
    } else {
      setError(await readError(res));
    }
  }

  async function runCommissionAction(row: Row, action: string) {
    await apiFetch("/auth/csrf/");
    let body = "{}";
    if (action === "hold") {
      const reason = window.prompt("Reason for holding this commission:");
      if (!reason) return;
      body = JSON.stringify({ reason });
    }
    const res = await apiFetch(`/sales/commissions/${row.id}/${action}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body,
    }, org);
    if (res.ok) {
      loadData();
    } else {
      setError(await readError(res));
    }
  }

  async function exportReport(key: string, name: string) {
    const res = await apiFetch(`/sales/analytics/exports/${key}/`, {}, org);
    if (!res.ok) {
      setError("Report export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setRecentExports((prev) => [{ key, name, exportedAt: new Date().toISOString() }, ...prev].slice(0, 8));
  }

  async function loadReportPreview(key: string, start = "", end = "") {
    if (!org) return;
    setReportKey(key);
    setReportLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      const qs = params.toString();
      const res = await apiFetch(`/sales/analytics/reports/${key}/${qs ? `?${qs}` : ""}`, {}, org);
      if (!res.ok) {
        throw new Error(await readError(res));
      }
      const data = (await res.json()) as ReportPreview;
      setReportPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The report could not be loaded.");
      setReportPreview(null);
    } finally {
      setReportLoading(false);
    }
  }

  async function downloadReport(key: string, name: string, format: "csv" | "xlsx", start = "", end = "") {
    if (!org) return;
    setError("");
    try {
      const params = new URLSearchParams({ output: format });
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      const qs = params.toString();
      const res = await apiFetch(`/sales/analytics/exports/${key}/${qs ? `?${qs}` : ""}`, {}, org);
      if (!res.ok) {
        throw new Error(await readError(res));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-${key}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setRecentExports((prev) => [{ key, name, exportedAt: new Date().toISOString(), format }, ...prev].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The report export failed.");
    }
  }

  const openBuyerRegistration = () => { setFormError(""); setShowRegisterBuyer(true); };
  const openNewSaleModal = () => { setFormError(""); setShowNewSale(true); };
  const openRecordVisitModal = () => { setFormError(""); setShowRecordVisit(true); };
  const openNewListingModal = () => { setFormError(""); setShowNewListing(true); };
  const openPaymentAction = (row: Row) => { setFormError(""); setPaymentAction(row); };
  const openTransitionSale = (row: Row) => { setFormError(""); setTransitionSaleRow(row); };
  const openTransitionBuyer = (row: Row) => { setFormError(""); setTransitionBuyerRow(row); };

  const saleOptions = SALE_TRANSITIONS[String(transitionSaleRow?.status ?? "")] ?? [];
  const buyerOptions = BUYER_TRANSITIONS[String(transitionBuyerRow?.status ?? "")] ?? [];

  return {
    tab,
    setTab,
    selectTab,
    dashboard,
    rows,
    search,
    setSearch,
    status,
    setStatus,
    loading,
    error,
    formError,
    org,
    canSell,
    canVisit,
    loadData,
    recentExports,
    reportPreview,
    reportLoading,
    reportKey,
    loadReportPreview,
    downloadReport,
    options,
    // Modals
    showRegisterBuyer,
    setShowRegisterBuyer,
    showNewSale,
    setShowNewSale,
    showRecordVisit,
    setShowRecordVisit,
    showNewListing,
    setShowNewListing,
    showNewProject,
    setShowNewProject,
    paymentAction,
    setPaymentAction,
    transitionSaleRow,
    setTransitionSaleRow,
    transitionBuyerRow,
    setTransitionBuyerRow,
    saleOptions,
    buyerOptions,
    // Openers
    openBuyerRegistration,
    openNewSaleModal,
    openRecordVisitModal,
    openNewListingModal,
    openNewProjectModal: () => { setFormError(""); setShowNewProject(true); },
    openPaymentAction,
    openTransitionSale,
    openTransitionBuyer,
    // Submissions
    submitRegisterBuyer,
    submitNewSale,
    submitRecordVisit,
    submitNewListing,
    submitNewProject,
    submitBatchListing,
    submitPaymentAction,
    submitTransitionSale,
    submitTransitionBuyer,
    quickTransitionBuyer,
    runCommissionAction,
    exportReport,
  };
}
