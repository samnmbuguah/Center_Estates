import { Row } from "../types/facility.types";

export function exportCsv(rows: Row[], filename: string) {
  if (rows.length === 0) return;
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const esc = (value: unknown) => {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => esc(row[key])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function kM(val: unknown): string {
  const n = Number(val ?? 0);
  if (isNaN(n)) return "KES 0";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

export function fmtDate(val: unknown): string {
  if (!val) return "—";
  try {
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return String(val);
  }
}

export function daysUntil(dateStr: string): number {
  if (!dateStr) return 0;
  const target = new Date(dateStr).getTime();
  const now = new Date().getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function shortId(id: unknown): string {
  const s = String(id ?? "");
  return s.length > 8 ? s.slice(0, 8) + "…" : s;
}
