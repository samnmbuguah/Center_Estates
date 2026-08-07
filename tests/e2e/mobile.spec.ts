import { expect, test, type Page } from "@playwright/test";
import { openModuleSection } from "./helpers";

const BASE = process.env.E2E_BASE_URL || "https://monitoringerp.com";
const ADMIN = process.env.E2E_ADMIN_USERNAME || "admin";
const PASS = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  if (!PASS) throw new Error("E2E_ADMIN_PASSWORD is required");
  await page.goto(`${BASE}/login`);
  await page.locator("#username").fill(ADMIN);
  await page.locator("#password").fill(PASS);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
}

test("mobile bottom navigation renders Dashboard, Ops, Tasks and More", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile-only layout check");
  await signIn(page);
  await page.goto("/workspaces");
  await page.waitForTimeout(2000);
  const nav = page.locator(".mobile-bottom-nav");
  await expect(nav).toBeVisible();
  await expect(nav.getByText("Dashboard")).toBeVisible();
  await expect(nav.getByText("Ops")).toBeVisible();
  await expect(nav.getByText("Tasks")).toBeVisible();
  await expect(nav.getByText("More")).toBeVisible();
});

test("More button opens the app-sidebar drawer and scrim closes it", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile-only layout check");
  await signIn(page);
  await page.goto("/workspaces");
  await page.waitForTimeout(2000);

  await page.locator(".mobile-bottom-nav").getByText("More").click();
  await expect(page.locator(".mobile-nav-scrim[aria-label='Close navigation']")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("aside, .app-sidebar, [class*='sidebar']").first()).toBeVisible();

  await page.locator(".mobile-nav-scrim").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".mobile-nav-scrim")).toBeHidden({ timeout: 10000 });
});

test("mobile module pages do not overflow horizontally", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile-only layout check");
  await signIn(page);
  await page.goto("/property");
  await page.waitForTimeout(2500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test("horizontal module tabs remain reachable on mobile via drawer", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile-only layout check");
  await signIn(page);
  await page.goto("/companion");
  await page.waitForTimeout(2500);
  await openModuleSection(page, "Tasks", testInfo);
  await expect(page.locator(".module-tabs-workspace").first()).toBeVisible({ timeout: 15000 });
});
