import { useMemo, useState } from "react";

export interface SCurvePoint {
  date: string;
  planned: number;
  actual: number;
}

export function InteractiveSCurve({ data }: { data: SCurvePoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data;
  }, [data]);

  const width = 640;
  const height = 220;
  const paddingLeft = 40;
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingRight = 20;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxVal = 100;

  const getCoords = (idx: number, val: number) => {
    const x = paddingLeft + (idx / Math.max(1, points.length - 1)) * chartW;
    const y = paddingTop + chartH - (val / maxVal) * chartH;
    return { x, y };
  };

  const plannedPolyline = points.map((p, i) => {
    const { x, y } = getCoords(i, p.planned);
    return `${x},${y}`;
  }).join(" ");

  const actualPolyline = points.map((p, i) => {
    const { x, y } = getCoords(i, p.actual);
    return `${x},${y}`;
  }).join(" ");

  const activePoint = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  return (
    <div style={{ background: "var(--surface)", padding: 18, borderRadius: 10, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            Interactive Physical S-Curve Analysis
          </h4>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Planned Baseline vs Live Field Actuals</span>
        </div>
        {activePoint && (
          <div style={{ display: "flex", gap: 12, fontSize: 12, fontWeight: 700 }}>
            <span style={{ color: "#94a3b8" }}>Planned: {activePoint.planned}%</span>
            <span style={{ color: "#10b981" }}>Actual: {activePoint.actual}%</span>
            <span style={{ color: activePoint.actual >= activePoint.planned ? "#10b981" : "#ef4444" }}>
              Variance: {(activePoint.actual - activePoint.planned).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((v) => {
            const y = paddingTop + chartH - (v / 100) * chartH;
            return (
              <g key={v}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--border)" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{v}%</text>
              </g>
            );
          })}

          {/* Planned Curve */}
          <polyline fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="5 5" points={plannedPolyline} />

          {/* Actual Curve */}
          <polyline fill="none" stroke="#10b981" strokeWidth="3" points={actualPolyline} />

          {/* Data Points */}
          {points.map((p, idx) => {
            const { x: px, y: py } = getCoords(idx, p.planned);
            const { x: ax, y: ay } = getCoords(idx, p.actual);
            const isHovered = hoverIdx === idx;
            return (
              <g key={idx} onMouseEnter={() => setHoverIdx(idx)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: "pointer" }}>
                <circle cx={px} cy={py} r={isHovered ? 6 : 3} fill="#94a3b8" />
                <circle cx={ax} cy={ay} r={isHovered ? 7 : 4} fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                <text x={ax} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--muted)">
                  {p.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
