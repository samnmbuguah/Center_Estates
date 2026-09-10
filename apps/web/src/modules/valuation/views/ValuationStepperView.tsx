import { useState } from "react";
import { CheckCircle2, Clock, FileCheck, Search, ShieldCheck } from "lucide-react";
import { Pagination } from "@/components/module-ui";

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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const instructions: ValuationItem[] = [
    { id: "1", code: "#VAL-2026-001", property: "Westlands Business Centre", valuationType: "Commercial Mortgage Valuation", step: 4, valuerName: "Samuel Njuguna (Registered Valuer)", estimatedValue: 485000000 },
    { id: "2", code: "#VAL-2026-002", property: "Parklands Residential Suites", valuationType: "Asset Market Valuation", step: 2, valuerName: "Mercy Wanjiku", estimatedValue: 210000000 },
  ];

  const filtered = instructions.filter(
    (item) =>
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      item.property.toLowerCase().includes(search.toLowerCase()) ||
      item.valuationType.toLowerCase().includes(search.toLowerCase())
  );

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const steps = [
    { num: 1, label: "Instruction Received" },
    { num: 2, label: "Site Inspection" },
    { num: 3, label: "Comparable Analysis" },
    { num: 4, label: "Draft Valuation" },
    { num: 5, label: "Report Dispatched" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#000000", margin: 0 }}>
            Valuation Instruction Milestone Stepper
          </h2>
          <span style={{ fontSize: 13, color: "var(--color-slate-900)", fontWeight: 750 }}>
            Track real-time progress of professional valuation reports from initial site inspection to final signed dispatch.
          </span>
        </div>

        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-slate-500)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search instructions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px 8px 36px",
              borderRadius: 8,
              border: "1px solid var(--color-slate-300)",
              fontSize: 13,
              fontWeight: 700,
              color: "#000000",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {paginated.map((item) => (
          <div key={item.id} style={{ background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 900, color: "var(--color-violet-strong)", fontFamily: "ui-monospace, monospace" }}>{item.code}</span>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: "#000000", margin: "2px 0 0" }}>{item.property}</h3>
                <small style={{ fontSize: 12, color: "var(--color-slate-900)", fontWeight: 750 }}>{item.valuationType} • Valuer: {item.valuerName}</small>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-slate-500)", textTransform: "uppercase" }}>Estimated Valuation</span>
                <strong style={{ fontSize: 20, fontWeight: 900, color: "var(--color-success)", display: "block" }}>
                  KES {item.estimatedValue.toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div style={{ background: "var(--color-slate-50)", padding: 16, borderRadius: 10, border: "1px solid var(--color-slate-200)", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
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
                        background: completed ? "var(--color-success)" : active ? "var(--color-violet-strong)" : "var(--color-slate-300)",
                        color: completed || active ? "#ffffff" : "var(--color-slate-500)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {completed ? <CheckCircle2 size={18} /> : s.num}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: active || completed ? 900 : 700, color: active || completed ? "#000000" : "var(--color-slate-500)" }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
    </div>
  );
}
