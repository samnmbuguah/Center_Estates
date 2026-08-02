/** Shared display helpers — never invent payment-critical numbers. */

export function money(v: number | string | null | undefined, currency = "KSh"): string {
  const num = Number(v || 0);
  if (!Number.isFinite(num) || num === 0) return `${currency} 0`;
  if (Math.abs(num) >= 1_000_000_000) return `${currency} ${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${currency} ${(num / 1_000_000).toFixed(2)}M`;
  return `${currency} ${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function pct(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return `${Number(v).toFixed(digits)}%`;
}

export function formatDate(msOrIso: number | string | null | undefined): string {
  if (msOrIso == null || msOrIso === "") return "—";
  const d = typeof msOrIso === "number"
    ? new Date(msOrIso > 1e12 ? msOrIso : msOrIso * 1000)
    : new Date(msOrIso);
  if (Number.isNaN(d.getTime())) return String(msOrIso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(msOrIso: number | string | null | undefined): string {
  if (msOrIso == null || msOrIso === "") return "—";
  const d = typeof msOrIso === "number"
    ? new Date(msOrIso > 1e12 ? msOrIso : msOrIso * 1000)
    : new Date(msOrIso);
  if (Number.isNaN(d.getTime())) return String(msOrIso);
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function stageLabel(stage: string | undefined | null): string {
  if (!stage) return "Unknown";
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function riskLevel(score: number): { level: string; color: string; bg: string } {
  if (score >= 15) return { level: "High", color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
  if (score >= 8) return { level: "Medium", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  return { level: "Low", color: "#10b981", bg: "rgba(16,185,129,0.12)" };
}
