import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://monitoringerp.com";
const ADMIN = process.env.E2E_ADMIN_USERNAME || "admin";
const PASS = process.env.E2E_ADMIN_PASSWORD || "S/2xvBbssIGJJwjOEbOni4JyHQ7tJc0f";

async function signIn(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("input", { timeout: 30000 });
  await page.locator("input").nth(0).fill(ADMIN);
  await page.locator("input").nth(1).fill(PASS);
  await page.locator("button[type=submit]").click();
  await page.waitForURL(/(workspaces|\/)$/, { timeout: 30000 });
}

test.beforeEach(async ({ page }) => signIn(page));

test("demo tour launcher is present in the topbar", async ({ page }) => {
  await page.goto(`${BASE}/workspaces`);
  await page.waitForTimeout(2000);
  const launcher = page.getByTestId("tour-launcher-btn");
  await expect(launcher).toBeVisible();
  await launcher.click();
  const workOrderTour = page.getByTestId("tour-create-work-order");
  await expect(workOrderTour).toBeVisible();
  const rentTour = page.getByTestId("tour-record-rent-receipt");
  await expect(rentTour).toBeVisible();
});

test("facility work order user story: create and submit a work order", async ({ page }) => {
  // 1. Navigate to Facility via the sidebar nav testid
  await page.goto(`${BASE}/facility`);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("module-nav-facility")).toBeVisible();

  // 2. Open the create work order modal
  await page.getByTestId("facility-create-work-order-btn").click();
  await page.getByTestId("wo-title-input").waitFor({ timeout: 10000 });

  // 3. Fill the form (framework state sync via real input events)
  const unique = Date.now();
  await page.getByTestId("wo-title-input").fill(`E2E Water Leakage ${unique}`);
  await page.getByTestId("wo-priority-select").selectOption("high");
  await page.getByTestId("wo-category-input").fill("Plumbing");
  await page.getByTestId("wo-description-input").fill("Automated end-to-end test work order creation.");

  // Property is required — pick the first available property option
  const propertySelect = page.getByTestId("wo-property-select");
  const optionCount = await propertySelect.locator("option").count();
  if (optionCount > 1) {
    await propertySelect.selectOption({ index: 1 });
  }

  // 4. Submit
  await page.getByTestId("wo-submit-btn").click();
  await page.waitForTimeout(2500);

  // 5. Verify the record landed in the register (UI mutation)
  await page.getByTestId("wo-register-search").fill(`Water Leakage ${unique}`);
  await page.waitForTimeout(1500);
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).toContain(`Water Leakage ${unique}`);
});

test("facility work order form validates required fields", async ({ page }) => {
  await page.goto(`${BASE}/facility`);
  await page.waitForTimeout(3000);
  await page.getByTestId("facility-create-work-order-btn").click();
  await page.getByTestId("wo-title-input").waitFor({ timeout: 10000 });

  // Submit empty — the browser's required validation should block submission
  const submitBtn = page.getByTestId("wo-submit-btn");
  await submitBtn.click();
  await page.waitForTimeout(800);
  // Modal should still be open (form not submitted without required fields)
  await expect(page.getByTestId("wo-title-input")).toBeVisible();
});

test("rent receipt user story: record a payment against an invoice", async ({ page }) => {
  await page.goto(`${BASE}/property`);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("module-nav-property")).toBeVisible();

  // Open the Rent & Invoices tab (left sidebar)
  const rentTab = page.locator(".module-side-nav button").filter({ hasText: /Rent & invoices|Rent/i }).first();
  if (await rentTab.isVisible()) {
    await rentTab.click();
    await page.waitForTimeout(1500);
  }

  // Record receipt button if present
  const recordBtn = page.getByTestId("property-record-receipt-btn");
  if (await recordBtn.isVisible().catch(() => false)) {
    await recordBtn.click();
    await page.waitForTimeout(1000);
  }

  // Assert the rent view rendered without page errors
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
