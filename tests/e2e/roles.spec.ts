import { expect, test, type Page } from "@playwright/test";

const rolePassword = process.env.E2E_ROLE_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;

async function signInAs(page: Page, username: string) {
  if (!rolePassword) throw new Error("E2E_ROLE_PASSWORD or E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(rolePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/);
}

async function openTab(page: Page, name: string) {
  await page.locator(".module-tabs-workspace").getByRole("button", { name, exact: true }).click();
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
    const moduleLinks = page.locator("a.module-card");
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
  await openTab(page, "Payments");
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
});

test("@role:operator @module:sales @story:ROLE-SALES-MANAGE operator can manage but cannot approve", async ({ page }) => {
  await signInAs(page, "role-sales-operator");
  await page.goto("/sales");
  await expect(page.getByRole("button", { name: "+ Register buyer" })).toBeVisible();
  await openTab(page, "Payments");
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
});

test("@role:sales-financier @module:sales @story:ROLE-SALES-FINANCE financier can verify but cannot create", async ({ page }) => {
  await signInAs(page, "role-sales-financier");
  await page.goto("/sales");
  await expect(page.getByRole("button", { name: "+ Register buyer" })).toHaveCount(0);
  await openTab(page, "Payments");
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeVisible();
});

test("@role:sales-agent @module:sales @story:ROLE-SALES-AGENT agent can sell but cannot verify payments", async ({ page }) => {
  await signInAs(page, "role-sales-agent");
  await page.goto("/sales");
  await expect(page.getByRole("button", { name: "+ Register buyer" })).toBeVisible();
  await openTab(page, "Payments");
  await expect(page.getByRole("button", { name: "Verify", exact: true })).toHaveCount(0);
});

test("@role:site-clerk @module:sales @story:ROLE-SALES-CLERK clerk focuses on visits without buyer registration", async ({ page }) => {
  await signInAs(page, "role-site-clerk");
  await page.goto("/sales");
  await expect(page.getByRole("button", { name: "+ Register buyer" })).toHaveCount(0);
  await openTab(page, "Site visits");
  await expect(page.getByRole("heading", { name: "Site visits", exact: true })).toBeVisible();
});

test("@role:sales-advocate @module:sales @story:ROLE-SALES-ADVOCATE advocate reaches legal documents only", async ({ page }) => {
  await signInAs(page, "role-sales-advocate");
  await page.goto("/sales");
  await expect(page.getByRole("button", { name: "+ Register buyer" })).toHaveCount(0);
  await openTab(page, "Legal documents");
  await expect(page.getByRole("heading", { name: "Legal documents", exact: true })).toBeVisible();
});

test("@role:construction-certifier @module:monitoring @story:ROLE-CONSTRUCTION-CERTIFY certifier sees verification actions", async ({ page }) => {
  await signInAs(page, "role-construction-certifier");
  await page.goto("/monitoring");
  await expect(page.getByRole("button", { name: "+ Project workspace" })).toHaveCount(0);
  await openTab(page, "Progress");
  await expect(page.getByRole("button", { name: "Verify", exact: true }).first()).toBeVisible();
});

test("@role:construction-finance @module:monitoring @story:ROLE-CONSTRUCTION-FINANCE finance officer sees payments without project create", async ({ page }) => {
  await signInAs(page, "role-construction-finance");
  await page.goto("/monitoring");
  await expect(page.getByRole("button", { name: "+ Project workspace" })).toHaveCount(0);
  await openTab(page, "Payments");
  await expect(page.getByText("Financial control", { exact: true })).toBeVisible();
});

test("@role:tender-board-reviewer @module:tender @story:ROLE-TENDER-BOARD board reviewer cannot register invitations", async ({ page }) => {
  await signInAs(page, "role-tender-board-reviewer");
  await page.goto("/tender");
  await expect(page.getByRole("button", { name: "+ Register invitation" })).toHaveCount(0);
  await openTab(page, "Review & approval");
  await expect(page.getByRole("heading", { name: "Review & approval", exact: true })).toBeVisible();
});

test("@role:valuation-reviewer @module:valuation @story:ROLE-VALUATION-REVIEW reviewer cannot create instructions", async ({ page }) => {
  await signInAs(page, "role-valuation-reviewer");
  await page.goto("/valuation");
  await expect(page.getByRole("button", { name: "+ New instruction" })).toHaveCount(0);
  await openTab(page, "Draft reports");
  await expect(page.getByRole("heading", { name: "Draft reports", exact: true })).toBeVisible();
});

test("@role:admin @module:platform @story:ROLE-ADMIN-SWITCH admin can open demo identity switcher", async ({ page }) => {
  await signInAs(page, process.env.E2E_ADMIN_USERNAME ?? "admin");
  await page.goto("/");
  await page.locator(".profile-trigger").click();
  await expect(page.getByText("Demo identity / role", { exact: true })).toBeVisible();
  await expect(page.getByText("Super Administrator", { exact: true }).first()).toBeVisible();
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
  ["construction-admin", "/monitoring", "+ Project workspace", true, "Export & reports", true],
  ["quantity-surveyor", "/monitoring", "+ Project workspace", false, "", false],
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
