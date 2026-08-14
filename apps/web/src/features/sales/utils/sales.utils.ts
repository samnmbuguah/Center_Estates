import { money } from "@/components/module-ui";
import { Row } from "../types/sales.types";

export function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtMoney(v: unknown): string {
  return money.format(Number(v ?? 0));
}

export const EMPTY_ROWS: Row[] = [];

export function countBy(rows: Row[], statuses: string[]): number {
  return rows.filter((r) => statuses.includes(String(r.status ?? ""))).length;
}

export function sumBy(rows: Row[], key: string, statuses?: string[]): number {
  return rows.reduce(
    (acc, r) => (statuses && !statuses.includes(String(r.status ?? "")) ? acc : acc + Number(r[key] ?? 0)),
    0,
  );
}

export async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body.detail === "string") return body.detail;
    for (const value of Object.values(body)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
    }
    return `Request failed (${res.status}).`;
  } catch {
    return `Request failed (${res.status}).`;
  }
}

export function toneForAudit(t: string): "green" | "yellow" | "blue" | "red" | "gray" {
  if (t.includes("verified") || t.includes("approved") || t.includes("completed")) return "green";
  if (t.includes("rejected") || t.includes("reversed") || t.includes("cancelled") || t.includes("expired")) return "red";
  if (t.includes("pending") || t.includes("submitted") || t.includes("reserved")) return "yellow";
  if (t.includes("status_change") || t.includes("created") || t.includes("sale")) return "blue";
  return "gray";
}
