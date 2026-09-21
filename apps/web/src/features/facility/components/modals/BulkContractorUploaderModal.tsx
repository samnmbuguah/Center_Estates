"use client";

import React, { useCallback, useRef, useState } from "react";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { csvCell as get, csvColumn as col, describeEmptyGrid, normalizeCsvHeader as norm, parseCsv, parseImportGrid } from "@/lib/csv";

type ParsedContractorRow = {
  name: string;
  code?: string;
  specialty: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  emergency_phone?: string;
  pin_number?: string;
  registration_number?: string;
  coverage_areas?: string;
  rating?: string;
  status?: string;
};

const SAMPLE_CSV = `name,code,specialty,contact_name,email,phone,emergency_phone,pin_number,registration_number,coverage_areas,rating,status
Schindler Lifts Kenya Ltd,VND-ELEV-01,Vertical Transportation & Lifts,Francis Mwangi,service.ke@schindler.com,+254722100200,+254700999111,P051234567X,REG-SCH-2018,Nairobi & Mombasa,4.8,active
CentAir Mechanical Engineering,VND-HVAC-02,HVAC & Central Chillers,Dennis Ochieng,contracts@centair.co.ke,+254733400500,+254711888222,P051987654Z,REG-CA-2015,Coast Region,4.6,active
PowerTech Energy Systems,VND-GEN-03,Diesel Generators & Switchgear,Esther Wanjiru,support@powertech.co.ke,+254799000444,+254700777333,P051444333A,REG-PT-2020,Nationwide,4.9,active
Metro Fire Safety Solutions,VND-FIRE-04,Fire Suppression & Life Safety,Peter Kimani,info@metrofire.co.ke,+254711222333,+254722555666,P051777888K,REG-MF-2019,Nairobi & Kiambu,4.7,active`;

function csvToContractorRows(text: string): ParsedContractorRow[] {
  const all = parseCsv(text);
  if (all.length < 2) return [];
  const h = all[0].map(norm);

  const cName = col(h, ["name", "provider_name", "vendor_name", "company_name"]);
  const cCode = col(h, ["code", "vendor_code", "provider_id", "code_id"]);
  const cSpec = col(h, ["specialty", "category", "trade", "service_type"]);
  const cContact = col(h, ["contact_name", "contact_person", "representative", "manager"]);
  const cEmail = col(h, ["email", "email_address", "contact_email"]);
  const cPhone = col(h, ["phone", "phone_number", "telephone", "mobile"]);
  const cEmerg = col(h, ["emergency_phone", "emergency_number", "hotline", "24_7_desk"]);
  const cPin = col(h, ["pin_number", "tax_pin", "kra_pin", "pin"]);
  const cReg = col(h, ["registration_number", "company_registration", "reg_no"]);
  const cArea = col(h, ["coverage_areas", "coverage", "region", "zones"]);
  const cRate = col(h, ["rating", "score"]);
  const cStatus = col(h, ["status", "state"]);

  return all.slice(1).map((r) => ({
    name: get(r, cName),
    code: get(r, cCode),
    specialty: get(r, cSpec) || "General Maintenance",
    contact_name: get(r, cContact),
    email: get(r, cEmail),
    phone: get(r, cPhone),
    emergency_phone: get(r, cEmerg) || get(r, cPhone),
    pin_number: get(r, cPin),
    registration_number: get(r, cReg),
    coverage_areas: get(r, cArea),
    rating: get(r, cRate) || "4.5",
    status: get(r, cStatus) || "active",
  })).filter((r) => Boolean(r.name));
}

export function BulkContractorUploaderModal({
  onClose,
  onSuccess,
  organizationId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string | null;
}) {
  const [rows, setRows] = useState<ParsedContractorRow[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ count: number; errors?: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setFilename(file.name);
    setResult(null);
    setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      try {
        const parsed = csvToContractorRows(text);
        if (!parsed.length) {
          // Name the headings actually found so the user can fix the file
          // instead of facing a silent empty table.
          const grid = parseImportGrid(parseCsv(text), {
            fields: {
              name: ["name", "provider_name", "vendor_name", "company_name"],
              code: ["code", "vendor_code", "provider_id", "code_id"],
            },
            required: ["name"],
            keep: (row) => Boolean(row.name),
          });
          setResult({ count: 0, errors: [describeEmptyGrid(grid, "contractor rows")] });
          return;
        }
        setRows(parsed);
      } catch (reason) {
        setResult({ count: 0, errors: [reason instanceof Error ? reason.message : "The selected file could not be read. Download the template and try again."] });
      }
    };
    reader.readAsText(file);
  }, []);

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contractors_bulk_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const executeUpload = async () => {
    if (rows.length === 0) return;
    setUploading(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/facility/contractors/bulk_upload/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ contractors: rows }),
      }, organizationId);

      if (res.ok) {
        const data = await res.json();
        setResult({ count: data.created_count, errors: data.errors });
        onSuccess();
      } else {
        const err = await res.json().catch(() => ({}));
        setResult({ count: 0, errors: [err.detail || "Failed to upload service providers."] });
      }
    } catch {
      setResult({ count: 0, errors: ["Network or server error during upload."] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div
        className="modal-panel"
        style={{
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, var(--color-slate-300))",
          borderRadius: 12,
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          width: "100%",
          maxWidth: 820,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border, var(--color-slate-300))", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-primary, var(--color-slate-900))" }}>
              ⬆ Bulk Upload Service Providers &amp; Contractors (CSV)
            </h3>
            <small style={{ color: "var(--text-secondary, var(--color-slate-500))" }}>
              Import multiple maintenance vendors, specialists, and SLA emergency contacts simultaneously.
            </small>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: 0, fontSize: 20, cursor: "pointer", color: "var(--text-secondary, var(--color-slate-500))" }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Action Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <button
              onClick={downloadTemplate}
              className="fc-toolbar-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              📥 Download CSV Template
            </button>
            <span style={{ fontSize: 12, color: "var(--text-secondary, var(--color-slate-500))" }}>
              Required columns: <strong>name</strong>, <strong>specialty</strong>, <strong>contact_name</strong>, <strong>phone</strong>
            </span>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--primary, var(--color-danger))" : "var(--border, var(--color-slate-300))"}`,
              borderRadius: 10,
              padding: "24px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "rgba(220,38,38,0.04)" : "var(--surface-sunken, var(--color-slate-50))",
              transition: "all 0.15s ease",
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, var(--color-slate-900))" }}>
              {filename ? `Selected: ${filename}` : "Drag and drop CSV file here, or click to browse"}
            </div>
            <small style={{ color: "var(--text-secondary, var(--color-slate-500))", marginTop: 4, display: "block" }}>
              Accepts .csv files (up to 1,000 providers per import)
            </small>
          </div>

          {/* Result Banner */}
          {result && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: result.count > 0 ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
                border: `1px solid ${result.count > 0 ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"}`,
                color: result.count > 0 ? "var(--color-green-text)" : "var(--color-danger-deep)",
                fontSize: 13,
              }}
            >
              <strong>{result.count > 0 ? `✓ Successfully created ${result.count} service providers!` : "Upload issues detected:"}</strong>
              {result.errors && result.errors.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12 }}>
                  {result.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Parsed Preview Table */}
          {rows.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary, var(--color-slate-900))" }}>
                  Preview: {rows.length} Providers Ready to Import
                </span>
                <button
                  onClick={() => { setRows([]); setFilename(""); }}
                  style={{ background: "none", border: 0, color: "var(--primary, var(--color-danger))", fontSize: 12, cursor: "pointer", fontWeight: 700 }}
                >
                  Clear
                </button>
              </div>

              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border, var(--color-slate-300))", borderRadius: 6 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-sunken, var(--color-slate-50))", borderBottom: "1px solid var(--border, var(--color-slate-300))", textAlign: "left" }}>
                      <th style={{ padding: "6px 10px" }}>Code</th>
                      <th style={{ padding: "6px 10px" }}>Provider Name</th>
                      <th style={{ padding: "6px 10px" }}>Specialty</th>
                      <th style={{ padding: "6px 10px" }}>Contact Person</th>
                      <th style={{ padding: "6px 10px" }}>Phone / Desk</th>
                      <th style={{ padding: "6px 10px" }}>Tax PIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border, var(--color-slate-200))" }}>
                        <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{r.code || `VND-${100 + i}`}</td>
                        <td style={{ padding: "6px 10px", fontWeight: 700 }}>{r.name}</td>
                        <td style={{ padding: "6px 10px" }}>{r.specialty}</td>
                        <td style={{ padding: "6px 10px" }}>{r.contact_name || "—"}</td>
                        <td style={{ padding: "6px 10px" }}>{r.phone || r.emergency_phone || "—"}</td>
                        <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{r.pin_number || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && (
                <small style={{ color: "var(--text-secondary, var(--color-slate-500))", display: "block", marginTop: 4 }}>
                  Showing first 10 of {rows.length} records.
                </small>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border, var(--color-slate-300))", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-sunken, var(--color-slate-50))" }}>
          <button
            onClick={onClose}
            className="fc-toolbar-btn"
          >
            Cancel
          </button>
          <button
            onClick={executeUpload}
            disabled={rows.length === 0 || uploading}
            className="fc-toolbar-btn primary"
            style={{ fontWeight: 800 }}
          >
            {uploading ? "Importing Providers…" : `✓ Upload ${rows.length} Providers`}
          </button>
        </div>
      </div>
    </div>
  );
}
