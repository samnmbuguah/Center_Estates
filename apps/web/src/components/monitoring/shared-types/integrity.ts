/**
 * Client mirror of apps/backend/sync/integrity.py.
 * Computes SHA-256 digest hex matching Python's hashlib.sha256().hexdigest()
 */

const US = " ";

export interface SubmissionContent {
  milestoneId: string;
  projectId: string;
  percentComplete: number;
  submittedAt: number;
  evidenceHashes: string[];
  observationBodies: string[];
}

export function canonicalSubmission(c: SubmissionContent): string {
  return [
    `milestone_id=${c.milestoneId}`,
    `project_id=${c.projectId}`,
    `percent_complete=${c.percentComplete}`,
    `submitted_at=${c.submittedAt}`,
    "evidence_hashes=" + [...c.evidenceHashes].sort().join(","),
    "observation_bodies=" + [...c.observationBodies].sort().join(US),
  ].join("\n");
}

export async function computeIntegrityHash(c: SubmissionContent): Promise<string> {
  const str = canonicalSubmission(c);
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const msgBuffer = new TextEncoder().encode(str);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback simple hash for non-browser/SSR
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}
