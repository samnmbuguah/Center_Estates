import { describe, expect, it } from "vitest";

import { buildSubmissionContent, canSubmit } from "../submission";

const milestone = { milestoneId: "ms1", projectId: "p1", percentComplete: 60 };
const doneEvidence = [{ hash: "a", uploadStatus: "done" }];

describe("canSubmit", () => {
  it("blocks an already-submitted milestone", () => {
    const r = canSubmit({ ...milestone, submittedAt: 123 }, doneEvidence);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/locked/);
  });

  it("requires at least one photo", () => {
    const r = canSubmit({ ...milestone, submittedAt: null }, []);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/at least one photo/);
  });

  it("waits for uploads to finish", () => {
    const r = canSubmit({ ...milestone, submittedAt: null }, [{ hash: "a", uploadStatus: "pending" }]);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/finish uploading/);
  });

  it("rejects out-of-range progress", () => {
    const r = canSubmit({ ...milestone, percentComplete: 140, submittedAt: null }, doneEvidence);
    expect(r.ok).toBe(false);
  });

  it("allows a valid draft", () => {
    expect(canSubmit({ ...milestone, submittedAt: null }, doneEvidence).ok).toBe(true);
  });
});

describe("buildSubmissionContent", () => {
  it("collects evidence hashes and observation bodies", () => {
    const content = buildSubmissionContent(
      milestone,
      1700,
      [{ hash: "a", uploadStatus: "done" }, { hash: "b", uploadStatus: "done" }],
      [{ body: "cracked wall" }],
    );
    expect(content).toEqual({
      milestoneId: "ms1",
      projectId: "p1",
      percentComplete: 60,
      submittedAt: 1700,
      evidenceHashes: ["a", "b"],
      observationBodies: ["cracked wall"],
    });
  });
});
