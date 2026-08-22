import { daysUntil, fmtDate, kM, shortId } from "./facility.utils";

describe("facility utilities", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-08-22T00:00:00Z")));
  afterEach(() => jest.useRealTimers());

  test("formats currency defensively", () => {
    expect(kM(1250)).toMatch(/1,250/);
    expect(kM("not-a-number")).toBe("KES 0");
  });

  test("formats dates and calculates deadlines", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("invalid")).toBe("invalid");
    expect(fmtDate("2026-08-22")).toContain("22 Aug 2026");
    expect(daysUntil("")).toBe(0);
    expect(daysUntil("2026-08-24T00:00:00Z")).toBe(2);
  });

  test("shortens long identifiers without obscuring short ones", () => {
    expect(shortId("abc")).toBe("abc");
    expect(shortId("123456789")).toBe("12345678…");
  });
});
