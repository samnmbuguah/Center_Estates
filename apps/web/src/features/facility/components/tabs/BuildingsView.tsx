"use client";

import React, { useState } from "react";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";

function PanelHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <header className="panel-title" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontSize: 14, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>{title}</h2>
        {count !== undefined && (
          <span style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
            {count}
          </span>
        )}
      </div>
      {action}
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

type FloorPlanTag = {
  id: string;
  room: string;
  type: string;
  area: number;
  x: number;
  y: number;
  w: number;
  h: number;
  status: string;
  tenant: string;
  color: string;
};

export function BuildingsView({ rows }: { rows: Row[]; kpis: Record<string, string | number> }) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | number>((rows[0]?.id as string | number) ?? "");
  const [selectedFloor, setSelectedFloor] = useState("Floor 2");
  const [selectedAreaType, setSelectedAreaType] = useState<"all" | "lettable" | "common" | "core">("all");
  const [zoom, setZoom] = useState(1.0);
  const [hoveredTag, setHoveredTag] = useState<FloorPlanTag | null>(null);

  const buildings = rows;

  if (buildings.length === 0) {
    return (
      <article className="data-panel" style={{ padding: 32, textAlign: "center" }}>
        <h2 style={{ color: "var(--text-primary)", margin: "0 0 8px" }}>No buildings registered</h2>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Add a building to this property before recording floor areas, infrastructure zones and floor plans.
        </p>
      </article>
    );
  }

  const currentBuilding = buildings.find((b) => String(b.id) === String(selectedBuildingId)) ?? buildings[0];

  const gfa = Number(currentBuilding.gfa ?? 0);
  const commonArea = Number(currentBuilding.common_area ?? 0);
  const lettableArea = Number(currentBuilding.lettable ?? (gfa - commonArea));
  const occupiedArea = Number(currentBuilding.occupied ?? 0);

  const commonAreaPct = gfa ? ((commonArea / gfa) * 100).toFixed(1) : "0.0";
  const lettableAreaPct = gfa ? ((lettableArea / gfa) * 100).toFixed(1) : "0.0";
  const occupancyPct = lettableArea ? ((occupiedArea / lettableArea) * 100).toFixed(1) : "0.0";

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
  const floorPlanTags: FloorPlanTag[] = [
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
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="fc-toolbar-btn" onClick={() => exportCsv(buildings, "facility-buildings.csv")}>
          ↓ Export CSV
        </button>
      </div>
      {/* Top Building KPI Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Gross Floor Area (GFA)" value={`${gfa.toLocaleString()} m²`} sub="Total measured envelope" />
        <FcKpiCard icon="🚪" iconBg="#dcfce7" iconColor="#16a34a" label="Lettable / Net Area" value={`${lettableArea.toLocaleString()} m²`} sub={`${lettableAreaPct}% of Gross Area`} />
        <FcKpiCard icon="👥" iconBg="#fef3c7" iconColor="#d97706" label="Common Area %" value={`${commonAreaPct}%`} sub={`${commonArea.toLocaleString()} m² Circulation`} />
        <FcKpiCard icon="📊" iconBg="#dbeafe" iconColor="#2563eb" label="Occupancy Rate" value={`${occupancyPct}%`} sub={`${occupiedArea.toLocaleString()} m² Leased`} />
        <FcKpiCard icon="⚡" iconBg="#fdf4ff" iconColor="#9333ea" label="Building Efficiency" value="80.0%" sub="Lettable / GFA ratio" />
      </div>

      {/* Building Header Card & Specifications */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <article className="data-panel" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: "0.75rem", background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                {String(currentBuilding.code ?? "BLD-001")}
              </span>
              <h2 style={{ margin: "6px 0 2px", fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {String(currentBuilding.name)}
              </h2>
              <small style={{ color: "var(--text-secondary)" }}>{String(currentBuilding.location ?? "Location not recorded")} · {String(currentBuilding.floors ?? 0)} Floors</small>
            </div>

            <select
              value={String(selectedBuildingId)}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              style={{
                padding: "6px 12px",
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
              <strong style={{ color: "var(--text-primary)" }}>{String(currentBuilding.lr_number ?? "Not recorded")}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", display: "block" }}>Year Commissioned</span>
              <strong style={{ color: "var(--text-primary)" }}>{String(currentBuilding.year_built ?? "Not recorded")}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", display: "block" }}>Operating Access Hours</span>
              <strong style={{ color: "var(--text-primary)" }}>{String(currentBuilding.operating_hours ?? "Not recorded")}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", display: "block" }}>Emergency Contact Desk</span>
              <strong style={{ color: "#dc2626" }}>{String(currentBuilding.emergency_contact ?? "Not recorded")}</strong>
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

          {/* Scale Legend & Zoom Controls */}
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              background: "rgba(15,23,42,0.85)",
              backdropFilter: "blur(4px)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: "0.75rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 12,
              zIndex: 20,
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ width: 50, height: 2, background: "#fff", position: "relative" }}>
              <span style={{ position: "absolute", top: -14, left: 16, fontSize: 10 }}>10m</span>
            </div>
            <span>Calibrated Scale (1:200)</span>
          </div>

          {/* Zoom Buttons Overlay */}
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              display: "flex",
              gap: 4,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: 4,
              borderRadius: 6,
              zIndex: 20,
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
          >
            <button
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
              style={{ background: "none", border: 0, padding: "4px 8px", cursor: "pointer", fontWeight: 900, fontSize: 13 }}
              title="Zoom In"
            >
              ＋
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, alignSelf: "center", minWidth: 36, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              style={{ background: "none", border: 0, padding: "4px 8px", cursor: "pointer", fontWeight: 900, fontSize: 13 }}
              title="Zoom Out"
            >
              －
            </button>
            <button
              onClick={() => setZoom(1.0)}
              style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
              title="Reset View"
            >
              Reset
            </button>
          </div>

          {/* Tagged Polygon Rooms with Scaled Transform */}
          <div
            style={{
              position: "relative",
              width: 720,
              height: 420,
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              transition: "transform 0.2s ease-out",
            }}
          >
            {filteredTags.map((tag) => {
              const isHovered = hoveredTag?.id === tag.id;
              return (
                <div
                  key={tag.id}
                  onMouseEnter={() => setHoveredTag(tag)}
                  onMouseLeave={() => setHoveredTag(null)}
                  style={{
                    position: "absolute",
                    left: tag.x,
                    top: tag.y,
                    width: tag.w,
                    height: tag.h,
                    background: isHovered ? `${tag.color}35` : `${tag.color}18`,
                    border: `2px solid ${tag.color}`,
                    borderRadius: 6,
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    transform: isHovered ? "scale(1.02)" : "none",
                    boxShadow: isHovered ? `0 8px 16px ${tag.color}40` : "0 2px 4px rgba(0,0,0,0.05)",
                    zIndex: isHovered ? 15 : 1,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.78rem", color: "var(--text-primary)", display: "block" }}>
                      {tag.room}
                    </strong>
                    <small style={{ fontSize: "0.72rem", color: tag.color, fontWeight: 700 }}>
                      {tag.tenant}
                    </small>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span style={{ fontSize: "0.68rem", background: "var(--surface)", border: "1px solid var(--border)", padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>
                      {tag.area} m²
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {tag.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Hover Details Card */}
          {hoveredTag && (
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                background: "var(--surface)",
                border: `2px solid ${hoveredTag.color}`,
                borderRadius: 8,
                padding: "12px 14px",
                width: 260,
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
                zIndex: 30,
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)", display: "block" }}>
                    {hoveredTag.room}
                  </strong>
                  <span style={{ color: hoveredTag.color, fontWeight: 800, fontSize: 11 }}>
                    {hoveredTag.tenant}
                  </span>
                </div>
                <span style={{ background: `${hoveredTag.color}20`, color: hoveredTag.color, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
                  {hoveredTag.type}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, margin: "8px 0", padding: "6px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Area:</span>
                  <strong style={{ display: "block" }}>{hoveredTag.area} m² ({(hoveredTag.area * 10.764).toFixed(0)} sq.ft)</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Open Tickets:</span>
                  <strong style={{ display: "#16a34a", fontWeight: 700 }}>0 active</strong>
                </div>
              </div>

              <small style={{ color: "var(--text-muted)", display: "block" }}>
                Click polygon to view tenancy agreement & lease history
              </small>
            </div>
          )}
        </div>
      </article>

      {/* Floor-by-Floor Area Breakdown Table */}
      <article className="data-panel">
        <PanelHeader title={`Floor-by-Floor Area Schedule (${String(currentBuilding.name)})`} />
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>FLOOR LEVEL</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>PRIMARY USE</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>GROSS AREA (GFA)</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>COMMON AREA</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>LETTABLE AREA</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>OCCUPIED</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>OCCUPANCY %</th>
              </tr>
            </thead>
            <tbody>
              {floorBreakdown.map((fl) => {
                const flOcc = fl.lettable > 0 ? ((fl.occupied / fl.lettable) * 100).toFixed(0) : "—";
                return (
                  <tr key={fl.floor} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{fl.floor}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontSize: 12 }}>{fl.use}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{fl.gfa} m²</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-secondary)" }}>{fl.common} m²</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{fl.lettable} m²</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#16a34a" }}>{fl.occupied} m²</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ background: flOcc === "100" ? "#dcfce7" : flOcc === "—" ? "var(--surface-sunken)" : "#dbeafe", color: flOcc === "100" ? "#166534" : flOcc === "—" ? "var(--text-muted)" : "#1e40af", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 800 }}>
                        {flOcc === "—" ? "N/A" : `${flOcc}%`}
                      </span>
                    </td>
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
