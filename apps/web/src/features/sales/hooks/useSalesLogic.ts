"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { usePropertyContext } from "@/lib/property-context";
import {
  BUYER_TRANSITIONS,
  Dashboard,
  OutreachCampaign,
  OutreachCampaignModule,
  OutreachProspect,
  OutreachSummary,
  ProjectMarketingProfile,
  Row,
  SALE_TRANSITIONS,
  SalesCmsSummary,
  SalesContentArticle,
  SalesMarketingAsset,
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

  // Outreach state
  const [outreachCampaigns, setOutreachCampaigns] = useState<OutreachCampaign[]>([]);
  const [outreachProspects, setOutreachProspects] = useState<OutreachProspect[]>([]);
  const [outreachSummary, setOutreachSummary] = useState<OutreachSummary | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<OutreachCampaignModule | "all">("all");
  const [outreachLoading, setOutreachLoading] = useState(false);

  // CMS state
  const [cmsArticles, setCmsArticles] = useState<SalesContentArticle[]>([]);
  const [cmsAssets, setCmsAssets] = useState<SalesMarketingAsset[]>([]);
  const [cmsProfiles, setCmsProfiles] = useState<ProjectMarketingProfile[]>([]);
  const [cmsSummary, setCmsSummary] = useState<SalesCmsSummary | null>(null);
  const [cmsLoading, setCmsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAssetKind, setSelectedAssetKind] = useState<string>("all");

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

    if (tab === "outreach") {
      try {
        let prospectUrl = "/sales/outreach-prospects/";
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (status) params.append("status", status);
        if (selectedCampaignId) params.append("campaign", selectedCampaignId);
        if (selectedModule && selectedModule !== "all") params.append("target_module", selectedModule);
        if (params.toString()) prospectUrl += `?${params.toString()}`;

        const [campRes, prospRes, sumRes] = await Promise.all([
          apiFetch("/sales/outreach-campaigns/", {}, org),
          apiFetch(prospectUrl, {}, org),
          apiFetch("/sales/outreach-campaigns/summary/", {}, org),
        ]);

        if (version !== loadVersion.current) return;

        if (campRes.ok) {
          const campData = await campRes.json();
          setOutreachCampaigns(Array.isArray(campData) ? campData : campData.results ?? []);
        }
        if (prospRes.ok) {
          const prospData = await prospRes.json();
          const items = Array.isArray(prospData) ? prospData : prospData.results ?? [];
          setOutreachProspects(items);
          setRows(items as unknown as Row[]);
        }
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          setOutreachSummary(sumData);
        }
      } catch {
        if (version === loadVersion.current) setError("Unable to load AI Outreach campaigns.");
      } finally {
        if (version === loadVersion.current) setLoading(false);
      }
      return;
    }

    if (tab === "cms") {
      try {
        let articleUrl = "/sales/marketing-articles/";
        const artParams = new URLSearchParams();
        if (search) artParams.append("search", search);
        if (status) artParams.append("status", status);
        if (selectedCategory && selectedCategory !== "all") artParams.append("category", selectedCategory);
        if (artParams.toString()) articleUrl += `?${artParams.toString()}`;

        let assetUrl = "/sales/marketing-assets/";
        const assetParams = new URLSearchParams();
        if (search) assetParams.append("search", search);
        if (selectedAssetKind && selectedAssetKind !== "all") assetParams.append("asset_kind", selectedAssetKind);
        if (assetParams.toString()) assetUrl += `?${assetParams.toString()}`;

        const [artRes, assetRes, profRes, sumRes] = await Promise.all([
          apiFetch(articleUrl, {}, org),
          apiFetch(assetUrl, {}, org),
          apiFetch("/sales/project-profiles/", {}, org),
          apiFetch("/sales/marketing-articles/summary/", {}, org),
        ]);

        if (version !== loadVersion.current) return;

        if (artRes.ok) {
          const artData = await artRes.json();
          const items = Array.isArray(artData) ? artData : artData.results ?? [];
          setCmsArticles(items);
          setRows(items as unknown as Row[]);
        }
        if (assetRes.ok) {
          const assetData = await assetRes.json();
          setCmsAssets(Array.isArray(assetData) ? assetData : assetData.results ?? []);
        }
        if (profRes.ok) {
          const profData = await profRes.json();
          setCmsProfiles(Array.isArray(profData) ? profData : profData.results ?? []);
        }
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          setCmsSummary(sumData);
        }
      } catch {
        if (version === loadVersion.current) setError("Unable to load Marketing CMS content.");
      } finally {
        if (version === loadVersion.current) setLoading(false);
      }
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
  }, [tab, search, status, org, activeProperty?.id, selectedCampaignId, selectedModule, selectedCategory, selectedAssetKind]);

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

  async function downloadReport(key: string, name: string, format: "csv" | "xlsx" | "pdf", start = "", end = "") {
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

  // Outreach actions
  const seedDefaults = useCallback(async () => {
    if (!org) return;
    setOutreachLoading(true);
    await apiFetch("/auth/csrf/");
    try {
      const res = await apiFetch("/sales/outreach-campaigns/seed_defaults/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
      }, org);
      if (res.ok) {
        await loadData();
      }
    } finally {
      setOutreachLoading(false);
    }
  }, [org, loadData]);

  const generateDraft = useCallback(async (prospectId: string, stepNumber?: number) => {
    if (!org) return null;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/outreach-prospects/${prospectId}/generate-draft/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(stepNumber ? { step_number: stepNumber } : {}),
    }, org);
    if (res.ok) {
      return await res.json();
    }
    return null;
  }, [org]);

  const logOutreach = useCallback(async (prospectId: string, payload: { activity_type: string; subject?: string; content?: string; step_number?: number }) => {
    if (!org) return null;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/outreach-prospects/${prospectId}/log-outreach/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      const data = await res.json();
      await loadData();
      return data;
    }
    return null;
  }, [org, loadData]);

  // CMS Actions
  const publishArticle = useCallback(async (id: string) => {
    if (!org) return null;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/marketing-articles/${id}/publish/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
    }, org);
    if (res.ok) {
      await loadData();
      return await res.json();
    }
    return null;
  }, [org, loadData]);

  const unpublishArticle = useCallback(async (id: string) => {
    if (!org) return null;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/marketing-articles/${id}/unpublish/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
    }, org);
    if (res.ok) {
      await loadData();
      return await res.json();
    }
    return null;
  }, [org, loadData]);

  const saveArticle = useCallback(async (payload: Partial<SalesContentArticle>, id?: string) => {
    if (!org) return null;
    await apiFetch("/auth/csrf/");
    const url = id ? `/sales/marketing-articles/${id}/` : "/sales/marketing-articles/";
    const method = id ? "PATCH" : "POST";
    const res = await apiFetch(url, {
      method,
      headers: { "X-CSRFToken": csrfFromCookie(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      await loadData();
      return await res.json();
    }
    return null;
  }, [org, loadData]);

  const deleteArticle = useCallback(async (id: string) => {
    if (!org) return false;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/marketing-articles/${id}/`, {
      method: "DELETE",
      headers: { "X-CSRFToken": csrfFromCookie() },
    }, org);
    if (res.ok) {
      await loadData();
      return true;
    }
    return false;
  }, [org, loadData]);

  const saveAsset = useCallback(async (payload: FormData | Record<string, unknown>, id?: string) => {
    if (!org) return null;
    await apiFetch("/auth/csrf/");
    const url = id ? `/sales/marketing-assets/${id}/` : "/sales/marketing-assets/";
    const method = id ? "PATCH" : "POST";
    const isFormData = payload instanceof FormData;
    const headers: Record<string, string> = { "X-CSRFToken": csrfFromCookie() };
    if (!isFormData) headers["Content-Type"] = "application/json";
    const res = await apiFetch(url, {
      method,
      headers,
      body: isFormData ? payload : JSON.stringify(payload),
    }, org);
    if (res.ok) {
      await loadData();
      return await res.json();
    }
    return null;
  }, [org, loadData]);

  const deleteAsset = useCallback(async (id: string) => {
    if (!org) return false;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/marketing-assets/${id}/`, {
      method: "DELETE",
      headers: { "X-CSRFToken": csrfFromCookie() },
    }, org);
    if (res.ok) {
      await loadData();
      return true;
    }
    return false;
  }, [org, loadData]);

  const recordAssetDownload = useCallback(async (id: string) => {
    if (!org) return;
    await apiFetch("/auth/csrf/");
    await apiFetch(`/sales/marketing-assets/${id}/record-download/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
    }, org);
  }, [org]);

  const saveProjectProfile = useCallback(async (payload: Partial<ProjectMarketingProfile>, id?: string) => {
    if (!org) return null;
    await apiFetch("/auth/csrf/");
    const url = id ? `/sales/project-profiles/${id}/` : "/sales/project-profiles/";
    const method = id ? "PATCH" : "POST";
    const res = await apiFetch(url, {
      method,
      headers: { "X-CSRFToken": csrfFromCookie(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      await loadData();
      return await res.json();
    }
    return null;
  }, [org, loadData]);

  const seedCmsDefaults = useCallback(async () => {
    if (!org) return;
    setCmsLoading(true);
    await apiFetch("/auth/csrf/");
    try {
      await Promise.all([
        apiFetch("/sales/marketing-articles/seed-defaults/", {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
        }, org),
        apiFetch("/sales/marketing-assets/seed-defaults/", {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
        }, org),
      ]);
      await loadData();
    } finally {
      setCmsLoading(false);
    }
  }, [org, loadData]);

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
    // Outreach state & actions
    outreachCampaigns,
    outreachProspects,
    outreachSummary,
    selectedCampaignId,
    setSelectedCampaignId,
    selectedModule,
    setSelectedModule,
    outreachLoading,
    seedDefaults,
    generateDraft,
    logOutreach,
    // CMS state & actions
    cmsArticles,
    cmsAssets,
    cmsProfiles,
    cmsSummary,
    cmsLoading,
    selectedCategory,
    setSelectedCategory,
    selectedAssetKind,
    setSelectedAssetKind,
    publishArticle,
    unpublishArticle,
    saveArticle,
    deleteArticle,
    saveAsset,
    deleteAsset,
    recordAssetDownload,
    saveProjectProfile,
    seedCmsDefaults,
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
