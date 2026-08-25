"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Box, Button, Chip, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
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
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { Upload } from "lucide-react";

export function UnitsView({ rows, loading, search, setSearch, setTab, onSelectRow }: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void; setTab: (t: PropertyTab) => void; onSelectRow?: (r: Row) => void;
}) {
  const [view, setView] = useState<"commercial" | "residential" | "stacking" | "floorplan">("residential");
  const [selectedFloor, setSelectedFloor] = useState<string>("1");
  const [billingUnit, setBillingUnit] = useState<UnitRow | null>(null);
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

  const [floorImages, setFloorImages] = useState<Record<string, string>>({});
  const floorPlanImage = floorImages[selectedFloor] || "";

  // Available floors list
  const availableFloors = useMemo(() => {
    return Array.from(new Set(units.map(u => String(u.floor ?? "1").trim() || "1"))).sort();
  }, [units]);

  // Set default selected floor if needed
  useEffect(() => {
    if (availableFloors.length > 0 && !availableFloors.includes(selectedFloor)) {
      setSelectedFloor(availableFloors[0]);
    }
  }, [availableFloors, selectedFloor]);

  // Current floor units formatted for UnitFloorPlanCanvas
  const currentFloorUnits = useMemo<UnitLayout[]>(() => {
    return units
      .filter((u) => (String(u.floor ?? "1").trim() || "1") === selectedFloor)
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
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
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
                  {floorPlanImage ? "Change Floor Plan Image" : "Upload Floor Plan Blueprint"}
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === "string") {
                            setFloorImages((prev) => ({ ...prev, [selectedFloor]: reader.result as string }));
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </Button>
                {floorPlanImage && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => setFloorImages((prev) => ({ ...prev, [selectedFloor]: "" }))}
                    sx={{ height: 36, fontSize: 11, textTransform: "none" }}
                  >
                    Clear Image
                  </Button>
                )}
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                💡 Click <strong>"Draw Unit Outline"</strong> to draw boundary corners over each unit space. Click any unit to view details.
              </Typography>
            </Box>

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
