/**
 * Milestone Progress-Verification governance (URS Mobile App, module 2).
 * Pure, unit-testable rules — the screen applies them and records the audit.
 */

/** Threshold above which a single-step % jump needs explicit confirmation. */
export const INFLATION_THRESHOLD = 40;

export type MilestoneStatus = "Not Started" | "In Progress" | "Completed";

/**
 * Logical status enforcement: status is a pure function of percent, so a
 * Completed status always means 100% and 100% always means Completed —
 * contradictory states are impossible.
 */
export function deriveStatus(percent: number): MilestoneStatus {
  if (percent <= 0) return "Not Started";
  if (percent >= 100) return "Completed";
  return "In Progress";
}

export type ProgressChange =
  | { kind: "ok" }
  | { kind: "regression"; prev: number; next: number }
  | { kind: "inflation"; prev: number; next: number; jump: number };

/**
 * Progressive-% rule + artificial-inflation control. A decrease is a regression
 * (mandatory justification); a jump beyond the threshold needs confirmation.
 */
export function classifyProgressChange(
  prev: number,
  next: number,
  threshold = INFLATION_THRESHOLD,
): ProgressChange {
  if (next < prev) return { kind: "regression", prev, next };
  if (next - prev > threshold) return { kind: "inflation", prev, next, jump: next - prev };
  return { kind: "ok" };
}

/** Audit line for a controlled regression (immutable observation body). */
export function regressionAudit(prev: number, next: number, justification: string): string {
  return `REGRESSION_EVENT: progress lowered ${prev}% → ${next}%. Justification: ${justification.trim()}`;
}

export interface PrerequisiteCheckResult {
  satisfied: boolean;
  blockedBy: Array<{ milestone_id: string; percent_complete: number }>;
}

/**
 * Stage-gate rule: All prerequisite milestones must reach 100% completion
 * before progress > 0% can be submitted or verified on the downstream milestone.
 */
export function checkPrerequisites(
  prerequisites: string[] | undefined | null,
  allMilestones: Array<{ milestone_id: string; percent_complete: number }>,
): PrerequisiteCheckResult {
  if (!prerequisites || prerequisites.length === 0) {
    return { satisfied: true, blockedBy: [] };
  }
  const map = new Map(allMilestones.map((m) => [m.milestone_id, m.percent_complete]));
  const blockedBy: Array<{ milestone_id: string; percent_complete: number }> = [];

  for (const pid of prerequisites) {
    const pct = map.get(pid);
    if (pct === undefined || pct < 100) {
      blockedBy.push({ milestone_id: pid, percent_complete: pct ?? 0 });
    }
  }

  return {
    satisfied: blockedBy.length === 0,
    blockedBy,
  };
}

