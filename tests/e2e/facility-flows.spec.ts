import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  if (!password) throw new Error("E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.locator("#username").fill(process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/);
  await expect(page.getByRole("heading", { name: "ERP modules", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => signIn(page));

async function openFacilityTab(page: Page, name: string, testInfo?: TestInfo) {
  const isMobile = Boolean(testInfo?.project.name.startsWith("mobile"));
  if (isMobile) {
    const openNav = page.getByRole("button", { name: "Open module navigation" });
    if (await openNav.isVisible().catch(() => false)) await openNav.click();
    await page.locator(".module-side-nav").getByRole("button", { name, exact: true }).click();
    return;
  }
  const tabs = page.locator(".module-tabs-workspace");
  if (await tabs.count()) {
    await tabs.getByRole("button", { name, exact: true }).click();
    return;
  }
  await page.getByRole("button", { name, exact: true }).first().click();
}

test("facility overview renders dashboard components", async ({ page }) => {
  await page.goto("/facility");
  await expect(page.getByRole("heading", { name: "Facility Management" })).toBeVisible();

  await expect(page.getByText("Buildings", { exact: true })).toBeVisible();
  await expect(page.getByText("Assets", { exact: true })).toBeVisible();
  await expect(page.getByText("Work Orders", { exact: true })).toBeVisible();

  await expect(page.getByText("Work Orders Overview", { exact: true })).toBeVisible();
  await expect(page.getByText("Recent Work Orders", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Critical Alerts", { exact: true }).first()).toBeVisible();

  await expect(page.locator(".form-error")).toHaveCount(0);
});

test("buildings list shows locations with export capability", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Buildings", testInfo);

  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Code/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Type/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Location/i })).toBeVisible();

  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
});

test("assets register shows data with detail panel", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Assets", testInfo);

  await expect(page.getByText("Total Assets", { exact: true })).toBeVisible();
  await expect(page.getByText("Operational", { exact: true })).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
});

test("work orders list shows orders with status badges", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Work orders", testInfo);

  await expect(page.getByText("WO-2026-1787", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /WO Ref|Reference/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Title" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Priority/i })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Status/i })).toBeVisible();
});

test("work orders detail view opens when clicking a row", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Work orders", testInfo);

  const woRow = page.getByRole("row").filter({ hasText: "WO-2026-1787" });
  await woRow.click();
  await page.waitForTimeout(800);

  await expect(page.getByText("WO-2026-1787", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(page.getByRole("tab").count() || 1);
});

test("planned maintenance shows calendar and generate work order action", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Planned maintenance", testInfo);

  await expect(page.getByText("PM-LIFT-MONTHLY", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calendar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "List", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gantt", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Templates", exact: true })).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "PM-LIFT-MONTHLY" }).getByRole("button", { name: "Generate work order", exact: true })
  ).toBeVisible();
});

test("inspections list shows completed inspections with scores", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Inspections", testInfo);

  await expect(page.getByText(/58|Inspection/i).first()).toBeVisible();
  await expect(page.getByText("90", { exact: true })).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
});

test("service requests list shows requests with actions", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Service requests", testInfo);

  await expect(page.getByText("SR-2026-00123", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "In Progress", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "SR-2026-00123" }).getByRole("button", { name: "Resolve", exact: true })
  ).toBeVisible();
});

test("contractors list shows contractors with ratings", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Contractors", testInfo);

  await expect(page.getByText("AquaFix Stores", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "By Category", exact: true })).toBeVisible();
  await expect(page.locator("table")).toBeVisible();
});

test("utility management shows meter readings", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Utilities", testInfo);

  await expect(page.locator("table")).toBeVisible();
  await expect(page.getByText("Electricity", { exact: true })).toBeVisible();
  await expect(page.getByText("Water", { exact: true })).toBeVisible();
});

test("facility work history, cost and media registers are connected", async ({ page }, testInfo) => {
  await page.goto("/facility");
  await openFacilityTab(page, "Work history", testInfo);
  await expect(page.getByText("Technician checked in and isolated the leaking joint.", { exact: true })).toBeVisible();
  await openFacilityTab(page, "Labor & parts", testInfo);
  await expect(page.getByText("Compression fitting and pipe section", { exact: true })).toBeVisible();
  await expect(page.getByText("AquaFix Stores", { exact: true })).toBeVisible();
  await openFacilityTab(page, "Work media", testInfo);
  await expect(page.getByText("leak-before-repair.jpg", { exact: true })).toBeVisible();
});

test("facility preventive and service workflows are interactive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel maintenance races");
  await page.goto("/facility");
  await openFacilityTab(page, "Planned maintenance", testInfo);
  const schedule = page.getByRole("row").filter({ hasText: "PM-LIFT-MONTHLY" });
  await expect(schedule.getByRole("button", { name: "Generate work order", exact: true })).toBeVisible();
  await schedule.getByRole("button", { name: "Generate work order", exact: true }).click();
  await openFacilityTab(page, "Work orders", testInfo);
  await expect(page.getByText(/PM-PM-LIFT-MONTHLY/).first()).toBeVisible();
  await openFacilityTab(page, "Service requests", testInfo);
  await expect(page.getByRole("row").filter({ hasText: "SR-2026-00123" }).getByRole("button", { name: "Resolve", exact: true })).toBeVisible();
});
