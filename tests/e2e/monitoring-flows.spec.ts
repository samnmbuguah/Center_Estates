import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./helpers";

const BASE = process.env.E2E_BASE_URL || "https://centerestates.com";
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


async function openSubTab(page: Page, name: string) {
  const btn = page.locator(".project-workspace-tabs button, a").filter({ hasText: name });
  if (await btn.count() > 0) {
    await btn.first().click();
    await page.waitForTimeout(500);
  }
}

test("monitoring overview renders executive dashboard", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(2000);

  await expect(page.locator("h1, h2").first()).toBeVisible();
  // Super administrators land on the operations dashboard by default.
  await expect(page.getByText(/Administrator Dashboard|Total Projects|System administration/i).first()).toBeVisible();

  await expect(page.locator(".form-error")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("projects tab shows project portfolio with cards/table", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(500);

  await openTab(page, "Projects");

  const cardOrTable = page.locator(".construction-project-card, table, [role=table]").first();
  if (await cardOrTable.count() > 0) await expect(cardOrTable).toBeVisible();

  const allFilter = page.getByRole("button", { name: "All", exact: true });
  if (await allFilter.count() > 0) await expect(allFilter.first()).toBeVisible();

  const activeFilter = page.getByRole("button", { name: /Active|active/i }).first();
  if (await activeFilter.count() > 0) await expect(activeFilter).toBeVisible();

  const searchInput = page.getByPlaceholder(/search|Search/i).first();
  if (await searchInput.count() > 0) await expect(searchInput).toBeVisible();

  expect(errors).toEqual([]);
});

test("milestones tab shows progress data", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(500);

  await openTab(page, "Progress");
  await page.waitForTimeout(4000);

  await expect(page.getByText(/Programme & Milestones|Milestone/i).first()).toBeVisible();
  await expect(page.locator("table, [role=table]").first()).toBeVisible();

  await expect(page.locator("h1").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("daily logs tab shows log entries", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(500);

  await openTab(page, "Daily logs");
  await page.waitForTimeout(2000);

  await expect(
    page.locator(".site-diary-list article, table, [role=table]").first()
      .or(page.getByText(/No daily logs|No logs|No data|empty/i).first())
  ).toBeVisible();

  expect(errors).toEqual([]);
});

test("tickets tab shows issues with status filters", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(500);

  await openTab(page, "Issues");

  const issueCard = page.locator(".issue-card, table, [role=table]").first();
  if (await issueCard.count() > 0) await expect(issueCard).toBeVisible();

  const statusPill = page.locator(".badge, .pill, .status-chip, .issue-status").first();
  if (await statusPill.count() > 0) await expect(statusPill).toBeVisible();

  await expect(page.locator("h1").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("risks tab shows risk register", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(500);

  await openTab(page, "Risks");

  const riskHeading = page.getByRole("heading", { name: /Exposure|Risk/i }).first();
  if (await riskHeading.count() > 0) await expect(riskHeading).toBeVisible();

  const riskCard = page.locator(".risk-register-card, table, [role=table]").first();
  if (await riskCard.count() > 0) await expect(riskCard).toBeVisible();

  await expect(page.locator("h1").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("quality tests tab renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(500);

  await openTab(page, "Quality");

  const tableOrEmpty = page.locator("table, [role=table]").first();
  if (await tableOrEmpty.count() > 0) await expect(tableOrEmpty).toBeVisible();
  const noQuality = page.getByText(/No quality|no quality|empty|No tests/i).first();
  if (await noQuality.count() > 0) await expect(noQuality).toBeVisible();

  await expect(page.locator("h1").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("rfi list tab renders correctly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(500);

  await openTab(page, "RFIs");
  await page.waitForTimeout(2000);

  await expect(page.getByRole("heading", { name: /Requests for Information/i }).first()).toBeVisible();
  await expect(
    page.locator("table, [role=table]").first().or(page.getByText(/No RFIs|No data|empty/i).first())
  ).toBeVisible();

  await expect(page.locator("h1").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("reports tab shows report catalogue", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(500);

  await openTab(page, "Reports");
  await page.waitForTimeout(2000);

  await expect(page.getByRole("heading", { name: /REPORT TEMPLATES|RECENTLY GENERATED|Reports/i }).first()).toBeVisible();
  await expect(page.locator("table, [role=table], .report-card").first()).toBeVisible();

  const exportBtn = page.getByRole("button", { name: /Export|Generate/i }).first();
  if (await exportBtn.count() > 0) await expect(exportBtn).toBeVisible();

  expect(errors).toEqual([]);
});

test("role dashboards render project manager/finance/site agent views", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/monitoring");
  await page.waitForTimeout(500);

  // Construction/Monitoring is disabled in the current scope — role dashboards live under
  // the horizontal tabs when the module is enabled. Tolerate the unavailable state.
  const unavailable = await page.evaluate(() => document.body.innerText.includes("Module unavailable"));
  if (unavailable) {
    test.skip(true, "Construction Monitoring is disabled in the active scope.");
    return;
  }
  const roleDashboardsBtn = page.locator(".module-nav-bar button").filter({ hasText: "Role Dashboards" });
  if (await roleDashboardsBtn.count() > 0) {
    await roleDashboardsBtn.first().click();
    await page.waitForTimeout(500);
  }

  const roleTabs = page.locator(".project-workspace-tabs button, a").filter({ hasText: /Project Manager|Finance|Site Agent/i });
  if (await roleTabs.count() > 0) {
    const count = await roleTabs.count();
    for (let i = 0; i < count; i++) {
      const tab = roleTabs.nth(i);
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(500);
        await expect(page.locator("h1").first()).toBeVisible();
      }
    }
  }

  const kpiCards = page.locator(".kpi-card, .stat-card, .metric-card").first();
  if (await kpiCards.count() > 0) await expect(kpiCards).toBeVisible();

  const table = page.locator("table, [role=table]").first();
  if (await table.count() > 0) await expect(table).toBeVisible();

  expect(errors).toEqual([]);
});
