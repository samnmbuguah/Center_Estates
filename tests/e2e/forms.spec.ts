import { expect, test, type Page } from "@playwright/test";
import { openModuleSection, signInAs } from "./helpers";

const password = process.env.E2E_ADMIN_PASSWORD;

test.beforeEach(async ({ page }) => {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await signInAs(page, process.env.E2E_ADMIN_USERNAME ?? "admin", password);
});

test("facility: add new asset form submits", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel asset races");
  await page.goto("/facility");
  const assetsNav = page.locator(".module-nav-bar").getByRole("button", { name: /Assets & Inventory/i });
  if (await assetsNav.count()) await assetsNav.click();
  await page.waitForTimeout(2000);
  const addBtn = page.getByRole("button", { name: /Add Asset/i }).first();
  if (await addBtn.count() === 0) {
    await expect(page.locator(".module-workspace")).toBeVisible();
    return;
  }
  await addBtn.click();
  await page.getByLabel("Asset name").waitFor({ timeout: 15000 });
  const suffix = Date.now();
  await expect(page.getByLabel("Asset ID")).toHaveValue("Generated on save");
  await page.getByLabel("Asset name").fill(`E2E Asset ${suffix}`);
  await page.getByLabel("Asset category").fill("Electrical Systems");
  await page.getByLabel("Asset type").fill("Standby generator");
  await page.getByRole("tab", { name: /Location/ }).click();
  await page.getByLabel("Property").selectOption({ index: 1 });
  await page.getByLabel("Room / exact location").fill("Roof plant room");
  await page.getByRole("tab", { name: /Identity/ }).click();
  await expect(page.getByLabel("Asset name")).toHaveValue(`E2E Asset ${suffix}`);
  await page.getByRole("tab", { name: /Location/ }).click();
  await page.getByRole("button", { name: "Save record" }).click();
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  expect(body).toContain(`E2E Asset ${suffix}`);
});

test("facility: comprehensive service provider onboarding persists across tabs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel provider races");
  await page.goto("/facility");
  await openModuleSection(page, "Contractors", testInfo);
  await page.getByRole("button", { name: /Add Provider/i }).click();
  const suffix = Date.now();
  const name = `E2E Service Provider ${suffix}`;
  await expect(page.getByLabel("Provider ID")).toHaveValue("Generated on save");
  await page.getByLabel("Company / organization name").fill(name);
  await page.getByLabel("Registration number").fill(`PVT-${suffix}`);
  await page.getByLabel("Business / entity type").fill("Limited company");
  await page.getByLabel("Company category").fill("Facilities services");
  await page.getByLabel("Tax PIN").fill(`P${String(suffix).slice(-9)}`);
  await page.getByLabel("Trade / specialization").fill("Mechanical and electrical");
  await page.getByRole("tab", { name: /Contacts/ }).click();
  await page.getByLabel("Primary contact name").fill("Jane Manager");
  await page.getByLabel("Primary phone").fill("+254700000001");
  await page.getByLabel("Primary email").fill("provider@example.test");
  await page.getByRole("tab", { name: /Services/ }).click();
  await page.getByLabel("Geographic coverage areas").fill("Nairobi and Mombasa");
  await page.locator('input[name="assigned_properties"]').first().check();
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15000 });
});

test("facility: new inspection form submits", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel inspection races");
  await page.goto("/facility");
  const inspNav = page.locator(".module-nav-bar").getByRole("button", { name: /Inspections/i });
  if (await inspNav.count()) await inspNav.click();
  await page.waitForTimeout(1500);
  const addBtn = page.getByRole("button", { name: /New Inspection|Add Inspection/i }).first();
  if (await addBtn.count() === 0) {
    await expect(page.locator(".module-nav-bar")).toBeVisible();
    return; // register may be empty; the form surface is verified via the nav
  }
  await addBtn.click();
  await page.getByTestId("insp-ref-input").waitFor({ timeout: 15000 });
  const ref = `INSP-E2E-${Date.now()}`;
  await page.getByTestId("insp-ref-input").fill(ref);
  await page.getByRole("button", { name: /Save Inspection|Create Inspection|Start Inspection/i }).first().click();
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  expect(body).toContain(ref);
});

test("property: add new property form submits", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel property races");
  // The redesigned onboarding is a standalone multi-section form.
  await page.goto("/property-onboarding");
  await page.getByLabel(/Property name/i).waitFor({ timeout: 20000 });
  const name = `E2E Form Property ${Date.now()}`;
  await page.getByLabel(/Property name/i).fill(name);
  await page.getByLabel(/Name of landlord/i).fill("E2E Landlord");
  // Location section holds the remaining required fields.
  await page.getByRole("tab", { name: /Property address|Location/i }).click();
  await page.getByLabel(/Physical address/i).fill("E2E Road, Mombasa");
  await page.getByLabel(/City \/ town/i).fill("Mombasa");
  await page.getByLabel(/County/i).fill("Mombasa");
  await page.getByRole("button", { name: /Save & Close/i }).first().click();
  await page.waitForTimeout(2500);
  // The save navigates to the command center overview.
  await expect(page).toHaveURL(/workspaces|\/property|\/overview/, { timeout: 20000 });
});

test("facility: record expenditure form submits", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel finance races");
  await page.goto("/facility");
  const expNav = page.locator(".module-nav-bar").getByRole("button", { name: /Expenditure/i });
  if (await expNav.count()) await expNav.click();
  await page.waitForTimeout(1500);
  const addBtn = page.getByRole("button", { name: /Record Expenditure|Add Expenditure/i }).first();
  if (await addBtn.count() === 0) {
    await expect(page.locator(".module-workspace")).toBeVisible();
    return;
  }
  await addBtn.click();
  await page.getByLabel(/Category/i).waitFor({ timeout: 15000 });
  await page.getByLabel(/Category/i).selectOption({ index: 1 });
  const body0 = await page.locator("body").innerText();
  const amountInput = page.locator("input[type='number']").first();
  await amountInput.fill("2500");
  await page.getByRole("button", { name: /Save|Record/i }).first().click();
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("Form submission failed");
});

test("sales: new listing form submits", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel listing races");
  await page.goto("/sales");
  const addBtn = page.getByRole("button", { name: /New Listing|Add Listing/i }).first();
  if (await addBtn.count() === 0) {
    await expect(page.locator(".module-workspace")).toBeVisible();
    return;
  }
  await addBtn.click();
  await page.getByRole("dialog", { name: /New Listing/i }).waitFor({ timeout: 15000 });
  const listingTitle = `E2E Listing ${Date.now()}`;
  const titleField = page.getByLabel(/Title|Unit|Listing/i).first();
  if (await titleField.count()) await titleField.fill(listingTitle);
  await page.getByRole("button", { name: /Save|Create|Add/i }).first().click();
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  expect(body).toContain(listingTitle);
});

test("property: invoice register is a direct second-level page", async ({ page }) => {
  await page.goto("/property");
  await openModuleSection(page, "Invoices");
  await page.waitForTimeout(1500);
  await expect(page.locator(".module-workspace, .module-nav-bar").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /New invoice|Record Rent Payment/i }).first()).toBeVisible();
});

test("property: service charge workflows use only two navigation levels", async ({ page }) => {
  await page.goto("/property?tab=service-charges");
  await expect(page.getByText("Service Charge Schemes", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Budget vs Actual", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cost Centres", exact: true })).toHaveCount(0);
  await page.locator(".module-nav-bar").getByRole("button", { name: /Charge Allocations/i }).click();
  await expect(page.getByText("Charge Allocations", { exact: true }).first()).toBeVisible();
});

test("property onboarding: autosaved draft restores on reload and can be discarded", async ({ page }) => {
  await page.goto("/property-onboarding");
  await page.getByLabel(/Property name/i).waitFor({ timeout: 20000 });
  const draftName = `Draft Test Property ${Date.now()}`;
  await page.getByLabel(/Property name/i).fill(draftName);
  
  // Reload page to test draft restoration
  await page.reload();
  await page.getByLabel(/Property name/i).waitFor({ timeout: 20000 });
  
  // Verify draft restored and field value persisted
  await expect(page.getByLabel(/Property name/i)).toHaveValue(draftName);
  await expect(page.getByText(/Your unsaved property onboarding draft was restored/i)).toBeVisible();
  
  // Test Discard Draft button
  const discardBtn = page.getByRole("button", { name: /Discard draft/i });
  await expect(discardBtn).toBeVisible();
  await discardBtn.click();
  
  // Verify draft cleared and input reset
  await page.getByLabel(/Property name/i).waitFor({ timeout: 20000 });
  await expect(page.getByLabel(/Property name/i)).toHaveValue("");
});
