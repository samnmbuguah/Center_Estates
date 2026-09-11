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
    <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--color-slate-200)", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>📥 BoQ & Work Plan Spreadsheet Ingestion</h3>
          <small style={{ color: "var(--text-faint)" }}>Upload Excel (.xlsx) or CSV files to auto-extract BoQ line items and work plan schedules</small>
        </div>

        {/* Step Indicator */}
        <div style={{ display: "flex", gap: 8, fontSize: "0.8rem", fontWeight: "bold" }}>
          <span style={{ color: step === "upload" ? "var(--color-info)" : "var(--color-slate-500)" }}>1. File Drop</span>
          <span>$\rightarrow$</span>
          <span style={{ color: step === "map" ? "var(--color-info)" : "var(--color-slate-500)" }}>2. Column Mapping</span>
          <span>$\rightarrow$</span>
          <span style={{ color: step === "preview" ? "var(--color-info)" : "var(--color-slate-500)" }}>3. Verification & Ingest</span>
        </div>
      </div>

      {step === "upload" && (
        <div
          onClick={() => {
            setFileName("Sample_BoQ_Project_Phase1.xlsx");
            setStep("map");
          }}
          style={{
            border: "2px dashed var(--color-slate-400)",
            borderRadius: 8,
            padding: 36,
            textAlign: "center",
            background: "var(--color-slate-50)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📁</div>
          <strong style={{ color: "var(--text-primary)", fontSize: "1rem" }}>Drag & Drop BoQ Excel / CSV file here</strong>
          <p style={{ color: "var(--text-faint)", fontSize: "0.85rem", margin: "4px 0 12px 0" }}>Supports .xlsx, .xls, .csv files up to 25MB</p>
          <button style={{ background: "var(--color-info)", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
            Select File from Device
          </button>
        </div>
      )}

      {step === "map" && (
        <div>
          <div style={{ background: "var(--color-blue-bg)", color: "var(--color-info-deep)", padding: 10, borderRadius: 6, fontSize: "0.85rem", marginBottom: 14 }}>
            📄 File Loaded: <strong>{fileName}</strong> (4 Sheet Tabs Found: &quot;Summary&quot;, &quot;Substructure&quot;, &quot;Superstructure&quot;, &quot;Finishes&quot;)
          </div>

          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "var(--text-primary)" }}>Map Excel Columns to Database Attributes</h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {Object.entries(mapping).map(([key, val]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-slate-50)", padding: 8, borderRadius: 6, border: "1px solid var(--color-slate-200)" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                <select
                  value={val}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                  style={{ background: "var(--surface)", border: "1px solid var(--color-slate-300)", padding: 4, borderRadius: 4, fontSize: "0.8rem" }}
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
            <button onClick={() => setStep("upload")} style={{ background: "var(--color-slate-100)", color: "var(--text-soft)", border: "1px solid var(--color-slate-300)", padding: "6px 14px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}>Back</button>
            <button onClick={() => setStep("preview")} style={{ background: "var(--color-info)", color: "#fff", border: "none", padding: "6px 16px", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Continue to Preview $\rightarrow$</button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "var(--text-primary)" }}>Ingestion Preview & Baseline Validation (4 Line Items Extracted)</h4>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: 16 }}>
            <thead>
              <tr style={{ background: "var(--color-slate-50)", borderBottom: "2px solid var(--color-slate-200)" }}>
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
                <tr key={row.itemNumber} style={{ borderBottom: "1px solid var(--color-slate-100)" }}>
                  <td style={{ padding: 8, fontWeight: "bold", fontFamily: "monospace" }}>{row.itemNumber}</td>
                  <td style={{ padding: 8 }}>{row.description}</td>
                  <td style={{ padding: 8, textAlign: "center" }}>{row.unit}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{row.quantity.toLocaleString()}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{row.rate.toLocaleString()}</td>
                  <td style={{ padding: 8, textAlign: "right", fontWeight: "bold", color: "var(--color-info)" }}>{row.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-green-text)", fontWeight: 600 }}>✓ Validation passed: 0 missing rates, 0 formatting errors</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep("map")} style={{ background: "var(--color-slate-100)", color: "var(--text-soft)", border: "1px solid var(--color-slate-300)", padding: "6px 14px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer" }}>Back to Mapping</button>
              <button onClick={() => alert("BoQ data successfully ingested into project baseline!")} style={{ background: "var(--color-success)", color: "#fff", border: "none", padding: "6px 16px", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Confirm & Commit Ingestion</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
