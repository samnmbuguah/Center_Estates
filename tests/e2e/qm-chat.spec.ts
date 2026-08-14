import { expect, test } from "@playwright/test";

const password = process.env.E2E_ADMIN_PASSWORD;

test("QM opens after login, briefs the user and retains a minimized conversation", async ({ page }) => {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/login");
  await page.locator("#username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/(workspaces)?$/, { timeout: 30_000 });

  const chat = page.getByRole("dialog", { name: "Quartermaster AI companion" });
  await expect(chat).toBeVisible({ timeout: 10_000 });
  await expect(chat.getByText(/Give me a concise briefing for today/)).toBeVisible();
  await expect(chat.getByText("View My Tasks", { exact: true })).toBeVisible({ timeout: 30_000 });

  await chat.getByRole("button", { name: "Minimize Quartermaster" }).click();
  await expect(chat).toBeHidden();
  await page.getByRole("button", { name: "Open Quartermaster AI companion" }).click();
  await expect(chat).toBeVisible();
  await expect(chat.getByText("View My Tasks", { exact: true })).toBeVisible();

  await chat.getByRole("button", { name: "Close Quartermaster" }).click();
  await expect(chat).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open Quartermaster AI companion" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
