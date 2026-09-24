"use client";

import { useEffect, useState } from "react";
import { BookOpen, Search, Filter, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { API_BASE } from "../api";

interface IQSKRate {
  id: string;
  trade: string;
  subcategory: string;
  item_code: string;
  description: string;
  unit: string;
  rate_nairobi: number | null;
  rate_coastal: number | null;
  rate_western: number | null;
  rate_kes: number;
  source_page: number;
  handbook_edition: string;
}

interface SummaryData {
  handbook_edition: string;
  publisher: string;
  total_rates: number;
  trades: { trade: string; item_count: number }[];
}

export function IQSKRatesHandbook() {
  const [rates, setRates] = useState<IQSKRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const limit = 50;

  useEffect(() => {
    // Fetch summary
    fetch(`${API_BASE}/construction/iqsk-rates/summary/`)
      .then((r) => r.json())
      .then((data) => setSummary(data))
      .catch((e) => console.error("Summary error:", e));
  }, []);

  useEffect(() => {
    fetchRates();
  }, [search, tradeFilter, unitFilter, offset]);

  async function fetchRates() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (search) params.set("search", search);
      if (tradeFilter) params.set("trade", tradeFilter);
      if (unitFilter) params.set("unit", unitFilter);

      const res = await fetch(`${API_BASE}/construction/iqsk-rates/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRates(data.results || []);
        setTotalCount(data.total_count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch IQSK rates:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatKES(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return Number(val).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const tradeLabels: Record<string, string> = {
    EARTHWORKS: "Earthworks & Excavations",
    CONCRETE: "Concrete (In-Situ)",
    FORMWORK: "Formwork",
    REINFORCEMENT: "Reinforcement",
    WALLING: "Walling",
    ROOFING: "Roof Coverings & Insulation",
    WATERPROOFING: "Waterproofing",
    RAINWATER: "Rain Water Goods",
    CARPENTRY_JOINERY: "Carpentry & Joinery",
    IRONMONGERY: "Ironmongery",
    GLAZING: "Glass & Glazing",
    METALWORK: "Metalwork & Aluminium",
    STRUCTURAL_STEEL: "Structural Steel Works",
    FINISHES: "Wall, Ceiling & Floor Finishes",
    PAINTING: "Painting & Decoration",
    ELECTRICAL: "Electrical Installations",
    PLUMBING_DRAINAGE: "Plumbing, Drainage & Sanitary",
    FIRE_FIGHTING: "Fire Fighting Equipment",
    EXTERNAL_WORKS: "External Works & Drainage",
    PLANT_EQUIPMENT: "Plant & Equipment Hire",
    APPROXIMATE_ESTIMATING: "Approximate Estimating (m²)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "16px",
          padding: "24px 28px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                padding: "4px 10px",
                borderRadius: "20px",
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              <CheckCircle2 size={13} />
              Official 2023-2024 Edition
            </span>
            <span style={{ fontSize: "13px", color: "var(--color-text-secondary, #94a3b8)" }}>
              State Dept for Public Works • KNBS • IQSK
            </span>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
            IQSK National Construction Costs Handbook
          </h1>
          <p style={{ margin: "6px 0 0 0", fontSize: "14px", color: "var(--color-text-secondary, #94a3b8)", maxWidth: "680px" }}>
            Comprehensive catalog of average contractor all-in unit rates across Kenya. Used for statutory BoQ benchmarking,
            independent quantity take-off audits, and commercial cost exposure analysis.
          </p>
        </div>

        {summary && (
          <div
            style={{
              display: "flex",
              gap: "20px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "12px 20px",
              borderRadius: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>Total Extracted Rates</div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "#38bdf8" }}>
                {summary.total_rates.toLocaleString()}
              </div>
            </div>
            <div style={{ width: "1px", background: "rgba(255, 255, 255, 0.1)" }} />
            <div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>Trades Covered</div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "#a855f7" }}>
                {summary.trades.length}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters & Search Controls */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          background: "var(--color-surface, #1e293b)",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid var(--color-border, #334155)",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
          />
          <input
            type="text"
            placeholder="Search items, subcategories, keywords (e.g. Vibrated concrete, T16, Walling)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            style={{
              width: "100%",
              padding: "9px 12px 9px 36px",
              borderRadius: "8px",
              background: "rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--color-border, #334155)",
              color: "#fff",
              fontSize: "14px",
            }}
          />
        </div>

        <select
          value={tradeFilter}
          onChange={(e) => {
            setTradeFilter(e.target.value);
            setOffset(0);
          }}
          style={{
            padding: "9px 12px",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid var(--color-border, #334155)",
            color: "#fff",
            fontSize: "14px",
            minWidth: "200px",
          }}
        >
          <option value="">All Construction Trades</option>
          {Object.entries(tradeLabels).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={unitFilter}
          onChange={(e) => {
            setUnitFilter(e.target.value);
            setOffset(0);
          }}
          style={{
            padding: "9px 12px",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid var(--color-border, #334155)",
            color: "#fff",
            fontSize: "14px",
            minWidth: "120px",
          }}
        >
          <option value="">All Units</option>
          <option value="SM">SM (m²)</option>
          <option value="CM">CM (m³)</option>
          <option value="LM">LM (Linear Metre)</option>
          <option value="KG">KG (Kilogram)</option>
          <option value="TON">TON (Tonne)</option>
          <option value="NO">NO (Item / Each)</option>
          <option value="HR">HR (Hourly Rate)</option>
        </select>

        <button
          onClick={() => {
            setSearch("");
            setTradeFilter("");
            setUnitFilter("");
            setOffset(0);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "9px 14px",
            borderRadius: "8px",
            background: "transparent",
            border: "1px solid var(--color-border, #334155)",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          <RefreshCw size={14} />
          Reset
        </button>
      </div>

      {/* Rates Table */}
      <div
        style={{
          background: "var(--color-surface, #1e293b)",
          borderRadius: "12px",
          border: "1px solid var(--color-border, #334155)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "rgba(0, 0, 0, 0.25)", borderBottom: "1px solid var(--color-border, #334155)" }}>
                <th style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: 600, width: "110px" }}>Code</th>
                <th style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: 600, width: "180px" }}>Trade</th>
                <th style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: 600 }}>Description & Subcategory</th>
                <th style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: 600, textAlign: "center", width: "80px" }}>Unit</th>
                <th style={{ padding: "12px 16px", color: "#38bdf8", fontWeight: 600, textAlign: "right", width: "140px" }}>
                  Nairobi (KES)
                </th>
                <th style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: 600, textAlign: "right", width: "130px" }}>
                  Coastal (KES)
                </th>
                <th style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: 600, textAlign: "right", width: "130px" }}>
                  Western (KES)
                </th>
                <th style={{ padding: "12px 16px", color: "#94a3b8", fontWeight: 600, textAlign: "center", width: "70px" }}>Page</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                    Loading IQSK rates...
                  </td>
                </tr>
              ) : rates.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
                    No rates found matching criteria.
                  </td>
                </tr>
              ) : (
                rates.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#a855f7", fontWeight: 600 }}>
                      {r.item_code}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "rgba(56, 189, 248, 0.12)",
                          color: "#38bdf8",
                        }}
                      >
                        {tradeLabels[r.trade] || r.trade}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ color: "#fff", fontWeight: 500 }}>{r.description}</div>
                      {r.subcategory && r.subcategory !== r.description && (
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                          {r.subcategory}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "#e2e8f0",
                        }}
                      >
                        {r.unit}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#38bdf8" }}>
                      {formatKES(r.rate_nairobi || r.rate_kes)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#cbd5e1" }}>
                      {formatKES(r.rate_coastal)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#cbd5e1" }}>
                      {formatKES(r.rate_western)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
                      {r.source_page || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 20px",
            borderTop: "1px solid var(--color-border, #334155)",
            background: "rgba(0, 0, 0, 0.15)",
            fontSize: "13px",
            color: "#94a3b8",
          }}
        >
          <div>
            Showing {totalCount > 0 ? offset + 1 : 0} to {Math.min(offset + limit, totalCount)} of {totalCount} rates
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                borderRadius: "6px",
                background: offset === 0 ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.08)",
                border: "1px solid var(--color-border, #334155)",
                color: offset === 0 ? "#475569" : "#fff",
                cursor: offset === 0 ? "not-allowed" : "pointer",
                fontSize: "13px",
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              disabled={offset + limit >= totalCount}
              onClick={() => setOffset(offset + limit)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                borderRadius: "6px",
                background: offset + limit >= totalCount ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.08)",
                border: "1px solid var(--color-border, #334155)",
                color: offset + limit >= totalCount ? "#475569" : "#fff",
                cursor: offset + limit >= totalCount ? "not-allowed" : "pointer",
                fontSize: "13px",
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
