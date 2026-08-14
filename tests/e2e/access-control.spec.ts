import { expect, test } from "@playwright/test";

const password = process.env.E2E_ADMIN_PASSWORD;

test("administrator sees the concise role catalogue and feature matrix", async ({ page }) => {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.locator("#username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/);

  await page.goto("/administration");
  await page.getByRole("button", { name: /Roles & User Access/i }).click();
  await expect(page.getByRole("heading", { name: "Roles and feature access" })).toBeVisible();
  await page.getByLabel("Role").click();
  await expect(page.getByRole("option", { name: "Portfolio Manager" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Finance Officer" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Operations Staff" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Read Only" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Facility Inspector" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Property Management", { exact: true })).toBeVisible();
  await expect(page.getByText("Facility Management", { exact: true })).toBeVisible();
  await expect(page.getByText("Companion", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create role" })).toBeVisible();
});
