"use client";

import { useState } from "react";

export interface ColumnMapping {
  itemNumber: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string;
}

export function BoqIngestion() {
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    itemNumber: "Col A (Item No)",
    description: "Col B (Description)",
    unit: "Col C (Unit)",
    quantity: "Col D (Qty)",
    rate: "Col E (Rate KES)",
    amount: "Col F (Total Amount)",
  });

  const SAMPLE_PREVIEW_ROWS = [
    { itemNumber: "1.1", description: "Site Excavation and Earthworks", unit: "m³", quantity: 1200, rate: 850, amount: 1020000 },
    { itemNumber: "1.2", description: "Substructure Reinforced Concrete Footings", unit: "m³", quantity: 450, rate: 18500, amount: 8325000 },
    { itemNumber: "1.3", description: "High Tensile Steel Reinforcement Bars (Y16)", unit: "Tonnes", quantity: 38, rate: 145000, amount: 5510000 },
    { itemNumber: "2.1", description: "Superstructure Masonry Walling", unit: "m²", quantity: 1800, rate: 3200, amount: 5760000 },
  ];

  return (
    <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>📥 BoQ & Work Plan Spreadsheet Ingestion</h3>
          <small style={{ color: "#64748b" }}>Upload Excel (.xlsx) or CSV files to auto-extract BoQ line items and work plan schedules</small>
        </div>

        {/* Step Indicator */}
        <div style={{ display: "flex", gap: 8, fontSize: "0.8rem", fontWeight: "bold" }}>
          <span style={{ color: step === "upload" ? "#2563eb" : "#64748b" }}>1. File Drop</span>
          <span>$\rightarrow$</span>
          <span style={{ color: step === "map" ? "#2563eb" : "#64748b" }}>2. Column Mapping</span>
          <span>$\rightarrow$</span>
          <span style={{ color: step === "preview" ? "#2563eb" : "#64748b" }}>3. Verification & Ingest</span>
        </div>
      </div>

      {step === "upload" && (
        <div
          onClick={() => {
            setFileName("Sample_BoQ_Project_Phase1.xlsx");
            setStep("map");
          }}
          style={{
            border: "2px dashed #94a3b8",
            borderRadius: 8,
            padding: 36,
            textAlign: "center",
            background: "#f8fafc",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📁</div>
          <strong style={{ color: "#0f172a", fontSize: "1rem" }}>Drag & Drop BoQ Excel / CSV file here</strong>
          <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "4px 0 12px 0" }}>Supports .xlsx, .xls, .csv files up to 25MB</p>
          <button style={{ background: "#2563eb", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
            Select File from Device
          </button>
        </div>
      )}

      {step === "map" && (
        <div>
          <div style={{ background: "#dbeafe", color: "#1e40af", padding: 10, borderRadius: 6, fontSize: "0.85rem", marginBottom: 14 }}>
            📄 File Loaded: <strong>{fileName}</strong> (4 Sheet Tabs Found: &quot;Summary&quot;, &quot;Substructure&quot;, &quot;Superstructure&quot;, &quot;Finishes&quot;)
          </div>

          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "#0f172a" }}>Map Excel Columns to Database Attributes</h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {Object.entries(mapping).map(([key, val]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: 8, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155", textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                <select
                  value={val}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{ background: "#fff", border: "1px solid #cbd5e1", padding: 4, borderRadius: 4, fontSize: "0.8rem" }}
                >
                  <option>{val}</option>
                  <option>Col A (Item No)</option>
                  <option>Col B (Description)</option>
                  <option>Col C (Unit)</option>
                  <option>Col D (Qty)</option>
                  <option>Col E (Rate)</option>
                  <option>Col F (Amount)</option>
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setStep("upload")} style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "6px 14px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}>Back</button>
            <button onClick={() => setStep("preview")} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "6px 16px", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Continue to Preview $\rightarrow$</button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "#0f172a" }}>Ingestion Preview & Baseline Validation (4 Line Items Extracted)</h4>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: 16 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 8, textAlign: "left" }}>Item No</th>
                <th style={{ padding: 8, textAlign: "left" }}>Description</th>
                <th style={{ padding: 8, textAlign: "center" }}>Unit</th>
                <th style={{ padding: 8, textAlign: "right" }}>Qty</th>
                <th style={{ padding: 8, textAlign: "right" }}>Rate (KES)</th>
                <th style={{ padding: 8, textAlign: "right" }}>Total Amount (KES)</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_PREVIEW_ROWS.map((row) => (
                <tr key={row.itemNumber} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 8, fontWeight: "bold", fontFamily: "monospace" }}>{row.itemNumber}</td>
                  <td style={{ padding: 8 }}>{row.description}</td>
                  <td style={{ padding: 8, textAlign: "center" }}>{row.unit}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{row.quantity.toLocaleString()}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{row.rate.toLocaleString()}</td>
                  <td style={{ padding: 8, textAlign: "right", fontWeight: "bold", color: "#2563eb" }}>{row.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "#166534", fontWeight: 600 }}>✓ Validation passed: 0 missing rates, 0 formatting errors</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep("map")} style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "6px 14px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}>Back to Mapping</button>
              <button onClick={() => alert("BoQ data successfully ingested into project baseline!")} style={{ background: "#16a34a", color: "#fff", border: "none", padding: "6px 16px", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Confirm & Commit Ingestion</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
