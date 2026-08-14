import { expect, test } from "@playwright/test";

const password = process.env.E2E_ADMIN_PASSWORD;

test("fast sign-in never reuses the anonymous session bootstrap", async ({ page }) => {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");

  let releaseFirstSessionRequest: (() => void) | undefined;
  let markFirstSessionRequest: (() => void) | undefined;
  const firstSessionRequestStarted = new Promise<void>((resolve) => { markFirstSessionRequest = resolve; });
  const firstSessionRequestGate = new Promise<void>((resolve) => { releaseFirstSessionRequest = resolve; });
  let sessionRequestCount = 0;

  await page.route("**/api/v1/auth/me/", async (route) => {
    sessionRequestCount += 1;
    if (sessionRequestCount === 1) {
      markFirstSessionRequest?.();
      await firstSessionRequestGate;
    }
    await route.continue();
  });

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await firstSessionRequestStarted;
  await page.locator("#username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.locator("#password").fill(password);

  const loginResponse = page.waitForResponse((response) => (
    response.url().includes("/api/v1/auth/login/") && response.request().method() === "POST"
  ));
  await page.locator("button[type=submit]").click();
  expect((await loginResponse).ok()).toBeTruthy();
  releaseFirstSessionRequest?.();

  await expect(page).toHaveURL(/\/workspaces$/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "ERP modules", exact: true })).toBeVisible();
  expect(sessionRequestCount).toBeGreaterThanOrEqual(2);
});
