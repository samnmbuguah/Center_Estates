"use client";

import { CheckCircle2, Clock, FileCheck, Search, ShieldCheck } from "lucide-react";

type ValuationItem = {
  id: string;
  code: string;
  property: string;
  valuationType: string;
  step: 1 | 2 | 3 | 4 | 5;
  valuerName: string;
  estimatedValue: number;
};

export function ValuationStepperView() {
  const instructions: ValuationItem[] = [
    { id: "1", code: "#VAL-2026-001", property: "Westlands Business Centre", valuationType: "Commercial Mortgage Valuation", step: 4, valuerName: "Samuel Njuguna (Registered Valuer)", estimatedValue: 485000000 },
    { id: "2", code: "#VAL-2026-002", property: "Parklands Residential Suites", valuationType: "Asset Market Valuation", step: 2, valuerName: "Mercy Wanjiku", estimatedValue: 210000000 },
  ];

  const steps = [
    { num: 1, label: "Instruction Received" },
    { num: 2, label: "Site Inspection" },
    { num: 3, label: "Comparable Analysis" },
    { num: 4, label: "Draft Valuation" },
    { num: 5, label: "Report Dispatched" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, padding: "16px 20px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: "#000000", margin: 0 }}>
          Valuation Instruction Milestone Stepper
        </h2>
        <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 750 }}>
          Track real-time progress of professional valuation reports from initial site inspection to final signed dispatch.
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {instructions.map((item) => (
          <div key={item.id} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#8b5cf6", fontFamily: "ui-monospace, monospace" }}>{item.code}</span>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: "#000000", margin: "2px 0 0" }}>{item.property}</h3>
                <small style={{ fontSize: 12, color: "#0f172a", fontWeight: 750 }}>{item.valuationType} • Valuer: {item.valuerName}</small>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Estimated Valuation</span>
                <strong style={{ fontSize: 20, fontWeight: 900, color: "#16a34a", display: "block" }}>
                  KES {item.estimatedValue.toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 10, border: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {steps.map((s) => {
                const active = item.step === s.num;
                const completed = item.step > s.num;

                return (
                  <div key={s.num} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: completed ? "#16a34a" : active ? "#8b5cf6" : "#cbd5e1",
                        color: completed || active ? "#ffffff" : "#64748b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {completed ? <CheckCircle2 size={18} /> : s.num}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: active || completed ? 900 : 700, color: active || completed ? "#000000" : "#64748b" }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
