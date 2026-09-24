"use client";

import { useState, useRef } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Download,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle
} from "lucide-react";
import { API_BASE } from "../api";

interface AuditMatrixItem {
  key: string;
  trade: string;
  name: string;
  boq_matched_desc: string;
  unit: string;
  model_qty: number;
  boq_qty: number;
  delta_qty: number;
  variance_pct: number;
  status: "MATCHED" | "TOLERABLE_VARIANCE" | "CRITICAL_DISCREPANCY" | "OMISSION" | "PHANTOM_ITEM";
  status_label: string;
  severity: "success" | "info" | "warning" | "critical";
  boq_rate: number;
  iqsk_rate: number;
  tender_amount: number;
  iqsk_benchmark_amount: number;
  financial_exposure: number;
}

interface VerificationAuditData {
  summary_kpis: {
    total_items_audited: number;
    matched_count: number;
    critical_discrepancies: number;
    omissions_detected: number;
    match_rate_pct: number;
    total_tender_amount: number;
    total_iqsk_benchmark: number;
    net_financial_exposure: number;
    currency: string;
  };
  physical_summary: {
    concrete_totals: {
      footings_vol_m3: number;
      columns_vol_m3: number;
      beams_vol_m3: number;
      slabs_vol_m3: number;
      total_concrete_m3: number;
    };
    formwork_totals: {
      columns_formwork_m2: number;
      beams_formwork_m2: number;
      slabs_formwork_m2: number;
      footings_formwork_m2: number;
      total_formwork_m2: number;
    };
    rebar_totals: {
      total_rebar_kg: number;
      by_diameter: Record<string, number>;
    };
    walling_totals: {
      walls_area_m2: number;
    };
    element_counts: Record<string, number>;
  };
  audit_matrix: AuditMatrixItem[];
}

export function BimVerificationHub() {
  const [ifcFile, setIfcFile] = useState<File | null>(null);
  const [boqFile, setBoqFile] = useState<File | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditData, setAuditData] = useState<VerificationAuditData | null>(null);
  const [activeTrade, setActiveTrade] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ifcInputRef = useRef<HTMLInputElement>(null);
  const boqInputRef = useRef<HTMLInputElement>(null);

  async function handleRunAudit() {
    if (!ifcFile) {
      setError("Please select a structural BIM (.ifc) model file.");
      return;
    }

    setIsAuditing(true);
    setError(null);

    const formData = new FormData();
    formData.append("ifc_file", ifcFile);
    if (boqFile) {
      formData.append("boq_file", boqFile);
    }

    try {
      const res = await fetch(`${API_BASE}/construction/bim/verify-quantities/`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to process BIM verification audit.");
      }

      if (json.data && json.data.summary_kpis) {
        setAuditData(json.data);
      } else {
        throw new Error("Audit finished, but reconciliation matrix was not generated.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during verification.");
    } finally {
      setIsAuditing(false);
    }
  }

  function loadSampleDemonstration() {
    // Generate realistic demo audit based on Nairobi commercial multi-storey building
    const sampleData: VerificationAuditData = {
      summary_kpis: {
        total_items_audited: 8,
        matched_count: 5,
        critical_discrepancies: 2,
        omissions_detected: 1,
        match_rate_pct: 62.5,
        total_tender_amount: 14_850_000,
        total_iqsk_benchmark: 12_420_000,
        net_financial_exposure: 2_430_000,
        currency: "KES",
      },
      physical_summary: {
        concrete_totals: {
          footings_vol_m3: 38.4,
          columns_vol_m3: 24.6,
          beams_vol_m3: 42.0,
          slabs_vol_m3: 115.2,
          total_concrete_m3: 220.2,
        },
        formwork_totals: {
          columns_formwork_m2: 246.0,
          beams_formwork_m2: 380.0,
          slabs_formwork_m2: 768.0,
          footings_formwork_m2: 124.0,
          total_formwork_m2: 1518.0,
        },
        rebar_totals: {
          total_rebar_kg: 24_220.0,
          by_diameter: {
            T8: 2_900.0,
            T10: 3_630.0,
            T12: 6_780.0,
            T16: 7_260.0,
            T20: 3_650.0,
          },
        },
        walling_totals: {
          walls_area_m2: 640.0,
        },
        element_counts: {
          footings: 24,
          columns: 36,
          beams: 48,
          slabs: 4,
          walls: 62,
          rebars: 1420,
        },
      },
      audit_matrix: [
        {
          key: "concrete_columns",
          trade: "CONCRETE",
          name: "Vibrated Reinforced Concrete Class 25/20 in Columns",
          boq_matched_desc: "Reinforced concrete vibrated in square columns 300x300mm",
          unit: "CM",
          model_qty: 24.6,
          boq_qty: 25.0,
          delta_qty: 0.4,
          variance_pct: 1.6,
          status: "MATCHED",
          status_label: "Verified Match (<=2%)",
          severity: "success",
          boq_rate: 16_500.0,
          iqsk_rate: 15_800.0,
          tender_amount: 412_500.0,
          iqsk_benchmark_amount: 388_680.0,
          financial_exposure: 23_820.0,
        },
        {
          key: "concrete_beams",
          trade: "CONCRETE",
          name: "Vibrated Reinforced Concrete Class 25/20 in Beams",
          boq_matched_desc: "Reinforced concrete vibrated in main ring beams & lintels",
          unit: "CM",
          model_qty: 42.0,
          boq_qty: 54.0,
          delta_qty: 12.0,
          variance_pct: 28.6,
          status: "CRITICAL_DISCREPANCY",
          status_label: "Over-measured (+28.6%)",
          severity: "critical",
          boq_rate: 17_200.0,
          iqsk_rate: 15_500.0,
          tender_amount: 928_800.0,
          iqsk_benchmark_amount: 651_000.0,
          financial_exposure: 277_800.0,
        },
        {
          key: "concrete_slabs",
          trade: "CONCRETE",
          name: "Vibrated Reinforced Concrete Class 25/20 in Suspended Slabs",
          boq_matched_desc: "150mm thick suspended floor slab concrete class 25/20",
          unit: "CM",
          model_qty: 115.2,
          boq_qty: 118.0,
          delta_qty: 2.8,
          variance_pct: 2.4,
          status: "TOLERABLE_VARIANCE",
          status_label: "Tolerable Variance (2.4%)",
          severity: "info",
          boq_rate: 15_900.0,
          iqsk_rate: 15_200.0,
          tender_amount: 1_876_200.0,
          iqsk_benchmark_amount: 1_751_040.0,
          financial_exposure: 125_160.0,
        },
        {
          key: "formwork_slabs",
          trade: "FORMWORK",
          name: "Sawn Formwork to Soffits of Suspended Slabs",
          boq_matched_desc: "Sawn timber formwork to horizontal soffits of slabs",
          unit: "SM",
          model_qty: 768.0,
          boq_qty: 780.0,
          delta_qty: 12.0,
          variance_pct: 1.6,
          status: "MATCHED",
          status_label: "Verified Match (<=2%)",
          severity: "success",
          boq_rate: 650.0,
          iqsk_rate: 610.0,
          tender_amount: 507_000.0,
          iqsk_benchmark_amount: 468_480.0,
          financial_exposure: 38_520.0,
        },
        {
          key: "formwork_beams",
          trade: "FORMWORK",
          name: "Sawn Formwork to Sides and Soffits of Beams",
          boq_matched_desc: "Sawn timber formwork to sides and soffits of isolated beams",
          unit: "SM",
          model_qty: 380.0,
          boq_qty: 490.0,
          delta_qty: 110.0,
          variance_pct: 28.9,
          status: "CRITICAL_DISCREPANCY",
          status_label: "Over-measured (+28.9%)",
          severity: "critical",
          boq_rate: 680.0,
          iqsk_rate: 615.0,
          tender_amount: 333_200.0,
          iqsk_benchmark_amount: 233_700.0,
          financial_exposure: 99_500.0,
        },
        {
          key: "rebar_t16",
          trade: "REINFORCEMENT",
          name: "High Tensile Ribbed Reinforcement Bars 16mm (T16)",
          boq_matched_desc: "High yield ribbed bar reinforcement size 16mm to BS 4449",
          unit: "KG",
          model_qty: 7_260.0,
          boq_qty: 7_550.0,
          delta_qty: 290.0,
          variance_pct: 4.0,
          status: "TOLERABLE_VARIANCE",
          status_label: "Tolerable Lap/Cut Waste (4.0%)",
          severity: "info",
          boq_rate: 235.0,
          iqsk_rate: 220.0,
          tender_amount: 1_774_250.0,
          iqsk_benchmark_amount: 1_597_200.0,
          financial_exposure: 177_050.0,
        },
        {
          key: "rebar_t12",
          trade: "REINFORCEMENT",
          name: "High Tensile Ribbed Reinforcement Bars 12mm (T12)",
          boq_matched_desc: "High yield ribbed bar reinforcement size 12mm to BS 4449",
          unit: "KG",
          model_qty: 6_780.0,
          boq_qty: 7_100.0,
          delta_qty: 320.0,
          variance_pct: 4.7,
          status: "TOLERABLE_VARIANCE",
          status_label: "Tolerable Lap/Cut Waste (4.7%)",
          severity: "info",
          boq_rate: 238.0,
          iqsk_rate: 220.0,
          tender_amount: 1_689_800.0,
          iqsk_benchmark_amount: 1_491_600.0,
          financial_exposure: 198_200.0,
        },
        {
          key: "walling_masonry",
          trade: "WALLING",
          name: "200mm Machine Cut Stone Walling / Concrete Block",
          boq_matched_desc: "200mm machine cut quarry stone walling bedded in cement mortar",
          unit: "SM",
          model_qty: 640.0,
          boq_qty: 0.0,
          delta_qty: -640.0,
          variance_pct: -100.0,
          status: "OMISSION",
          status_label: "Critical Omission (Model > 0, BoQ = 0)",
          severity: "critical",
          boq_rate: 0.0,
          iqsk_rate: 2_150.0,
          tender_amount: 0.0,
          iqsk_benchmark_amount: 1_376_000.0,
          financial_exposure: -1_376_000.0,
        },
      ],
    };

    setAuditData(sampleData);
    setError(null);
  }

  function formatKES(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val)) return "KES 0.00";
    return `KES ${Number(val).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const filteredMatrix = auditData?.audit_matrix.filter((item) => {
    if (activeTrade !== "ALL" && item.trade !== activeTrade) return false;
    if (severityFilter !== "ALL" && item.severity !== severityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.boq_matched_desc.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Hero Header */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))",
          borderRadius: "16px",
          padding: "26px 30px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 12px 30px -5px rgba(0, 0, 0, 0.35)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "18px",
        }}
      >
        <div style={{ maxWidth: "750px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                background: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                padding: "4px 10px",
                borderRadius: "20px",
                border: "1px solid rgba(56, 189, 248, 0.3)",
              }}
            >
              BIM Automated QTO & Audit
            </span>
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>
              Powered by IfcOpenShell & IQSK National Cost Handbook
            </span>
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
            Drawing vs. BoQ Verification & Cost Exposure Engine
          </h1>
          <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#94a3b8", lineHeight: 1.5 }}>
            Upload IFC structural drawings and contractor tender BoQ schedules. Automatically computes exact 3D physical
            quantities, flags geometric over-measurements, identifies omissions, and benchmarks tender rates against the
            official IQSK Handbook.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={loadSampleDemonstration}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              background: "rgba(168, 85, 247, 0.15)",
              border: "1px solid rgba(168, 85, 247, 0.4)",
              color: "#c084fc",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <Sparkles size={16} />
            Load Live Demo Model
          </button>
        </div>
      </div>

      {/* Upload & Execution Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "18px",
          background: "var(--color-surface, #1e293b)",
          padding: "20px",
          borderRadius: "14px",
          border: "1px solid var(--color-border, #334155)",
        }}
      >
        {/* IFC File Input */}
        <div
          onClick={() => ifcInputRef.current?.click()}
          style={{
            border: ifcFile ? "2px solid #38bdf8" : "2px dashed #475569",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center",
            cursor: "pointer",
            background: ifcFile ? "rgba(56, 189, 248, 0.05)" : "rgba(0, 0, 0, 0.2)",
            transition: "all 0.2s ease",
          }}
        >
          <input
            type="file"
            ref={ifcInputRef}
            accept=".ifc"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) setIfcFile(e.target.files[0]);
            }}
          />
          <UploadCloud size={32} style={{ color: ifcFile ? "#38bdf8" : "#94a3b8", margin: "0 auto 8px auto" }} />
          <div style={{ fontWeight: 600, color: "#fff", fontSize: "14px" }}>
            {ifcFile ? ifcFile.name : "1. Select Structural Drawing (.ifc)"}
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
            {ifcFile ? `${(ifcFile.size / 1024 / 1024).toFixed(2)} MB • Ready` : "Supports IFC2X3 and IFC4 building models"}
          </div>
        </div>

        {/* BoQ File Input */}
        <div
          onClick={() => boqInputRef.current?.click()}
          style={{
            border: boqFile ? "2px solid #10b981" : "2px dashed #475569",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center",
            cursor: "pointer",
            background: boqFile ? "rgba(16, 185, 129, 0.05)" : "rgba(0, 0, 0, 0.2)",
            transition: "all 0.2s ease",
          }}
        >
          <input
            type="file"
            ref={boqInputRef}
            accept=".xlsx,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) setBoqFile(e.target.files[0]);
            }}
          />
          <FileSpreadsheet size={32} style={{ color: boqFile ? "#10b981" : "#94a3b8", margin: "0 auto 8px auto" }} />
          <div style={{ fontWeight: 600, color: "#fff", fontSize: "14px" }}>
            {boqFile ? boqFile.name : "2. Select Tender BoQ (.xlsx / .csv)"}
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
            {boqFile ? `${(boqFile.size / 1024).toFixed(1)} KB • Ready` : "Excel or CSV with item quantities and unit rates"}
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px" }}>
          <button
            onClick={handleRunAudit}
            disabled={!ifcFile || isAuditing}
            style={{
              padding: "16px 24px",
              borderRadius: "10px",
              background: !ifcFile ? "#334155" : "linear-gradient(135deg, #0284c7, #2563eb)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              border: "none",
              cursor: !ifcFile || isAuditing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              boxShadow: ifcFile ? "0 4px 15px rgba(2, 132, 199, 0.4)" : "none",
            }}
          >
            {isAuditing ? <RefreshCw size={18} className="animate-spin" /> : <FileCheck size={18} />}
            {isAuditing ? "Auditing IFC & BoQ Elements..." : "Run Quantity Verification Audit"}
          </button>
          <div style={{ fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
            Extracts volumes, contact formwork areas, rebar schedules and cross-benchmarks IQSK rates.
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Audit Results Dashboard */}
      {auditData && (
        <>
          {/* Executive KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <div
              style={{
                background: "var(--color-surface, #1e293b)",
                borderRadius: "14px",
                padding: "20px",
                border: "1px solid var(--color-border, #334155)",
              }}
            >
              <div style={{ fontSize: "13px", color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
                <span>Match Rate</span>
                <span
                  style={{
                    color: auditData.summary_kpis.match_rate_pct >= 80 ? "#10b981" : "#f59e0b",
                    fontWeight: 700,
                  }}
                >
                  {auditData.summary_kpis.match_rate_pct}%
                </span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginTop: "8px" }}>
                {auditData.summary_kpis.matched_count} / {auditData.summary_kpis.total_items_audited}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                Elements verified within tolerable allowance
              </div>
            </div>

            <div
              style={{
                background: "var(--color-surface, #1e293b)",
                borderRadius: "14px",
                padding: "20px",
                border: "1px solid var(--color-border, #334155)",
              }}
            >
              <div style={{ fontSize: "13px", color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
                <span>Critical Discrepancies</span>
                <span style={{ color: "#ef4444", fontWeight: 700 }}>
                  {auditData.summary_kpis.critical_discrepancies} Alert(s)
                </span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#ef4444", marginTop: "8px" }}>
                {auditData.summary_kpis.critical_discrepancies}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                Over-measurements exceeding ±10% threshold
              </div>
            </div>

            <div
              style={{
                background: "var(--color-surface, #1e293b)",
                borderRadius: "14px",
                padding: "20px",
                border: "1px solid var(--color-border, #334155)",
              }}
            >
              <div style={{ fontSize: "13px", color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
                <span>Omissions Detected</span>
                <span style={{ color: "#f97316", fontWeight: 700 }}>
                  {auditData.summary_kpis.omissions_detected} Item(s)
                </span>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#f97316", marginTop: "8px" }}>
                {auditData.summary_kpis.omissions_detected}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                Modeled in drawing but omitted from tender BoQ
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))",
                borderRadius: "14px",
                padding: "20px",
                border: "1px solid rgba(56, 189, 248, 0.3)",
              }}
            >
              <div style={{ fontSize: "13px", color: "#38bdf8", display: "flex", justifyContent: "space-between" }}>
                <span>Financial Exposure</span>
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>Tender vs IQSK</span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#38bdf8", marginTop: "8px" }}>
                {formatKES(auditData.summary_kpis.net_financial_exposure)}
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                Potential overclaim / rate variance across trades
              </div>
            </div>
          </div>

          {/* Physical Model Quantities Summary (Take-off) */}
          <div
            style={{
              background: "var(--color-surface, #1e293b)",
              borderRadius: "14px",
              padding: "20px",
              border: "1px solid var(--color-border, #334155)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Layers size={18} style={{ color: "#38bdf8" }} />
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: 0 }}>
                Physical Quantities Take-off Extracted from IFC Model
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "14px",
              }}
            >
              <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "14px", borderRadius: "10px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Total Concrete Volume</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginTop: "4px" }}>
                  {auditData.physical_summary.concrete_totals.total_concrete_m3.toLocaleString()} m³
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  Cols: {auditData.physical_summary.concrete_totals.columns_vol_m3}m³ • Beams:{" "}
                  {auditData.physical_summary.concrete_totals.beams_vol_m3}m³ • Slabs:{" "}
                  {auditData.physical_summary.concrete_totals.slabs_vol_m3}m³
                </div>
              </div>

              <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "14px", borderRadius: "10px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Formwork Contact Area</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginTop: "4px" }}>
                  {auditData.physical_summary.formwork_totals.total_formwork_m2.toLocaleString()} m²
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  Slab Soffits: {auditData.physical_summary.formwork_totals.slabs_formwork_m2}m² • Beams:{" "}
                  {auditData.physical_summary.formwork_totals.beams_formwork_m2}m²
                </div>
              </div>

              <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "14px", borderRadius: "10px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Total Steel Reinforcement</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginTop: "4px" }}>
                  {(auditData.physical_summary.rebar_totals.total_rebar_kg / 1000).toFixed(2)} Tonnes
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  T16: {auditData.physical_summary.rebar_totals.by_diameter["T16"]?.toLocaleString()} kg • T12:{" "}
                  {auditData.physical_summary.rebar_totals.by_diameter["T12"]?.toLocaleString()} kg
                </div>
              </div>

              <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "14px", borderRadius: "10px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Walling / Masonry Area</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginTop: "4px" }}>
                  {auditData.physical_summary.walling_totals.walls_area_m2.toLocaleString()} m²
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  Net vertical wall surface area from IFC boundary geometry
                </div>
              </div>
            </div>
          </div>

          {/* Audit Matrix Table */}
          <div
            style={{
              background: "var(--color-surface, #1e293b)",
              borderRadius: "14px",
              border: "1px solid var(--color-border, #334155)",
              overflow: "hidden",
            }}
          >
            {/* Filter Toolbar */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid var(--color-border, #334155)",
                background: "rgba(0, 0, 0, 0.15)",
              }}
            >
              <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
                <Search
                  size={15}
                  style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
                />
                <input
                  type="text"
                  placeholder="Filter audit matrix items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 32px",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.2)",
                    border: "1px solid var(--color-border, #334155)",
                    color: "#fff",
                    fontSize: "13px",
                  }}
                />
              </div>

              <select
                value={activeTrade}
                onChange={(e) => setActiveTrade(e.target.value)}
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.2)",
                  border: "1px solid var(--color-border, #334155)",
                  color: "#fff",
                  fontSize: "13px",
                }}
              >
                <option value="ALL">All Trades</option>
                <option value="CONCRETE">Concrete In-Situ</option>
                <option value="FORMWORK">Formwork</option>
                <option value="REINFORCEMENT">Reinforcement</option>
                <option value="WALLING">Walling</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: "rgba(0, 0, 0, 0.2)",
                  border: "1px solid var(--color-border, #334155)",
                  color: "#fff",
                  fontSize: "13px",
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="critical">Critical Discrepancies</option>
                <option value="info">Tolerable Variances</option>
                <option value="success">Verified Matches</option>
              </select>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "rgba(0, 0, 0, 0.25)", borderBottom: "1px solid var(--color-border, #334155)" }}>
                    <th style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: 600 }}>Element & Tender Item</th>
                    <th style={{ padding: "12px 14px", color: "#94a3b8", fontWeight: 600, textAlign: "center", width: "60px" }}>Unit</th>
                    <th style={{ padding: "12px 14px", color: "#38bdf8", fontWeight: 600, textAlign: "right" }}>Model Qty</th>
                    <th style={{ padding: "12px 14px", color: "#cbd5e1", fontWeight: 600, textAlign: "right" }}>BoQ Claimed</th>
                    <th style={{ padding: "12px 14px", color: "#94a3b8", fontWeight: 600, textAlign: "right" }}>Variance</th>
                    <th style={{ padding: "12px 14px", color: "#94a3b8", fontWeight: 600, textAlign: "center" }}>Risk Status</th>
                    <th style={{ padding: "12px 14px", color: "#cbd5e1", fontWeight: 600, textAlign: "right" }}>Tender Rate</th>
                    <th style={{ padding: "12px 14px", color: "#38bdf8", fontWeight: 600, textAlign: "right" }}>IQSK Benchmark</th>
                    <th style={{ padding: "12px 16px", color: "#38bdf8", fontWeight: 600, textAlign: "right" }}>Exposure (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrix?.map((row) => (
                    <tr
                      key={row.key}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        background:
                          row.status === "CRITICAL_DISCREPANCY"
                            ? "rgba(239, 68, 68, 0.04)"
                            : row.status === "OMISSION"
                            ? "rgba(249, 115, 22, 0.04)"
                            : "transparent",
                      }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ color: "#fff", fontWeight: 600 }}>{row.name}</div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                          BoQ: {row.boq_matched_desc}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "#e2e8f0",
                          }}
                        >
                          {row.unit}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: "#38bdf8" }}>
                        {row.model_qty.toLocaleString()}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#e2e8f0" }}>
                        {row.boq_qty.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          textAlign: "right",
                          fontWeight: 600,
                          color:
                            row.variance_pct > 10
                              ? "#ef4444"
                              : row.variance_pct < -10
                              ? "#f97316"
                              : "#10b981",
                        }}
                      >
                        {row.delta_qty > 0 ? `+${row.delta_qty}` : row.delta_qty} ({row.variance_pct > 0 ? `+${row.variance_pct}%` : `${row.variance_pct}%`})
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "12px",
                            background:
                              row.severity === "success"
                                ? "rgba(16, 185, 129, 0.15)"
                                : row.severity === "info"
                                ? "rgba(56, 189, 248, 0.15)"
                                : row.severity === "warning"
                                ? "rgba(245, 158, 11, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                            color:
                              row.severity === "success"
                                ? "#10b981"
                                : row.severity === "info"
                                ? "#38bdf8"
                                : row.severity === "warning"
                                ? "#f59e0b"
                                : "#ef4444",
                            border: `1px solid ${
                              row.severity === "success"
                                ? "rgba(16, 185, 129, 0.3)"
                                : row.severity === "info"
                                ? "rgba(56, 189, 248, 0.3)"
                                : row.severity === "warning"
                                ? "rgba(245, 158, 11, 0.3)"
                                : "rgba(239, 68, 68, 0.3)"
                            }`,
                          }}
                        >
                          {row.status_label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#cbd5e1" }}>
                        {formatKES(row.boq_rate)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#38bdf8", fontWeight: 600 }}>
                        {formatKES(row.iqsk_rate)}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontWeight: 700,
                          color: row.financial_exposure > 0 ? "#ef4444" : row.financial_exposure < 0 ? "#10b981" : "#94a3b8",
                        }}
                      >
                        {formatKES(row.financial_exposure)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
