"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { valuationNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type InstructionRow = Record<string, string | number | boolean | null>;

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState<InstructionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/valuation/instructions/")
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as InstructionRow[];
          setInstructions(data || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = instructions.filter((ins) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      String(ins.reference_number || "").toLowerCase().includes(term) ||
      String(ins.property_name || "").toLowerCase().includes(term) ||
      String(ins.client_name || "").toLowerCase().includes(term)
    );
  });

  return (
    <ModuleShell
      moduleKey="valuation"
      moduleName="Valuation"
      eyebrow="Valuation Work"
      title="Valuation Instructions Register"
      subtitle="Property valuation instructions, bank mortgage valuations, site inspection logs, comparable sales evidence."
      accent="#ea580c"
      groups={valuationNav}
      activeId="instructions"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/valuation";
        else window.location.href = `/valuation?tab=${id}`;
      }}
      contextLabel="Instructions Scope"
      contextValue={`${instructions.length} Active Instructions`}
    >
      <div className="valuation-app">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search instruction by reference, property, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", width: 320, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <Link
            href="/valuation?tab=instructions"
            style={{ background: "#ea580c", color: "#fff", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}
          >
            + New Instruction
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading valuation instructions…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 10, textAlign: "left" }}>Ref Number</th>
                <th style={{ padding: 10, textAlign: "left" }}>Property Subject</th>
                <th style={{ padding: 10, textAlign: "left" }}>Instructing Client / Bank</th>
                <th style={{ padding: 10, textAlign: "center" }}>Stage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ins) => (
                <tr key={String(ins.id)} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 10, fontWeight: "bold", fontFamily: "monospace", color: "#ea580c" }}>
                    {String(ins.reference_number || `VAL-${ins.id}`)}
                  </td>
                  <td style={{ padding: 10, fontWeight: 600 }}>{String(ins.property_name || "Commercial Land & Buildings")}</td>
                  <td style={{ padding: 10, color: "#64748b" }}>{String(ins.client_name || "Commercial Bank of Kenya")}</td>
                  <td style={{ padding: 10, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem", fontWeight: "bold", background: "#dbeafe", color: "#1e40af" }}>
                      INSPECTION COMPLETE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ModuleShell>
  );
}
