import { describe, expect, it } from "vitest";

import { canonicalSubmission, computeIntegrityHash } from "../integrity";

const VECTOR = {
  milestoneId: "ms1",
  projectId: "p1",
  percentComplete: 60,
  submittedAt: 1_700_000_000_000,
  evidenceHashes: ["bbb", "aaa"],
  observationBodies: ["rebar exposed", "wall cracked"],
};

// Pinned from the Python server (sync.integrity.compute_integrity_hash) for the
// SAME inputs. If this changes, the client and server have drifted and
// signatures will stop verifying — see apps/backend/sync/tests/test_integrity.py.
const PYTHON_VECTOR_HASH = "65d49637705771979d54b08ba486a1da7f8697bb388572ab3f87864492062daa";

describe("integrity (client mirror of server)", () => {
  it("matches the pinned Python digest exactly", async () => {
    expect(await computeIntegrityHash(VECTOR)).toBe(PYTHON_VECTOR_HASH);
  });

  it("is order-independent across evidence + observations", async () => {
    const reordered = {
      ...VECTOR,
      evidenceHashes: ["aaa", "bbb"],
      observationBodies: ["wall cracked", "rebar exposed"],
    };
    expect(await computeIntegrityHash(reordered)).toBe(PYTHON_VECTOR_HASH);
  });

  it("changes when any photo hash changes", async () => {
    const tampered = { ...VECTOR, evidenceHashes: ["aaa", "ZZZ"] };
    expect(await computeIntegrityHash(tampered)).not.toBe(PYTHON_VECTOR_HASH);
  });

  it("canonical string is the ordered key=value form", () => {
    expect(canonicalSubmission(VECTOR)).toContain("evidence_hashes=aaa,bbb");
  });
});
