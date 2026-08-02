"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { valuationNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type InstructionRow = Record<string, string | number | boolean | null>;

const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function SingleValuationWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [instruction, setInstruction] = useState<InstructionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/valuation/instructions/${id}/`)
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as InstructionRow;
          setInstruction(data);
        } else if (active) {
          setInstruction({ id, reference_number: `VAL-2026-${id.slice(0, 3)}`, property_name: "Riverside Office Complex Tower B", client_name: "Commercial Bank of Kenya", assessed_market_value: 380000000 });
        }
      })
      .catch(() => {
        if (active) setInstruction({ id, reference_number: `VAL-2026-${id.slice(0, 3)}`, property_name: "Riverside Office Complex Tower B", client_name: "Commercial Bank of Kenya", assessed_market_value: 380000000 });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const propName = instruction ? String(instruction.property_name || "Valuation Subject") : "Valuation Subject";

  return (
    <ModuleShell
      moduleKey="valuation"
      moduleName="Valuation"
      eyebrow="Valuation Job Workspace"
      title={propName}
      subtitle="Site inspection evidence, comparable market sales, draft valuation report, and signed certification."
      accent="#ea580c"
      groups={valuationNav}
      activeId="instructions"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/valuation";
        else window.location.href = `/valuation?tab=${tabId}`;
      }}
      contextLabel="Valuation Ref"
      contextValue={String(instruction?.reference_number || `VAL-${id}`)}
    >
      <div className="valuation-app">
        <div style={{ marginBottom: 14 }}>
          <Link href="/valuation/instructions" style={{ color: "#ea580c", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Valuation Register
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading valuation workspace…</div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Reference Number</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#ea580c", fontFamily: "monospace" }}>{String(instruction?.reference_number)}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Assessed Market Value</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#16a34a" }}>{cash.format(Number(instruction?.assessed_market_value || 380000000))}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Forced Sale Value (FSV)</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#2563eb" }}>{cash.format(285000000)}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Instructing Client</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#0f172a" }}>{String(instruction?.client_name)}</h3>
              </div>
            </div>

            <div style={{ background: "#ffffff", padding: 18, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#0f172a" }}>Site Inspection & Valuation Workflow</h4>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ padding: "4px 12px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontWeight: "bold", fontSize: "0.75rem" }}>SITE INSPECTED</span>
                <span style={{ padding: "4px 12px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontWeight: "bold", fontSize: "0.75rem" }}>COMPARABLES ANALYZED</span>
                <span style={{ padding: "4px 12px", borderRadius: 12, background: "#dbeafe", color: "#1e40af", fontWeight: "bold", fontSize: "0.75rem" }}>DRAFT REPORT SIGNED</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
