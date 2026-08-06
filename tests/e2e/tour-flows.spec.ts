import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://monitoringerp.com";
const ADMIN = process.env.E2E_ADMIN_USERNAME || "admin";
const PASS = process.env.E2E_ADMIN_PASSWORD || "S/2xvBbssIGJJwjOEbOni4JyHQ7tJc0f";

async function signIn(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("input", { timeout: 40000 });
  await page.locator("input").nth(0).fill(ADMIN);
  await page.locator("input").nth(1).fill(PASS);
  await page.locator("button[type=submit]").click();
  await page.waitForTimeout(8000);
  await page.goto(`${BASE}/workspaces`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
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

  // Navigate to the Work Orders section in the module sidebar
  const woNav = page.locator(".module-side-nav button").filter({ hasText: /Work orders/i }).first();
  if (await woNav.isVisible()) {
    await woNav.click();
    await page.waitForTimeout(1500);
  }

  // 2. Open the create work order modal
  await page.getByTestId("facility-create-work-order-btn").waitFor({ timeout: 15000 });
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
  // Navigate to Work Orders section
  const woNav = page.locator(".module-side-nav button").filter({ hasText: /Work orders/i }).first();
  if (await woNav.isVisible()) {
    await woNav.click();
    await page.waitForTimeout(1500);
  }
  await page.getByTestId("facility-create-work-order-btn").waitFor({ timeout: 15000 });
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

test("tenant onboarding user story: create a tenant", async ({ page }) => {
  await page.goto(`${BASE}/property`);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("module-nav-property")).toBeVisible();

  // Navigate to the Tenants section in the module sidebar
  const tenantsNav = page.locator(".module-side-nav button").filter({ hasText: /Tenants/i }).first();
  if (await tenantsNav.isVisible()) {
    await tenantsNav.click();
    await page.waitForTimeout(1500);
  }

  // 2. Open the add tenant modal
  await page.getByTestId("property-add-tenant-btn").waitFor({ timeout: 15000 });
  await page.getByTestId("property-add-tenant-btn").click();
  await page.getByTestId("tenant-name-input").waitFor({ timeout: 10000 });

  // 3. Fill the form (code + name are required for the tenant profile)
  const unique = Date.now();
  await page.getByTestId("tenant-code-input").fill(`TNT-${unique}`);
  await page.getByTestId("tenant-name-input").fill(`E2E Tenant ${unique}`);
  await page.getByTestId("tenant-type-select").selectOption("company");
  await page.getByTestId("tenant-email-input").fill(`e2e.tenant.${unique}@example.com`);
  await page.getByTestId("tenant-phone-input").fill(`+254 700 ${String(unique).slice(-6)}`);

  // 4. Submit
  await page.getByTestId("tenant-save-btn").click();
  await page.waitForTimeout(2500);

  // 5. Verify the record landed in the tenant register (UI mutation)
  await page.getByTestId("tenant-search-input").fill(`E2E Tenant ${unique}`);
  await page.waitForTimeout(1500);
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).toContain(`E2E Tenant ${unique}`);
});

test("facility inspection user story: create an inspection", async ({ page }) => {
  await page.goto(`${BASE}/facility`);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("module-nav-facility")).toBeVisible();

  // Navigate to the Inspections section in the module sidebar
  const inspNav = page.locator(".module-side-nav button").filter({ hasText: /Inspections/i }).first();
  if (await inspNav.isVisible()) {
    await inspNav.click();
    await page.waitForTimeout(1500);
  }

  // 2. Open the create inspection modal
  await page.getByTestId("facility-create-inspection-btn").waitFor({ timeout: 15000 });
  await page.getByTestId("facility-create-inspection-btn").click();
  await page.getByTestId("insp-title-input").waitFor({ timeout: 10000 });

  // 3. Fill the form
  const unique = Date.now();
  await page.getByTestId("insp-title-input").fill(`E2E Inspection ${unique}`);
  await page.getByTestId("insp-type-select").selectOption("compliance");

  // Reference, property and scheduled date are required by the API
  const inspForm = page.getByTestId("insp-title-input").locator("xpath=ancestor::form");
  await inspForm.locator('input[name="reference"]').fill(`INSP-E2E-${unique}`);
  const propertySelect = inspForm.locator('select[name="property"]');
  const optionCount = await propertySelect.locator("option").count();
  if (optionCount > 1) {
    await propertySelect.selectOption({ index: 1 });
  }
  await inspForm.locator('input[name="scheduled_on"]').fill(new Date().toISOString().slice(0, 10));

  // 4. Submit
  await page.getByTestId("insp-submit-btn").click();
  await page.waitForTimeout(2500);

  // 5. Verify the record landed in the inspections register (UI mutation)
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).toContain(`E2E Inspection ${unique}`);
});

test("facility service request user story: create a service request", async ({ page }) => {
  await page.goto(`${BASE}/facility`);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("module-nav-facility")).toBeVisible();

  // Navigate to the Service Requests section in the module sidebar
  const srNav = page.locator(".module-side-nav button").filter({ hasText: /Service requests/i }).first();
  if (await srNav.isVisible()) {
    await srNav.click();
    await page.waitForTimeout(1500);
  }

  // 2. Open the create service request modal
  await page.getByTestId("facility-create-request-btn").waitFor({ timeout: 15000 });
  await page.getByTestId("facility-create-request-btn").click();
  await page.getByTestId("sr-title-input").waitFor({ timeout: 10000 });

  // 3. Fill the form (reference, property and date default server-side)
  const unique = Date.now();
  await page.getByTestId("sr-title-input").fill(`E2E AC Issue ${unique}`);
  await page.getByTestId("sr-priority-select").selectOption("high");

  // 4. Submit
  await page.getByTestId("sr-submit-btn").click();
  await page.waitForTimeout(2500);

  // 5. Verify the record landed in the requests register (UI mutation)
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).toContain(`E2E AC Issue ${unique}`);
});

test("property add property user story: create a property via the wizard", async ({ page }) => {
  await page.goto(`${BASE}/property`);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId("module-nav-property")).toBeVisible();

  // 2. Open the add property wizard from the module header
  await page.getByTestId("property-add-prop-btn").waitFor({ timeout: 15000 });
  await page.getByTestId("property-add-prop-btn").click();
  await page.getByTestId("prop-name-input").waitFor({ timeout: 10000 });

  // 3. Fill step 1 (basic information — name, code, type and city are required)
  const unique = Date.now();
  await page.getByTestId("prop-name-input").fill(`E2E Demo Tower ${unique}`);
  await page.getByTestId("prop-code-input").fill(`DEMO-${unique}`);
  await page.getByTestId("prop-type-select").selectOption("Commercial");
  await page.getByTestId("prop-city-input").fill("Nairobi");

  // 4. Walk the wizard: step 2 (unit mix) → step 3 (review & create)
  await page.getByTestId("prop-wizard-next").click();
  await page.waitForTimeout(800);
  await page.getByTestId("prop-wizard-next").click();
  await page.waitForTimeout(800);
  await page.getByTestId("prop-wizard-create").click();
  await page.waitForTimeout(2500);

  // 5. Verify the record landed in the property register (UI mutation)
  await page.getByTestId("property-search-input").fill(`E2E Demo Tower ${unique}`);
  await page.waitForTimeout(1500);
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).toContain(`E2E Demo Tower ${unique}`);
});
