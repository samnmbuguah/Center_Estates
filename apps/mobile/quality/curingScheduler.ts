/**
 * Concrete Cube Curing Scheduler & Alert Engine.
 * Implements Kenyan Standard KS 02-594 / BS 1881:
 * - 7-day preliminary crush (>= 65% target strength)
 * - 14-day intermediate crush (optional)
 * - 28-day compliance crush (100% target characteristic strength)
 */

export interface CuringSchedule {
  ageDays: number;
  date7d: string;
  date14d: string;
  date28d: string;
  status: "curing" | "due_7d" | "due_14d" | "due_28d" | "overdue" | "tested";
  statusLabel: string;
  badgeColor: string;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function calculateCuringSchedule(
  pourDateStr: string,
  passed: boolean | null,
  referenceDateStr?: string
): CuringSchedule | null {
  if (!pourDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(pourDateStr)) {
    return null;
  }

  const pourDate = new Date(pourDateStr);
  if (isNaN(pourDate.getTime())) return null;

  const today = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const diffTime = today.getTime() - pourDate.getTime();
  const ageDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  const date7d = addDays(pourDateStr, 7);
  const date14d = addDays(pourDateStr, 14);
  const date28d = addDays(pourDateStr, 28);

  if (passed !== null) {
    return {
      ageDays,
      date7d,
      date14d,
      date28d,
      status: "tested",
      statusLabel: passed ? "Cured & Passed" : "Failed Spec",
      badgeColor: passed ? "#16a34a" : "#dc2626",
    };
  }

  if (ageDays === 7) {
    return {
      ageDays,
      date7d,
      date14d,
      date28d,
      status: "due_7d",
      statusLabel: "7-Day Crush Due Today",
      badgeColor: "#ea580c",
    };
  }

  if (ageDays === 28) {
    return {
      ageDays,
      date7d,
      date14d,
      date28d,
      status: "due_28d",
      statusLabel: "28-Day Final Crush Due Today",
      badgeColor: "#dc2626",
    };
  }

  if (ageDays > 28) {
    return {
      ageDays,
      date7d,
      date14d,
      date28d,
      status: "overdue",
      statusLabel: `28-Day Crush Overdue (${ageDays - 28}d late)`,
      badgeColor: "#b91c1c",
    };
  }

  if (ageDays < 7) {
    const remaining = 7 - ageDays;
    return {
      ageDays,
      date7d,
      date14d,
      date28d,
      status: "curing",
      statusLabel: `Day ${ageDays}/28 (7-day crush in ${remaining}d)`,
      badgeColor: "#0284c7",
    };
  }

  const remaining28 = 28 - ageDays;
  return {
    ageDays,
    date7d,
    date14d,
    date28d,
    status: "curing",
    statusLabel: `Day ${ageDays}/28 (28-day crush in ${remaining28}d)`,
    badgeColor: "#0284c7",
  };
}
