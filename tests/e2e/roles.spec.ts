import { expect, test, type Page } from "@playwright/test";

const rolePassword = process.env.E2E_ROLE_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;

async function signInAs(page: Page, username: string) {
  if (!rolePassword) throw new Error("E2E_ROLE_PASSWORD or E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(rolePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

const moduleCases = [
  ["property", "Property", "Property Management"],
  ["facility", "Facility", "Facility Management"],
  ["sales", "Sales", "Sales Management"],
  ["tender", "Tender", "Tender Management"],
  ["valuation", "Valuation", "Valuation"],
  ["monitoring", "Construction Monitoring", "Project monitoring"],
] as const;

for (const [module, linkName, heading] of moduleCases) {
  test(`@role:viewer @module:${module} @story:ROLE-${module.toUpperCase()}-VIEW viewer sees only their module`, async ({ page }, testInfo) => {
    await signInAs(page, `role-${module}-viewer`);
    const moduleLinks = page.locator('a.module-card');
    await expect(moduleLinks).toHaveCount(1);
    if (testInfo.project.name.startsWith("mobile")) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await page.getByRole("link", { name: linkName, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.locator(".form-error")).toHaveCount(0);
  });
}

test("@role:viewer @module:sales @story:ROLE-SALES-DENY viewer cannot see Sales mutations", async ({ page }) => {
  await signInAs(page, "role-sales-viewer");
  await page.goto("/sales");
  await expect(page.getByRole("button", { name: "+ Register buyer" })).toHaveCount(0);
  await page.locator(".module-tabs-workspace").getByRole("button", { name: "Payments", exact: true }).click();
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
});

test("@role:operator @module:sales @story:ROLE-SALES-MANAGE operator can manage but cannot approve", async ({ page }) => {
  await signInAs(page, "role-sales-operator");
  await page.goto("/sales");
  await expect(page.getByRole("button", { name: "+ Register buyer" })).toBeVisible();
  await page.locator(".module-tabs-workspace").getByRole("button", { name: "Payments", exact: true }).click();
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
});

test("@role:sales-financier @module:sales @story:ROLE-SALES-FINANCE financier can verify but cannot create", async ({ page }) => {
  await signInAs(page, "role-sales-financier");
  await page.goto("/sales");
  await expect(page.getByRole("button", { name: "+ Register buyer" })).toHaveCount(0);
  await page.locator(".module-tabs-workspace").getByRole("button", { name: "Payments", exact: true }).click();
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeVisible();
});

const businessControlCases = [
  ["leasing-officer", "/property", "+ Add property", false, "Record receipt", false],
  ["property-accountant", "/property", "+ Add property", false, "Record receipt", true],
  ["facility-technician", "/facility", "+ New work order", true, "", false],
  ["facility-inspector", "/facility", "+ New work order", true, "", false],
  ["technical-author", "/tender", "+ Register invitation", false, "", false],
  ["valuation-coordinator", "/valuation", "+ New instruction", true, "", false],
  ["valuer-inspector", "/valuation", "+ New instruction", false, "", false],
  ["construction-auditor", "/monitoring", "+ Project workspace", false, "Export & reports", true],
] as const;

for (const [role, path, primary, primaryVisible, secondary, secondaryVisible] of businessControlCases) {
  test(`@role:${role} @story:ROLE-${role.toUpperCase()} business controls follow least privilege`, async ({ page }) => {
    await signInAs(page, `role-${role}`);
    await page.goto(path);
    await expect(page.getByRole("button", { name: primary, exact: true })).toHaveCount(primaryVisible ? 1 : 0);
    if (secondary) {
      await expect(page.getByRole("button", { name: secondary, exact: true })).toHaveCount(secondaryVisible ? 1 : 0);
    }
  });
}
