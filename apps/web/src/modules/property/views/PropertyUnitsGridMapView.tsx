"use client";

import { useState } from "react";
import { GuidedTenantWizardModal } from "../dialogs/GuidedTenantWizardModal";
import { Building2, CheckCircle2, Clock, UserPlus, Layers } from "lucide-react";

type UnitItem = {
  id: string;
  code: string;
  floor: string;
  type: string;
  status: "occupied" | "expiring" | "vacant";
  tenantName?: string;
  rent: number;
};

export function PropertyUnitsGridMapView({
  onNavigate,
}: {
  onNavigate: (tab: string) => void;
}) {
  const [showWizard, setShowWizard] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);
  const [units] = useState<UnitItem[]>([
    { id: "101", code: "U-101", floor: "Floor 1", type: "Commercial Office", status: "occupied", tenantName: "Apex Solutions Ltd", rent: 45000 },
    { id: "102", code: "U-102", floor: "Floor 1", type: "Commercial Office", status: "vacant", rent: 45000 },
    { id: "103", code: "U-103", floor: "Floor 1", type: "Commercial Office", status: "occupied", tenantName: "Kenia Trade Logistics", rent: 48000 },
    { id: "104", code: "U-104", floor: "Floor 1", type: "Commercial Office", status: "expiring", tenantName: "Greenfield Agritech", rent: 50000 },

    { id: "201", code: "U-201", floor: "Floor 2", type: "Commercial Office", status: "occupied", tenantName: "BlueFin Analytics", rent: 52000 },
    { id: "202", code: "U-202", floor: "Floor 2", type: "Commercial Office", status: "occupied", tenantName: "Optima Legal Practitioners", rent: 52000 },
    { id: "203", code: "U-203", floor: "Floor 2", type: "Commercial Office", status: "vacant", rent: 55000 },
    { id: "204", code: "U-204", floor: "Floor 2", type: "Commercial Office", status: "expiring", tenantName: "Summit Capital Advisors", rent: 55000 },

    { id: "301", code: "U-301", floor: "Penthouse", type: "Executive Suite", status: "occupied", tenantName: "Global Venture Holdings", rent: 95000 },
    { id: "302", code: "U-302", floor: "Penthouse", type: "Executive Suite", status: "vacant", rent: 95000 },
  ]);

  const floors = Array.from(new Set(units.map((u) => u.floor)));

  const total = units.length;
  const occupied = units.filter((u) => u.status === "occupied").length;
  const expiring = units.filter((u) => u.status === "expiring").length;
  const vacant = units.filter((u) => u.status === "vacant").length;
  const occupancyPct = Math.round((occupied / total) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="data-panel" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#000000", textTransform: "uppercase" }}>Total Inventory</span>
          <strong style={{ fontSize: 24, fontWeight: 900, color: "#000000", display: "block", marginTop: 4 }}>{total} Units</strong>
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 750 }}>Westlands Business Centre</span>
        </div>

        <div className="data-panel" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "var(--color-success)", textTransform: "uppercase" }}>Occupied ({occupancyPct}%)</span>
          <strong style={{ fontSize: 24, fontWeight: 900, color: "var(--color-success)", display: "block", marginTop: 4 }}>{occupied} Units</strong>
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 750 }}>Active leases</span>
        </div>

        <div className="data-panel" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "var(--color-warning)", textTransform: "uppercase" }}>Leases Expiring</span>
          <strong style={{ fontSize: 24, fontWeight: 900, color: "var(--color-warning)", display: "block", marginTop: 4 }}>{expiring} Units</strong>
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 750 }}>Requires renewal &lt; 30 days</span>
        </div>

        <div className="data-panel" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "var(--color-danger)", textTransform: "uppercase" }}>Vacant & Available</span>
          <strong style={{ fontSize: 24, fontWeight: 900, color: "var(--color-danger)", display: "block", marginTop: 4 }}>{vacant} Units</strong>
          <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 750 }}>Ready for onboarding</span>
        </div>
      </div>

      {/* Interactive Legend & Onboard Action */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: "#000000" }}>Floorplan Status Legend:</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#000000" }}>
            <i style={{ width: 12, height: 12, background: "var(--color-green-bg)", border: "1px solid var(--color-green-300)", borderRadius: 3 }} />
            Occupied (Green)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#000000" }}>
            <i style={{ width: 12, height: 12, background: "var(--color-amber-bg)", border: "1px solid #fde047", borderRadius: 3 }} />
            Expiring &lt; 30d (Yellow)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#000000" }}>
            <i style={{ width: 12, height: 12, background: "var(--color-slate-50)", border: "1px solid var(--color-slate-300)", borderRadius: 3 }} />
            Vacant (White)
          </span>
        </div>

        <button
          onClick={() => setShowWizard(true)}
          style={{
            background: "var(--color-danger)",
            color: "#ffffff",
            border: 0,
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <UserPlus size={16} />
          <span>+ Guided Tenant Wizard</span>
        </button>
      </div>

      {/* Building Floorplan Grid Map */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {floors.map((floor) => {
          const floorUnits = units.filter((u) => u.floor === floor);

          return (
            <div key={floor} style={{ background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Layers size={18} style={{ color: "var(--color-danger)" }} />
                <h3 style={{ fontSize: 16, fontWeight: 900, color: "#000000", margin: 0 }}>
                  {floor} Layout ({floorUnits.length} Units)
                </h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                {floorUnits.map((u) => {
                  const isOccupied = u.status === "occupied";
                  const isExpiring = u.status === "expiring";
                  const isVacant = u.status === "vacant";

                  return (
                    <div
                      key={u.id}
                      style={{
                        background: isOccupied ? "var(--color-green-soft)" : isExpiring ? "#fffbeb" : "#ffffff",
                        border: `2px solid ${isOccupied ? "var(--color-green-300)" : isExpiring ? "#fde047" : "var(--color-slate-300)"}`,
                        borderRadius: 10,
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: 15, fontWeight: 900, color: "#000000", fontFamily: "ui-monospace, monospace" }}>
                          {u.code}
                        </strong>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 6,
                            textTransform: "uppercase",
                            background: isOccupied ? "var(--color-green-bg)" : isExpiring ? "var(--color-amber-bg)" : "var(--color-slate-100)",
                            color: isOccupied ? "var(--color-success-strong)" : isExpiring ? "var(--color-amber-deep)" : "var(--color-slate-600)",
                          }}
                        >
                          {u.status}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 750, color: "var(--text-primary)" }}>
                        {u.tenantName ? (
                          <span style={{ fontWeight: 900, color: "#000000" }}>👤 {u.tenantName}</span>
                        ) : (
                          <span style={{ color: "var(--text-faint)" }}>⚪ Unoccupied Unit</span>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "#000000" }}>
                          KES {u.rent.toLocaleString()}/mo
                        </span>

                        {isVacant && (
                          <button
                            onClick={() => {
                              setSelectedUnit(u);
                              setShowWizard(true);
                            }}
                            style={{ background: "var(--color-danger)", color: "#fff", border: 0, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                          >
                            Assign Tenant
                          </button>
                        )}
                        {isExpiring && (
                          <button
                            onClick={() => onNavigate("leases")}
                            style={{ background: "var(--color-warning)", color: "#fff", border: 0, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                          >
                            Renew Lease
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Onboarding Wizard Modal */}
      {showWizard && (
        <GuidedTenantWizardModal
          onClose={() => {
            setShowWizard(false);
            setSelectedUnit(null);
          }}
          onComplete={(data) => {
            alert(`Tenant ${data.tenantName} successfully onboarded to Unit ${data.unitCode || selectedUnit?.code || ""}!`);
            setShowWizard(false);
            setSelectedUnit(null);
          }}
        />
      )}
    </div>
  );
}
