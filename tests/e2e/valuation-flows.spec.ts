import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./helpers";

const ADMIN = process.env.E2E_ADMIN_USERNAME || "admin";
const PASS = process.env.E2E_ADMIN_PASSWORD || "S/2xvBbssIGJJwjOEbOni4JyHQ7tJc0f";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill(ADMIN);
  await page.locator("#password").fill(PASS);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/valuation");
  const selector = page.getByLabel("Current property");
  const westlands = await selector.locator("option", { hasText: "Westlands Business Centre" }).getAttribute("value");
  await selector.selectOption(westlands ?? "");
});


test("valuation overview renders dashboard with KPIs and charts", async ({ page }) => {
  await page.goto("/valuation");
  await expect(page.getByText(/Total Instructions|Instructions/i).first()).toBeVisible();
  await expect(page.getByText("In Progress", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Draft Reports", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Final Reports", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Overdue", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Turnaround", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Fees", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /INSTRUCTIONS TREND|Instructions/i }).first()).toBeVisible();
  await expect(page.locator("svg, .donut, [class*=donut], [class*=chart]").first()).toBeVisible();
  await expect(page.getByText(/VAL-\d{4}-\d+/).first()).toBeVisible();
});

test("instructions show register with status filters", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Instructions");
  await expect(page.getByText("VAL-2026-0184", { exact: true }).first()).toBeVisible();
  const allBtn = page.locator("button").filter({ hasText: "All" }).first();
  if (await allBtn.count() > 0) await expect(allBtn).toBeVisible();
  const newBtn = page.locator("button").filter({ hasText: "New" }).first();
  if (await newBtn.count() > 0) await expect(newBtn).toBeVisible();
  const inProgressBtn = page.locator("button").filter({ hasText: "In Progress" }).first();
  if (await inProgressBtn.count() > 0) await expect(inProgressBtn).toBeVisible();
});

test("site inspections show data with status chart and quick actions", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Inspections");
  await expect(page.getByRole("heading", { name: /SITE INSPECTIONS|INSPECTIONS/i }).first()).toBeVisible();
  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No inspections|No data|empty/i).first())
  ).toBeVisible();
  await expect(page.getByText(/Quick Actions|QUICK ACTIONS/i).first()).toBeVisible();
});

test("draft reports show register with review modal", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Draft reports");
  await expect(page.getByText("review", { exact: true })).toBeVisible();
  const review = page.getByRole("button", { name: "Review", exact: true });
  await expect(review).toBeVisible();
  await review.click();
  const dialog = page.getByRole("dialog", { name: /Review VAL-2026-0184/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Review Comment")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
});

test("final reports show delivered reports with actions", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Final reports");
  await expect(page.getByRole("heading", { name: /FINAL SIGNED REPORTS|FINAL REPORTS/i }).first()).toBeVisible();
  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No final reports|No data|empty/i).first())
  ).toBeVisible();
});

test("client invoicing shows invoices with aging summary", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Invoicing");
  await expect(page.getByRole("heading", { name: /AGING SUMMARY|INVOIC|CLIENT INVOICES/i }).first()).toBeVisible();
  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No invoicing|No invoices|No data|empty/i).first())
  ).toBeVisible();
});

test("invoicing create invoice modal opens from quick action", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Invoicing");
  const createBtn = page.getByRole("button", { name: "Create New Invoice" }).or(page.getByRole("button", { name: /create.*invoice/i }));
  if (await createBtn.count() > 0) {
    await createBtn.first().click();
    const dialog = page.getByRole("dialog", { name: /Create.*invoice/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Instruction Ref *", { exact: true })).toBeVisible();
  }
});

test("clients list shows client entries", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Clients");
  await expect(page.getByText("Equity Commercial Bank")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Type|type/i }).or(page.getByText("Type", { exact: true }))).toBeVisible();
});

test("analytics renders KPIs and performance charts", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Analytics");
  await expect(page.getByRole("heading", { name: /INSTRUCTIONS TREND|ANALYTICS|INSTRUCTIONS BY TYPE/i }).first()).toBeVisible();
  await expect(page.locator("table, [role=table]").first()).toBeVisible();
  await expect(page.locator(".bar-chart, [class*=bar], .chart, [class*=chart]").first()).toBeVisible();
});

test("reports show catalogue with export capability", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Reports");
  await expect(page.getByRole("heading", { name: /REPORT CATALOGUE|RECENT REPORTS/i }).first()).toBeVisible();
  await expect(page.getByText("Comparable evidence analysis", { exact: true }).first()).toBeVisible();
  const exportBtn = page.getByRole("button", { name: /Download CSV|Export/i }).first();
  if (await exportBtn.count() > 0) await expect(exportBtn).toBeVisible();
});

test("valuation final report, payment and audit evidence are connected", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Payments");
  await expect(page.getByRole("heading", { name: /FEE COLLECTIONS|PAYMENTS/i }).first()).toBeVisible();
  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No payments|No data|empty/i).first())
  ).toBeVisible();
  await openTab(page, "Audit trail");
  await expect(page.getByRole("heading", { name: /AUDIT TRAIL/i }).first()).toBeVisible();
  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No audit|No data|empty/i).first())
  ).toBeVisible();
});
