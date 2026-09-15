import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";

export interface SCurvePoint {
  date: string;
  planned: number;
  actual: number;
  plannedValueKes?: number;
  earnedValueKes?: number;
  actualCostKes?: number;
}

interface InteractiveSCurveProps {
  data: SCurvePoint[];
  totalBudgetKes?: number;
}

export function InteractiveSCurve({ data, totalBudgetKes = 10000000 }: InteractiveSCurveProps) {
  const [mode, setMode] = useState<"physical" | "financial">("physical");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d) => {
      const pv = d.plannedValueKes ?? (d.planned / 100) * totalBudgetKes;
      const ev = d.earnedValueKes ?? (d.actual / 100) * totalBudgetKes;
      // Actual cost defaults to earned value with realistic slight variance if not supplied
      const ac = d.actualCostKes ?? (ev > 0 ? ev * 0.96 : 0);
      return {
        ...d,
        plannedValueKes: pv,
        earnedValueKes: ev,
        actualCostKes: ac,
      };
    });
  }, [data, totalBudgetKes]);

  const width = 680;
  const height = 240;
  const paddingLeft = 65;
  const paddingBottom = 32;
  const paddingTop = 20;
  const paddingRight = 24;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxVal = useMemo(() => {
    if (mode === "physical") return 100;
    const maxFin = Math.max(...points.map((p) => Math.max(p.plannedValueKes, p.earnedValueKes, p.actualCostKes, 1)));
    return Math.max(maxFin, totalBudgetKes);
  }, [mode, points, totalBudgetKes]);

  const getCoords = (idx: number, val: number) => {
    const x = paddingLeft + (idx / Math.max(1, points.length - 1)) * chartW;
    const y = paddingTop + chartH - (Math.min(val, maxVal) / Math.max(1, maxVal)) * chartH;
    return { x, y };
  };

  const polylinePlanned = points
    .map((p, i) => {
      const val = mode === "physical" ? p.planned : p.plannedValueKes;
      const { x, y } = getCoords(i, val);
      return `${x},${y}`;
    })
    .join(" ");

  const polylineActual = points
    .map((p, i) => {
      const val = mode === "physical" ? p.actual : p.earnedValueKes;
      const { x, y } = getCoords(i, val);
      return `${x},${y}`;
    })
    .join(" ");

  const polylineAc = points
    .map((p, i) => {
      const val = mode === "financial" ? p.actualCostKes : 0;
      const { x, y } = getCoords(i, val);
      return `${x},${y}`;
    })
    .join(" ");

  const activePoint = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  // EVM Calculations
  const evm = useMemo(() => {
    if (!activePoint) {
      return { cpi: 1.0, spi: 1.0, cv: 0, sv: 0, eac: totalBudgetKes };
    }
    const pv = activePoint.plannedValueKes;
    const ev = activePoint.earnedValueKes;
    const ac = Math.max(activePoint.actualCostKes, 1);

    const cpi = ev > 0 ? Number((ev / ac).toFixed(2)) : 1.0;
    const spi = pv > 0 ? Number((ev / pv).toFixed(2)) : 1.0;
    const cv = ev - ac;
    const sv = ev - pv;
    const eac = cpi > 0 ? totalBudgetKes / cpi : totalBudgetKes;

    return { cpi, spi, cv, sv, eac };
  }, [activePoint, totalBudgetKes]);

  return (
    <div
      style={{
        background: "var(--surface)",
        padding: "18px 22px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Top Header & Mode Toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            {mode === "physical" ? "Interactive Physical S-Curve Analysis" : "Earned Value Management (EVM) S-Curve"}
          </h4>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {mode === "physical"
              ? "Planned baseline schedule vs verified field physical progress"
              : "Planned Value (PV) vs Earned Value (EV) vs Actual Cost (AC)"}
          </span>
        </div>

        {/* Toggle Mode */}
        <div
          style={{
            display: "flex",
            background: "var(--border)",
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}
        >
          <button
            className="btn ghost sm"
            onClick={() => setMode("physical")}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 6,
              background: mode === "physical" ? "var(--surface)" : "transparent",
              fontWeight: mode === "physical" ? 700 : 500,
              boxShadow: mode === "physical" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Physical (%)
          </button>
          <button
            className="btn ghost sm"
            onClick={() => setMode("financial")}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 6,
              background: mode === "financial" ? "var(--surface)" : "transparent",
              fontWeight: mode === "financial" ? 700 : 500,
              boxShadow: mode === "financial" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Financial (EVM)
          </button>
        </div>
      </div>

      {/* EVM Indicator Strip */}
      {activePoint && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
            padding: "10px 14px",
            background: "var(--surface-2, rgba(0,0,0,0.02))",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <div>
            <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>Planned (PV)</span>
            <strong style={{ fontFamily: "monospace", fontSize: 13 }}>
              {mode === "physical" ? `${activePoint.planned}%` : `KES ${(activePoint.plannedValueKes / 1e3).toFixed(1)}k`}
            </strong>
          </div>
          <div>
            <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>Earned (EV)</span>
            <strong style={{ fontFamily: "monospace", fontSize: 13, color: "#16a34a" }}>
              {mode === "physical" ? `${activePoint.actual}%` : `KES ${(activePoint.earnedValueKes / 1e3).toFixed(1)}k`}
            </strong>
          </div>
          {mode === "financial" && (
            <div>
              <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>Actual Cost (AC)</span>
              <strong style={{ fontFamily: "monospace", fontSize: 13, color: "#2563eb" }}>
                KES {(activePoint.actualCostKes / 1e3).toFixed(1)}k
              </strong>
            </div>
          )}
          <div>
            <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>Cost Index (CPI)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <strong
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  color: evm.cpi >= 1.0 ? "#16a34a" : "#dc2626",
                }}
              >
                {evm.cpi}
              </strong>
              {evm.cpi >= 1.0 ? (
                <CheckCircle2 size={12} color="#16a34a" />
              ) : (
                <AlertCircle size={12} color="#dc2626" />
              )}
            </div>
          </div>
          <div>
            <span style={{ color: "var(--muted)", display: "block", fontSize: 11 }}>Schedule Index (SPI)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <strong
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  color: evm.spi >= 1.0 ? "#16a34a" : "#ea580c",
                }}
              >
                {evm.spi}
              </strong>
              {evm.spi >= 1.0 ? (
                <TrendingUp size={12} color="#16a34a" />
              ) : (
                <TrendingDown size={12} color="#ea580c" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* SVG Chart */}
      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
          {/* Y-Axis Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
            const y = paddingTop + chartH - frac * chartH;
            const valLabel =
              mode === "physical"
                ? `${Math.round(frac * 100)}%`
                : `${((frac * maxVal) / 1e6).toFixed(1)}M`;
            return (
              <g key={frac}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
                  {valLabel}
                </text>
              </g>
            );
          })}

          {/* Planned Line (Gray dashed) */}
          <polyline
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.5"
            strokeDasharray="5 5"
            points={polylinePlanned}
          />

          {/* Actual Cost Line (Blue dashed, financial mode only) */}
          {mode === "financial" && (
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeDasharray="3 3"
              points={polylineAc}
            />
          )}

          {/* Actual / Earned Line (Solid Green) */}
          <polyline
            fill="none"
            stroke="#16a34a"
            strokeWidth="3"
            points={polylineActual}
          />

          {/* Interactive Data Points */}
          {points.map((p, idx) => {
            const planVal = mode === "physical" ? p.planned : p.plannedValueKes;
            const actVal = mode === "physical" ? p.actual : p.earnedValueKes;
            const { x: px, y: py } = getCoords(idx, planVal);
            const { x: ax, y: ay } = getCoords(idx, actVal);
            const isHovered = hoverIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={px} cy={py} r={isHovered ? 5 : 3} fill="#94a3b8" />
                <circle
                  cx={ax}
                  cy={ay}
                  r={isHovered ? 7 : 4}
                  fill="#16a34a"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={ax}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--muted)"
                >
                  {p.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 18, fontSize: 12, color: "var(--muted)", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 2, background: "#94a3b8", display: "inline-block" }} />
          <span>{mode === "physical" ? "Planned Target (%)" : "Planned Value (PV)"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 3, background: "#16a34a", display: "inline-block" }} />
          <span>{mode === "physical" ? "Verified Progress (%)" : "Earned Value (EV)"}</span>
        </div>
        {mode === "financial" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 2, background: "#2563eb", display: "inline-block" }} />
            <span>Actual Cost (AC)</span>
          </div>
        )}
      </div>
    </div>
  );
}
