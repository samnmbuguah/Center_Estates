import type { SubmissionContent } from "@monitoring/shared-types";

/**
 * Pure submission helpers — no DB, no native — so the rules are unit-testable.
 * The screen reads rows from the local store (TinyBase / expo-sqlite) and feeds plain shapes in here.
 */

export interface MilestoneFields {
  milestoneId: string;
  projectId: string;
  percentComplete: number;
  submittedAt: number | null;
}

export interface EvidenceLike {
  hash: string;
  uploadStatus: string;
}
export interface ObservationLike {
  body: string;
}

/** Assemble the exact content that gets hashed + signed at submission. */
export function buildSubmissionContent(
  milestone: Omit<MilestoneFields, "submittedAt">,
  submittedAt: number,
  evidence: EvidenceLike[],
  observations: ObservationLike[],
): SubmissionContent {
  return {
    milestoneId: milestone.milestoneId,
    projectId: milestone.projectId,
    percentComplete: milestone.percentComplete,
    submittedAt,
    evidenceHashes: evidence.map((e) => e.hash),
    observationBodies: observations.map((o) => o.body),
  };
}

export interface SubmitGuard {
  ok: boolean;
  reason: string | null;
}

/**
 * Whether a milestone may be submitted. Mirrors the server's expectations:
 * already-submitted is immutable; evidence must have finished uploading so the
 * signed hashes match the server's canonical hashes; progress must be 0–100.
 */
export function canSubmit(
  milestone: MilestoneFields,
  evidence: EvidenceLike[],
): SubmitGuard {
  if (milestone.submittedAt != null) {
    return { ok: false, reason: "Already submitted — evidence is locked." };
  }
  if (milestone.percentComplete < 0 || milestone.percentComplete > 100) {
    return { ok: false, reason: "Progress must be between 0 and 100%." };
  }
  if (evidence.length === 0) {
    return { ok: false, reason: "Capture at least one photo before submitting." };
  }
  if (evidence.some((e) => e.uploadStatus !== "done")) {
    return { ok: false, reason: "Wait for all photos to finish uploading." };
  }
  return { ok: true, reason: null };
}
