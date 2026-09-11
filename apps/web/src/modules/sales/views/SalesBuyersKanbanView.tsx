"use client";

import { useState } from "react";
import { DollarSign, User, Building, ArrowRight, CheckCircle } from "lucide-react";

type BuyerLead = {
  id: string;
  name: string;
  phone: string;
  targetUnit: string;
  dealValue: number;
  stage: "inquiry" | "visit" | "offer" | "signed" | "handover";
  rating: "Hot" | "Warm" | "Cold";
};

export function SalesBuyersKanbanView() {
  const [leads, setLeads] = useState<BuyerLead[]>([
    { id: "1", name: "David Kiprop", phone: "+254 722 111 222", targetUnit: "Penthouse Suite 301", dealValue: 18500000, stage: "inquiry", rating: "Hot" },
    { id: "2", name: "Sarah Cherono", phone: "+254 733 444 555", targetUnit: "Commercial Unit 104", dealValue: 9200000, stage: "visit", rating: "Hot" },
    { id: "3", name: "Mombasa Enterprises", phone: "+254 711 888 999", targetUnit: "Warehouse Hub B-02", dealValue: 24000000, stage: "offer", rating: "Warm" },
    { id: "4", name: "Dr. Evans Mutua", phone: "+254 700 333 444", targetUnit: "Executive Office 202", dealValue: 12500000, stage: "signed", rating: "Hot" },
  ]);

  const moveStage = (id: string, next: BuyerLead["stage"]) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: next } : l)));
  };

  const stages: Array<{ id: BuyerLead["stage"]; label: string; color: string }> = [
    { id: "inquiry", label: "Lead Inquiry", color: "var(--text-faint)" },
    { id: "visit", label: "Site Visit Scheduled", color: "var(--color-warning)" },
    { id: "offer", label: "Offer Letter Sent", color: "var(--color-info)" },
    { id: "signed", label: "Sale Agreement Signed", color: "var(--color-violet)" },
    { id: "handover", label: "Title & Handover", color: "var(--color-success)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#000000", margin: 0 }}>
            Sales Buyer Pipeline Funnel
          </h2>
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 750 }}>
            Track property buyer leads from initial site visit inquiry to signed agreement and handover.
          </span>
        </div>
      </div>

      <div className="kanban-scroll" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(250px, 1fr))", gap: 16, paddingBottom: 12 }}>
        {stages.map((stg) => {
          const stgLeads = leads.filter((l) => l.stage === stg.id);

          return (
            <div key={stg.id} style={{ background: "var(--color-slate-50)", border: "1px solid var(--color-slate-300)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12, minHeight: 480 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${stg.color}`, paddingBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: "#000000" }}>{stg.label}</span>
                <span style={{ background: stg.color, color: "#ffffff", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 900 }}>
                  {stgLeads.length}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {stgLeads.map((l) => (
                  <div key={l.id} style={{ background: "var(--surface)", border: "1px solid var(--color-slate-300)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 14, fontWeight: 900, color: "#000000" }}>{l.name}</strong>
                      <span style={{ fontSize: 10, fontWeight: 900, background: "var(--color-red-bg)", color: "var(--color-danger)", padding: "2px 6px", borderRadius: 4 }}>
                        {l.rating}
                      </span>
                    </div>

                    <small style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>🏢 {l.targetUnit}</small>
                    <strong style={{ fontSize: 13, fontWeight: 900, color: "var(--color-success)" }}>KES {l.dealValue.toLocaleString()}</strong>

                    <div style={{ borderTop: "1px solid var(--color-slate-100)", paddingTop: 8, marginTop: 4 }}>
                      {stg.id === "inquiry" && (
                        <button onClick={() => moveStage(l.id, "visit")} style={{ width: "100%", background: "var(--color-warning)", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                          Schedule Visit →
                        </button>
                      )}
                      {stg.id === "visit" && (
                        <button onClick={() => moveStage(l.id, "offer")} style={{ width: "100%", background: "var(--color-info)", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                          Send Offer Letter →
                        </button>
                      )}
                      {stg.id === "offer" && (
                        <button onClick={() => moveStage(l.id, "signed")} style={{ width: "100%", background: "var(--color-violet)", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                          Sign Agreement →
                        </button>
                      )}
                      {stg.id === "signed" && (
                        <button onClick={() => moveStage(l.id, "handover")} style={{ width: "100%", background: "var(--color-success)", color: "#fff", border: 0, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                          Complete Handover ✓
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
