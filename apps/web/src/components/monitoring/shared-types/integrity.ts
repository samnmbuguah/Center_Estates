/**
 * Client mirror of apps/backend/sync/integrity.py.
 *
 * MUST produce byte-identical canonical strings (and therefore identical
 * SHA-256 digests) as the Python server, because the mobile client signs this
 * hash with the device's biometric-gated key and the server verifies that
 * signature against the hash it recomputes. The cross-lock test in both
 * packages pins the same known vector to guard against drift.
 *
 * The canonical form is a plain ordered key=value string (not JSON) precisely
 * so the two languages can reproduce it without JSON escaping/encoding quirks.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

// Unit Separator (U+001F) — delimits observation bodies that may contain commas.
const US = "";

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

/**
 * SHA-256 of the canonical submission, hex-encoded — matching Python's
 * hashlib.sha256(...).hexdigest(). Uses the pure-JS @noble/hashes (not
 * crypto.subtle) so it works identically in Node, the browser, AND React
 * Native / Hermes (Expo Go has no Web Crypto). Async signature kept for
 * backward compatibility with callers.
 */
export async function computeIntegrityHash(c: SubmissionContent): Promise<string> {
  return bytesToHex(sha256(utf8ToBytes(canonicalSubmission(c))));
}
