import { describe, expect, it } from "vitest";

import { parseLabourCount, parseQuantity, validateDateYMD } from "./validation";

describe("validateDateYMD", () => {
  it("accepts a real ISO date", () => {
    expect(validateDateYMD("2026-06-11").ok).toBe(true);
  });

  it("rejects wrong formats", () => {
    for (const bad of ["11/06/2026", "2026-6-1", "not a date", ""]) {
      expect(validateDateYMD(bad).ok).toBe(false);
    }
  });

  it("rejects calendar-impossible dates", () => {
    expect(validateDateYMD("2026-02-30").ok).toBe(false);
    expect(validateDateYMD("2026-13-01").ok).toBe(false);
  });
});

describe("parseLabourCount", () => {
  it("treats empty as zero", () => {
    expect(parseLabourCount("")).toMatchObject({ ok: true, count: 0 });
  });

  it("accepts whole non-negative numbers", () => {
    expect(parseLabourCount("24")).toMatchObject({ ok: true, count: 24 });
  });

  it("rejects negatives and fractions", () => {
    expect(parseLabourCount("-3").ok).toBe(false);
    expect(parseLabourCount("2.5").ok).toBe(false);
    expect(parseLabourCount("abc").ok).toBe(false);
  });
});

describe("parseQuantity", () => {
  it("accepts positive decimals", () => {
    expect(parseQuantity("2.5")).toMatchObject({ ok: true, quantity: 2.5 });
  });

  it("rejects zero, negatives and non-numbers", () => {
    expect(parseQuantity("0").ok).toBe(false);
    expect(parseQuantity("-1").ok).toBe(false);
    expect(parseQuantity("").ok).toBe(false);
    expect(parseQuantity("a lot").ok).toBe(false);
  });
});
