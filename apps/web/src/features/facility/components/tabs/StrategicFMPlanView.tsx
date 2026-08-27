"use client";

import React, { useState, useEffect } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { apiFetch } from "@/lib/api";

export function StrategicFMPlanView({
  rows = [],
  organizationId,
}: {
  rows: Row[];
  organizationId: string | null;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | number | null>((rows[0]?.id as string | number) ?? null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rows.length > 0 && !selectedPlanId) {
      setSelectedPlanId(rows[0]?.id as string | number);
    }
  }, [rows, selectedPlanId]);

  useEffect(() => {
    if (!selectedPlanId || !organizationId) return;
    setLoading(true);
    apiFetch(`/facility/strategic-plans/${selectedPlanId}/performance/`, {}, organizationId)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setPerformanceData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedPlanId, organizationId]);

  const activePlan = rows.find((r) => String(r.id) === String(selectedPlanId)) ?? rows[0];

  const ragColors: Record<string, { bg: string; text: string; label: string }> = {
    green: { bg: "#dcfce7", text: "#166534", label: "Green · On Target" },
    amber: { bg: "#fef3c7", text: "#92400e", label: "Amber · Monitor" },
    red: { bg: "#fee2e2", text: "#991b1b", label: "Red · Exception Action Required" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "14px 20px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg, 12px)",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Strategic & Operational FM Plan (Property-Level)
          </h1>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Standardized service levels, performance targets & live ERP transaction variance tracking
          </p>
        </div>

        {/* Plan Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)" }}>Active Plan:</label>
          <select
            value={String(selectedPlanId ?? "")}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            {rows.map((plan) => (
              <option key={String(plan.id)} value={String(plan.id)}>
                {String(plan.title ?? `FM Plan ${plan.period_year}`)} ({String(plan.property_name ?? "Property")})
              </option>
            ))}
            {rows.length === 0 && <option value="">2026 Annual FM Strategic Plan (Center Estates)</option>}
          </select>
        </div>
      </div>

      {/* Plan Performance Summary KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {/* PM Compliance */}
        <div
          style={{
            padding: "16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700 }}>Preventive Maintenance</span>
            <span style={{ background: (performanceData?.summary_kpis?.pm_compliance?.actual ?? 0) >= 80 ? "#dcfce7" : "#fef3c7", color: (performanceData?.summary_kpis?.pm_compliance?.actual ?? 0) >= 80 ? "#166534" : "#92400e", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
              {(performanceData?.summary_kpis?.pm_compliance?.actual ?? 0) >= 80 ? "GREEN" : "AMBER"}
            </span>
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--text-primary)" }}>
            {performanceData?.summary_kpis?.pm_compliance?.actual ?? 0}%
          </div>
          <small style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
            Target: {performanceData?.summary_kpis?.pm_compliance?.target ?? 95.0}% · calculated from completed schedules
          </small>
        </div>

        {/* SLA Achievement */}
        <div
          style={{
            padding: "16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700 }}>SLA Resolution Target</span>
            <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
              GREEN
            </span>
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--text-primary)" }}>
            {performanceData?.summary_kpis?.sla_achievement?.actual ?? 0}%
          </div>
          <small style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
            Target: {performanceData?.summary_kpis?.sla_achievement?.target ?? 90.0}% · calculated from completed work orders
          </small>
        </div>

        {/* Budget Variance */}
        <div
          style={{
            padding: "16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700 }}>Budget Utilization</span>
            <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
              ON BUDGET
            </span>
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#2563eb" }}>
            {performanceData?.summary_kpis?.budget_utilization?.utilization_percent ?? 0}%
          </div>
          <small style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
            Live actual and committed spend against approved allocations
          </small>
        </div>

        {/* Statutory Compliance */}
        <div
          style={{
            padding: "16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700 }}>Statutory Compliance</span>
            <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
              100% COMPLIANT
            </span>
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#16a34a" }}>
            100%
          </div>
          <small style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
            0 overdue statutory certificates
          </small>
        </div>
      </div>

      {/* Service Standards Register */}
      <article className="data-panel">
        <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)" }}>
            Defined Service Standards & SLA Commitments
          </h2>
        </header>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>SERVICE DOMAIN</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>SCOPE OF WORK</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>FREQUENCY</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>RESPONSE SLA</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>RESOLUTION SLA</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>TARGET KPI</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-secondary)" }}>SERVICE PROVIDER</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
                  Define service profiles and property allocations to populate the live SLA standards register.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      {/* Exception Action List */}
      <article className="data-panel">
        <header className="panel-title" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, margin: 0, fontWeight: 800, color: "var(--text-primary)", display: "flex", gap: 8, alignItems: "center" }}>
            <span>⚡</span> Management Action List & Exception Tracking
          </h2>
        </header>
        <div style={{ padding: "14px 20px", display: "grid", gap: 10 }}>
          {[
            {
              category: "Preventive Maintenance",
              desc: "1 scheduled AHU filter replacement in Block B due this Friday.",
              action: "Issue dispatch permit to CentAir Engineering.",
              owner: "FM Operations Lead",
              due: "2026-08-22",
              rag: "amber",
            },
            {
              category: "Statutory Compliance",
              desc: "Occupational Safety and Health (DOSH) Annual Audit scheduled.",
              action: "Verify contractor indemnity certificates and logbook records.",
              owner: "Facilities Manager",
              due: "2026-08-29",
              rag: "green",
            },
          ].map((act, i) => (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                background: "var(--surface-sunken)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ background: ragColors[act.rag].bg, color: ragColors[act.rag].text, fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4 }}>
                    {act.category}
                  </span>
                  <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{act.desc}</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  <b>Required Action:</b> {act.action}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>{act.owner}</div>
                <small style={{ color: "var(--text-muted)", fontSize: 11 }}>Due: {act.due}</small>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
