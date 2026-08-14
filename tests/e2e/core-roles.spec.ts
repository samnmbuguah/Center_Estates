import { expect, test, type Page } from "@playwright/test";
import { openModuleSection } from "./helpers";

const password = process.env.E2E_ROLE_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page, username: string) {
  if (!password) throw new Error("E2E_ROLE_PASSWORD or E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/);
}

async function expectModuleCards(page: Page, expected: string[]) {
  const cards = page.locator("a.module-card");
  await expect(cards).toHaveCount(expected.length);
  const hrefs = await cards.evaluateAll((items) => items.map((item) => item.getAttribute("href")));
  expect(hrefs.sort()).toEqual(expected.map((module) => `/${module}`).sort());
}

test("portfolio manager has the three operational workspaces", async ({ page }) => {
  await signIn(page, "role-portfolio-manager");
  await expectModuleCards(page, ["property", "facility", "companion"]);
});

test("operations staff can perform facility work without property administration", async ({ page }) => {
  await signIn(page, "role-operations-staff");
  await expectModuleCards(page, ["property", "facility", "companion"]);
  await page.goto("/facility");
  await openModuleSection(page, "Work Orders");
  await expect(page.getByRole("button", { name: "+ Create Work Order", exact: true })).toBeVisible();
  await page.goto("/property");
  await expect(page.getByRole("button", { name: /Add property/i })).toHaveCount(0);
});

test("finance officer reaches property collections and companion only", async ({ page }) => {
  await signIn(page, "role-finance-officer");
  await expectModuleCards(page, ["property", "companion"]);
  await page.goto("/property");
  await openModuleSection(page, "Receipts");
  await expect(page.getByRole("button", { name: "+ Record Receipt", exact: true }).last()).toBeVisible();
});

test("read-only role can inspect all three modules without mutation controls", async ({ page }) => {
  await signIn(page, "role-read-only");
  await expectModuleCards(page, ["property", "facility", "companion"]);
  await page.goto("/facility");
  await openModuleSection(page, "Work Orders");
  await expect(page.getByRole("button", { name: "+ Create Work Order", exact: true })).toHaveCount(0);
  await page.goto("/companion");
  await expect(page.getByRole("button", { name: /Assign Task/i })).toHaveCount(0);
});
