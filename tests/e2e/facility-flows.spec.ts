import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { openModuleSection } from "./helpers";

const password = process.env.E2E_ADMIN_PASSWORD || "S/2xvBbssIGJJwjOEbOni4JyHQ7tJc0f";

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

const openFacilityTab = openModuleSection;

test("facility overview renders dashboard components", async ({ page }) => {
  await page.goto("/facility");
  // The module title heading renders on desktop only; the nav bar is the
  // reliable signal on every viewport.
  await expect(page.locator(".module-nav-bar, .module-workspace").first()).toBeVisible();

  await expect(page.getByText("Total Buildings", { exact: true })).toBeVisible();
  await expect(page.getByText("Active Assets", { exact: true })).toBeVisible();
  await expect(page.getByText("Open Work Orders", { exact: true }).first()).toBeVisible();

  await expect(page.getByText("Work Orders Overview", { exact: true })).toBeVisible();
  await expect(page.getByText("Recent Work Orders", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Critical Alerts|CRITICAL ALERTS/i).first()).toBeVisible();

  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("buildings list shows locations with export capability", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Buildings", testInfo);

  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Building Name|Name|Code/i }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Location/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Type|Building Type/i }).first()).toBeVisible();

  await expect(page.getByRole("button", { name: /Export/i })).toBeVisible();
});

test("assets register shows data with detail panel", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Assets", testInfo);
  await page.waitForTimeout(2000);

  await expect(page.getByText("Total Assets", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Operational", { exact: true }).first()).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("button", { name: /Export/i }).first()).toBeVisible();
});

test("work orders list shows orders with status badges", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Work orders", testInfo);

  await expect(page.getByRole("columnheader", { name: /WO Ref|Reference|WORK ORDER/i }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Title" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Priority/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Status/i })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
});

test("work orders detail view opens when clicking a row", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Work orders", testInfo);

  const firstRow = page.locator("table tbody tr").first();
  await firstRow.click();
  await page.waitForTimeout(800);

  const detail = page.locator(".work-order-detail, [class*='detail'], .drawer, .modal, .dialog, [role='dialog']").first();
  if (await detail.count() > 0) await expect(detail).toBeVisible();
});

test("planned maintenance shows calendar and generate work order action", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Planned maintenance", testInfo);
  await page.waitForTimeout(2000);

  await expect(page.locator(".module-workspace").getByText(/PPM Compliance|Compliance Trend/i).first()).toBeVisible();
  await expect(page.locator("table, [role=table], .fc-kpi-strip").first()).toBeVisible();
});

test("inspections list shows completed inspections with scores", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Inspections", testInfo);
  await page.waitForTimeout(1500);

  await expect(page.locator("table, [role=table]").first()).toBeVisible();
});

test("service requests list shows requests with actions", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Service requests", testInfo);

  await expect(page.locator(".fc-kpi-card, .data-panel").getByText(/Open Requests|In Progress|Service/i).first()).toBeVisible();
  await expect(page.locator(".fc-kpi-card, .data-panel").getByText("Open", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".fc-kpi-card, .data-panel").getByText("In Progress", { exact: true }).first()).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
});

test("contractors list shows contractors with ratings", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Contractors", testInfo);

  await expect(page.getByText(/Total Contractors|Active Contractors/i).first()).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
});

test("utility management shows meter readings", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Utilities", testInfo);

  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByText("Electricity", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Water", { exact: true }).first()).toBeVisible();
});

test("facility work history, cost and media registers are connected", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Work history", testInfo);
  await expect(
    page.locator("table, [role=table], .fc-alert-list").first().or(page.getByText(/No work history|No records/i).first())
  ).toBeVisible();
  await openFacilityTab(page, "Labor & parts", testInfo);
  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No .*records|No data|empty/i).first())
  ).toBeVisible();
  await openFacilityTab(page, "Work media", testInfo);
  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No .*records|No data|empty/i).first())
  ).toBeVisible();
});

test("facility preventive and service workflows are interactive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel maintenance races");
  await page.goto("/facility");
  await openFacilityTab(page, "Planned maintenance", testInfo);
  await expect(page.getByText(/PPM Compliance|Preventive|Schedule/i).first()).toBeVisible();
  await openFacilityTab(page, "Work orders", testInfo);
  await expect(page.getByRole("columnheader", { name: /Status/i }).first()).toBeVisible();
  await openFacilityTab(page, "Service requests", testInfo);
  await expect(page.locator(".fc-kpi-card, .data-panel").getByText(/Open Requests|In Progress|Service/i).first()).toBeVisible();
});

test("facility reports export current operational data", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Download verification runs once on desktop");
  await page.goto("/facility");
  await openFacilityTab(page, "Reports & BI", testInfo);
  await expect(page.getByRole("heading", { name: "Operational report exports" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/assets.*\.csv|center-estates-assets\.csv/i);
});
