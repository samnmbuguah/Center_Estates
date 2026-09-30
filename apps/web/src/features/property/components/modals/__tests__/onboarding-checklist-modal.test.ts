import { downloadErrorMessage } from "../OnboardingChecklistModal";

describe("OnboardingChecklistModal download errors", () => {
  it("never leaks raw HTML error pages", () => {
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>';
    for (const format of ["pdf", "xlsx"] as const) {
      const message = downloadErrorMessage(404, html, format);
      expect(message).not.toContain("<!DOCTYPE");
      expect(message).not.toContain("<html");
      expect(message).toMatch(/CSV download|sign in|retry/i);
    }
  });

  it("directs expired sessions to sign-in", () => {
    expect(downloadErrorMessage(401, "", "pdf")).toMatch(/sign in/i);
    expect(downloadErrorMessage(403, "", "xlsx")).toMatch(/sign in/i);
  });

  it("reports unexpected failures with the status code", () => {
    expect(downloadErrorMessage(500, "", "pdf")).toContain("500");
  });
});
