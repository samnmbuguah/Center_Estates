import {
  daysLeftLabel,
  daysUntil,
  fmtDate,
  occupancyTone,
  overdueLabel,
  pct,
  shortId,
} from "./property.utils";

describe("property utilities", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-08-22T12:00:00Z")));
  afterEach(() => jest.useRealTimers());

  test("formats valid, missing, and invalid dates", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("not-a-date")).toBe("not-a-date");
    expect(fmtDate("2026-08-22")).toContain("22 Aug 2026");
  });

  test("calculates lease countdown labels", () => {
    expect(daysUntil()).toBeNull();
    expect(daysUntil("invalid")).toBeNull();
    expect(daysUntil("2026-08-24T12:00:00Z")).toBe(2);
    expect(daysLeftLabel("2026-08-21T12:00:00Z")).toBe("Expired");
    expect(daysLeftLabel("2026-08-24T12:00:00Z")).toBe("2 days");
  });

  test("returns safe percentages and occupancy tones", () => {
    expect(pct(1, 0)).toBe(0);
    expect(pct(8, 10)).toBe(80);
    expect(occupancyTone(80)).toBe("green");
    expect(occupancyTone(60)).toBe("yellow");
    expect(occupancyTone(59)).toBe("red");
  });

  test("formats overdue ages and shortened identifiers", () => {
    expect(overdueLabel()).toBe("—");
    expect(overdueLabel("bad-date")).toBe("bad-date");
    expect(overdueLabel("2026-08-20T12:00:00Z")).toBe("2d");
    expect(shortId("1234567890")).toBe("12345678");
    expect(shortId()).toBe("—");
  });
});
