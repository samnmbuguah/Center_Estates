import { fmtDate, fmtDateTime, greeting, readError, toMediaUrl } from "./companion.utils";

describe("companion utilities", () => {
  afterEach(() => jest.useRealTimers());

  test.each([
    ["2026-08-22T08:00:00Z", "Good Morning"],
    ["2026-08-22T13:00:00Z", "Good Afternoon"],
    ["2026-08-22T19:00:00Z", "Good Evening"],
  ])("selects a time-aware greeting", (time, expected) => {
    jest.useFakeTimers().setSystemTime(new Date(time));
    expect(greeting()).toBe(expected);
  });

  test("formats dates while preserving invalid values", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("invalid")).toBe("invalid");
    expect(fmtDateTime(null)).toBe("—");
    expect(fmtDateTime("invalid")).toBe("invalid");
  });

  test("extracts useful API error messages", async () => {
    const response = (status: number, body: unknown, rejects = false) => ({
      status,
      json: rejects ? jest.fn().mockRejectedValue(new Error("invalid json")) : jest.fn().mockResolvedValue(body),
    }) as unknown as Response;
    expect(await readError(response(403, { detail: "Denied" }))).toBe("Denied");
    expect(await readError(response(400, { name: ["Required"] }))).toBe("Required");
    expect(await readError(response(502, null, true))).toBe("Request failed (502).");
  });

  test("normalizes relative media URLs and preserves absolute URLs", () => {
    expect(toMediaUrl(null)).toBe("");
    expect(toMediaUrl("https://cdn.example/logo.png")).toBe("https://cdn.example/logo.png");
    expect(toMediaUrl("/media/logo.png")).toBe("https://api.centerestates.com/media/logo.png");
  });
});
