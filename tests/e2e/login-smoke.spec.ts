import { expect, test } from "@playwright/test";

const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_ADMIN_PASSWORD;

test("an active user can sign in and open the command centre", async ({ page }) => {
  test.skip(!username || !password, "E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD are required");

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#username").fill(username!);
  await page.locator("#password").fill(password!);

  const loginResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/auth/login/") && response.request().method() === "POST",
  );
  await page.locator("button[type=submit]").click();
  expect((await loginResponse).status()).toBe(200);

  await expect(page).toHaveURL(/\/workspaces$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByText("Property Management", { exact: true }).first()).toBeVisible();
});
