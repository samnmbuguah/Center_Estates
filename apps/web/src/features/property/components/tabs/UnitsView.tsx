"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, MenuItem, Paper, Select, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
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
import { LettingFeeModal } from "../modals/LettingFeeModal";
import { csvColumn, normalizeCsvHeader, parseCsv } from "@/lib/csv";

type StoredFloorPlan = {
  id: string; building: string; floor: string; title: string; version: string;
  original_filename?: string; file_type?: string; original_url?: string; preview_url?: string;
  preview_status?: string; preview_error?: string; created_at?: string;
};

type ServiceChargeImportRow = { unit_code: string; amount: string };
type ServiceChargePreview = { property_name: string; matched: number; monthly_total: string };

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
  const [chargeImportOpen, setChargeImportOpen] = useState(false);
  const [chargeImportRows, setChargeImportRows] = useState<ServiceChargeImportRow[]>([]);
  const [chargeImportPreview, setChargeImportPreview] = useState<ServiceChargePreview | null>(null);
  const [chargeImportFile, setChargeImportFile] = useState("");
  const [chargeImportError, setChargeImportError] = useState("");
  const [chargeImportBusy, setChargeImportBusy] = useState(false);

  // On-demand letting fee invoice state
  const [lettingFeeModalOpen, setLettingFeeModalOpen] = useState(false);
  const [lettingUnit, setLettingUnit] = useState<UnitRow | null>(null);

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
    setLettingUnit(u || null);
    setLettingFeeModalOpen(true);
  };

  const closeServiceChargeImport = () => {
    if (chargeImportBusy) return;
    setChargeImportOpen(false);
    setChargeImportRows([]);
    setChargeImportPreview(null);
    setChargeImportFile("");
    setChargeImportError("");
  };

  const previewServiceChargeFile = async (file?: File) => {
    if (!file) return;
    setChargeImportOpen(true);
    setChargeImportBusy(true);
    setChargeImportError("");
    setChargeImportPreview(null);
    setChargeImportFile(file.name);
    try {
      const csvRows = parseCsv(await file.text());
      const headers = (csvRows.shift() ?? []).map(normalizeCsvHeader);
      const codeColumn = csvColumn(headers, ["unit_no", "unit_number", "unit_code", "unit", "code"]);
      const amountColumn = csvColumn(headers, ["monthly_service_charge", "service_charge_amount", "service_charge_rate", "sc_amount"]);
      if (codeColumn < 0 || amountColumn < 0) {
        throw new Error("The CSV needs a unit_no column and a monthly_service_charge or service_charge_rate column.");
      }
      const parsed = csvRows.filter(row => row.some(Boolean)).map(row => ({
        unit_code: String(row[codeColumn] || "").trim(),
        amount: String(row[amountColumn] || "").replace(/[\s,]/g, "").trim(),
      }));
      if (!parsed.length) throw new Error("The CSV contains no service-charge rows.");
      await apiFetch("/auth/csrf/");
      const response = await apiFetch("/property/units/bulk-service-charges/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ rows: parsed, apply: false }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The service-charge schedule could not be previewed."));
      setChargeImportRows(parsed);
      setChargeImportPreview(await response.json() as ServiceChargePreview);
    } catch (error) {
      setChargeImportRows([]);
      setChargeImportError(error instanceof Error ? error.message : "The service-charge schedule could not be read.");
    } finally {
      setChargeImportBusy(false);
    }
  };

  const applyServiceChargeImport = async () => {
    if (!chargeImportRows.length || !chargeImportPreview) return;
    setChargeImportBusy(true);
    setChargeImportError("");
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch("/property/units/bulk-service-charges/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ rows: chargeImportRows, apply: true }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The service charges could not be saved."));
      const amounts = new Map(chargeImportRows.map(row => [row.unit_code.trim().toUpperCase(), row.amount]));
      setLocalUnits(current => current.map(unit => {
        const amount = amounts.get(String(unit.code).trim().toUpperCase());
        if (amount === undefined) return unit;
        return {
          ...unit,
          common_area_fee_amount: amount,
          metadata: {
            ...((unit.metadata || {}) as Record<string, unknown>),
            billing_setup: { service_charge_rate: amount, service_charge_calculation: "fixed" },
          },
        };
      }));
      toast.success(`${chargeImportPreview.matched} service charges saved. Monthly total: ${money.format(Number(chargeImportPreview.monthly_total))}.`);
      setChargeImportOpen(false);
      setChargeImportRows([]);
      setChargeImportPreview(null);
      setChargeImportFile("");
    } catch (error) {
      setChargeImportError(error instanceof Error ? error.message : "The service charges could not be saved.");
    } finally {
      setChargeImportBusy(false);
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
          <Button
            size="small"
            variant="outlined"
            component="label"
            startIcon={<Upload size={15} />}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            Upload service charges
            <input hidden type="file" accept=".csv,text/csv" onChange={(event) => { void previewServiceChargeFile(event.target.files?.[0]); event.target.value = ""; }} />
          </Button>
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
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell padding="checkbox" sx={{ width: 44, textAlign: "center" }}>
                      <Checkbox
                        size="small"
                        checked={allVisibleSelected}
                        onChange={handleToggleSelectAll}
                        aria-label="Select all visible units"
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Unit Code</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Building</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Floor</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Landlord / Owner</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Mandate</TableCell>
                    {view === "commercial" ? (
                      <>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Area (sq.ft)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Area (m²)</TableCell>
                      </>
                    ) : (
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Typology</TableCell>
                    )}
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Tenant</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Billing</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayUnits.map((u) => {
                    const rent = (u.metadata as Record<string, unknown> | undefined)?.rent;
                    const area = u.area === undefined || u.area === null ? null : Number(u.area);
                    const isSelected = selectedIds.has(String(u.id));
                    return (
                      <TableRow
                        key={String(u.id)}
                        hover
                        selected={isSelected}
                        onClick={() => onSelectRow?.(u)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell padding="checkbox" sx={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(String(u.id))}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main", fontWeight: 700 }}>
                            {String(u.code ?? "—")}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2">{String(u.building_name ?? "—")}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
                            {String(u.floor ?? "—")}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {u.owner_name ? (
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "secondary.main" }}>{u.owner_name}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.management_mandate ? (
                            <Chip
                              size="small"
                              variant="outlined"
                              color="secondary"
                              label={u.management_mandate.replace(/_/g, " ")}
                              sx={{ fontSize: 10, height: 20 }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        {view === "commercial" ? (
                          <>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
                                {area === null ? "—" : kN(area)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace" }}>
                                {area === null ? "—" : kN(area / 10.7639)}
                              </Typography>
                            </TableCell>
                          </>
                        ) : (
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditSingleUnit(u);
                              }}
                              endIcon={<Edit2 size={11} />}
                              title="Click to edit unit typology"
                              sx={{ textTransform: "none", py: 0.2, px: 1, minWidth: 0, fontSize: 12 }}
                            >
                              {String(u.unit_type ?? "—")}
                            </Button>
                          </TableCell>
                        )}
                        <TableCell align="center"><StatusPill value={String(u.status ?? "—")} /></TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {String(u.tenant_name || (u.metadata as Record<string, unknown> | undefined)?.tenant || "—")}
                          </Typography>
                          {u.status !== "occupied" ? (
                            <Chip size="small" label="⚪ Vacant" sx={{ height: 18, fontSize: 10, fontWeight: 700, mt: 0.5 }} />
                          ) : isDevTenanted(u) ? (
                            <Chip
                              size="small"
                              color="primary"
                              variant="outlined"
                              label={`🏢 Developer Unit · Rent KES ${Number(u.effective_rent || u.monthly_rent || 0).toLocaleString()}`}
                              sx={{ height: 18, fontSize: 10, fontWeight: 700, mt: 0.5 }}
                            />
                          ) : isDirectLandlord(u) ? (
                            <Chip
                              size="small"
                              color="secondary"
                              variant="outlined"
                              label="🔑 Direct Landlord · KES 0 Mgmt"
                              sx={{ height: 18, fontSize: 10, fontWeight: 700, mt: 0.5 }}
                            />
                          ) : isOwnerOccupied(u) ? (
                            <Chip
                              size="small"
                              color="warning"
                              variant="outlined"
                              label="🏠 Owner Occupier · SC Only"
                              sx={{ height: 18, fontSize: 10, fontWeight: 700, mt: 0.5 }}
                            />
                          ) : (
                            <Chip
                              size="small"
                              color="success"
                              variant="outlined"
                              label="👤 Active Tenancy"
                              sx={{ height: 18, fontSize: 10, fontWeight: 700, mt: 0.5 }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                            <Button
                              size="small"
                              variant="text"
                              onClick={(event) => { event.stopPropagation(); setBillingUnit(u); }}
                              sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: 11 }}
                            >
                              {u.billing_isolation?.bill_rent ? "Rent + utilities" : u.billing_isolation?.bill_utilities_to_tenant ? "Utilities only" : "Schedule"}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              title="Issue ad-hoc letting fee invoice to landlord"
                              onClick={(event) => {
                                event.stopPropagation();
                                openLettingFeeModalForUnit(u);
                              }}
                              sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: 11, fontWeight: 700 }}
                            >
                              ⚡ Letting
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
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
      <LettingFeeModal
        open={lettingFeeModalOpen}
        onClose={() => setLettingFeeModalOpen(false)}
        units={units}
        initialUnit={lettingUnit}
      />

      {chargeImportOpen && (
        <Modal
          title="Upload monthly service charges"
          onClose={closeServiceChargeImport}
          footer={
            <>
              <Button variant="outlined" onClick={closeServiceChargeImport} disabled={chargeImportBusy}>Cancel</Button>
              <Button variant="contained" onClick={() => void applyServiceChargeImport()} disabled={chargeImportBusy || !chargeImportPreview}>
                {chargeImportBusy ? "Checking…" : `Save ${chargeImportPreview?.matched ?? 0} charges`}
              </Button>
            </>
          }
        >
          <Stack spacing={2}>
            <Alert severity="info">
              This updates existing units only. It will not create units or change owners, tenants, leases, rent or utility billing.
            </Alert>
            <Box>
              <Typography sx={{ fontWeight: 800 }}>{chargeImportFile || "Service-charge CSV"}</Typography>
              <Typography variant="body2" color="text.secondary">Every unit code is checked against the currently selected property before saving.</Typography>
            </Box>
            {chargeImportBusy && <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><CircularProgress size={20} /><Typography>Validating every row…</Typography></Box>}
            {chargeImportError && <Alert severity="error">{chargeImportError}</Alert>}
            {chargeImportPreview && (
              <>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3,1fr)" }, gap: 1 }}>
                  <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Property</Typography><Typography sx={{ fontWeight: 800 }}>{chargeImportPreview.property_name}</Typography></Box>
                  <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Matched units</Typography><Typography sx={{ fontWeight: 900 }}>{chargeImportPreview.matched} of {chargeImportRows.length}</Typography></Box>
                  <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Monthly billing total</Typography><Typography sx={{ fontWeight: 900 }}>{money.format(Number(chargeImportPreview.monthly_total))}</Typography></Box>
                </Box>
                <Box sx={{ maxHeight: 260, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", "th,td": { p: 1, borderBottom: "1px solid", borderColor: "divider", textAlign: "left" } }}>
                    <thead><tr><th>Unit</th><th style={{ textAlign: "right" }}>Monthly service charge</th></tr></thead>
                    <tbody>{chargeImportRows.slice(0, 20).map(row => <tr key={row.unit_code}><td>{row.unit_code}</td><td style={{ textAlign: "right" }}>{money.format(Number(row.amount))}</td></tr>)}</tbody>
                  </Box>
                </Box>
                {chargeImportRows.length > 20 && <Typography variant="caption" color="text.secondary">Showing the first 20 of {chargeImportRows.length} validated rows.</Typography>}
              </>
            )}
          </Stack>
        </Modal>
      )}

      {billingUnit && <UnitBillingScheduleDrawer unit={billingUnit} onClose={() => setBillingUnit(null)} />}
    </>
  );
}

/* ─── PROJECTS ─── */
