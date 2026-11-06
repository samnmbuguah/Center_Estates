import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { apiUrl } from "../api";

describe("apiUrl", () => {
  it("appends trailing slash to standard DRF resource paths", () => {
    expect(apiUrl("/projects")).toBe("https://api.centerestates.com/api/v1/construction/projects/");
    expect(apiUrl("/daily-logs")).toBe("https://api.centerestates.com/api/v1/construction/daily-logs/");
    expect(apiUrl("/materials")).toBe("https://api.centerestates.com/api/v1/construction/materials/");
  });

  it("preserves trailing slash if already present", () => {
    expect(apiUrl("/projects/")).toBe("https://api.centerestates.com/api/v1/construction/projects/");
  });

  it("does not append slash to non-slash endpoints", () => {
    expect(apiUrl("/me")).toBe("https://api.centerestates.com/api/v1/construction/me");
    expect(apiUrl("/sync/pull")).toBe("https://api.centerestates.com/api/v1/construction/sync/pull");
    expect(apiUrl("/sync/push")).toBe("https://api.centerestates.com/api/v1/construction/sync/push");
    expect(apiUrl("/media/upload")).toBe("https://api.centerestates.com/api/v1/construction/media/upload");
    expect(apiUrl("/devices/register")).toBe("https://api.centerestates.com/api/v1/construction/devices/register");
    expect(apiUrl("/audit/verify/milestone-123")).toBe("https://api.centerestates.com/api/v1/construction/audit/verify/milestone-123");
  });

  it("handles query strings correctly with trailing slashes", () => {
    expect(apiUrl("/reports/weekly?project_id=123")).toBe(
      "https://api.centerestates.com/api/v1/construction/reports/weekly/?project_id=123",
    );
    expect(apiUrl("/sync/pull?last_pulled_at=100")).toBe(
      "https://api.centerestates.com/api/v1/construction/sync/pull?last_pulled_at=100",
    );
  });

  it("preserves file extension paths without trailing slash", () => {
    expect(apiUrl("/exports/boq/123.csv")).toBe(
      "https://api.centerestates.com/api/v1/construction/exports/boq/123.csv",
    );
  });
});
