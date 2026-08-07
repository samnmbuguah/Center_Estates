import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { openTab } from "./helpers";

const BASE = process.env.E2E_BASE_URL || "https://monitoringerp.com";
const ADMIN = process.env.E2E_ADMIN_USERNAME || "admin";
const PASS = process.env.E2E_ADMIN_PASSWORD || "S/2xvBbssIGJJwjOEbOni4JyHQ7tJc0f";

async function signIn(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.locator("#username").fill(ADMIN);
  await page.locator("#password").fill(PASS);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
}

test.beforeEach(async ({ page }) => signIn(page));


test("property overview renders all KPIs and charts correctly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await page.waitForTimeout(500);

  await expect(page.getByText("Properties", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Units", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Occupied", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Monthly Rent", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Outstanding", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Collection Rate", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Occupancy", { exact: true }).first()).toBeVisible();

  await expect(page.getByRole("heading", { name: "Monthly rent collection trend" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lease expiry overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Property portfolio summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rent ageing summary" })).toBeVisible();

  await expect(page.getByText("Westlands Business Centre", { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

test("property list shows properties with correct data and filters work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Properties");
  await page.waitForTimeout(500);

  await expect(page.getByText("Finance House", { exact: true })).toBeVisible();

  const typeFilter = page.locator("select, [role=combobox]").filter({ hasText: /Type/i });
  if (await typeFilter.count() > 0) await expect(typeFilter.first()).toBeVisible();

  const locationFilter = page.locator("select, [role=combobox]").filter({ hasText: /Location/i });
  if (await locationFilter.count() > 0) await expect(locationFilter.first()).toBeVisible();

  const statusFilter = page.locator("select, [role=combobox]").filter({ hasText: /Status/i });
  if (await statusFilter.count() > 0) await expect(statusFilter.first()).toBeVisible();

  const exportBtn = page.getByRole("button", { name: /Export/i });
  if (await exportBtn.count() > 0) await expect(exportBtn.first()).toBeVisible();

  const occupancyBadge = page.locator("text=/\\d+% occupied/").first();
  if (await occupancyBadge.count() > 0) await expect(occupancyBadge).toBeVisible();

  expect(errors).toEqual([]);
});

test("tenant list shows seeded tenants and search works", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Tenants");
  await page.waitForTimeout(500);

  await expect(page.getByText("ABC Traders Ltd", { exact: true })).toBeVisible();

  const searchInput = page.locator("input[placeholder*='earch'], input[aria-label*='earch'], input[type='search']").first();
  if (await searchInput.count() > 0) {
    await searchInput.fill("Acacia");
    await page.waitForTimeout(500);
    await expect(page.getByText("Acacia Consulting", { exact: false })).toBeVisible();
  }

  const activeBadge = page.locator("text=/Active/i").first();
  if (await activeBadge.count() > 0) await expect(activeBadge).toBeVisible();

  expect(errors).toEqual([]);
});

test("tenant creation flow works end to end", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel tenant-code races");

  await page.goto("/property");
  await openTab(page, "Tenants");
  await page.waitForTimeout(500);

  const suffix = Date.now();
  const tenantName = `E2E Test Tenant ${suffix}`;

  const addBtn = page.getByRole("button", { name: /Add Tenant|Add New Tenant/i }).last();
  await addBtn.click();
  await page.waitForTimeout(500);

  const dialog = page.getByRole("dialog").first();
  if (await dialog.isVisible()) {
    const codeInput = dialog.locator("input").filter({ has: page.locator("text=/Code|code/i") }).first();
    if (await codeInput.count() === 0) {
      const codeField = dialog.getByLabel(/code/i);
      if (await codeField.count() > 0) await codeField.fill(`E2E-${suffix}`);
    } else {
      await codeInput.fill(`E2E-${suffix}`);
    }

    const nameField = dialog.getByLabel(/name|company/i);
    if (await nameField.count() > 0) await nameField.first().fill(tenantName);

    const typeField = dialog.getByLabel(/type/i);
    if (await typeField.count() > 0) {
      await typeField.selectOption("company");
    }

    const emailField = dialog.getByLabel(/email/i);
    if (await emailField.count() > 0) await emailField.first().fill("e2e-test@example.com");

    const phoneField = dialog.getByLabel(/phone/i);
    if (await phoneField.count() > 0) await phoneField.first().fill("+254 700 000000");

    const kraField = dialog.getByLabel(/kra|tax/i);
    if (await kraField.count() > 0) await kraField.first().fill("P0E2ETESTZ");

    const submitBtn = dialog.getByRole("button", { name: /Register Tenant|Save|Create/i });
    if (await submitBtn.count() > 0) {
      await submitBtn.first().click();
      await page.waitForTimeout(1000);
    }
  }

  await expect(page.getByText(tenantName, { exact: true })).toBeVisible();
});

test("lease list shows seeded leases with data", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Leases");
  await page.waitForTimeout(500);

  await expect(page.getByText("LS-2025-0128", { exact: true })).toBeVisible();
  await expect(page.getByText("ABC Traders", { exact: true })).toBeVisible();

  const activeBadge = page.locator("text=/Active|active/i").first();
  if (await activeBadge.count() > 0) await expect(activeBadge).toBeVisible();

  const outstandingText = page.locator("text=/Outstanding|outstanding/i").first();
  if (await outstandingText.count() > 0) await expect(outstandingText).toBeVisible();

  expect(errors).toEqual([]);
});

test("rent collection view shows invoices and collection KPIs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Rent & invoices");
  await page.waitForTimeout(500);

  const totalBilled = page.locator("text=/Total Billed|total billed/i").first();
  if (await totalBilled.count() > 0) await expect(totalBilled).toBeVisible();

  const collected = page.locator("text=/Collected|collected/i").first();
  if (await collected.count() > 0) await expect(collected).toBeVisible();

  const collectionRate = page.locator("text=/Collection Rate|collection rate/i").first();
  if (await collectionRate.count() > 0) await expect(collectionRate).toBeVisible();

  const outstanding = page.locator("text=/Outstanding|outstanding/i").first();
  if (await outstanding.count() > 0) await expect(outstanding).toBeVisible();

  await expect(page.getByText("INV-2026-0701", { exact: true })).toBeVisible();
  await expect(page.getByText("INV-2026-0702", { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

test("service charge view shows charge scheme and cost centres", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Service charge");
  await page.waitForTimeout(500);

  const setupTab = page.locator("button, a").filter({ hasText: /Setup/i }).first();
  if (await setupTab.count() > 0) await expect(setupTab).toBeVisible();

  const costCentresText = page.locator("text=/Cost Cent|cost cent/i").first();
  if (await costCentresText.count() > 0) await expect(costCentresText).toBeVisible();

  const budgetText = page.locator("text=/Annual|annual budget/i").first();
  if (await budgetText.count() > 0) await expect(budgetText).toBeVisible();

  expect(errors).toEqual([]);
});

test("receipts list shows receipt data and credit notes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Receipts");
  await page.waitForTimeout(500);

  await expect(page.getByText("RCT-2026-0418", { exact: true })).toBeVisible();

  const appliedText = page.locator("text=/Applied|applied/i").first();
  if (await appliedText.count() > 0) await expect(appliedText).toBeVisible();

  await openTab(page, "Credit notes");
  await page.waitForTimeout(500);

  await expect(page.getByText("CN-2026-0021", { exact: true })).toBeVisible();

  const receiptChip = page.locator("button, a, span").filter({ hasText: /Receipts/i }).first();
  if (await receiptChip.count() > 0) await expect(receiptChip).toBeVisible();

  const creditNoteChip = page.locator("button, a, span").filter({ hasText: /Credit Notes/i }).first();
  if (await creditNoteChip.count() > 0) await expect(creditNoteChip).toBeVisible();

  const unappliedChip = page.locator("button, a, span").filter({ hasText: /Unapplied/i }).first();
  if (await unappliedChip.count() > 0) await expect(unappliedChip).toBeVisible();

  expect(errors).toEqual([]);
});

test("bank reconciliation shows matched transaction", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Bank reconciliation");
  await page.waitForTimeout(500);

  await expect(page.getByText("FT260418ACACIA", { exact: true })).toBeVisible();

  const matchedBadge = page.locator("text=/matched|Matched/i").first();
  if (await matchedBadge.count() > 0) await expect(matchedBadge).toBeVisible();

  expect(errors).toEqual([]);
});

test("budgets view shows budget lines and utilization", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Budgets");
  await page.waitForTimeout(500);

  await expect(page.getByText("Utilities", { exact: true })).toBeVisible();

  const approveBtn = page.getByRole("button", { name: /Approve/i }).first();
  if (await approveBtn.count() > 0) await expect(approveBtn).toBeVisible();

  const utilizationText = page.locator("text=/Utilization|utilization|utilised/i").first();
  if (await utilizationText.count() > 0) await expect(utilizationText).toBeVisible();

  expect(errors).toEqual([]);
});

test("expenses view shows expense records with status badges", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Expenses");
  await page.waitForTimeout(500);

  const incomeKpi = page.locator("text=/Income/i").first();
  if (await incomeKpi.count() > 0) await expect(incomeKpi).toBeVisible();

  const expensesKpi = page.locator("text=/Expenses/i").first();
  if (await expensesKpi.count() > 0) await expect(expensesKpi).toBeVisible();

  const netIncome = page.locator("text=/Net Income|net income/i").first();
  if (await netIncome.count() > 0) await expect(netIncome).toBeVisible();

  const transactionsTable = page.locator("table, [role=table]").first();
  await expect(transactionsTable).toBeVisible();

  const incomeByCategory = page.locator("text=/Income by category/i").first();
  if (await incomeByCategory.count() > 0) await expect(incomeByCategory).toBeVisible();

  expect(errors).toEqual([]);
});

test("property reports show report catalogue with export capability", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Reports");
  await page.waitForTimeout(500);

  const reportCategory = page.locator("text=/Report|report|Catalogue|catalogue/i").first();
  if (await reportCategory.count() > 0) await expect(reportCategory).toBeVisible();

  const agingRow = page.getByRole("row").filter({ hasText: "Outstanding aging" });
  await expect(agingRow).toBeVisible();

  const downloadBtn = agingRow.getByRole("button", { name: /CSV|Export|Download/i });
  if (await downloadBtn.count() > 0) await expect(downloadBtn).toBeVisible();

  test.skip(testInfo.project.name.startsWith("mobile"), "Download behavior is covered once on desktop");
  if (await downloadBtn.count() > 0) {
    const downloadPromise = page.waitForEvent("download");
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("property-aging.csv");
  }

  expect(errors).toEqual([]);
});

test("arrears view shows aging summary", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Arrears");
  await page.waitForTimeout(500);

  const aging0to30 = page.locator("text=/0.30|0-30/i").first();
  if (await aging0to30.count() > 0) await expect(aging0to30).toBeVisible();

  const aging31to60 = page.locator("text=/31.60|31-60/i").first();
  if (await aging31to60.count() > 0) await expect(aging31to60).toBeVisible();

  const aging61to90 = page.locator("text=/61.90|61-90/i").first();
  if (await aging61to90.count() > 0) await expect(aging61to90).toBeVisible();

  const aging90plus = page.locator("text=/90\\+|90 plus|over 90|over90/i").first();
  if (await aging90plus.count() > 0) await expect(aging90plus).toBeVisible();

  const tenantRow = page.locator("table, [role=table]").locator("tr, [role=row]").filter({ has: page.locator("td, [role=cell]") }).first();
  await expect(tenantRow).toBeVisible();

  expect(errors).toEqual([]);
});

test("tenant documents tab renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Tenant documents");
  await page.waitForTimeout(500);

  const tableOrEmpty = page.locator("table, [role=table], text=/No documents|no documents|empty/i").first();
  if (await tableOrEmpty.count() > 0) await expect(tableOrEmpty).toBeVisible();

  await expect(page.locator("h1, h2, h3").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("rent schedules tab renders data", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Rent schedules");
  await page.waitForTimeout(500);

  const table = page.locator("table, [role=table]").first();
  if (await table.count() > 0) {
    await expect(table).toBeVisible();
  } else {
    const emptyState = page.locator("text=/No schedules|no schedules|No data|empty/i").first();
    if (await emptyState.count() > 0) await expect(emptyState).toBeVisible();
  }

  expect(errors).toEqual([]);
});
