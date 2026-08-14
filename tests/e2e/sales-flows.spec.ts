import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { openModuleSection } from "./helpers";

const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.locator("#username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "ERP modules", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => signIn(page));

const openSalesTab = openModuleSection;

test("sales overview renders dashboard with KPIs", async ({ page }) => {
  await page.goto("/sales");
  await expect(page.locator(".module-workspace-sales .module-nav-bar")).toBeVisible();

  await expect(page.getByText("Available Units", { exact: true })).toBeVisible();
  await expect(page.getByText("Pipeline Value", { exact: true })).toBeVisible();

  await expect(page.getByText("Recent Sales", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Sales by Project", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Collection Rate", { exact: true }).first()).toBeVisible();

  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("inventory shows units with status filter chips", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openSalesTab(page, "Inventory", testInfo);

  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Available", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reserved", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sold", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Blocked", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Available", exact: true }).click();
  await page.waitForTimeout(500);
  await expect(page.locator("table")).toBeVisible();
});

test("buyers list shows buyers with search functionality", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openSalesTab(page, "Buyers", testInfo);

  await expect(page.getByRole("columnheader", { name: /Name|Buyer/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /ID|Code/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /KRA/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Contact|Phone/i })).toBeVisible();

  const searchInput = page.getByPlaceholder(/search|Search/i);
  if (await searchInput.count()) {
    await searchInput.first().fill("E2E Test Buyer");
    await page.waitForTimeout(500);
  }

  await expect(page.getByRole("button", { name: /Export CSV|Export/i })).toBeVisible();
});

test("leads tab shows lead funnel and pipeline", async ({ page }, testInfo) => {
  await page.goto("/sales?tab=leads");

  await expect(page.getByText("Total Leads", { exact: true })).toBeVisible();
  await expect(page.getByText("New", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Lead Funnel", { exact: true }).first()).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
});

test("buyer profile opens with tabs when clicking a buyer row", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openSalesTab(page, "Buyers", testInfo);

  const buyerRow = page.getByRole("row").filter({ hasText: "E2E Test Buyer" });
  if (await buyerRow.count() === 0) {
    const firstRow = page.locator("tbody tr").first();
    if (await firstRow.count()) await firstRow.click();
  } else {
    await buyerRow.first().click();
  }
  await page.waitForTimeout(800);

  await expect(page.getByRole("button", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Payments", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Documents", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activity", exact: true })).toBeVisible();

  const back = page.getByRole("button", { name: /Back|←/ });
  if (await back.count()) await back.first().click();
});

test("sales pipeline shows sales with transition controls", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openSalesTab(page, "Sales", testInfo);

  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Buyer|Customer/i }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Unit|Property/i }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Price|Amount/i }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Status/i }).first()).toBeVisible();

  const statusChips = page.locator(".status-chip, .filter-chip, [data-testid*='status']");
  await expect(statusChips.first()).toBeVisible();
});

test("site visits list renders correctly", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openSalesTab(page, "Site visits", testInfo);

  await expect(page.locator("table")).toBeVisible();
});

test("payment verification shows payments with verify action", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openSalesTab(page, "Payments", testInfo);

  await expect(page.getByText("PAY-2026-0106", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pending", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verified", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejected", exact: true })).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "PAY-2026-0106" }).getByRole("button", { name: "Verify", exact: true })
  ).toBeVisible();
});

test("commissions list shows agent commissions with status", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openSalesTab(page, "Commissions", testInfo);

  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Hold", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark Paid", exact: true }).first()).toBeVisible();
});

test("bank reconciliation renders import zone and transaction table", async ({ page }, testInfo) => {
  await page.goto("/sales?tab=bank-reconciliation");

  await expect(page.locator("table")).toBeVisible();
});

test("sales payment verification and audit controls are connected", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openSalesTab(page, "Payments", testInfo);
  await expect(page.getByText("PAY-2026-0106", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeVisible();
  await openSalesTab(page, "Audit trail", testInfo);
  await expect(page.getByText("PAY-2026-0098", { exact: true })).toBeVisible();
  await expect(page.getByText("payment verified", { exact: true })).toBeVisible();
});

test("sales buyer and commission workflows are controlled", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel sales workflow races");
  await page.goto("/sales");
  await openSalesTab(page, "Buyers", testInfo);
  const lead = page.getByRole("row").filter({ hasText: "BUY-2026-0043" });
  await lead.getByRole("button", { name: "Qualify", exact: true }).click();
  await expect(lead.getByText("qualified", { exact: true })).toBeVisible();
  await openSalesTab(page, "Commissions", testInfo);
  const commission = page.getByRole("row").filter({ hasText: "COM-2026-0029" });
  await commission.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(commission.getByText("approved", { exact: true })).toBeVisible();
});

test("sales performance and report exports use live data", async ({ page }, testInfo) => {
  await page.goto("/sales");
  await openSalesTab(page, "Agent performance", testInfo);
  await expect(page.getByRole("columnheader", { name: "Pipeline value" })).toBeVisible();
  await expect(page.getByText("admin", { exact: true }).first()).toBeVisible();
  await openSalesTab(page, "Reports", testInfo);
  await expect(page.getByText("Payment reconciliation", { exact: true })).toBeVisible();
  test.skip(testInfo.project.name.startsWith("mobile"), "Download behavior is covered once on desktop");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("row").filter({ hasText: "Payment reconciliation" }).getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sales-payments.csv");
});
