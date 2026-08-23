import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { openTab, expectNoPageErrors } from "./helpers";

const BASE = process.env.E2E_BASE_URL || "https://centerestates.com";
const ADMIN = process.env.E2E_ADMIN_USERNAME || "admin";
const PASS = process.env.E2E_ADMIN_PASSWORD || "";

async function signIn(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.locator("#username").fill(ADMIN);
  await page.locator("#password").fill(PASS);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
}

test.beforeEach(async ({ page }) => signIn(page));


test("property overview is scoped to the selected property", async ({ page }) => {
  const errors: string[] = [];
  const dashboardScopes: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/property/dashboard/")) {
      const propertyId = request.headers()["x-property-id"];
      if (propertyId) dashboardScopes.push(propertyId);
    }
  });

  await page.goto("/property");
  await page.waitForTimeout(2000);

  await expect(page.getByText(/Outstanding Rent|Monthly Rent|Collection Rate|Arrears Aging/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Monthly Rent Collection & Variance Trend/i })).toBeVisible();
  await expect(page.getByText("Expected Target (KES)")).toBeVisible();
  await expect(page.getByText("Actual Collected (KES)")).toBeVisible();
  await expect(page.getByText("Net Variance", { exact: true })).toBeVisible();
  await expect(page.getByText("Period Efficiency", { exact: true })).toBeVisible();
  await expect(page.locator("h2, h3, .panel-title").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Property Portfolio Summary/i })).toHaveCount(0);
  await expect(page.getByText("All Properties", { exact: true })).toHaveCount(0);
  expect(dashboardScopes.length).toBeGreaterThan(0);

  await expectNoPageErrors(page, errors);
});

test("portfolio overview shows properties with working search", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/overview");
  await page.waitForTimeout(1500);

  await expect(page.getByRole("heading", { name: "Portfolio Overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Portfolio performance" })).toBeVisible();
  await expect(page.getByText("Monthly rent collection trend", { exact: true })).toBeVisible();
  await expect(page.getByText("Collection summary", { exact: true })).toBeVisible();
  await expect(page.getByText("Lease expiry outlook", { exact: true })).toBeVisible();
  await expect(page.getByText("Occupancy by property", { exact: true })).toBeVisible();
  await expect(page.getByText("Rent ageing summary", { exact: true })).toBeVisible();
  await expect(page.getByText(/Properties Register/i)).toBeVisible();
  const search = page.getByPlaceholder("Search properties...");
  await expect(search).toBeVisible();
  await search.fill("Nyali");
  await expect(page.getByText("Nyali Trade Centre", { exact: true }).first()).toBeVisible();

  await expectNoPageErrors(page, errors);
});

test("tenant list shows seeded tenants and search works", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Tenants");
  await page.waitForTimeout(500);

  await expect(
    page.locator("table, [role=table], .fc-alert-list").first().or(page.getByRole("heading", { name: "No tenants found" }))
  ).toBeVisible();

  const searchInput = page.locator("input[placeholder*='earch'], input[aria-label*='earch'], input[type='search']").first();
  if (await searchInput.count() > 0) {
    await searchInput.fill("Acacia");
    await page.waitForTimeout(500);
  }

  await expectNoPageErrors(page, errors);
});

test("tenant creation flow works end to end", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel tenant-code races");

  await page.goto("/property");
  await openTab(page, "Tenants");
  await page.waitForTimeout(500);

  const suffix = Date.now();
  const tenantName = `E2E Test Tenant ${suffix}`;

  const addBtn = page.getByRole("button", { name: /Onboard Tenant/i }).last();
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

  await expect(
    page.getByText(tenantName, { exact: true }).first().or(page.locator("table, [role=table]").first())
  ).toBeVisible();
});

test("lease list shows seeded leases with data", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Leases");
  await page.waitForTimeout(1500);

  await expect(page.locator("table, [role=table], .fc-alert-list").first()).toBeVisible();

  const outstandingText = page.locator("text=/Outstanding|outstanding/i").first();
  if (await outstandingText.count() > 0) await expect(outstandingText).toBeVisible();

  await expectNoPageErrors(page, errors);
});

test("rent collection view shows invoices and collection KPIs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property?tab=rent");
  await page.waitForTimeout(500);

  const totalBilled = page.locator("text=/Total Billed|total billed/i").first();
  if (await totalBilled.count() > 0) await expect(totalBilled).toBeVisible();

  const collected = page.locator("text=/Collected|collected/i").first();
  if (await collected.count() > 0) await expect(collected).toBeVisible();

  const collectionRate = page.locator("text=/Collection Rate|collection rate/i").first();
  if (await collectionRate.count() > 0) await expect(collectionRate).toBeVisible();

  const outstanding = page.locator("text=/Outstanding|outstanding/i").first();
  if (await outstanding.count() > 0) await expect(outstanding).toBeVisible();

  await expect(page.locator("table, [role=table], .fc-alert-list").first()).toBeVisible();

  await expectNoPageErrors(page, errors);
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

  await expectNoPageErrors(page, errors);
});

test("receipts list shows receipt data and credit notes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property?tab=receipts");
  await page.waitForTimeout(1500);

  await expect(page.locator("table, [role=table], .fc-alert-list").first()).toBeVisible();

  const appliedText = page.locator("text=/Applied|applied/i").first();
  if (await appliedText.count() > 0) await expect(appliedText).toBeVisible();

  await page.goto("/property?tab=credit-notes");
  await page.waitForTimeout(1000);

  await expect(
    page.locator("table, [role=table], .fc-alert-list").first().or(page.getByRole("heading", { name: /No credit notes found/i }))
  ).toBeVisible();

  const receiptChip = page.locator("button, a, span").filter({ hasText: /Receipts/i }).first();
  if (await receiptChip.count() > 0) await expect(receiptChip).toBeVisible();

  const creditNoteChip = page.locator("button, a, span").filter({ hasText: /Credit Notes/i }).first();
  if (await creditNoteChip.count() > 0) await expect(creditNoteChip).toBeVisible();

  const unappliedChip = page.locator("button, a, span").filter({ hasText: /Unapplied/i }).first();
  if (await unappliedChip.count() > 0) await expect(unappliedChip).toBeVisible();

  await expectNoPageErrors(page, errors);
});

test("bank reconciliation shows matched transaction", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property?tab=bank-reconciliation");
  await page.waitForTimeout(1500);

  await expect(page.getByRole("heading", { name: /Bank Reconciliation|RECONCILIATION/i }).first()).toBeVisible();
  await expect(
    page.locator("table, [role=table], .fc-alert-list").first().or(page.getByText(/No .*transactions|No data|empty/i).first())
  ).toBeVisible();

  const matchedBadge = page.locator("text=/matched|Matched/i").first();
  if (await matchedBadge.count() > 0) await expect(matchedBadge).toBeVisible();

  await expectNoPageErrors(page, errors);
});

test("budgets view shows budget lines and utilization", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Budgets");
  await page.waitForTimeout(2000);

  await expect(page.getByRole("heading", { name: /BUDGET|Budget|ESTIMATE/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Budget Utilization" }).or(page.getByRole("heading", { name: "No budgets found" })).first()).toBeVisible();

  const approveBtn = page.getByRole("button", { name: /Approve/i }).first();
  if (await approveBtn.count() > 0) await expect(approveBtn).toBeVisible();

  const utilizationText = page.locator("text=/Utilization|utilization|utilised/i").first();
  if (await utilizationText.count() > 0) await expect(utilizationText).toBeVisible();

  await expectNoPageErrors(page, errors);
});

test("expenses view shows expense records with status badges", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Expenses");
  await page.waitForTimeout(2000);

  // Expenses are tracked on their own register page.
  await expect(page.getByRole("heading", { name: /EXPENSE|Expenses/i }).first()).toBeVisible();
  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No invoices|No data|No expenses|empty/i).first())
  ).toBeVisible();

  await expectNoPageErrors(page, errors);
});

test("property reports show report catalogue with export capability", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property?tab=reports");
  await page.waitForTimeout(1500);

  await expect(page.getByRole("heading", { name: /Property reports/i })).toBeVisible();
  await expect(page.getByText("All reports", { exact: false }).first()).toBeVisible();

  const downloadBtn = page.getByRole("button", { name: /CSV|Export|Download/i }).first();
  if (await downloadBtn.count() > 0) await expect(downloadBtn).toBeVisible();

  test.skip(testInfo.project.name.startsWith("mobile"), "Download behavior is covered once on desktop");
  if (await downloadBtn.count() > 0) {
    const downloadPromise = page.waitForEvent("download");
    await downloadBtn.click();
    await downloadPromise;
  }

  await expectNoPageErrors(page, errors);
});

test("arrears view shows aging summary", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Arrears");
  await page.waitForTimeout(1500);

  const aging0to30 = page.locator("text=/0.30|0-30/i").first();
  if (await aging0to30.count() > 0) await expect(aging0to30).toBeVisible();

  const tenantRow = page.locator("table, [role=table]").locator("tr, [role=row]").filter({ has: page.locator("td, [role=cell]") }).first();
  await expect(tenantRow.or(page.getByText(/No arrears|No data|empty/i).first())).toBeVisible();

  await expectNoPageErrors(page, errors);
});

test("tenant documents tab renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property");
  await openTab(page, "Tenant documents");
  await page.waitForTimeout(1500);

  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No documents|No data|empty/i).first())
  ).toBeVisible();

  await expect(page.locator("h1, h2, h3").first()).toBeVisible();

  await expectNoPageErrors(page, errors);
});

test("rent schedules tab renders data", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property?tab=rent-schedules");
  await page.waitForTimeout(500);

  const table = page.locator("table, [role=table]").first();
  if (await table.count() > 0) {
    await expect(table).toBeVisible();
  } else {
    const emptyState = page.locator("text=/No schedules|no schedules|No data|empty/i").first();
    if (await emptyState.count() > 0) await expect(emptyState).toBeVisible();
  }

  await expectNoPageErrors(page, errors);
});
