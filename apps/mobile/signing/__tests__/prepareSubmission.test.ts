import { describe, expect, it, vi } from "vitest";
import { computeIntegrityHash, type SubmissionContent } from "@monitoring/shared-types";

import { prepareSubmission } from "../prepareSubmission";
import type { SubmissionSigner } from "../types";

const CONTENT: SubmissionContent = {
  milestoneId: "ms1",
  projectId: "p1",
  percentComplete: 75,
  submittedAt: 1_700_000_000_000,
  evidenceHashes: ["hash-a"],
  observationBodies: [],
};

function fakeSigner(): SubmissionSigner {
  return {
    deviceId: vi.fn().mockResolvedValue("dev-1"),
    publicKeyBase64: vi.fn().mockResolvedValue("pub"),
    sign: vi.fn(async (m: string) => `sig(${m})`),
  };
}

describe("prepareSubmission", () => {
  it("signs the exact integrity hash the server will recompute", async () => {
    const signer = fakeSigner();
    const result = await prepareSubmission(CONTENT, signer);

    const expectedHash = await computeIntegrityHash(CONTENT);
    expect(result.integrityHash).toBe(expectedHash);
    expect(signer.sign).toHaveBeenCalledWith(expectedHash);
    expect(result.clientSignature).toBe(`sig(${expectedHash})`);
    expect(result.signingDeviceId).toBe("dev-1");
  });

  it("propagates a biometric failure (no signature produced)", async () => {
    const signer = fakeSigner();
    (signer.sign as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Biometric confirmation required to submit"),
    );
    await expect(prepareSubmission(CONTENT, signer)).rejects.toThrow(/Biometric/);
  });
});
