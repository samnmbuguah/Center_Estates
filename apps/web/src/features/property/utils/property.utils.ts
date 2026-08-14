import { money, number } from "@/components/module-ui";
import { Row } from "../types/property.types";

export const kM = (v: unknown) => money.format(Number(v ?? 0));
export const kN = (v: unknown) => number.format(Number(v ?? 0));

export const fmtDate = (v: unknown): string => {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export function daysUntil(end?: unknown): number | null {
  if (!end) return null;
  const d = new Date(String(end));
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export const daysLeftLabel = (end?: unknown): string => {
  const dl = daysUntil(end);
  if (dl === null) return "—";
  if (dl < 0) return "Expired";
  return `${dl} days`;
};

export const overdueLabel = (due?: unknown): string => {
  if (!due) return "—";
  const d = new Date(String(due));
  if (Number.isNaN(d.getTime())) return String(due);
  const diff = Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
  return `${diff}d`;
};

export const pct = (part: unknown, whole: unknown): number => {
  const w = Number(whole ?? 0);
  if (w <= 0) return 0;
  return Math.round((Number(part ?? 0) / w) * 100);
};

export function occupancyTone(v: number): "green" | "yellow" | "red" {
  if (v >= 80) return "green";
  if (v >= 60) return "yellow";
  return "red";
}

export function shortId(id?: unknown): string {
  const s = String(id ?? "");
  return s.length > 8 ? s.slice(0, 8) : s || "—";
}

export function exportCsv(rows: Row[], columns: { key: string; label: string }[], filename: string) {
  const escape = (v: string) => v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((r) => columns.map((c) => escape(String(r[c.key] ?? ""))).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLeaseICS(leases: Row[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Center Estates//ERP//EN"];
  for (const l of leases) {
    const endDate = String(l.end_date || l.end || "");
    if (!endDate) continue;
    const dt = new Date(endDate);
    const dateStr = dt.getFullYear().toString() +
      String(dt.getMonth() + 1).padStart(2, "0") +
      String(dt.getDate()).padStart(2, "0") + "T000000Z";
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${dateStr}`,
      `DTEND:${dateStr}`,
      `SUMMARY:Lease expires: ${String(l.tenant_name || "")} - ${String(l.property_name || "")}`,
      `DESCRIPTION:Lease ${String(l.reference || l.id || "")} expires. Monthly rent: KES ${Number(l.monthly_rent || 0).toLocaleString()}`,
      "END:VEVENT"
    );
    const remind = new Date(dt.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rStr = remind.getFullYear().toString() +
      String(remind.getMonth() + 1).padStart(2, "0") +
      String(remind.getDate()).padStart(2, "0") + "T000000Z";
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${rStr}`,
      `DTEND:${rStr}`,
      `SUMMARY:REMINDER: Lease expires in 30 days - ${String(l.tenant_name || "")}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "lease-calendar.ics"; a.click();
  URL.revokeObjectURL(a.href);
}

export const criticalFormatDate = (s?: unknown) => {
  if (!s) return "—";
  const d = new Date(String(s));
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const criticalDaysUntil = (s?: unknown) => {
  if (!s) return null;
  const d = new Date(String(s));
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

export function exportICS(events: { title: string; date: string; description?: string }[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Center Estates//Critical Dates//EN"];
  for (const e of events) {
    if (!e.date) continue;
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const dateStr = d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    lines.push("BEGIN:VEVENT", `DTSTART:${dateStr}`, `DTEND:${dateStr}`, `SUMMARY:${e.title}`, `DESCRIPTION:${e.description || ""}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "critical-dates.ics"; a.click();
  URL.revokeObjectURL(url);
}
