"use client";

import { useState } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus, HealthBar } from "../FacilityToolbar";

function PanelHeader({
  title,
  action,
}: {
  title: string;
  action?: () => void;
}) {
  return (
    <header className="panel-title">
      <h2 style={{ fontSize: 14, margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
        {title}
      </h2>
      {action && (
        <button onClick={action} style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          View all →
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
  const [selectedLoc, setSelectedLoc] = useState(0);
  const buildingCount = Number((kpis?.buildings ?? rows.length) || 12);
  const locations = [
    { name: "Nairobi Head Office", county: "Nairobi County", count: 5, color: "#e23b3b" },
    { name: "Mombasa Branch", county: "Mombasa County", count: 2, color: "#3b82f6" },
    { name: "Kisumu Office", county: "Kisumu County", count: 1, color: "#8b5cf6" },
    { name: "Eldoret Office", county: "Uasin Gishu County", count: 1, color: "#f59e0b" },
    { name: "Nakuru Office", county: "Nakuru County", count: 1, color: "#10b981" },
    { name: "Nyeri Office", county: "Nyeri County", count: 1, color: "#6366f1" },
    { name: "Meru Office", county: "Meru County", count: 1, color: "#ec4899" },
    { name: "Remote Sites", county: "Various Counties", count: 2, color: "#9ca3af" },
  ];
  const totalFloorArea = rows.length > 0 ? rows.reduce((s, r) => s + Number(r.floor_area ?? 0), 0) : null;
  const avgOccupancy = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + Number(r.occupancy ?? 0), 0) / rows.length) : null;
  const monthlyOpsCost = rows.length > 0 ? rows.reduce((s, r) => s + Number(r.monthly_cost ?? 0), 0) : null;

  return (
    <>
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Buildings" value={String(kpis?.buildings ?? 0)} sub="Across all locations" />
        <FcKpiCard icon="📍" iconBg="#dcfce7" iconColor="#16a34a" label="Locations" value={String(locations.length || "—")} sub="Active sites" />
        <FcKpiCard icon="📐" iconBg="#dbeafe" iconColor="#2563eb" label="Total Floor Area" value={totalFloorArea ? `${totalFloorArea.toLocaleString()} m²` : "—"} sub="Gross floor area" />
        <FcKpiCard icon="▦" iconBg="#fdf4ff" iconColor="#9333ea" label="Avg. Occupancy" value={avgOccupancy ? `${avgOccupancy}%` : "—"} sub="All buildings" />
        <FcKpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Monthly Operations Cost" value={monthlyOpsCost ? money.format(monthlyOpsCost) : "—"} sub="All buildings" />
      </div>

      <div className="fc-locations-layout">
        {/* Location list */}
        <article className="data-panel">
          <PanelHeader title="Locations Overview" />
          <div className="fc-location-list">
            {locations.map((loc, i) => (
              <button
                key={loc.name}
                className={`fc-location-item ${i === selectedLoc ? "active" : ""}`}
                onClick={() => setSelectedLoc(i)}
              >
                <span className="fc-location-dot" style={{ background: loc.color }} />
                <div className="fc-location-name">
                  <strong>{loc.name}</strong>
                  <small>{loc.county}</small>
                </div>
                <span className="fc-location-count">
                  {loc.count} {loc.count === 1 ? "Building" : "Buildings"}
                </span>
              </button>
            ))}
          </div>
        </article>

        {/* Map + table */}
        <div style={{ display: "grid", gap: 16 }}>
          <article className="data-panel">
            <PanelHeader title="Location Map" />
            <div className="card" style={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-2)" }}>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 40, opacity: 0.3 }}>🗺️</span>
                <div className="muted" style={{ marginTop: 8 }}>Map view requires a configured GIS provider.</div>
              </div>
            </div>
          </article>

          {/* Buildings table */}
          <article className="data-panel">
            <div className="fc-table-toolbar">
              <span style={{ color: "#27364a", fontWeight: 700, fontSize: 13 }}>All Buildings ({buildingCount})</span>
              <button className="fc-toolbar-btn" onClick={() => exportCsv(rows, "buildings.csv")}>↓ Export</button>
            </div>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Building Name</th>
                    <th>Location</th>
                    <th>Building Type</th>
                    <th>Floor Area</th>
                    <th>Occupancy</th>
                    <th>Status</th>
                    <th>Monthly Cost</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0
                    ? rows.slice(0, 8).map((row) => (
                        <tr key={String(row.id)}>
                          <td>
                            <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
                              <div style={{ height: 36, width: 36, fontSize: 16, borderRadius: 6, display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--muted)" }}>
                                {String(row.name || "?").slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <strong style={{ display: "block", fontSize: 12 }}>{String(row.name ?? "—")}</strong>
                                <small style={{ color: "#8a96a7", fontSize: 10 }}>{String(row.code ?? "—")}</small>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            <span style={{ color: "#e23b3b", marginRight: 4 }}>📍</span>
                            {String(row.location ?? "Nairobi")}
                          </td>
                          <td style={{ fontSize: 12 }}>{String(row.type ?? "Commercial Office")}</td>
                          <td style={{ fontSize: 12 }}>{String(row.floor_area ?? "—")} m²</td>
                          <td>
                            <HealthBar pct={Number(row.occupancy ?? 85)} />
                          </td>
                          <td><FcStatus value="active" /></td>
                          <td style={{ fontSize: 12 }}>{money.format(Number(row.monthly_cost ?? 0))}</td>
                          <td>
                            <button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button>
                          </td>
                        </tr>
                      ))
                    : [
                        { id: 1, name: "Finance House", code: "BLD-001", location: "Nairobi Head Office", type: "Commercial Office", floor: "25,000", occupancy: 98, cost: 850000 },
                        { id: 2, name: "Uchumi House", code: "BLD-002", location: "Nairobi Head Office", type: "Commercial Office", floor: "18,500", occupancy: 92, cost: 620000 },
                        { id: 3, name: "Utalii House", code: "BLD-003", location: "Nairobi Head Office", type: "Commercial Office", floor: "22,000", occupancy: 95, cost: 710000 },
                        { id: 4, name: "Mombasa Offices", code: "BLD-004", location: "Mombasa Branch", type: "Commercial Office", floor: "8,500", occupancy: 85, cost: 280000 },
                      ].map((b) => (
                        <tr key={b.id}>
                          <td>
                            <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
                              <div style={{ height: 36, width: 36, fontSize: 16, borderRadius: 6, display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--muted)" }}>
                                {String(b.name || "?").slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <strong style={{ display: "block", fontSize: 12 }}>{b.name}</strong>
                                <small style={{ color: "#8a96a7", fontSize: 10 }}>Building ID: {b.code}</small>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}><span style={{ color: "#e23b3b", marginRight: 4 }}>📍</span>{b.location}</td>
                          <td style={{ fontSize: 12 }}>{b.type}</td>
                          <td style={{ fontSize: 12 }}>{b.floor} m²</td>
                          <td><HealthBar pct={b.occupancy} /></td>
                          <td><FcStatus value="active" /></td>
                          <td style={{ fontSize: 12 }}>KSh {b.cost.toLocaleString()}</td>
                          <td><button style={{ background: "none", border: "1px solid #d7dce5", borderRadius: 6, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⋯</button></td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <div className="fc-pagination">
              <span className="fc-pager-info">Showing 1 to {rows.length > 0 ? Math.min(rows.length, 8) : 4} of {buildingCount} buildings</span>
              <div className="fc-pager">
                <button className="fc-page-btn active">1</button>
                <button className="fc-page-btn">2</button>
                <button className="fc-page-btn">3</button>
                <button className="fc-page-btn">›</button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
