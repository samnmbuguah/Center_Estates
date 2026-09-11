"use client";

import { useState } from "react";
import { Wrench, CheckCircle2, Clock, AlertTriangle, ArrowRight, UserCheck, ShieldAlert } from "lucide-react";

type WorkOrderItem = {
  id: string;
  code: string;
  title: string;
  property: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "unassigned" | "dispatched" | "in_progress" | "inspection" | "closed";
  technician?: string;
  dueDate: string;
};

export function FacilityWorkOrdersKanbanView() {
  const [items, setItems] = useState<WorkOrderItem[]>([
    { id: "1", code: "#WO-56350", title: "E2E Common Area Lighting Repair", property: "Westlands Business Centre", priority: "critical", status: "unassigned", dueDate: "Today, 5:00 PM" },
    { id: "2", code: "#WO-84042", title: "Quarterly Electrical Distribution Inspection", property: "Westlands Business Centre", priority: "high", status: "dispatched", technician: "Joseph Omondi", dueDate: "Tomorrow, 10:00 AM" },
    { id: "3", code: "#WO-36779", title: "Generator Fuel Pump Replacement", property: "Parklands Plaza", priority: "high", status: "in_progress", technician: "Peter Kamau", dueDate: "14 Aug 2026" },
    { id: "4", code: "#WO-70213", title: "Borehole Water Pressure Audit", property: "Westlands Business Centre", priority: "medium", status: "inspection", technician: "Aqua Solutions Ltd", dueDate: "15 Aug 2026" },
    { id: "5", code: "#WO-10476", title: "HVAC Filter Maintenance", property: "Mombasa Commercial Hub", priority: "low", status: "closed", technician: "Francis Njoroge", dueDate: "10 Aug 2026" },
  ]);

  const moveStatus = (id: string, newStatus: WorkOrderItem["status"]) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)));
  };

  const columns: Array<{ id: WorkOrderItem["status"]; label: string; color: string }> = [
    { id: "unassigned", label: "Unassigned", color: "var(--color-danger)" },
    { id: "dispatched", label: "Dispatched", color: "var(--color-warning)" },
    { id: "in_progress", label: "In Progress", color: "var(--color-info)" },
    { id: "inspection", label: "Under Inspection", color: "var(--color-violet)" },
    { id: "closed", label: "Closed & Verified", color: "var(--color-success)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 12, padding: "16px 20px" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#000000", margin: 0 }}>
            Work Order Kanban Dispatch Board
          </h2>
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 750 }}>
            Drag and track work order progression across real-time technician status columns.
          </span>
        </div>
      </div>

      {/* 5-Column Kanban Board */}
      <div className="kanban-scroll" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(260px, 1fr))", gap: 16, paddingBottom: 12 }}>
        {columns.map((col) => {
          const colItems = items.filter((i) => i.status === col.id);

          return (
            <div
              key={col.id}
              style={{
                background: "var(--color-slate-50)",
                border: "1px solid var(--color-slate-300)",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                minHeight: 500,
              }}
            >
              {/* Column Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${col.color}`, paddingBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: "#000000" }}>{col.label}</span>
                <span style={{ background: col.color, color: "#ffffff", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 900 }}>
                  {colItems.length}
                </span>
              </div>

              {/* Work Order Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {colItems.map((item) => {
                  const isCritical = item.priority === "critical";

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--color-slate-300)",
                        borderRadius: 10,
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "#000000", fontFamily: "ui-monospace, monospace" }}>
                          {item.code}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            padding: "2px 6px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            background: isCritical ? "var(--color-red-bg)" : "var(--color-amber-bg)",
                            color: isCritical ? "var(--color-danger-strong)" : "var(--color-amber-deep)",
                          }}
                        >
                          {item.priority}
                        </span>
                      </div>

                      <strong style={{ fontSize: 13, fontWeight: 800, color: "#000000", lineHeight: 1.3 }}>
                        {item.title}
                      </strong>

                      <small style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>
                        🏢 {item.property}
                      </small>

                      {item.technician ? (
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-green-text)", background: "var(--color-green-bg)", padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                          <UserCheck size={14} />
                          <span>Tech: {item.technician}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-danger-strong)", background: "var(--color-red-bg)", padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                          <AlertTriangle size={14} />
                          <span>Needs Tech Dispatch</span>
                        </div>
                      )}

                      {/* Column Move Quick Buttons */}
                      <div style={{ borderTop: "1px solid var(--color-slate-100)", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between", gap: 6 }}>
                        {col.id === "unassigned" && (
                          <button onClick={() => moveStatus(item.id, "dispatched")} style={{ width: "100%", background: "var(--color-danger)", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                            Dispatch Technician →
                          </button>
                        )}
                        {col.id === "dispatched" && (
                          <button onClick={() => moveStatus(item.id, "in_progress")} style={{ width: "100%", background: "var(--color-info)", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                            Start Work →
                          </button>
                        )}
                        {col.id === "in_progress" && (
                          <button onClick={() => moveStatus(item.id, "inspection")} style={{ width: "100%", background: "var(--color-violet)", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                            Request Inspection →
                          </button>
                        )}
                        {col.id === "inspection" && (
                          <button onClick={() => moveStatus(item.id, "closed")} style={{ width: "100%", background: "var(--color-success)", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                            Verify & Close ✓
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
    </div>
  );
}
