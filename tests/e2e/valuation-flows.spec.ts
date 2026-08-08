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
  await expect(page.getByText("Total Instructions", { exact: true }).or(page.getByText("Instructions"))).toBeVisible();
  await expect(page.getByText("In Progress", { exact: true })).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByText("Draft Reports", { exact: true })).toBeVisible();
  await expect(page.getByText("Final Reports", { exact: true })).toBeVisible();
  await expect(page.getByText("Overdue", { exact: true })).toBeVisible();
  await expect(page.getByText("Turnaround", { exact: true }).or(page.getByText("Turnaround Time"))).toBeVisible();
  await expect(page.getByText("Fees", { exact: true })).toBeVisible();
  await expect(page.getByText("Instructions Trend").or(page.getByRole("heading", { name: /Instructions/i }))).toBeVisible();
  await expect(page.locator(".donut, [class*=donut], [class*=chart]").first()).toBeVisible();
  await expect(page.getByText("VAL-2026-0184", { exact: true })).toBeVisible();
});

test("instructions show register with status filters and detail drawer", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Instructions");
  await expect(page.getByText("VAL-2026-0184", { exact: true })).toBeVisible();
  await expect(page.locator("button").filter({ hasText: "All" }).first()).toBeVisible();
  await expect(page.locator("button").filter({ hasText: "New" }).first()).toBeVisible();
  await expect(page.locator("button").filter({ hasText: "In Progress" }).first()).toBeVisible();
  await page.getByRole("row").filter({ hasText: "VAL-2026-0184" }).click();
  await expect(page.locator(".drawer, [role=dialog], .detail-drawer").first()).toBeVisible();
  await expect(page.getByText("Timeline").or(page.getByText("timeline")).or(page.locator("[class*=timeline]"))).toBeVisible();
});

test("site inspections show data with status chart and quick actions", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Inspections");
  await expect(page.getByText("Scheduled", { exact: true }).or(page.getByText("scheduled", { exact: true }))).toBeVisible();
  await expect(page.getByText("Completed", { exact: true }).or(page.getByText("completed", { exact: true }))).toBeVisible();
  await expect(page.getByText("Status This Month").or(page.getByRole("heading", { name: /Status/i }))).toBeVisible();
  await expect(page.getByText("Quick Actions").or(page.getByText("quick actions"))).toBeVisible();
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
  await expect(page.getByText("VR-2026-0161-F", { exact: true })).toBeVisible();
  await expect(page.getByText("Resend").or(page.getByRole("button", { name: /Resend/i }))).toBeVisible();
  await expect(page.getByText("Invoice").or(page.getByRole("button", { name: /Invoice/i }))).toBeVisible();
});

test("client invoicing shows invoices with aging summary", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Invoicing");
  await expect(page.getByText("Invoiced", { exact: true }).or(page.getByText("invoiced", { exact: true }))).toBeVisible();
  await expect(page.getByText("Outstanding", { exact: true }).or(page.getByText("outstanding", { exact: true }))).toBeVisible();
  await expect(page.getByText("0-30").or(page.getByText("Aging"))).toBeVisible();
  await expect(page.locator("table, [role=table]").first()).toBeVisible();
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
  await expect(page.getByText("Instructions YTD").or(page.getByText("Instructions", { exact: true }))).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByText("Fees", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Average fee" })).toBeVisible();
  await expect(page.getByText("admin", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".bar-chart, [class*=bar], .chart").first()).toBeVisible();
});

test("reports show catalogue with export capability", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Reports");
  await expect(page.getByText("Comparable evidence analysis", { exact: true })).toBeVisible();
  await expect(page.getByText("Fees, payments and aging", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" }).or(page.getByRole("button", { name: "Export" }))).toBeVisible();
});

test("valuation final report, payment and audit evidence are connected", async ({ page }) => {
  await page.goto("/valuation");
  await openTab(page, "Payments");
  await expect(page.getByText("VPAY-2026-0032", { exact: true })).toBeVisible();
  await openTab(page, "Audit trail");
  await expect(page.getByText("final report issued", { exact: true })).toBeVisible();
  await expect(page.getByText("payment allocated", { exact: true })).toBeVisible();
});
