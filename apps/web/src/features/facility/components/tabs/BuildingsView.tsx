"use client";

import React, { useState } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus, HealthBar } from "../FacilityToolbar";

function PanelHeader({
  title,
  action,
  actionText = "View all →",
}: {
  title: string;
  action?: () => void;
  actionText?: string;
}) {
  return (
    <header className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h2 style={{ fontSize: 14, margin: 0, display: "flex", gap: 8, alignItems: "center", color: "var(--text-primary)", fontWeight: 800 }}>
        {title}
      </h2>
      {action && (
        <button onClick={action} style={{ background: "none", border: 0, color: "var(--primary)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          {actionText}
        </button>
      )}
    </header>
  );
}

function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="fc-kpi-card" style={{ textAlign: "left" }}>
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub && <span className="fc-kpi-sub">{sub}</span>}
    </div>
  );
}

export function BuildingsView({ rows, kpis }: { rows: Row[]; kpis: Record<string, string | number> }) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | number>((rows[0]?.id as string | number) ?? "bld-1");
  const [selectedFloor, setSelectedFloor] = useState("Floor 2");
  const [selectedAreaType, setSelectedAreaType] = useState<"all" | "lettable" | "common" | "core">("all");

  const buildings = rows.length > 0 ? rows : [
    { id: "bld-1", name: "Finance House", code: "BLD-001", lr_number: "LR 209/10842", year_built: 2018, floors: 12, gfa: 25000, common_area: 5000, lettable: 20000, occupied: 19600, location: "Nairobi CBD", operating_hours: "06:00 - 20:00 Mon-Sat", emergency_contact: "+254 700 123 456" },
    { id: "bld-2", name: "Utalii Plaza", code: "BLD-002", lr_number: "LR 209/4512", year_built: 2020, floors: 8, gfa: 18500, common_area: 3700, lettable: 14800, occupied: 13912, location: "Upper Hill, Nairobi", operating_hours: "24/7 Access", emergency_contact: "+254 711 987 654" },
    { id: "bld-3", name: "Center Heights", code: "BLD-003", lr_number: "LR 336/902", year_built: 2022, floors: 15, gfa: 32000, common_area: 6400, lettable: 25600, occupied: 24320, location: "Westlands, Nairobi", operating_hours: "24/7 Access", emergency_contact: "+254 722 555 888" },
  ];

  const currentBuilding = buildings.find((b) => String(b.id) === String(selectedBuildingId)) ?? buildings[0];

  const gfa = Number(currentBuilding.gfa ?? 25000);
  const commonArea = Number(currentBuilding.common_area ?? 5000);
  const lettableArea = Number(currentBuilding.lettable ?? (gfa - commonArea));
  const occupiedArea = Number(currentBuilding.occupied ?? Math.round(lettableArea * 0.95));

  const commonAreaPct = gfa ? ((commonArea / gfa) * 100).toFixed(1) : "20.0";
  const lettableAreaPct = gfa ? ((lettableArea / gfa) * 100).toFixed(1) : "80.0";
  const occupancyPct = lettableArea ? ((occupiedArea / lettableArea) * 100).toFixed(1) : "98.0";

  // Floor-by-floor breakdown data
  const floorBreakdown = [
    { floor: "Basement 2", gfa: 2200, common: 2200, lettable: 0, occupied: 0, use: "Parking & Pump Room", units: 0 },
    { floor: "Basement 1", gfa: 2200, common: 1400, lettable: 800, occupied: 800, use: "Storage & Chiller Plant", units: 4 },
    { floor: "Ground Floor", gfa: 2100, common: 600, lettable: 1500, occupied: 1500, use: "Banking Hall & Retail", units: 5 },
    { floor: "Floor 1", gfa: 2050, common: 410, lettable: 1640, occupied: 1640, use: "Commercial Office", units: 6 },
    { floor: "Floor 2", gfa: 2050, common: 410, lettable: 1640, occupied: 1640, use: "Commercial Office", units: 6 },
    { floor: "Floor 3", gfa: 2050, common: 410, lettable: 1640, occupied: 1640, use: "Commercial Office", units: 6 },
    { floor: "Floor 4", gfa: 2050, common: 410, lettable: 1640, occupied: 1500, use: "Commercial Office", units: 6 },
  ];

  // Scaled polygon tags for Floor 2
  const floorPlanTags = [
    { id: "t1", room: "Unit 201 (Anchor Tenant)", type: "lettable", area: 420.5, x: 20, y: 30, w: 220, h: 120, status: "Occupied", tenant: "Safaricom PLC", color: "#3b82f6" },
    { id: "t2", room: "Unit 202 (Executive Suite)", type: "lettable", area: 380.0, x: 260, y: 30, w: 200, h: 120, status: "Occupied", tenant: "PwC Kenya", color: "#3b82f6" },
    { id: "t3", room: "Unit 203 (Office Suite)", type: "lettable", area: 410.0, x: 480, y: 30, w: 210, h: 120, status: "Occupied", tenant: "KCB Bank", color: "#3b82f6" },
    { id: "t4", room: "Central Lift Lobby & Atrium", type: "common", area: 180.0, x: 260, y: 170, w: 200, h: 80, status: "Common Area", tenant: "Common Core", color: "#10b981" },
    { id: "t5", room: "Restrooms & Service Shafts", type: "core", area: 90.0, x: 120, y: 170, w: 120, h: 80, status: "Service Core", tenant: "M&E Risers", color: "#f59e0b" },
    { id: "t6", room: "Emergency Fire Staircase A", type: "core", area: 50.0, x: 20, y: 170, w: 80, h: 80, status: "Fire Escape", tenant: "Safety Core", color: "#ef4444" },
    { id: "t7", room: "Unit 204 (East Wing)", type: "lettable", area: 429.5, x: 20, y: 270, w: 340, h: 130, status: "Occupied", tenant: "Standard Chartered", color: "#3b82f6" },
    { id: "t8", room: "Unit 205 (West Wing)", type: "lettable", area: 420.0, x: 380, y: 270, w: 310, h: 130, status: "Available", tenant: "Vacant (Available)", color: "#8b5cf6" },
  ];

  const filteredTags = selectedAreaType === "all"
    ? floorPlanTags
    : floorPlanTags.filter((t) => t.type === selectedAreaType);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Building KPI Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Gross Floor Area (GFA)" value={`${gfa.toLocaleString()} m²`} sub="Total measured envelope" />
        <FcKpiCard icon="🚪" iconBg="#dcfce7" iconColor="#16a34a" label="Lettable / Net Area" value={`${lettableArea.toLocaleString()} m²`} sub={`${lettableAreaPct}% of Gross Area`} />
        <FcKpiCard icon="🌿" iconBg="#ffedd5" iconColor="#ea580c" label="Common & Service Area" value={`${commonArea.toLocaleString()} m²`} sub={`${commonAreaPct}% Common factor`} />
        <FcKpiCard icon="▦" iconBg="#fdf4ff" iconColor="#9333ea" label="Occupancy Rate" value={`${occupancyPct}%`} sub={`${occupiedArea.toLocaleString()} m² occupied`} />
        <FcKpiCard icon="📍" iconBg="#e0f2fe" iconColor="#0284c7" label="Floors & Levels" value={String(currentBuilding.floors ?? 12)} sub={String(currentBuilding.lr_number ?? "LR 209/10842")} />
      </div>

      {/* Building Identity Card + Area Computation Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* Building Identity & Physical Specs */}
        <article className="data-panel" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
              Building Identity & Operational Parameters
            </h2>
            <select
              value={String(selectedBuildingId)}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-primary)",
                fontSize: "0.82rem",
                fontWeight: 700,
              }}
            >
              {buildings.map((b) => (
                <option key={String(b.id)} value={String(b.id)}>
                  {String(b.name)} ({String(b.code)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.82rem" }}>
            <div>
              <span style={{ color: "var(--text-secondary)", display: "block" }}>Land Reference (LR) Number</span>
              <strong style={{ color: "var(--text-primary)" }}>{String(currentBuilding.lr_number ?? "LR 209/10842")}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", display: "block" }}>Year Commissioned</span>
              <strong style={{ color: "var(--text-primary)" }}>{String(currentBuilding.year_built ?? 2018)}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", display: "block" }}>Operating Access Hours</span>
              <strong style={{ color: "var(--text-primary)" }}>{String(currentBuilding.operating_hours ?? "24/7 Access")}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", display: "block" }}>Emergency Contact Desk</span>
              <strong style={{ color: "#dc2626" }}>{String(currentBuilding.emergency_contact ?? "+254 700 123 456")}</strong>
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Critical Building Infrastructure Zones
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {["500kVA Generator Room (Basement)", "Chiller Plant Room (Basement 1)", "Main Fiber & Telecoms MPOE", "Roof-Level Solar PV Array (120kW)", "Borehole & Reverse Osmosis Plant"].map((zone) => (
                <span key={zone} style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: 4, fontSize: "0.75rem", color: "var(--text-primary)", fontWeight: 600 }}>
                  ⚡ {zone}
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Standard Area Computation Formula Card */}
        <article className="data-panel" style={{ padding: "18px 20px" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Standard Area Computation Engine
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.82rem" }}>
            <div style={{ background: "var(--surface-sunken)", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Gross Floor Area (GFA)</span>
                <strong>{gfa.toLocaleString()} m² (100.0%)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: "var(--text-secondary)" }}>
                <span>- Common Area (Lobbies, Stairs, M&E)</span>
                <span>{commonArea.toLocaleString()} m² ({commonAreaPct}%)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)", fontWeight: 800, color: "#16a34a" }}>
                <span>= Lettable / Net Rentable Area</span>
                <span>{lettableArea.toLocaleString()} m² ({lettableAreaPct}%)</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <div>
                <strong style={{ display: "block", color: "var(--text-primary)" }}>Current Occupied Lettable Area</strong>
                <small style={{ color: "var(--text-secondary)" }}>{occupiedArea.toLocaleString()} m² under active tenant leases</small>
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#2563eb" }}>
                {occupancyPct}%
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* Scaled Floor Plan Viewer & Polygon Area Tagging */}
      <article className="data-panel" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", gap: 8, alignItems: "center" }}>
              <span>📐</span> Scaled Interactive Floor Plan & Room Polygon Tagging
            </h2>
            <small style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
              Calibrated architectural drawing (Scale: 1m = 50px) · Version 2.1 Approved
            </small>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-primary)",
                fontSize: "0.82rem",
                fontWeight: 700,
              }}
            >
              {["Basement 1", "Ground Floor", "Floor 1", "Floor 2", "Floor 3", "Floor 4", "Floor 5"].map((fl) => (
                <option key={fl} value={fl}>{fl}</option>
              ))}
            </select>

            {/* Filter by Tag Type */}
            <div style={{ display: "flex", background: "var(--surface-sunken)", padding: 2, borderRadius: 6, border: "1px solid var(--border)" }}>
              {(["all", "lettable", "common", "core"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedAreaType(t)}
                  style={{
                    border: 0,
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: selectedAreaType === t ? "var(--surface)" : "transparent",
                    color: selectedAreaType === t ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Floor Plan Canvas */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 440,
            background: "var(--surface-sunken)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
        >
          {/* Background Grid Pattern simulating CAD drawing */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              opacity: 0.6,
            }}
          />

          {/* Scale Legend */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: "0.72rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
              zIndex: 10,
            }}
          >
            <div style={{ width: 50, height: 2, background: "#fff", position: "relative" }}>
              <span style={{ position: "absolute", top: -14, left: 16, fontSize: 10 }}>10m</span>
            </div>
            <span>Scale Calibrated (1:200)</span>
          </div>

          {/* Tagged Polygon Rooms */}
          <div style={{ position: "relative", width: 720, height: 420 }}>
            {filteredTags.map((tag) => (
              <div
                key={tag.id}
                style={{
                  position: "absolute",
                  left: tag.x,
                  top: tag.y,
                  width: tag.w,
                  height: tag.h,
                  background: `${tag.color}22`,
                  border: `2px solid ${tag.color}`,
                  borderRadius: 6,
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                }}
                title={`${tag.room} · ${tag.area} m² · ${tag.tenant}`}
              >
                <div>
                  <strong style={{ fontSize: "0.75rem", color: "var(--text-primary)", display: "block" }}>
                    {tag.room}
                  </strong>
                  <small style={{ fontSize: "0.7rem", color: tag.color, fontWeight: 700 }}>
                    {tag.tenant}
                  </small>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", fontWeight: 800 }}>
                  <span style={{ background: tag.color, color: "#fff", padding: "1px 5px", borderRadius: 3 }}>
                    {tag.area} m²
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{tag.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>

      {/* Floor-by-Floor Area Breakdown Table */}
      <article className="data-panel">
        <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
            Floor-by-Floor Area Schedule & Occupancy Breakdown
          </h2>
          <button className="fc-toolbar-btn" onClick={() => exportCsv(floorBreakdown, "floor-area-schedule.csv")}>
            ↓ Export Area Schedule
          </button>
        </header>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>FLOOR LEVEL</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>PRIMARY USE</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>GROSS (GFA)</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>COMMON AREA</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>NET LETTABLE</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>OCCUPIED</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>OCCUPANCY %</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>UNITS</th>
              </tr>
            </thead>
            <tbody>
              {floorBreakdown.map((fl) => {
                const occ = fl.lettable > 0 ? Math.round((fl.occupied / fl.lettable) * 100) : 100;
                return (
                  <tr key={fl.floor} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 800, fontSize: 13, color: "var(--text-primary)" }}>{fl.floor}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{fl.use}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, fontWeight: 700 }}>{fl.gfa.toLocaleString()} m²</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, color: "var(--text-secondary)" }}>{fl.common.toLocaleString()} m²</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12, color: "#16a34a", fontWeight: 800 }}>{fl.lettable.toLocaleString()} m²</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontSize: 12 }}>{fl.occupied.toLocaleString()} m²</td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ background: occ >= 90 ? "#dcfce7" : "#fef3c7", color: occ >= 90 ? "#166534" : "#92400e", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
                        {occ}%
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, fontSize: 12 }}>{fl.units}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
