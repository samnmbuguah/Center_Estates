/**
 * Maps an S-curve series (planned vs actual cumulative %) onto SVG polyline
 * coordinates. Kept pure so the chart maths is unit-testable without a DOM.
 */
import type { SCurvePoint } from "../shared-types";

export function polylinePoints(
  series: SCurvePoint[],
  key: "planned_percent" | "actual_percent",
  width: number,
  height: number,
  pad = 8,
): string {
  if (series.length === 0) return "";
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
  return (series || [])
    .map((p, i) => {
      const val = Number(p?.[key] ?? 0);
      const x = pad + i * stepX;
      const y = pad + innerH * (1 - Math.min(100, Math.max(0, val)) / 100);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
}
