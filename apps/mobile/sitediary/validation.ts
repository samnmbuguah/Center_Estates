/**
 * Client-side validation for site-diary entry (daily log, material deliveries,
 * H&S incidents — SRS-MOB-MAT / SRS-MOB-HS). Pure + unit-tested; the server
 * re-validates everything, this exists to give the Clerk instant feedback.
 */

export interface Validation {
  ok: boolean;
  reason?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDateYMD(value: string): Validation {
  if (!DATE_RE.test(value)) return { ok: false, reason: "Use the YYYY-MM-DD format, e.g. 2026-06-11" };
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    return { ok: false, reason: "That date doesn't exist — check the month and day" };
  }
  return { ok: true };
}

/** Whole, non-negative head-count. Empty counts as 0 (allowed). */
export function parseLabourCount(value: string): Validation & { count: number } {
  if (value.trim() === "") return { ok: true, count: 0 };
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, count: 0, reason: "Labour count must be a whole number" };
  }
  if (n < 0) return { ok: false, count: 0, reason: "Labour count can't be negative" };
  return { ok: true, count: n };
}

/** Positive quantity, decimals allowed (e.g. 2.5 tonnes). */
export function parseQuantity(value: string): Validation & { quantity: number } {
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n)) {
    return { ok: false, quantity: 0, reason: "Quantity must be a number" };
  }
  if (n <= 0) return { ok: false, quantity: 0, reason: "Quantity must be greater than zero" };
  return { ok: true, quantity: n };
}

export const HS_SEVERITIES = [
  { value: "near_miss", label: "Near miss" },
  { value: "first_aid", label: "First aid" },
  { value: "lost_time", label: "Lost time" },
  { value: "serious", label: "Serious" },
] as const;

export type HsSeverity = (typeof HS_SEVERITIES)[number]["value"];
