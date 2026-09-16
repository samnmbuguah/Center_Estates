import { expect, test, type Page } from "@playwright/test";

// Fast, dependency-light probe used as a post-deploy gate. It deliberately
// avoids asserting on seeded records so it stays green on any environment
// where the admin account and active modules are configured.
const username = process.env.E2E_ADMIN_USERNAME ?? "admin";
const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password!);

  const loginResponse = page.waitForResponse(
    (response) => response.url().includes("/api/v1/auth/login") && response.request().method() === "POST",
  );
  await page.locator("button[type=submit]").click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/workspaces$/, { timeout: 30_000 });
}

test.describe("@smoke", () => {
  test.skip(!password, "E2E_ADMIN_PASSWORD is required");

  test("@smoke admin signs in and reaches the command centre", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  });

  test("@smoke every advertised module opens its workspace", async ({ page }) => {
    await signIn(page);

    const hrefs = (
      await page.locator("a.module-card").evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("href")).filter((href): href is string => Boolean(href)),
      )
    ).sort();
    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      await page.goto(href, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".module-nav-bar, .module-workspace").first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator(".form-error")).toHaveCount(0);
    }
  });
});
