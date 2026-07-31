import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.getByLabel("Username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ERP modules", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => signIn(page));

test("subscribed modules navigate through the unified shell", async ({ page }, testInfo) => {
  const modules = [
    ["Property", "Property Management"],
    ["Facility", "Facility Management"],
    ["Sales", "Sales Management"],
    ["Tender", "Tender Management"],
    ["Valuation", "Valuation"],
    ["Construction Monitoring", "Project monitoring"],
  ] as const;
  for (const [link, heading] of modules) {
    if (testInfo.project.name.startsWith("mobile")) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.locator(".form-error")).toHaveCount(0);
  }
});

test("property rent ledger registers and receipt dialog are usable", async ({ page }) => {
  await page.goto("/property");
  await expect(page.getByText("Outstanding rent", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Receipts", exact: true }).click();
  await expect(page.getByText("RCT-2026-0418", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Allocations", exact: true }).click();
  await expect(page.getByText("INV-2026-0701", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Credit notes", exact: true }).click();
  await expect(page.getByText("CN-2026-0021", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Record receipt", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Record and allocate receipt" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Open invoice")).not.toHaveValue("");
  await expect(dialog.getByLabel("Amount")).toHaveAttribute("max", "100000.00");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("mobile navigation opens, changes module and closes", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile navigation behavior");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Platform modules" })).toBeVisible();
  await page.getByRole("link", { name: "Property", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Property Management" })).toBeVisible();
  await expect(page.locator(".sidebar")).not.toHaveClass(/mobile-open/);
});

test("authenticated module pages do not produce browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of ["/property", "/facility", "/sales", "/tender", "/valuation", "/monitoring"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
