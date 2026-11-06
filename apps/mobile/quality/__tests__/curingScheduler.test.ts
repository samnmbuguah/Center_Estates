import { describe, expect, it } from "vitest";
import { calculateCuringSchedule } from "../curingScheduler";

describe("curingScheduler", () => {
  it("calculates 7-day, 14-day and 28-day target dates", () => {
    const sched = calculateCuringSchedule("2026-08-01", null, "2026-08-03");
    expect(sched).not.toBeNull();
    expect(sched!.date7d).toBe("2026-08-08");
    expect(sched!.date14d).toBe("2026-08-15");
    expect(sched!.date28d).toBe("2026-08-29");
    expect(sched!.ageDays).toBe(2);
    expect(sched!.status).toBe("curing");
    expect(sched!.statusLabel).toContain("7-day crush in 5d");
  });

  it("flags 7-day test due today", () => {
    const sched = calculateCuringSchedule("2026-08-01", null, "2026-08-08");
    expect(sched!.status).toBe("due_7d");
    expect(sched!.statusLabel).toBe("7-Day Crush Due Today");
  });

  it("flags 28-day test due today", () => {
    const sched = calculateCuringSchedule("2026-08-01", null, "2026-08-29");
    expect(sched!.status).toBe("due_28d");
    expect(sched!.statusLabel).toBe("28-Day Final Crush Due Today");
  });

  it("flags overdue tests if 28 days pass without test results", () => {
    const sched = calculateCuringSchedule("2026-08-01", null, "2026-09-05");
    expect(sched!.status).toBe("overdue");
    expect(sched!.statusLabel).toContain("Overdue");
  });

  it("marks tested once passed boolean is recorded", () => {
    const sched = calculateCuringSchedule("2026-08-01", true, "2026-09-05");
    expect(sched!.status).toBe("tested");
    expect(sched!.statusLabel).toBe("Cured & Passed");
  });
});
