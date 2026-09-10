"use client";

import React, { useCallback, useRef, useState } from "react";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { csvCell as get, csvColumn as col, normalizeCsvHeader as norm, parseCsv } from "@/lib/csv";

type ParsedAssetRow = {
  name: string;
  code?: string;
  category: string;
  asset_class?: string;
  criticality: string;
  condition: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  purchase_value?: string;
  replacement_cost?: string;
  expected_useful_life_years?: string;
  funding_source?: string;
  maintenance_procedure?: string;
};

const ASSET_TEMPLATE_HEADERS = [
  "name",
  "code",
  "category",
  "asset_class",
  "criticality",
  "condition",
  "manufacturer",
  "model_number",
  "serial_number",
  "purchase_value",
  "replacement_cost",
  "expected_useful_life_years",
  "funding_source",
  "maintenance_procedure",
];

const SAMPLE_CSV = `name,code,category,asset_class,criticality,condition,manufacturer,model_number,serial_number,purchase_value,replacement_cost,expected_useful_life_years,funding_source,maintenance_procedure
Main Passenger Lift #1,LIFT-01,Vertical Transportation,Mechanical & Electrical,critical,good,Schindler,3300 AP,SCH-99412,8500000,9500000,15,Reserve Float,Monthly lubrication and brake audit
Prime Standby Generator 500kVA,GEN-500,Backup Power,Mechanical & Electrical,critical,excellent,Cummins,C500 D5e,CUM-44810,12000000,14500000,20,CAPEX Reserve,Weekly no-load test run and fluid analysis
Central Chiller Unit #1,CHILL-01,HVAC & Cooling,Mechanical & Electrical,high,fair,Daikin,EWWD-J,DAI-00812,16500000,18500000,12,CAPEX Reserve,Quarterly refrigerant leak test
Fire Alarm Control Panel,FACP-01,Life Safety,Life Safety,critical,excellent,Notifier,NFS2-3030,NOT-88123,2500000,3000000,15,Safety Float,Monthly battery check and loop test`;

function csvToAssetRows(text: string): ParsedAssetRow[] {
  const all = parseCsv(text);
  if (all.length < 2) return [];
  const h = all[0].map(norm);

  const cName = col(h, ["name", "asset_name", "equipment_name"]);
  const cCode = col(h, ["code", "asset_code", "asset_id", "tag"]);
  const cCat = col(h, ["category", "asset_category", "type"]);
  const cClass = col(h, ["asset_class", "class", "discipline"]);
  const cCrit = col(h, ["criticality", "priority", "criticality_level"]);
  const cCond = col(h, ["condition", "status", "health"]);
  const cMfg = col(h, ["manufacturer", "brand", "make"]);
  const cMod = col(h, ["model_number", "model"]);
  const cSer = col(h, ["serial_number", "serial", "serial_no"]);
  const cPur = col(h, ["purchase_value", "purchase_price", "cost", "value"]);
  const cRepl = col(h, ["replacement_cost", "replacement_value"]);
  const cLife = col(h, ["expected_useful_life_years", "useful_life", "lifespan", "life_years"]);
  const cFund = col(h, ["funding_source", "funding", "budget"]);
  const cProc = col(h, ["maintenance_procedure", "procedure", "sop"]);

  return all.slice(1).map((r) => ({
    name: get(r, cName),
    code: get(r, cCode),
    category: get(r, cCat) || "General M&E",
    asset_class: get(r, cClass) || "Mechanical & Electrical",
    criticality: get(r, cCrit) || "medium",
    condition: get(r, cCond) || "good",
    manufacturer: get(r, cMfg),
    model_number: get(r, cMod),
    serial_number: get(r, cSer),
    purchase_value: get(r, cPur) || "0",
    replacement_cost: get(r, cRepl) || get(r, cPur) || "0",
    expected_useful_life_years: get(r, cLife) || "10",
    funding_source: get(r, cFund) || "Operations Budget",
    maintenance_procedure: get(r, cProc),
  })).filter((r) => Boolean(r.name));
}

export function BulkAssetUploaderModal({
  onClose,
  onSuccess,
  organizationId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string | null;
}) {
  const [rows, setRows] = useState<ParsedAssetRow[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ count: number; errors?: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setFilename(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      const parsed = csvToAssetRows(text);
      setRows(parsed);
    };
    reader.readAsText(file);
  }, []);

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assets_bulk_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const executeUpload = async () => {
    if (rows.length === 0) return;
    setUploading(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/facility/assets/bulk_upload/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ assets: rows }),
      }, organizationId);

      if (res.ok) {
        const data = await res.json();
        setResult({ count: data.created_count, errors: data.errors });
        onSuccess();
      } else {
        const err = await res.json();
        setResult({ count: 0, errors: [err.detail || "Failed to upload assets."] });
      }
    } catch {
      setResult({ count: 0, errors: ["Network or server error during upload."] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "var(--surface)", width: "100%", maxWidth: 740, borderRadius: 12, border: "1px solid var(--border)", padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>
              ⬆ Bulk Upload Assets (CSV)
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Import plant equipment, mechanical systems, life safety assets & infrastructure in bulk.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: 0, fontSize: 18, cursor: "pointer", color: "var(--text-secondary)" }}>
            ✕
          </button>
        </div>

        {/* Action / Template Strip */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 16 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Need the correct column format? Download our pre-formatted asset template.
          </span>
          <button
            onClick={downloadTemplate}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: "0.8rem",
              fontWeight: 800,
              cursor: "pointer",
              color: "var(--primary)",
            }}
          >
            ↓ Download CSV Template
          </button>
        </div>

        {/* Drag and Drop Zone */}
        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileRef.current?.click()}
            style={{
              padding: "30px 20px",
              border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
              borderRadius: 8,
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "var(--surface-sunken)" : "transparent",
              marginBottom: 16,
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>📁</span>
            <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)", display: "block" }}>
              {filename ? filename : "Click or drag your CSV file here"}
            </strong>
            <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
              Supports CSV files with columns for Code, Name, Category, Value, Life, Criticality, etc.
            </small>
          </div>
        )}

        {/* Parsed Rows Preview */}
        {rows.length > 0 && !result && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
                Ready to Import: {rows.length} Assets (Editable Spreadsheet)
              </strong>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Click any cell to correct data prior to import
              </span>
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", width: 90 }}>CODE</th>
                    <th style={{ padding: "6px 8px", textAlign: "left" }}>ASSET NAME</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", width: 140 }}>CATEGORY</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", width: 100 }}>CRITICALITY</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", width: 110 }}>VALUE (KES)</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={r.code || ""}
                          placeholder="Auto"
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => prev.map((item, idx) => idx === i ? { ...item, code: val } : item));
                          }}
                          style={{ width: "100%", padding: "2px 4px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)" }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={r.name || ""}
                          required
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => prev.map((item, idx) => idx === i ? { ...item, name: val } : item));
                          }}
                          style={{ width: "100%", padding: "2px 4px", fontSize: 11, borderRadius: 4, border: !r.name ? "1px solid var(--color-danger)" : "1px solid var(--border)", background: "var(--surface)" }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={r.category || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => prev.map((item, idx) => idx === i ? { ...item, category: val } : item));
                          }}
                          style={{ width: "100%", padding: "2px 4px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)" }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <select
                          value={r.criticality || "medium"}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => prev.map((item, idx) => idx === i ? { ...item, criticality: val } : item));
                          }}
                          style={{ width: "100%", padding: "2px 4px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)" }}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          type="number"
                          value={r.purchase_value || "0"}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => prev.map((item, idx) => idx === i ? { ...item, purchase_value: val, replacement_cost: val } : item));
                          }}
                          style={{ width: "100%", padding: "2px 4px", fontSize: 11, textAlign: "right", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)" }}
                        />
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{ background: "none", border: 0, color: "var(--color-danger)", cursor: "pointer", fontSize: 13, padding: 0 }}
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Banner */}
        {result && (
          <div style={{ padding: 16, background: result.count > 0 ? "var(--color-green-bg)" : "var(--color-red-bg)", border: `1px solid ${result.count > 0 ? "var(--color-green-300)" : "var(--color-red-300)"}`, borderRadius: 8, marginBottom: 16 }}>
            <strong style={{ color: result.count > 0 ? "var(--color-green-text)" : "var(--color-danger-deep)", fontSize: "0.95rem" }}>
              {result.count > 0 ? `✓ Successfully imported ${result.count} assets!` : "⚠️ Import Failed"}
            </strong>
            {result.errors && result.errors.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: "0.8rem", color: "var(--color-danger-deep)" }}>
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: "var(--surface-sunken)",
              border: "1px solid var(--border)",
              padding: "8px 16px",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: "0.82rem",
              cursor: "pointer",
            }}
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={executeUpload}
              disabled={uploading || rows.length === 0}
              style={{
                background: "var(--primary, var(--color-brand-red))",
                color: "#fff",
                border: 0,
                padding: "8px 20px",
                borderRadius: 6,
                fontWeight: 800,
                fontSize: "0.82rem",
                cursor: rows.length === 0 || uploading ? "not-allowed" : "pointer",
                opacity: rows.length === 0 || uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "Importing Assets..." : `Import ${rows.length} Assets`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
