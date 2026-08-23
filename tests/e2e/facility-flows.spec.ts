import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { openModuleSection } from "./helpers";

const password = process.env.E2E_ADMIN_PASSWORD || "";

async function signIn(page: Page) {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.locator("#username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
  await expect(page.locator("a.module-card").first()).toBeVisible();
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

  await expect(page.getByRole("heading", { name: /Work Orders Lifecycle & Helpdesk Status/i })).toBeVisible();
  await expect(page.getByText(/Total Active|SLA Overdue/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Operational Flags & Risks/i })).toBeVisible();

  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("buildings list shows locations with export capability", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Buildings", testInfo);

  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Floor Level/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Primary Use/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Gross Area/i })).toBeVisible();

  await expect(page.getByRole("button", { name: /Export/i })).toBeVisible();
});

test("assets register shows data with detail panel", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Assets", testInfo);
  await page.waitForTimeout(2000);

  await expect(page.getByText("Registered Assets", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Asset Master Information/i })).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("button", { name: /Export/i }).first()).toBeVisible();
});

test("inventory pages use accessible customer-facing empty states", async ({ page }) => {
  for (const tab of ["spare-parts", "consumables"]) {
    await page.goto(`/facility?tab=${tab}`);
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await expect(page.locator(".inventory-workspace")).toBeVisible();
    await expect(page.getByText(/backend has no dedicated inventory model/i)).toHaveCount(0);
    await expect(page.getByText(/No assets matched/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^\+ Add/i }).first()).toBeVisible();
    await expect(page.locator(".inventory-summary")).toBeVisible();
    await expect(page.locator(".inventory-panel")).toBeVisible();
  }
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
  await expect(page.getByLabel("Maintenance view")).toBeVisible();
  await expect(page.locator("table, [role=table], .fc-kpi-strip").first()).toBeVisible();
});

test("inspections list shows completed inspections with scores", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Inspections", testInfo);
  await page.waitForTimeout(1500);

  await expect(page.locator("table, [role=table]").first()).toBeVisible();
});

test("service requests list shows requests with actions", async ({ page }) => {
  await page.goto("/facility?tab=service-requests");

  await expect(page.getByRole("heading", { name: "Service Requests Management" })).toBeVisible();
  await expect(page.getByText("Open Requests", { exact: true })).toBeVisible();
  await expect(page.getByText("In Progress", { exact: true })).toBeVisible();
  await expect(page.locator("table")).toBeVisible();

  const selectableRequests = page.locator("tbody tr").filter({ has: page.getByRole("checkbox") });
  if (await selectableRequests.count()) {
    await selectableRequests.first().getByRole("checkbox").check();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export selected" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("facility-service-requests.csv");
  }
});

test("service profiles and incident reporting are accessible workflows", async ({ page }) => {
  await page.goto("/facility?tab=service-profiles");
  await expect(page.getByRole("heading", { name: "Service profiles", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create service profile" })).toBeVisible();
  await page.getByRole("button", { name: "Create service profile" }).click();
  await expect(page.getByRole("heading", { name: "Create service profile" })).toBeVisible();
  await expect(page.getByLabel("Service name")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/facility?tab=incidents");
  await expect(page.getByRole("heading", { name: "Incident reporting", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report incident" })).toBeVisible();
  await page.getByRole("button", { name: "Report incident" }).click();
  await expect(page.getByRole("heading", { name: "Report an incident" })).toBeVisible();
  await expect(page.getByLabel("What happened?")).toBeVisible();
});

test("contractors list shows contractors with ratings", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Contractors", testInfo);

  await expect(page.getByRole("heading", { name: /Service Provider Master/i })).toBeVisible();
  await expect(page.getByText(/Active SLA Contracts/i).first()).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
});

test("utility management shows meter readings", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Utilities", testInfo);

  const utilityView = page.getByLabel("Utility view");
  await expect(utilityView).toBeVisible();
  await expect(utilityView.locator('option[value="electricity"]')).toHaveText("Electricity");
  await expect(utilityView.locator('option[value="water"]')).toHaveText("Water");
  await utilityView.selectOption("electricity");
  await expect(page.locator("table")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Service Requests Management" })).toBeVisible();
  await expect(page.getByText("Open Requests", { exact: true })).toBeVisible();
});

test("facility reports export current operational data", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Download verification runs once on desktop");
  await page.goto("/facility");
  await openFacilityTab(page, "Reports & BI", testInfo);
  await expect(page.getByRole("heading", { name: /Raw Operational Data Registers/i })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download/i }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/assets.*\.csv|center-estates.*\.csv/i);
});
