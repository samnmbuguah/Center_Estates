"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
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
import { Upload } from "lucide-react";

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
  const units = rows as UnitRow[];
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
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={`btn sm ${view === "residential" ? "primary" : "ghost"}`} data-testid="occupancy-residential-btn" onClick={() => setView("residential")}>Residential</button>
          <button type="button" className={`btn sm ${view === "commercial" ? "primary" : "ghost"}`} data-testid="occupancy-commercial-btn" onClick={() => setView("commercial")}>Commercial</button>
          <button type="button" className={`btn sm ${view === "stacking" ? "primary" : "ghost"}`} data-testid="occupancy-stacking-btn" onClick={() => setView("stacking")}>🏢 Stacking Plan</button>
          <button type="button" className={`btn sm ${view === "floorplan" ? "primary" : "ghost"}`} data-testid="occupancy-floorplan-btn" onClick={() => setView("floorplan")}>📐 Floor Plan Outline</button>
        </div>
      </ViewToolbar>

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
                          const tenantName = rawTenant ? String(rawTenant) : null;
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
          {Object.keys(typologyCounts).length > 0 ? (
            <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
              {Object.entries(typologyCounts).map(([type, count]) => (
                <div key={type} className="card" style={{ padding: 12, background: "var(--surface-2)" }}>
                  <strong style={{ fontSize: 18 }}>{kN(count)}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{type}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="🗂" title="No typology data" description="Unit type / typology (e.g. 1BD, 2BD, 3BD) will appear here once units are registered." />
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
          <ListState loading={loading} empty={units.length === 0} emptyTitle="No units found" emptyDesc="Generate units from a property or register them individually.">
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Unit Code</th>
                    <th>Building</th>
                    <th>Floor</th>
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
                  {units.map((u) => {
                    const rent = (u.metadata as Record<string, unknown> | undefined)?.rent;
                    const area = u.area === undefined || u.area === null ? null : Number(u.area);
                    return (
                      <tr key={String(u.id)} onClick={() => onSelectRow?.(u)}>
                        <td className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{String(u.code ?? "—")}</td>
                        <td style={{ fontSize: 12 }}>{String(u.building_name ?? "—")}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{String(u.floor ?? "—")}</td>
                        {view === "commercial" ? (
                          <>
                            <td className="mono">{area === null ? "—" : kN(area)}</td>
                            <td className="mono">{area === null ? "—" : kN(area / 10.7639)}</td>
                          </>
                        ) : (
                          <td style={{ fontSize: 12 }}>{String(u.unit_type ?? "—")}</td>
                        )}
                        <td><StatusPill value={String(u.status ?? "—")} /></td>
                        <td style={{ fontSize: 12 }}>{String((u.metadata as Record<string, unknown> | undefined)?.tenant ?? "—")} {rent !== undefined ? <span className="muted" style={{ fontSize: 11 }}>· {kM(rent)}/mo</span> : null}</td>
                        <td><button type="button" className="btn ghost sm" onClick={(event) => { event.stopPropagation(); setBillingUnit(u); }}>Schedule</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ListState>
        </Panel>
      )}
      {billingUnit && <UnitBillingScheduleDrawer unit={billingUnit} onClose={() => setBillingUnit(null)} />}
    </>
  );
}

/* ─── PROJECTS ─── */
