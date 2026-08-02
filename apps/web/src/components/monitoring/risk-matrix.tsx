"use client";

import { useMemo, useState } from "react";

export interface RiskItem {
  id: string;
  reference: string;
  description: string;
  category: "financial" | "site_safety" | "schedule" | "regulatory" | "quality";
  likelihood: 1 | 2 | 3 | 4 | 5; // 1: Very Low, 5: Very High
  impact: 1 | 2 | 3 | 4 | 5;     // 1: Minimal, 5: Critical
  mitigation: string;
  owner: string;
  status: "open" | "mitigated" | "closed";
}

interface RiskMatrixProps {
  risks?: RiskItem[];
}

const DEFAULT_RISKS: RiskItem[] = [
  { id: "r1", reference: "RSK-001", description: "Material Supply Chain Delay for Structural Steel", category: "schedule", likelihood: 4, impact: 4, mitigation: "Dual-sourcing agreement signed with secondary regional distributor", owner: "Procurement Manager", status: "open" },
  { id: "r2", reference: "RSK-002", description: "Unforeseen Subsurface Water Seepage during Excavation", category: "site_safety", likelihood: 3, impact: 5, mitigation: "Deploy high-capacity dewatering pumps & subsoil drainage channel", owner: "Site Engineer", status: "open" },
  { id: "r3", reference: "RSK-003", description: "Currency Fluctuations Affecting Imported MEP Equipment", category: "financial", likelihood: 5, impact: 3, mitigation: "Lock forward exchange rate with commercial bank", owner: "Finance Controller", status: "mitigated" },
  { id: "r4", reference: "RSK-004", description: "Municipal Approval Delay for Drainage Connection", category: "regulatory", likelihood: 2, impact: 4, mitigation: "Expedite inspection with County Public Works liaison", owner: "Compliance Officer", status: "open" },
  { id: "r5", reference: "RSK-005", description: "Concrete Batching Plant Quality Variance", category: "quality", likelihood: 2, impact: 3, mitigation: "Mandatory third-party cube testing on every pour", owner: "Quality Inspector", status: "closed" },
];

export function RiskMatrix({ risks = DEFAULT_RISKS }: RiskMatrixProps) {
  const [selectedCell, setSelectedCell] = useState<{ l: number; i: number } | null>(null);

  // Group risks into 5x5 matrix
  const matrixGrid = useMemo(() => {
    const grid: Record<string, RiskItem[]> = {};
    for (let l = 1; l <= 5; l++) {
      for (let i = 1; i <= 5; i++) {
        grid[`${l}-${i}`] = [];
      }
    }
    risks.forEach((r) => {
      grid[`${r.likelihood}-${r.impact}`]?.push(r);
    });
    return grid;
  }, [risks]);

  const filteredRisks = useMemo(() => {
    if (!selectedCell) return risks;
    return matrixGrid[`${selectedCell.l}-${selectedCell.i}`] || [];
  }, [risks, selectedCell, matrixGrid]);

  const getCellColor = (l: number, i: number) => {
    const score = l * i;
    if (score >= 15) return { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b" }; // High Risk (Red)
    if (score >= 8) return { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" };  // Medium Risk (Yellow)
    return { bg: "#dcfce7", border: "#86efac", text: "#166534" };                 // Low Risk (Green)
  };

  return (
    <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>⚠️ 5x5 Visual Risk Matrix & Heatmap</h3>
          <small style={{ color: "#64748b" }}>Click any cell to filter the active risk register below</small>
        </div>

        {selectedCell && (
          <button
            onClick={() => setSelectedCell(null)}
            style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "4px 10px", borderRadius: 6, fontSize: "0.8rem", cursor: "pointer" }}
          >
            Clear Matrix Filter ({selectedCell.l}L × {selectedCell.i}I)
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
        {/* 5x5 Matrix Visual Heatmap */}
        <div>
          <div style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: "bold", color: "#64748b", marginBottom: 4 }}>
            IMPACT $\rightarrow$ (1: Minimal to 5: Critical)
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, width: 240, height: 240 }}>
            {/* Render 5x5 from L5 down to L1 */}
            {[5, 4, 3, 2, 1].map((l) =>
              [1, 2, 3, 4, 5].map((i) => {
                const items = matrixGrid[`${l}-${i}`] || [];
                const color = getCellColor(l, i);
                const isSelected = selectedCell?.l === l && selectedCell?.i === i;

                return (
                  <button
                    key={`${l}-${i}`}
                    onClick={() => setSelectedCell(isSelected ? null : { l, i })}
                    style={{
                      background: color.bg,
                      border: isSelected ? "2.5px solid #000000" : `1px solid ${color.border}`,
                      borderRadius: 6,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "transform 0.1s ease",
                      position: "relative",
                    }}
                    title={`Likelihood: ${l}, Impact: ${i} (${items.length} risks)`}
                  >
                    <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: color.text }}>{l}×{i}</span>
                    {items.length > 0 && (
                      <span
                        style={{
                          marginTop: 2,
                          background: color.text,
                          color: "#ffffff",
                          borderRadius: 10,
                          padding: "1px 6px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}
                      >
                        {items.length}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: "bold", color: "#64748b", marginTop: 4 }}>
            $\uparrow$ LIKELIHOOD (1: Low to 5: High)
          </div>
        </div>

        {/* Filtered Risk Register List */}
        <div>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", color: "#0f172a" }}>
            Risk Register {selectedCell ? `(Filtered Matrix Cell ${selectedCell.l}L × ${selectedCell.i}I)` : `(${risks.length} Total Risks)`}
          </h4>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: 8, textAlign: "left" }}>Ref</th>
                  <th style={{ padding: 8, textAlign: "left" }}>Risk Description</th>
                  <th style={{ padding: 8, textAlign: "center" }}>L × I</th>
                  <th style={{ padding: 8, textAlign: "left" }}>Mitigation Action</th>
                  <th style={{ padding: 8, textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRisks.map((r) => {
                  const score = r.likelihood * r.impact;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 8, fontWeight: "bold", fontFamily: "monospace" }}>{r.reference}</td>
                      <td style={{ padding: 8 }}>
                        <div style={{ fontWeight: 600 }}>{r.description}</div>
                        <small style={{ color: "#64748b" }}>Category: {r.category} | Owner: {r.owner}</small>
                      </td>
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontWeight: "bold", fontSize: "0.75rem",
                          background: score >= 15 ? "#fee2e2" : score >= 8 ? "#fef3c7" : "#dcfce7",
                          color: score >= 15 ? "#991b1b" : score >= 8 ? "#92400e" : "#166534"
                        }}>
                          {r.likelihood}L × {r.impact}I ({score})
                        </span>
                      </td>
                      <td style={{ padding: 8, color: "#334155", fontSize: "0.8rem" }}>{r.mitigation}</td>
                      <td style={{ padding: 8 }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem", fontWeight: "bold",
                          background: r.status === "open" ? "#fee2e2" : r.status === "mitigated" ? "#dbeafe" : "#f1f5f9",
                          color: r.status === "open" ? "#dc2626" : r.status === "mitigated" ? "#2563eb" : "#64748b"
                        }}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
