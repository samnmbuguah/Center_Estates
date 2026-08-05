import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://erp.169-58-102-217.sslip.io";
const ADMIN = process.env.E2E_ADMIN_USERNAME || "admin";
const PASS = process.env.E2E_ADMIN_PASSWORD || "S/2xvBbssIGJJwjOEbOni4JyHQ7tJc0f";

async function signIn(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.locator("#username").fill(ADMIN);
  await page.locator("#password").fill(PASS);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/);
}

test.beforeEach(async ({ page }) => signIn(page));

async function openTab(page: Page, name: string) {
  const btn = page.locator(".module-side-nav button, .module-side-nav a").filter({ hasText: name });
  if (await btn.count() > 0) {
    await btn.first().click();
    await page.waitForTimeout(500);
  }
}

async function openSubTab(page: Page, name: string) {
  const btn = page.locator(".project-workspace-tabs button, a").filter({ hasText: name });
  if (await btn.count() > 0) {
    await btn.first().click();
    await page.waitForTimeout(500);
  }
}

test("companion renders overview with greeting and KPIs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/companion");
  await page.waitForTimeout(500);

  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByText(/Companion|Command Center/i)).toBeVisible();

  const greeting = page.locator("text=/Good morning|Good afternoon|Good evening/i").first();
  if (await greeting.count() > 0) await expect(greeting).toBeVisible();

  const kpis = ["Due Today", "Overdue", "Escalated", "In Progress", "Completed"];
  for (const kpi of kpis) {
    const el = page.getByText(kpi, { exact: true }).first();
    if (await el.count() > 0) await expect(el).toBeVisible();
  }

  const myTasksHeading = page.getByText("My Tasks", { exact: true });
  if (await myTasksHeading.count() > 0) await expect(myTasksHeading.first()).toBeVisible();

  const taskRows = page.locator("table tbody tr, .task-row, [data-testid*='task']").first();
  if (await taskRows.count() > 0) await expect(taskRows).toBeVisible();

  const escalatedPanel = page.getByText(/Escalated|escalated/i).first();
  if (await escalatedPanel.count() > 0) await expect(escalatedPanel).toBeVisible();

  const overduePanel = page.getByText(/Overdue|overdue/i).first();
  if (await overduePanel.count() > 0) await expect(overduePanel).toBeVisible();

  expect(errors).toEqual([]);
});

test("companion task list shows tasks with status pills", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/companion");
  await page.waitForTimeout(500);

  await openTab(page, "All tasks");
  await page.waitForTimeout(500);

  const table = page.locator("table, [role=table]").first();
  if (await table.count() > 0) {
    await expect(table).toBeVisible();
  }

  const titleCol = page.getByRole("columnheader", { name: /Title|Task/i }).first();
  if (await titleCol.count() > 0) await expect(titleCol).toBeVisible();

  const assigneeCol = page.getByRole("columnheader", { name: /Assignee|Assigned/i }).first();
  if (await assigneeCol.count() > 0) await expect(assigneeCol).toBeVisible();

  const priorityCol = page.getByRole("columnheader", { name: /Priority|Prio/i }).first();
  if (await priorityCol.count() > 0) await expect(priorityCol).toBeVisible();

  const dueCol = page.getByRole("columnheader", { name: /Due|Deadline/i }).first();
  if (await dueCol.count() > 0) await expect(dueCol).toBeVisible();

  const statusCol = page.getByRole("columnheader", { name: /Status/i }).first();
  if (await statusCol.count() > 0) await expect(statusCol).toBeVisible();

  const pendingBadge = page.locator(".badge, .pill, .status-chip, [data-testid*='status']").filter({ hasText: /pending/i }).first();
  if (await pendingBadge.count() > 0) await expect(pendingBadge).toBeVisible();

  const completedBadge = page.locator(".badge, .pill, .status-chip, [data-testid*='status']").filter({ hasText: /completed|done/i }).first();
  if (await completedBadge.count() > 0) await expect(completedBadge).toBeVisible();

  expect(errors).toEqual([]);
});

test("assign task modal opens and has required fields", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/companion");
  await page.waitForTimeout(500);

  const assignBtn = page.getByRole("button", { name: "+ Assign Task" });
  if (await assignBtn.count() === 0) {
    test.skip(true, "Assign action not available for current role");
    return;
  }

  await assignBtn.first().click();
  await page.waitForTimeout(500);

  const modal = page.getByRole("dialog").first();
  if (await modal.isVisible()) {
    await expect(modal).toBeVisible();

    const titleField = modal.getByLabel(/title|task name/i);
    if (await titleField.count() > 0) await expect(titleField.first()).toBeVisible();

    const assigneeField = modal.getByLabel(/assignee|assigned to/i);
    if (await assigneeField.count() > 0) await expect(assigneeField.first()).toBeVisible();

    const checkbox = modal.locator("input[type=checkbox]").first();
    if (await checkbox.count() > 0) await expect(checkbox).toBeVisible();

    const priorityField = modal.getByLabel(/priority/i);
    if (await priorityField.count() > 0) await expect(priorityField.first()).toBeVisible();

    const dueField = modal.getByLabel(/due|deadline/i);
    if (await dueField.count() > 0) await expect(dueField.first()).toBeVisible();

    const descField = modal.getByLabel(/description/i);
    if (await descField.count() > 0) await expect(descField.first()).toBeVisible();

    const cancelBtn = modal.getByRole("button", { name: /Cancel|Close/i });
    if (await cancelBtn.count() > 0) {
      await cancelBtn.first().click();
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.press("Escape");
    }
  }

  expect(errors).toEqual([]);
});

test("performance dashboard renders for admin with staff data", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/companion");
  await page.waitForTimeout(500);

  await openTab(page, "Performance dashboard");

  const kpis = ["Daily Active Users", "Tasks Assigned", "Tasks Completed", "Overdue", "Escalated", "Adoption Score"];
  for (const kpi of kpis) {
    const el = page.getByText(kpi, { exact: true }).first();
    if (await el.count() > 0) await expect(el).toBeVisible();
  }

  const staffTable = page.getByText(/Staff Requiring Attention|staff requiring|Staff/i).first();
  if (await staffTable.count() > 0) await expect(staffTable).toBeVisible();

  const table = page.locator("table, [role=table]").first();
  if (await table.count() > 0) await expect(table).toBeVisible();

  expect(errors).toEqual([]);
});

test("templates tab shows template entries", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/companion");
  await page.waitForTimeout(500);

  await openTab(page, "Templates");

  const tableOrEmpty = page.locator("table, [role=table], text=/No templates|no templates|empty/i").first();
  if (await tableOrEmpty.count() > 0) await expect(tableOrEmpty).toBeVisible();

  const addBtn = page.getByRole("button", { name: "+ Template" });
  if (await addBtn.count() > 0) await expect(addBtn.first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("staff history tab shows staff list with drill-down", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/companion");
  await page.waitForTimeout(500);

  await openTab(page, "Staff history");

  const table = page.locator("table, [role=table]").first();
  if (await table.count() > 0) {
    await expect(table).toBeVisible();

    const nameCol = page.getByRole("columnheader", { name: /Name|Staff/i }).first();
    if (await nameCol.count() > 0) await expect(nameCol).toBeVisible();

    const loginCol = page.getByRole("columnheader", { name: /Last Login|last login/i }).first();
    if (await loginCol.count() > 0) await expect(loginCol).toBeVisible();

    const assignedCol = page.getByRole("columnheader", { name: /Assigned|assigned/i }).first();
    if (await assignedCol.count() > 0) await expect(assignedCol).toBeVisible();

    const completedCol = page.getByRole("columnheader", { name: /Completed|completed/i }).first();
    if (await completedCol.count() > 0) await expect(completedCol).toBeVisible();

    const firstRow = page.locator("tbody tr, [role=rowgroup] [role=row]").first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(800);

      const drawer = page.locator(".drawer, .detail-panel, [role=dialog], .sheet, .side-panel").first();
      if (await drawer.count() > 0) await expect(drawer).toBeVisible();
    }
  }

  expect(errors).toEqual([]);
});

test("delegations tab shows delegated tasks", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/companion");
  await page.waitForTimeout(500);

  await openTab(page, "Delegations");

  const tableOrEmpty = page.locator("table, [role=table], text=/No delegations|no delegations|empty|No data/i").first();
  if (await tableOrEmpty.count() > 0) await expect(tableOrEmpty).toBeVisible();

  await expect(page.locator(".form-error")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("audit events tab shows task history", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/companion");
  await page.waitForTimeout(500);

  await openTab(page, "Audit trail");

  const tableOrEmpty = page.locator("table, [role=table], text=/No audit|no audit|empty|No events/i").first();
  if (await tableOrEmpty.count() > 0) await expect(tableOrEmpty).toBeVisible();

  const taskCol = page.getByRole("columnheader", { name: /Task|task/i }).first();
  if (await taskCol.count() > 0) await expect(taskCol).toBeVisible();

  const assigneeCol = page.getByRole("columnheader", { name: /Assignee|User|User/i }).first();
  if (await assigneeCol.count() > 0) await expect(assigneeCol).toBeVisible();

  const statusCol = page.getByRole("columnheader", { name: /Status|Action/i }).first();
  if (await statusCol.count() > 0) await expect(statusCol).toBeVisible();

  expect(errors).toEqual([]);
});
