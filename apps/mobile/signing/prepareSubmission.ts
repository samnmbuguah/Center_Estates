import { computeIntegrityHash, type SubmissionContent } from "@monitoring/shared-types";

import type { SubmissionSigner } from "./types";

/**
 * Pure submission-sealing logic (no native modules) — fully unit-testable.
 *
 * Computes the integrity hash for a milestone exactly as the server will, then
 * has the (biometric-gated) signer sign that hash. The returned fields are
 * written onto the MilestoneEntry row and synced; the server re-derives the
 * hash and verifies the signature against the enrolled device key.
 */
export interface PreparedSubmission {
  submittedAt: number;
  integrityHash: string;
  clientSignature: string;
  signingDeviceId: string;
}

export async function prepareSubmission(
  content: SubmissionContent,
  signer: SubmissionSigner,
): Promise<PreparedSubmission> {
  const integrityHash = await computeIntegrityHash(content);
  const [clientSignature, signingDeviceId] = await Promise.all([
    signer.sign(integrityHash),
    signer.deviceId(),
  ]);
  return {
    submittedAt: content.submittedAt,
    integrityHash,
    clientSignature,
    signingDeviceId,
  };
}
