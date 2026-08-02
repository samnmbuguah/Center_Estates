/**
 * Issues dashboard helpers (SRS-MOB-OBS-03): flagged observations must be
 * visually distinguished and surfaced urgent-first. Pure + unit-tested.
 */
import type { IssueRow } from "../shared-types";

const FLAG_WEIGHT: Record<string, number> = { urgent: 0, issue: 1, none: 2 };

/** Urgent first, then plain issues; newest first within each band. */
export function sortIssuesUrgentFirst(rows: IssueRow[]): IssueRow[] {
  return [...rows].sort((a, b) => {
    const w = (FLAG_WEIGHT[a.flag] ?? 9) - (FLAG_WEIGHT[b.flag] ?? 9);
    return w !== 0 ? w : b.created_at - a.created_at;
  });
}

export function flagColor(flag: string): string {
  return flag === "urgent" ? "var(--danger)" : flag === "issue" ? "var(--warning)" : "var(--muted)";
}

export function flagLabel(flag: string): string {
  return flag === "urgent" ? "URGENT ISSUE" : flag === "issue" ? "ISSUE" : "NOTE";
}
