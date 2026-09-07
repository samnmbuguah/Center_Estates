"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Alert, Autocomplete, Box, Button, Chip, CircularProgress, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  ErrorBanner, SearchInput, DetailDrawer, Modal, Field, Pagination, money, number,
} from "@/components/module-ui";
import { ViewToolbar, ListState, SubTabs } from "../PropertyToolbar";
import {
  PropertyTab, Row, ID, PropertyRow, BuildingRow, UnitRow, ProjectRow,
  TenantRow, TenantDocumentRow, LeaseRow, RentScheduleRow, InvoiceRow,
  InvoicePreview, ReceiptRow, ReminderRow, BankTransactionRow, ExpenseRow,
  BudgetRow, ServiceChargeRow, ServiceChargeAllocationRow,
  ServiceChargeReconciliationRow, ReceiptAllocationRow, CreditNoteRow,
  AgingTenantRow, AgingAnalytics, FinancialAnalytics, ReportItem,
  DashboardData, RentSection, ScSection, TenancySection, FinancialsSection,
} from "../../types/property.types";
import {
  kM, kN, fmtDate, daysUntil, daysLeftLabel, overdueLabel, pct,
  occupancyTone, shortId, exportCsv, exportLeaseICS, exportICS,
  criticalFormatDate, criticalDaysUntil,
} from "../../utils/property.utils";
import { UnitBillingScheduleDrawer } from "../UnitBillingScheduleDrawer";
import { UnitFloorPlanCanvas, type Point, type UnitLayout } from "../floorplan/UnitFloorPlanCanvas";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Upload, Edit2, CheckSquare } from "lucide-react";

type StoredFloorPlan = {
  id: string; building: string; floor: string; title: string; version: string;
  original_filename?: string; file_type?: string; original_url?: string; preview_url?: string;
  preview_status?: string; preview_error?: string; created_at?: string;
};

export function UnitsView({ rows, loading, search, setSearch, setTab, onSelectRow }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void; onSelectRow?: (r: Row) => void;
}) {
  const [view, setView] = useState<"commercial" | "residential" | "stacking" | "floorplan">("residential");
  const [selectedFloor, setSelectedFloor] = useState<string>("1");
  const [billingUnit, setBillingUnit] = useState<UnitRow | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [floorPlans, setFloorPlans] = useState<StoredFloorPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [plansLoading, setPlansLoading] = useState(false);
  const [planUploading, setPlanUploading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [browserPdfPreview, setBrowserPdfPreview] = useState("");
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [localUnits, setLocalUnits] = useState<UnitRow[]>((rows as UnitRow[]) || []);
  const [filterTypology, setFilterTypology] = useState<string | null>(null);
  const [filterOccupancy, setFilterOccupancy] = useState<"all" | "developer_tenanted" | "direct_landlord" | "owner_occupied" | "vacant">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTypologyValue, setBulkTypologyValue] = useState<string>("Studio");
  const [customTypologyInput, setCustomTypologyInput] = useState<string>("");
  const [isBulkUpdating, setIsBulkUpdating] = useState<boolean>(false);
  const [editingSingleUnit, setEditingSingleUnit] = useState<UnitRow | null>(null);
  const [singleTypologyInput, setSingleTypologyInput] = useState<string>("");
  const [isSingleUpdating, setIsSingleUpdating] = useState<boolean>(false);

  // On-demand letting fee invoice state
  const [lettingFeeModalOpen, setLettingFeeModalOpen] = useState(false);
  const [lettingUnit, setLettingUnit] = useState<UnitRow | null>(null);
  const [lettingFeeBasis, setLettingFeeBasis] = useState<"flat" | "one_month" | "half_month" | "percentage">("flat");
  const [lettingFeeAmount, setLettingFeeAmount] = useState<string>("25000");
  const [lettingFeeDate, setLettingFeeDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [lettingFeeOwner, setLettingFeeOwner] = useState<string>("");
  const [lettingFeeSaving, setLettingFeeSaving] = useState(false);
  const [lettingFeeSuccess, setLettingFeeSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLocalUnits((rows as UnitRow[]) || []);
  }, [rows]);

  const units = localUnits;
  const occupied = units.filter((u) => u.status === "occupied").length;
  const available = units.filter((u) => u.status === "available").length;
  const totalAreaSqft = units.reduce((s, u) => s + Number(u.area ?? 0), 0);
  const totalAreaM2 = totalAreaSqft / 10.7639;
  const typologyCounts = units.reduce<Record<string, number>>((acc, u) => {
    const t = String(u.unit_type ?? "").trim() || "—";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const typologyTotal = Object.values(typologyCounts).reduce((s, c) => s + c, 0);
  const areaCount = units.filter((u) => u.area !== undefined && u.area !== null).length;

  const isDevTenanted = (u: UnitRow) =>
    u.status === "occupied" &&
    (u.billing_isolation?.bill_rent === true ||
      (Number(u.effective_rent || u.monthly_rent || 0) > 0 &&
        u.billing_isolation?.rent_collection_mode !== "direct_landlord"));

  const isDirectLandlord = (u: UnitRow) =>
    u.status === "occupied" &&
    (u.billing_isolation?.rent_collection_mode === "direct_landlord" ||
      u.billing_isolation?.bill_rent === false ||
      Number(u.effective_rent || u.monthly_rent || 0) === 0);

  const isOwnerOccupied = (u: UnitRow) =>
    u.status === "occupied" &&
    Boolean(
      u.owner_name &&
        u.tenant_name &&
        u.owner_name.toLowerCase().trim() === u.tenant_name.toLowerCase().trim()
    );

  const devTenanted = units.filter(isDevTenanted);
  const directLandlord = units.filter(isDirectLandlord);
  const ownerOccupied = units.filter(isOwnerOccupied);
  const vacantUnits = units.filter((u) => u.status !== "occupied");

  const displayUnits = useMemo(() => {
    let list = units;
    if (filterTypology) {
      list = list.filter((u) => (String(u.unit_type ?? "").trim() || "—") === filterTypology);
    }
    if (filterOccupancy === "developer_tenanted") {
      list = list.filter(isDevTenanted);
    } else if (filterOccupancy === "direct_landlord") {
      list = list.filter(isDirectLandlord);
    } else if (filterOccupancy === "owner_occupied") {
      list = list.filter(isOwnerOccupied);
    } else if (filterOccupancy === "vacant") {
      list = list.filter((u) => u.status !== "occupied");
    }
    return list;
  }, [units, filterTypology, filterOccupancy]);

  const allVisibleSelected = displayUnits.length > 0 && displayUnits.every((u) => selectedIds.has(String(u.id)));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      const next = new Set(selectedIds);
      displayUnits.forEach((u) => next.delete(String(u.id)));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      displayUnits.forEach((u) => next.add(String(u.id)));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Group units by floor for Stacking Plan & Floor Plan
  const floorGroups = useMemo(() => {
    const map = new Map<string, UnitRow[]>();
    for (const u of units) {
      const f = String(u.floor ?? "1").trim() || "1";
      if (!map.has(f)) map.set(f, []);
      map.get(f)!.push(u);
    }
    // Sort floors descending (e.g. 5, 4, 3, 2, 1, G, B)
    return Array.from(map.entries()).sort((a, b) => {
      const na = Number(a[0]);
      const nb = Number(b[0]);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b[0].localeCompare(a[0]);
    });
  }, [units]);

  const buildingOptions = useMemo(() => {
    const seen = new Map<string, string>();
    units.forEach((unit) => {
      if (unit.building) seen.set(String(unit.building), unit.building_name || "Unnamed building");
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [units]);

  useEffect(() => {
    if (!selectedBuilding && buildingOptions.length) setSelectedBuilding(buildingOptions[0].id);
    if (selectedBuilding && !buildingOptions.some((building) => building.id === selectedBuilding)) {
      setSelectedBuilding(buildingOptions[0]?.id || "");
    }
  }, [buildingOptions, selectedBuilding]);

  // Available floors list
  const availableFloors = useMemo(() => {
    return Array.from(new Set(units
      .filter((unit) => !selectedBuilding || String(unit.building) === selectedBuilding)
      .map(u => String(u.floor ?? "1").trim() || "1"))).sort();
  }, [units, selectedBuilding]);

  // Set default selected floor if needed
  useEffect(() => {
    if (availableFloors.length > 0 && !availableFloors.includes(selectedFloor)) {
      setSelectedFloor(availableFloors[0]);
    }
  }, [availableFloors, selectedFloor]);

  useEffect(() => {
    if (!selectedBuilding || !selectedFloor) return;
    let active = true;
    setPlansLoading(true);
    setPlanError("");
    apiFetch(`/facility/floor-plans/?building=${encodeURIComponent(selectedBuilding)}&floor=${encodeURIComponent(selectedFloor)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Could not load floor plan versions."));
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        const plans = (Array.isArray(payload) ? payload : payload.results || []) as StoredFloorPlan[];
        setFloorPlans(plans);
        setSelectedPlanId((current) => plans.some((plan) => plan.id === current) ? current : (plans[0]?.id || ""));
      })
      .catch((error) => active && setPlanError(error instanceof Error ? error.message : "Could not load floor plans."))
      .finally(() => active && setPlansLoading(false));
    return () => { active = false; };
  }, [selectedBuilding, selectedFloor]);

  const selectedPlan = floorPlans.find((plan) => plan.id === selectedPlanId) || floorPlans[0];
  const storedPreview = selectedPlan?.preview_status === "ready" ? (selectedPlan.preview_url || "") : "";
  const floorPlanImage = storedPreview || browserPdfPreview;

  // cPanel does not provide a server-side PDF renderer. Render page one in the
  // browser so a PDF remains fully usable as a unit-mapping background.
  useEffect(() => {
    let active = true;
    setBrowserPdfPreview("");
    if (!selectedPlan || selectedPlan.file_type !== "pdf" || storedPreview || !selectedPlan.original_url) return;
    setPdfPreviewLoading(true);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        const response = await fetch(selectedPlan.original_url!, { credentials: "include" });
        if (!response.ok) throw new Error("The PDF plan could not be opened.");
        const document = await pdfjs.getDocument({ data: await response.arrayBuffer() }).promise;
        const page = await document.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 1600 / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not prepare the PDF preview.");
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (active) setBrowserPdfPreview(canvas.toDataURL("image/png"));
      } catch (error) {
        if (active) setPlanError(error instanceof Error ? error.message : "The PDF was saved but could not be previewed in this browser.");
      } finally {
        if (active) setPdfPreviewLoading(false);
      }
    })();
    return () => { active = false; };
  }, [selectedPlan?.id, selectedPlan?.file_type, selectedPlan?.original_url, storedPreview]);

  const uploadFloorPlan = async (file: File) => {
    if (!selectedBuilding) {
      setPlanError("Select a building before uploading its floor plan.");
      return;
    }
    setPlanUploading(true);
    setPlanError("");
    try {
      await apiFetch("/auth/csrf/");
      const form = new FormData();
      form.append("file", file);
      form.append("building", selectedBuilding);
      form.append("floor", selectedFloor);
      const response = await apiFetch("/facility/floor-plans/upload/", { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: form });
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The floor plan could not be uploaded."));
      const created = await response.json() as StoredFloorPlan;
      setFloorPlans((plans) => [created, ...plans]);
      setSelectedPlanId(created.id);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "The floor plan could not be uploaded.");
    } finally {
      setPlanUploading(false);
    }
  };

  // Current floor units formatted for UnitFloorPlanCanvas
  const currentFloorUnits = useMemo<UnitLayout[]>(() => {
    return units
      .filter((u) => (String(u.floor ?? "1").trim() || "1") === selectedFloor)
      .filter((u) => !selectedBuilding || String(u.building) === selectedBuilding)
      .map((u) => {
        const meta = (u.metadata || {}) as Record<string, any>;
        return {
          id: String(u.id),
          code: String(u.code),
          unit_type: String(u.unit_type || ""),
          floor: String(u.floor || selectedFloor),
          area: u.area,
          status: String(u.status || "available"),
          tenant_name: meta.tenant ? String(meta.tenant) : undefined,
          monthly_rent: meta.rent,
          polygon: Array.isArray(meta.polygon) ? (meta.polygon as Point[]) : undefined,
        };
      });
  }, [units, selectedFloor]);

  const handleSaveUnitPolygon = async (unitId: string, polygon: Point[]) => {
    try {
      const target = units.find((u) => String(u.id) === unitId || String(u.code) === unitId);
      if (!target) return;
      const currentMeta = (target.metadata || {}) as Record<string, any>;
      const updatedMeta = { ...currentMeta, polygon };
      await apiFetch("/auth/csrf/");
      await apiFetch(`/property/units/${target.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ metadata: updatedMeta }),
      });
      // update local object
      target.metadata = updatedMeta;
    } catch (e) {
      console.error("Failed to save unit polygon", e);
    }
  };

  const handleBulkUpdateTypology = async () => {
    const finalType = bulkTypologyValue === "Custom" ? customTypologyInput.trim() : bulkTypologyValue;
    if (!finalType) {
      toast.error("Please specify a typology.");
      return;
    }
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/property/units/bulk-update-typology/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          unit_ids: Array.from(selectedIds),
          unit_type: finalType,
        }),
      });
      if (res.ok) {
        setLocalUnits((prev) =>
          prev.map((u) => (selectedIds.has(String(u.id)) ? { ...u, unit_type: finalType } : u))
        );
        toast.success(`Updated ${selectedIds.size} unit(s) to "${finalType}".`);
        setSelectedIds(new Set());
        setCustomTypologyInput("");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || "Failed to update unit typologies.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating typologies.");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const openEditSingleUnit = (u: UnitRow) => {
    setEditingSingleUnit(u);
    setSingleTypologyInput(String(u.unit_type || ""));
  };

  const handleSaveSingleTypology = async () => {
    if (!editingSingleUnit) return;
    const finalType = singleTypologyInput.trim();
    if (!finalType) {
      toast.error("Please enter a typology.");
      return;
    }
    setIsSingleUpdating(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/property/units/${editingSingleUnit.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ unit_type: finalType }),
      });
      if (res.ok) {
        setLocalUnits((prev) =>
          prev.map((u) => (u.id === editingSingleUnit.id ? { ...u, unit_type: finalType } : u))
        );
        toast.success(`Unit ${editingSingleUnit.code} updated to "${finalType}".`);
        setEditingSingleUnit(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || "Failed to update unit.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving unit.");
    } finally {
      setIsSingleUpdating(false);
    }
  };

  const openLettingFeeModalForUnit = (u?: UnitRow) => {
    if (u) {
      setLettingUnit(u);
      setLettingFeeOwner(u.owner_name || "");
      const rent = Number(u.effective_rent || u.monthly_rent || 0);
      if (rent > 0) {
        setLettingFeeAmount(String(rent));
        setLettingFeeBasis("one_month");
      } else {
        setLettingFeeAmount("25000");
        setLettingFeeBasis("flat");
      }
    } else {
      setLettingUnit(null);
      setLettingFeeOwner("");
      setLettingFeeAmount("25000");
      setLettingFeeBasis("flat");
    }
    setLettingFeeSuccess(null);
    setLettingFeeModalOpen(true);
  };

  useEffect(() => {
    if (window.sessionStorage.getItem("ce:open-letting-fee") !== "1") return;
    window.sessionStorage.removeItem("ce:open-letting-fee");
    const task = window.setTimeout(() => openLettingFeeModalForUnit(), 0);
    return () => window.clearTimeout(task);
  }, []);

  const handleCreateLettingInvoice = async () => {
    if (!lettingUnit) {
      toast.error("Please select a unit to invoice the letting fee.");
      return;
    }
    const feeVal = Number(lettingFeeAmount);
    if (isNaN(feeVal) || feeVal <= 0) {
      toast.error("Enter a valid letting fee amount.");
      return;
    }
    setLettingFeeSaving(true);
    setLettingFeeSuccess(null);
    try {
      await apiFetch("/auth/csrf/");
      const payload: Record<string, any> = {
        unit: lettingUnit.id,
        invoice_type: "Letting Fee",
        charge_type: "letting_fee",
        recipient_type: "owner",
        amount: feeVal.toFixed(2),
        subtotal: feeVal.toFixed(2),
        tax_rate: "0",
        issued_on: lettingFeeDate,
        due_on: lettingFeeDate,
        metadata: {
          fee_basis: lettingFeeBasis,
          landlord_name: lettingFeeOwner,
          negotiated: true,
        },
      };
      if (lettingUnit.owner) {
        payload.owner = lettingUnit.owner;
      }
      const res = await apiFetch("/property/invoices/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || (typeof err === "object" ? Object.values(err).flat().join(" ") : "Failed to issue invoice."));
      }
      const data = await res.json();
      setLettingFeeSuccess(`Letting Fee Invoice ${data.number || "created"} generated for KES ${feeVal.toLocaleString()}!`);
      toast.success("Letting fee invoice generated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to issue invoice.");
    } finally {
      setLettingFeeSaving(false);
    }
  };

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="▦" iconBg="#dbeafe" iconColor="#2563eb" label="Units" value={kN(units.length)} sub="Registered units" link="View occupancy" onClick={() => setTab("units")} />
        <KpiCard icon="🔑" iconBg="#dcfce7" iconColor="#16a34a" label="Occupied" value={kN(occupied)} sub={`${pct(occupied, units.length)}% occupied`} link="View occupancy" onClick={() => setTab("units")} />
        <KpiCard icon="◌" iconBg="#fef3c7" iconColor="#d97706" label="Available" value={kN(available)} sub="Vacant units" link="View occupancy" onClick={() => setTab("units")} />
        {view === "commercial" ? (
          <KpiCard icon="📐" iconBg="#e0f2fe" iconColor="#0284c7" label="Total Area" value={`${kN(totalAreaSqft)} sqft`} sub={`${kN(totalAreaM2)} m² lettable`} link="View occupancy" onClick={() => setTab("units")} />
        ) : (
          <KpiCard icon="🗂" iconBg="#e0f2fe" iconColor="#0284c7" label="Typologies" value={kN(Object.keys(typologyCounts).length)} sub={`${kN(typologyTotal)} units`} link="View occupancy" onClick={() => setTab("units")} />
        )}
      </KpiStrip>

      <ViewToolbar title="Occupancy Register" subtitle="Lettable and non-lettable units at the selected property" search={search} onSearch={setSearch} placeholder="Search by unit code, type or building…">
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="btn sm"
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 6,
              padding: "6px 14px",
              cursor: "pointer",
            }}
            onClick={() => openLettingFeeModalForUnit()}
          >
            ⚡ Invoice Letting Fee
          </button>
          <button type="button" className={`btn sm ${view === "residential" ? "primary" : "ghost"}`} data-testid="occupancy-residential-btn" onClick={() => setView("residential")}>Residential</button>
          <button type="button" className={`btn sm ${view === "commercial" ? "primary" : "ghost"}`} data-testid="occupancy-commercial-btn" onClick={() => setView("commercial")}>Commercial</button>
          <button type="button" className={`btn sm ${view === "stacking" ? "primary" : "ghost"}`} data-testid="occupancy-stacking-btn" onClick={() => setView("stacking")}>🏢 Stacking Plan</button>
          <button type="button" className={`btn sm ${view === "floorplan" ? "primary" : "ghost"}`} data-testid="occupancy-floorplan-btn" onClick={() => setView("floorplan")}>📐 Floor Plan Outline</button>
        </div>
      </ViewToolbar>

      {/* Occupancy & Cashflow Quick-Filter Bar */}
      <div style={{
        margin: "0 0 16px 0",
        padding: "10px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", marginRight: 4 }}>
          Occupancy Breakdown:
        </span>
        {[
          { key: "all", label: `All Units (${units.length})`, bg: "#f1f5f9", activeBg: "#0f172a", activeColor: "#fff", color: "#334155" },
          { key: "developer_tenanted", label: `🏢 Developer Rent (${devTenanted.length})`, bg: "#eff6ff", activeBg: "#2563eb", activeColor: "#fff", color: "#1d4ed8" },
          { key: "direct_landlord", label: `🔑 Direct Landlord (${directLandlord.length})`, bg: "#faf5ff", activeBg: "#7c3aed", activeColor: "#fff", color: "#6d28d9" },
          { key: "owner_occupied", label: `🏠 Owner Occupied (${ownerOccupied.length})`, bg: "#fffbeb", activeBg: "#d97706", activeColor: "#fff", color: "#b45309" },
          { key: "vacant", label: `⚪ Vacant (${vacantUnits.length})`, bg: "#f8fafc", activeBg: "#475569", activeColor: "#fff", color: "#64748b" },
        ].map((pill) => {
          const isActive = filterOccupancy === pill.key;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => setFilterOccupancy(pill.key as any)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: isActive ? 800 : 600,
                background: isActive ? pill.activeBg : pill.bg,
                color: isActive ? pill.activeColor : pill.color,
                border: isActive ? `1.5px solid ${pill.activeBg}` : `1px solid var(--border)`,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {view === "floorplan" ? (
        <Panel title="Interactive Unit Drawing Outline & Floor Plan">
          <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            {planError && <Alert severity="error" onClose={() => setPlanError("")}>{planError}</Alert>}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>Building:</Typography>
                  <Select size="small" value={selectedBuilding} onChange={(e) => setSelectedBuilding(String(e.target.value))} sx={{ minWidth: 180, fontSize: 13, height: 36, background: "var(--surface)" }}>
                    {buildingOptions.map((building) => <MenuItem key={building.id} value={building.id}>{building.name}</MenuItem>)}
                  </Select>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>Select Floor Level:</Typography>
                  <Select
                    size="small"
                    value={selectedFloor}
                    onChange={(e) => setSelectedFloor(String(e.target.value))}
                    sx={{ minWidth: 140, fontSize: 13, height: 36, background: "var(--surface)" }}
                  >
                    {availableFloors.map((fl) => (
                      <MenuItem key={fl} value={fl}>Floor {fl}</MenuItem>
                    ))}
                  </Select>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  component="label"
                  startIcon={<Upload size={14} />}
                  sx={{ height: 36, fontSize: 12 }}
                >
                  {planUploading ? "Uploading…" : "Upload Floor Plan"}
                  <input
                    hidden
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/svg+xml,.dwg,.dxf"
                    disabled={planUploading || !selectedBuilding}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadFloorPlan(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </Button>
                {(plansLoading || pdfPreviewLoading) && <CircularProgress size={18} />}
                {floorPlans.length > 1 && <Select size="small" value={selectedPlan?.id || ""} onChange={(e) => setSelectedPlanId(String(e.target.value))} sx={{ minWidth: 165, height: 36, fontSize: 12 }}>
                  {floorPlans.map((plan) => <MenuItem key={plan.id} value={plan.id}>Version {plan.version} · {plan.original_filename || "Floor plan"}</MenuItem>)}
                </Select>}
                {selectedPlan?.original_url && <Button size="small" variant="text" component="a" href={selectedPlan.original_url} target="_blank" rel="noreferrer">Download original</Button>}
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary", maxWidth: 620 }}>
                Upload PDF, PNG, JPG, SVG, DWG or DXF (max. 25 MB). PDFs and supported CAD drawings are converted to a mapping preview; the original is retained. Click <strong>“Draw Unit Outline”</strong> to map units.
              </Typography>
            </Box>

            {selectedPlan?.preview_status === "preview_unavailable" && selectedPlan.file_type !== "pdf" && <Alert severity="warning" action={selectedPlan.original_url ? <Button color="inherit" size="small" component="a" href={selectedPlan.original_url} target="_blank">Download original</Button> : undefined}>
              {selectedPlan.preview_error || "This drawing was saved but cannot be shown in the mapper yet. Export it as PDF or PNG, then upload that version."}
            </Alert>}

            <UnitFloorPlanCanvas
              floorPlan={{
                title: `Level ${selectedFloor} Layout`,
                floor: selectedFloor,
                image_url: floorPlanImage,
                units: currentFloorUnits,
              }}
              availableUnits={currentFloorUnits}
              onSaveUnitPolygon={handleSaveUnitPolygon}
              onSelectUnit={(u) => {
                const target = units.find((row) => String(row.id) === u.id || String(row.code) === u.code);
                if (target && onSelectRow) onSelectRow(target);
              }}
              height={580}
            />
          </Box>
        </Panel>
      ) : view === "stacking" ? (
        <Panel title="Building Floor Elevation &amp; Stacking Plan">
          <ListState loading={loading} empty={units.length === 0} emptyTitle="No units available" emptyDesc="Register units with floor numbers to view the building stacking elevation.">
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#16a34a" }} /> Occupied
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#3b82f6" }} /> Available / Vacant
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#f59e0b" }} /> Reserved
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {floorGroups.map(([floor, floorUnits]) => {
                  const floorOccupied = floorUnits.filter(u => u.status === "occupied").length;
                  const floorArea = floorUnits.reduce((s, u) => s + Number(u.area ?? 0), 0);
                  return (
                    <div
                      key={floor}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px minmax(0, 1fr)",
                        gap: 12,
                        background: "var(--surface-2)",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        padding: 12,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ borderRight: "1px solid var(--border)", paddingRight: 8 }}>
                        <div style={{ fontWeight: 900, fontSize: 14, color: "var(--text-primary)" }}>Floor {floor}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{floorUnits.length} Unit{floorUnits.length !== 1 ? "s" : ""} · {pct(floorOccupied, floorUnits.length)}% occ.</div>
                        {floorArea > 0 && <div style={{ fontSize: 10, color: "var(--muted)" }}>{floorArea.toLocaleString()} sqft</div>}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                        {floorUnits.map((u) => {
                          const isOcc = u.status === "occupied";
                          const isRes = u.status === "reserved";
                          const borderCol = isOcc ? "#16a34a" : isRes ? "#f59e0b" : "#3b82f6";
                          const bgCol = isOcc ? "rgba(22, 163, 74, 0.08)" : isRes ? "rgba(245, 158, 11, 0.08)" : "rgba(59, 130, 246, 0.08)";
                          const rawTenant = (u.metadata as Record<string, unknown> | undefined)?.tenant;
                          const tenantName = u.tenant_name || (rawTenant ? String(rawTenant) : null);
                          return (
                            <div
                              key={String(u.id)}
                              onClick={() => onSelectRow?.(u)}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: `1.5px solid ${borderCol}`,
                                background: bgCol,
                                cursor: "pointer",
                                transition: "transform 0.15s, box-shadow 0.15s",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span className="mono" style={{ fontWeight: 800, fontSize: 12 }}>{u.code}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "capitalize", color: borderCol }}>
                                  {u.status}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                {u.area ? `${u.area} sqft` : u.unit_type || "Unit"}
                              </div>
                              {Boolean(tenantName) && (
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  👤 {String(tenantName)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ListState>
        </Panel>
      ) : view === "residential" ? (
        <Panel title="Unit Typology Breakdown">
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="body2" sx={{ color: "var(--muted, #64748b)", fontSize: 13 }}>
              Click any typology card below to filter the occupancy register:
            </Typography>
            {filterTypology && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setFilterTypology(null)}
                sx={{ textTransform: "none", fontSize: 12, height: 28 }}
              >
                Clear Filter ({filterTypology})
              </Button>
            )}
          </Box>
          {Object.keys(typologyCounts).length > 0 ? (
            <div style={{ padding: "10px 18px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))", gap: 10 }}>
              {Object.entries(typologyCounts).map(([type, count]) => {
                const isActive = filterTypology === type;
                return (
                  <div
                    key={type}
                    onClick={() => setFilterTypology(isActive ? null : type)}
                    className="card"
                    style={{
                      padding: 12,
                      background: isActive ? "rgba(37, 99, 235, 0.08)" : "var(--surface-2)",
                      border: isActive ? "2px solid var(--primary, #2563eb)" : "1px solid var(--border)",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong style={{ fontSize: 18, color: isActive ? "var(--primary, #2563eb)" : "inherit" }}>{kN(count)}</strong>
                      {isActive && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--primary, #2563eb)", background: "rgba(37, 99, 235, 0.12)", padding: "1px 5px", borderRadius: 4 }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4, fontWeight: isActive ? 600 : 400 }}>{type}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="🗂" title="No typology data" description="Unit type / typology (e.g. Studio, 1Br, 2Br) will appear here once units are registered." />
          )}
        </Panel>
      ) : (
        <Panel title="Lettable Area Summary">
          <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <strong style={{ fontSize: 18 }}>{kN(totalAreaSqft)}</strong>
              <div className="muted" style={{ fontSize: 11 }}>Total area (sq.ft)</div>
            </div>
            <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <strong style={{ fontSize: 18 }}>{kN(totalAreaM2)}</strong>
              <div className="muted" style={{ fontSize: 11 }}>Total area (m²)</div>
            </div>
            <div className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <strong style={{ fontSize: 18 }}>{kN(areaCount)}</strong>
              <div className="muted" style={{ fontSize: 11 }}>Units with area</div>
            </div>
          </div>
        </Panel>
      )}

      {view !== "stacking" && (
        <Panel title={view === "commercial" ? "Commercial Units" : "Residential Units"}>
          {selectedIds.size > 0 && (
            <Box
              sx={{
                mx: 2,
                mt: 1.5,
                mb: 1,
                p: 1.5,
                borderRadius: "8px",
                background: "var(--surface-2, #f8fafc)",
                border: "1px solid var(--primary, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--primary, #2563eb)" }}>
                  {selectedIds.size} {selectedIds.size === 1 ? "unit" : "units"} selected
                </Typography>
                <Button size="small" variant="text" onClick={() => setSelectedIds(new Set())} sx={{ textTransform: "none", fontSize: 12, color: "var(--muted)" }}>
                  Deselect All
                </Button>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600 }}>Bulk Change Typology:</Typography>
                <Select
                  size="small"
                  value={bulkTypologyValue}
                  onChange={(e) => setBulkTypologyValue(String(e.target.value))}
                  sx={{ minWidth: 140, height: 32, fontSize: 13, background: "var(--surface)" }}
                >
                  <MenuItem value="Studio">Studio</MenuItem>
                  <MenuItem value="1Br">1Br</MenuItem>
                  <MenuItem value="2Br Std">2Br Std</MenuItem>
                  <MenuItem value="2Br Ensuite">2Br Ensuite</MenuItem>
                  <MenuItem value="3Br">3Br</MenuItem>
                  <MenuItem value="Penthouse">Penthouse</MenuItem>
                  <MenuItem value="Custom">Custom...</MenuItem>
                </Select>
                {bulkTypologyValue === "Custom" && (
                  <TextField
                    size="small"
                    placeholder="Enter typology..."
                    value={customTypologyInput}
                    onChange={(e) => setCustomTypologyInput(e.target.value)}
                    sx={{ width: 140, "& input": { py: 0.5, px: 1, fontSize: 13 } }}
                  />
                )}
                <Button
                  size="small"
                  variant="contained"
                  disabled={isBulkUpdating}
                  onClick={handleBulkUpdateTypology}
                  sx={{ textTransform: "none", fontSize: 12, height: 32 }}
                >
                  {isBulkUpdating ? "Updating..." : "Apply Typology"}
                </Button>
              </Box>
            </Box>
          )}

          <ListState loading={loading} empty={displayUnits.length === 0} emptyTitle="No units found" emptyDesc={filterTypology ? `No units match typology "${filterTypology}".` : "Generate units from a property or register them individually."}>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleToggleSelectAll}
                        style={{ cursor: "pointer" }}
                        title="Select/Deselect all visible units"
                      />
                    </th>
                    <th>Unit Code</th>
                    <th>Building</th>
                    <th>Floor</th>
                    <th>Landlord / Owner</th>
                    <th>Mandate</th>
                    {view === "commercial" ? (
                      <>
                        <th>Area (sq.ft)</th>
                        <th>Area (m²)</th>
                      </>
                    ) : (
                      <th>Typology</th>
                    )}
                    <th>Status</th>
                    <th>Tenant</th>
                    <th>Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {displayUnits.map((u) => {
                    const rent = (u.metadata as Record<string, unknown> | undefined)?.rent;
                    const area = u.area === undefined || u.area === null ? null : Number(u.area);
                    const isSelected = selectedIds.has(String(u.id));
                    return (
                      <tr key={String(u.id)} onClick={() => onSelectRow?.(u)} style={{ background: isSelected ? "rgba(37, 99, 235, 0.04)" : undefined }}>
                        <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(String(u.id))}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                        <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(u.code ?? "—")}</td>
                        <td style={{ fontSize: 12 }}>{String(u.building_name ?? "—")}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{String(u.floor ?? "—")}</td>
                        <td style={{ fontSize: 12 }}>
                          {u.owner_name ? (
                            <span style={{ fontWeight: 600, color: "#818cf8" }}>{u.owner_name}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {u.management_mandate ? (
                            <span className="badge badge-purple" style={{ fontSize: 10 }}>
                              {u.management_mandate.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        {view === "commercial" ? (
                          <>
                            <td className="mono">{area === null ? "—" : kN(area)}</td>
                            <td className="mono">{area === null ? "—" : kN(area / 10.7639)}</td>
                          </>
                        ) : (
                          <td style={{ fontSize: 12 }}>
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditSingleUnit(u);
                              }}
                              style={{
                                cursor: "pointer",
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "var(--surface-2)",
                                border: "1px solid var(--border)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontWeight: 500,
                              }}
                              title="Click to edit unit typology"
                            >
                              {String(u.unit_type ?? "—")}
                              <Edit2 size={11} style={{ opacity: 0.6 }} />
                            </span>
                          </td>
                        )}
                        <td><StatusPill value={String(u.status ?? "—")} /></td>
                        <td style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{String(u.tenant_name || (u.metadata as Record<string, unknown> | undefined)?.tenant || "—")}</div>
                          {u.status !== "occupied" ? (
                            <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", color: "#64748b", fontSize: 10, fontWeight: 700, marginTop: 3 }}>
                              ⚪ Vacant
                            </span>
                          ) : isDevTenanted(u) ? (
                            <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", fontSize: 10, fontWeight: 700, marginTop: 3 }}>
                              🏢 Developer Unit · Rent KES {Number(u.effective_rent || u.monthly_rent || 0).toLocaleString()}
                            </span>
                          ) : isDirectLandlord(u) ? (
                            <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#faf5ff", color: "#7c3aed", border: "1px solid #e9d5ff", fontSize: 10, fontWeight: 700, marginTop: 3 }}>
                              🔑 Direct Landlord · KES 0 Mgmt
                            </span>
                          ) : isOwnerOccupied(u) ? (
                            <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", fontSize: 10, fontWeight: 700, marginTop: 3 }}>
                              🏠 Owner Occupier · SC Only
                            </span>
                          ) : (
                            <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, background: "#f0fdf4", color: "#16a34a", fontSize: 10, fontWeight: 700, marginTop: 3 }}>
                              👤 Active Tenancy
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button type="button" className="btn ghost sm" onClick={(event) => { event.stopPropagation(); setBillingUnit(u); }}>
                              {u.billing_isolation?.bill_rent ? "Rent + utilities" : u.billing_isolation?.bill_utilities_to_tenant ? "Utilities only" : "Schedule"}
                            </button>
                            <button
                              type="button"
                              className="btn ghost sm"
                              title="Issue ad-hoc letting fee invoice to landlord"
                              style={{ color: "#2563eb", fontWeight: 700, fontSize: 11 }}
                              onClick={(event) => {
                                event.stopPropagation();
                                openLettingFeeModalForUnit(u);
                              }}
                            >
                              ⚡ Letting
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}

      {/* Single Unit Typology Edit Modal */}
      {editingSingleUnit && (
        <Modal
          title={`Edit Typology for Unit ${editingSingleUnit.code}`}
          onClose={() => setEditingSingleUnit(null)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setEditingSingleUnit(null)} sx={{ textTransform: "none" }}>
                Cancel
              </Button>
              <Button variant="contained" disabled={isSingleUpdating} onClick={handleSaveSingleTypology} sx={{ textTransform: "none" }}>
                {isSingleUpdating ? "Saving..." : "Save Typology"}
              </Button>
            </>
          }
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 1 }}>
            <Typography variant="body2" sx={{ color: "var(--muted)" }}>
              Select or type the typology for <strong>Unit {editingSingleUnit.code}</strong>:
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {["Studio", "1Br", "2Br Std", "2Br Ensuite", "3Br", "Penthouse"].map((t) => (
                <Chip
                  key={t}
                  label={t}
                  clickable
                  color={singleTypologyInput === t ? "primary" : "default"}
                  onClick={() => setSingleTypologyInput(t)}
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Box>
            <TextField
              fullWidth
              size="small"
              label="Typology Name"
              value={singleTypologyInput}
              onChange={(e) => setSingleTypologyInput(e.target.value)}
              placeholder="e.g. Studio, 1Br, 2Br Std, 2Br Ensuite"
            />
          </Box>
        </Modal>
      )}

      {/* On-Demand Agency Letting Fee Invoice Modal */}
      {lettingFeeModalOpen && (
        <Modal
          title={<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><span aria-hidden="true">⚡</span> Issue agency letting-fee invoice</Box>}
          onClose={() => setLettingFeeModalOpen(false)}
          wide
          footer={
            <>
              <Button variant="outlined" onClick={() => setLettingFeeModalOpen(false)} sx={{ textTransform: "none" }}>
                {lettingFeeSuccess ? "Close" : "Cancel"}
              </Button>
              {!lettingFeeSuccess && (
                <Button
                  variant="contained"
                  disabled={lettingFeeSaving || !lettingUnit || Number(lettingFeeAmount) <= 0}
                  onClick={handleCreateLettingInvoice}
                  sx={{ textTransform: "none", background: "#2563eb", fontWeight: 700 }}
                >
                  {lettingFeeSaving ? "Generating Invoice..." : "⚡ Issue Letting Invoice"}
                </Button>
              )}
            </>
          }
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
            {/* Blue Ribbon Banner — Matching Staff Preview Mode Styling */}
            <Box
              sx={{
                background: "linear-gradient(112deg, #123b78 0%, #1d4ed8 58%, #2563eb 100%)",
                color: "#ffffff",
                p: { xs: 2, sm: 2.5 },
                borderRadius: 2.5,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
              }}
            >
              <span style={{ fontSize: 26 }} aria-hidden="true">⚡</span>
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: "0.08em", color: "rgba(255,255,255,.86)" }}>
                  Agency income · one-off charge
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                  Bill the unit owner when a tenancy is successfully placed
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.92, display: "block", mt: 0.5 }}>
                  Select the unit, confirm the agreed commission, then review the owner invoice before issuing it.
                </Typography>
              </Box>
            </Box>

            {lettingFeeSuccess && (
              <Alert severity="success" sx={{ fontWeight: 600 }}>
                {lettingFeeSuccess}
              </Alert>
            )}

            {!lettingFeeSuccess && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>1. Unit and invoice recipient</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.35fr 1fr" }, gap: 1.5 }}>
                  <Autocomplete
                    size="small"
                    options={units}
                    getOptionLabel={(u) => `${u.code} (${u.tenant_name || (u.owner_name ? `Owner: ${u.owner_name}` : "Vacant")})`}
                    value={lettingUnit}
                    onChange={(_, newVal) => {
                      setLettingUnit(newVal);
                      if (newVal?.owner_name) {
                        setLettingFeeOwner(newVal.owner_name);
                      }
                      const rent = Number(newVal?.effective_rent || newVal?.monthly_rent || 0);
                      if (rent > 0 && lettingFeeBasis !== "flat") {
                        if (lettingFeeBasis === "one_month") setLettingFeeAmount(String(rent));
                        else if (lettingFeeBasis === "half_month") setLettingFeeAmount(String(Math.round(rent * 0.5)));
                        else if (lettingFeeBasis === "percentage") setLettingFeeAmount(String(Math.round(rent * 0.1)));
                      }
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Unit" placeholder="Select unit..." helperText={lettingUnit ? lettingUnit.property_name || "Selected Unit" : "Select unit to bill letting fee"} />
                    )}
                  />
                  <TextField
                    label="Landlord / Owner Name"
                    size="small"
                    value={lettingFeeOwner}
                    onChange={(e) => setLettingFeeOwner(e.target.value)}
                    placeholder="e.g. Dennis Osame"
                    helperText="Filled from the unit ownership record"
                    slotProps={{ input: { readOnly: Boolean(lettingUnit?.owner_name) } }}
                  />
                  </Box>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                    2. Fee calculation
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {[
                      { key: "flat", label: "Negotiated Flat Amount" },
                      { key: "one_month", label: "1 Month Rent" },
                      { key: "half_month", label: "50% of Month Rent" },
                      { key: "percentage", label: "10% Agency Sourcing" },
                    ].map((item) => {
                      const isSel = lettingFeeBasis === item.key;
                      return (
                        <Chip
                          key={item.key}
                          label={item.label}
                          clickable
                          color={isSel ? "primary" : "default"}
                          onClick={() => {
                            setLettingFeeBasis(item.key as any);
                            const rent = Number(lettingUnit?.effective_rent || lettingUnit?.monthly_rent || 40000);
                            if (item.key === "one_month") setLettingFeeAmount(String(rent));
                            else if (item.key === "half_month") setLettingFeeAmount(String(Math.round(rent * 0.5)));
                            else if (item.key === "percentage") setLettingFeeAmount(String(Math.round(rent * 0.1)));
                            else setLettingFeeAmount("25000");
                          }}
                          sx={{ fontWeight: isSel ? 700 : 500 }}
                        />
                      );
                    })}
                  </Box>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  <TextField
                    label="Letting Fee Amount (KES)"
                    size="small"
                    type="number"
                    value={lettingFeeAmount}
                    onChange={(e) => setLettingFeeAmount(e.target.value)}
                    helperText="Final negotiated commission payable"
                  />
                  <TextField
                    label="Invoice Issue Date"
                    size="small"
                    type="date"
                    value={lettingFeeDate}
                    onChange={(e) => setLettingFeeDate(e.target.value)}
                    helperText="Date of tenancy closure / invoice"
                    {...({ InputLabelProps: { shrink: true } } as any)}
                  />
                </Box>

                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: -1 }}>3. Review and issue</Typography>
                {/* Live Invoice Preview Breakdown Card */}
                <Box
                  sx={{
                    background: "rgba(37, 99, 235, 0.04)",
                    border: "1px solid rgba(37, 99, 235, 0.2)",
                    borderRadius: "8px",
                    p: 2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#1e40af", display: "flex", alignItems: "center", gap: 1 }}>
                    <span>🧾</span> Invoice Preview Breakdown
                  </Typography>

                  {lettingUnit ? (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1, fontSize: 13, pt: 0.5 }}>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Target Unit:</span>{" "}
                        <strong>{lettingUnit.code}</strong>{" "}
                        <span style={{ fontSize: 11, color: lettingUnit.tenant_name ? "#16a34a" : "#ca8a04" }}>
                          ({lettingUnit.tenant_name ? `Leased: ${lettingUnit.tenant_name}` : "Vacant"})
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Recipient (Owner):</span>{" "}
                        <strong>{lettingFeeOwner || lettingUnit.owner_name || "Unassigned"}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Calculation Basis:</span>{" "}
                        <strong>
                          {lettingFeeBasis === "one_month"
                            ? "1 Month Rent"
                            : lettingFeeBasis === "half_month"
                            ? "50% Month Rent"
                            : lettingFeeBasis === "percentage"
                            ? "10% Agency Sourcing"
                            : "Flat Negotiated"}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Effective Rent:</span>{" "}
                        <strong>KES {Number(lettingUnit.effective_rent || lettingUnit.monthly_rent || 0).toLocaleString()}</strong>
                      </div>
                      <Box sx={{ gridColumn: "1 / -1", pt: 1, borderTop: "1px dashed rgba(37, 99, 235, 0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "#1e40af" }}>Total Amount to Invoice:</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#1e40af" }}>
                          KES {Number(lettingFeeAmount || 0).toLocaleString()}
                        </span>
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: "var(--text-secondary)", fontStyle: "italic", fontSize: 12 }}>
                      Select a unit above to view the real-time invoice breakdown and enable invoicing.
                    </Typography>
                  )}
                </Box>

                <Box
                  sx={{
                    background: "var(--surface-2)",
                    p: 1.5,
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                  }}
                >
                  💼 <strong>Collection Route:</strong> Payment is collected directly into the Estate Agency Commission Account. An immediate draft invoice reference will be allocated and ready for handover or remittance deduction.
                </Box>
              </Box>
            )}
          </Box>
        </Modal>
      )}

      {billingUnit && <UnitBillingScheduleDrawer unit={billingUnit} onClose={() => setBillingUnit(null)} />}
    </>
  );
}

/* ─── PROJECTS ─── */
