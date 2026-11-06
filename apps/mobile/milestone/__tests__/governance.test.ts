import { describe, expect, it } from "vitest";

import { classifyProgressChange, deriveStatus, regressionAudit, checkPrerequisites } from "../governance";

describe("deriveStatus (logical status enforcement)", () => {
  it("maps percent to a single consistent status", () => {
    expect(deriveStatus(0)).toBe("Not Started");
    expect(deriveStatus(1)).toBe("In Progress");
    expect(deriveStatus(55)).toBe("In Progress");
    expect(deriveStatus(100)).toBe("Completed");
  });
  it("never produces a contradictory state (100% is always Completed)", () => {
    expect(deriveStatus(100)).toBe("Completed");
    expect(deriveStatus(99)).not.toBe("Completed");
  });
});

describe("classifyProgressChange (progressive-% + inflation control)", () => {
  it("accepts a non-decreasing change within threshold", () => {
    expect(classifyProgressChange(20, 20).kind).toBe("ok");
    expect(classifyProgressChange(20, 50).kind).toBe("ok");
  });
  it("flags a decrease as a regression", () => {
    const c = classifyProgressChange(60, 40);
    expect(c.kind).toBe("regression");
    if (c.kind === "regression") expect(c).toMatchObject({ prev: 60, next: 40 });
  });
  it("flags an above-threshold jump as inflation", () => {
    const c = classifyProgressChange(10, 80, 40);
    expect(c.kind).toBe("inflation");
    if (c.kind === "inflation") expect(c.jump).toBe(70);
  });
  it("regression takes precedence and threshold is configurable", () => {
    expect(classifyProgressChange(10, 80, 100).kind).toBe("ok");
    expect(classifyProgressChange(80, 10, 100).kind).toBe("regression");
  });
});

describe("regressionAudit", () => {
  it("records prev, next and justification", () => {
    expect(regressionAudit(60, 40, "  re-measured  ")).toBe(
      "REGRESSION_EVENT: progress lowered 60% → 40%. Justification: re-measured",
    );
  });
});

describe("checkPrerequisites (contractual stage-gates)", () => {
  it("passes when there are no prerequisites", () => {
    expect(checkPrerequisites([], []).satisfied).toBe(true);
    expect(checkPrerequisites(undefined, []).satisfied).toBe(true);
  });

  it("blocks when a prerequisite is below 100%", () => {
    const all = [
      { milestone_id: "Foundation", percent_complete: 60 },
      { milestone_id: "Columns", percent_complete: 0 },
    ];
    const res = checkPrerequisites(["Foundation"], all);
    expect(res.satisfied).toBe(false);
    expect(res.blockedBy).toHaveLength(1);
    expect(res.blockedBy[0].milestone_id).toBe("Foundation");
    expect(res.blockedBy[0].percent_complete).toBe(60);
  });

  it("satisfies when all prerequisites reach 100%", () => {
    const all = [
      { milestone_id: "Foundation", percent_complete: 100 },
      { milestone_id: "Columns", percent_complete: 100 },
    ];
    const res = checkPrerequisites(["Foundation", "Columns"], all);
    expect(res.satisfied).toBe(true);
    expect(res.blockedBy).toHaveLength(0);
  });
});
