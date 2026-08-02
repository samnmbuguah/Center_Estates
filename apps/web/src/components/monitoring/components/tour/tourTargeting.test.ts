import { describe, expect, it } from "vitest";
import { resolveTourTargetSelector } from "./tourTargeting";

describe("resolveTourTargetSelector", () => {
  it("returns the first matching selector when the preferred target exists", () => {
    document.body.innerHTML = '<div data-tour-target="dashboard-stats"></div>';

    expect(resolveTourTargetSelector(".stat-card", "[data-tour-target='dashboard-stats']")).toBe("[data-tour-target='dashboard-stats']");
  });

  it("falls back to the provided selector when the preferred target is missing", () => {
    document.body.innerHTML = '<div class="stat-card"></div>';

    expect(resolveTourTargetSelector(".stat-card", "[data-tour-target='dashboard-stats']")).toBe(".stat-card");
  });

  it("returns the fallback selector when no preferred target exists", () => {
    document.body.innerHTML = "";

    expect(resolveTourTargetSelector(undefined, "[data-tour-target='layout-help-button']")).toBe("[data-tour-target='layout-help-button']");
  });
});
