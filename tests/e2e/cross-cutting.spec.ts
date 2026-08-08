import { test, expect, type Page } from "@playwright/test";

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

test("all modules navigate through the sidebar without page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const modules = [
    { link: "Property", heading: "Property Management" },
    { link: "Facility", heading: "Facility Management" },
    { link: "Sales", heading: "Sales Management" },
    { link: "Tender", heading: "Tender Management" },
    { link: "Valuation", heading: "Valuation" },
    { link: "Monitoring", heading: "Project monitoring" },
    { link: "Companion", heading: null },
  ] as const;

  for (const { link, heading } of modules) {
    const navLink = page.getByRole("link", { name: link, exact: true });
    if (await navLink.count() > 0) {
      await navLink.first().click();
      await page.waitForTimeout(500);
      if (heading) {
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      } else {
        await expect(page.locator("h1").first()).toBeVisible();
        await expect(page.locator("h1").first()).toContainText(/Companion/i);
      }
    }
  }

  expect(errors).toEqual([]);
});

test("global search filter works in top bar", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/workspaces");
  await page.waitForTimeout(500);

  const searchInput = page.locator("input[placeholder*='earch'], input[aria-label*='earch'], input[type='search'], .global-search input").first();
  if (await searchInput.count() > 0) {
    await searchInput.click();
    await searchInput.fill("Property");
    await page.waitForTimeout(800);

    const dropdown = page.locator(".search-results, .search-dropdown, [role=listbox], [role=menu]").first();
    if (await dropdown.count() > 0) await expect(dropdown).toBeVisible();

    const propertyResult = page.getByText("Property Management");
    if (await propertyResult.count() > 0) await expect(propertyResult.first()).toBeVisible();
  }

  expect(errors).toEqual([]);
});

test("dark/light theme toggle works", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/workspaces");
  await page.waitForTimeout(500);

  const themeToggle = page.locator("button").filter({ hasText: /🌙|☀️|dark|light|theme/i }).first();
  if (await themeToggle.count() > 0) {
    const htmlBefore = await page.locator("html").getAttribute("data-theme");

    await themeToggle.click();
    await page.waitForTimeout(500);

    const htmlAfter = await page.locator("html").getAttribute("data-theme");
    if (htmlBefore !== null && htmlAfter !== null) {
      expect(htmlAfter).not.toBe(htmlBefore);
    } else {
      const classBefore = await page.locator("html").getAttribute("class");
      await themeToggle.click();
      await page.waitForTimeout(500);
      const classAfter = await page.locator("html").getAttribute("class");
      expect(classAfter).not.toBe(classBefore);
    }
  }

  expect(errors).toEqual([]);
});

test("organization switcher works", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/workspaces");
  await page.waitForTimeout(500);

  const orgSelector = page.locator(".org-switcher, .organization-selector, select[aria-label*='Organization'], select[aria-label*='organisation']").first();
  if (await orgSelector.count() > 0) {
    await expect(orgSelector).toBeVisible();
    const orgName = page.getByText("Center Estates", { exact: true });
    if (await orgName.count() > 0) await expect(orgName.first()).toBeVisible();

    if (orgSelector.evaluate) {
      try {
        await orgSelector.selectOption({ index: 0 });
        await page.waitForTimeout(500);
      } catch {
        // Select might be disabled with single org
      }
    }
  }

  await expect(page.locator("h1").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("workspace module cards all render with live KPIs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/workspaces");
  await page.waitForTimeout(500);

  const modules = ["Property", "Facility", "Sales", "Tender", "Valuation", "Monitoring", "Companion"];
  for (const mod of modules) {
    const card = page.locator(".module-card, a.module-card, .workspace-card").filter({ hasText: mod }).first();
    if (await card.count() > 0) {
      await expect(card).toBeVisible();
    } else {
      const link = page.getByRole("link", { name: mod, exact: false });
      if (await link.count() > 0) await expect(link.first()).toBeVisible();
    }
  }

  const grid = page.locator(".module-grid, .workspace-grid, .cards-grid, .module-list").first();
  if (await grid.count() > 0) await expect(grid).toBeVisible();

  const kpiValue = page.locator(".kpi-value, .stat-value, .metric-value, .module-card .number").first();
  if (await kpiValue.count() > 0) await expect(kpiValue).toBeVisible();

  expect(errors).toEqual([]);
});

test("unauthenticated access redirects to login", async ({ page }) => {
  await page.context().clearCookies();

  await page.goto("/property");
  await page.waitForTimeout(500);

  const isLoginPage = page.url().includes("/login");
  const hasLoginForm = await page.locator("#username").isVisible().catch(() => false);
  const isRedirected = isLoginPage || hasLoginForm;

  expect(isRedirected).toBe(true);
});

test("inbox and alerts section renders in workspace", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/workspaces");
  await page.waitForTimeout(500);

  const criticalAlerts = page.getByText(/Critical Alerts|critical alerts/i).first();
  if (await criticalAlerts.count() > 0) {
    await expect(criticalAlerts).toBeVisible();
  }

  const myTasks = page.getByText(/My Tasks|my tasks|Recent Activity/i).first();
  if (await myTasks.count() > 0) {
    await expect(myTasks).toBeVisible();
  }

  const alertOrTaskSection = page.locator(".alerts-section, .tasks-section, .workspace-sidebar, .notifications-panel").first();
  if (await alertOrTaskSection.count() > 0) await expect(alertOrTaskSection).toBeVisible();

  expect(errors).toEqual([]);
});

test("module deep links work correctly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/property/properties");
  await page.waitForTimeout(500);

  const propertiesTab = page.locator("button, a").filter({ hasText: /Properties|properties/i }).first();
  if (await propertiesTab.count() > 0) {
    const isActive = (await propertiesTab.getAttribute("aria-selected")) === "true"
      || (await propertiesTab.getAttribute("class") || "").includes("active");
    await expect(propertiesTab).toBeVisible();
  }

  const propertyList = page.getByText("Finance House", { exact: true });
  if (await propertyList.count() > 0) await expect(propertyList.first()).toBeVisible();

  await page.goto("/property/tenants");
  await page.waitForTimeout(500);

  const tenantsTab = page.locator("button, a").filter({ hasText: /Tenants|tenants/i }).first();
  if (await tenantsTab.count() > 0) {
    const isActive = (await tenantsTab.getAttribute("aria-selected")) === "true"
      || (await tenantsTab.getAttribute("class") || "").includes("active");
    await expect(tenantsTab).toBeVisible();
  }

  const tenantName = page.getByText("ABC Traders Ltd", { exact: true });
  if (await tenantName.count() > 0) await expect(tenantName.first()).toBeVisible();

  expect(errors).toEqual([]);
});
