import { expect, test, type Page } from "@playwright/test";
import { openModuleSection, openTab } from "./helpers";

const rolePassword = process.env.E2E_ROLE_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD;

async function signInAs(page: Page, username: string) {
  if (!rolePassword) throw new Error("E2E_ROLE_PASSWORD or E2E_ADMIN_PASSWORD is required");
  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(rolePassword);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/(\/|\/workspaces)$/, { timeout: 30000 });
}

// Only modules in ACTIVE_MODULES render workspace cards; sales/tender/monitoring
// are disabled in the production scope and their viewers land on the command
// center without a module card.
const moduleCases = ["property", "facility", "valuation", "companion"] as const;

for (const module of moduleCases) {
  test(`@role:viewer @module:${module} @story:ROLE-${module.toUpperCase()}-VIEW viewer sees only their module`, async ({ page }, testInfo) => {
    await signInAs(page, `role-${module}-viewer`);
    const moduleLinks = page.locator("article.module-card");
    await expect(moduleLinks).toHaveCount(1);
    if (testInfo.project.name.startsWith("mobile")) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    // The card's primary link carries the full module name (h3), not the slug.
    await page.locator("article.module-card a.module-card-primary-link").first().click();
    // The redesigned workspace shell no longer renders a module title heading;
    // its navigation bar is the reliable signal that the module loaded.
    await expect(page.locator(".module-nav-bar, .module-workspace").first()).toBeVisible();
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
  ["leasing-officer", "/property", "+ Add Property", false, "+ Record Receipt", false],
  ["property-accountant", "/property", "+ Add Property", false, "+ Record Receipt", true],
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

test("@role:leasing-officer @module:property @story:ROLE-LEASING-OFFICER leasing officer can onboard and verify tenants but not administer or collect", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel tenant races");
  await signInAs(page, "role-leasing-officer");
  await page.goto("/property");
  await expect(page.getByRole("button", { name: "+ Add Property", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ Record Receipt", exact: true })).toHaveCount(0);

  await openModuleSection(page, "Tenants");
  await page.getByRole("button", { name: "+ Add Tenant", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Add New Tenant Profile" });
  const suffix = Date.now();
  await dialog.getByLabel("Full Name / Company").fill(`Leasing Prospect ${suffix}`);
  await dialog.getByLabel("Registration Number").fill(`REG-${suffix}`);
  await dialog.getByLabel("KRA PIN / Tax ID").fill(`P${String(suffix).slice(-8)}Z`);
  await dialog.getByLabel("Email Address").fill(`prospect-${suffix}@example.test`);
  await dialog.getByRole("button", { name: "Register Tenant" }).click();
  await expect(page.getByText(`Leasing Prospect ${suffix}`, { exact: true })).toBeVisible();

  await openModuleSection(page, "Tenant documents");
  const pendingRow = page.getByRole("row").filter({ hasText: "BR-BLUEBIRD-2026" });
  await expect(pendingRow).toContainText("pending");
  await pendingRow.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByText("BR-BLUEBIRD-2026", { exact: true }).first()).toBeVisible();
  await expect(pendingRow).toContainText("verified");
});

test("@role:property-accountant @module:property @story:ROLE-PROPERTY-ACCOUNTANT accountant issues invoices and posts receipts but cannot administer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel finance races");
  await signInAs(page, "role-property-accountant");
  await page.goto("/property");
  await expect(page.getByRole("button", { name: "+ Add Property", exact: true })).toHaveCount(0);

  await openModuleSection(page, "Invoices");
  const draftRow = page.getByRole("row").filter({ hasText: "INV-2026-DRAFT" });
  await expect(draftRow).toContainText("draft");
  await draftRow.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(page.getByText("INV-2026-DRAFT", { exact: true }).first()).toBeVisible();
  await expect(draftRow).toContainText("issued");

  await openModuleSection(page, "Receipts");
  await page.getByRole("button", { name: "+ Record Receipt", exact: true }).last().click();
  const receipt = page.getByRole("dialog", { name: "Record Rent Payment Receipt" });
  const receiptNumber = `RCT-ROLE-${Date.now()}`;
  await receipt.getByLabel("Receipt Number").fill(receiptNumber);
  await receipt.getByLabel("Received On").fill("2026-08-05");
  await receipt.getByLabel("Tenant").selectOption({ index: 1 });
  await receipt.getByLabel("Amount (KES)").fill("5000");
  await receipt.getByRole("button", { name: "Post Receipt" }).click();
  await expect(page.getByText(receiptNumber, { exact: true }).first()).toBeVisible();
});

test("@role:facility-technician @module:facility @story:ROLE-FACILITY-TECHNICIAN technician creates work and starts assigned work but cannot administer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel work order races");
  await signInAs(page, "role-facility-technician");
  await page.goto("/facility");
  await page.getByRole("button", { name: "+ New Work Order", exact: true }).click();
  const create = page.locator(".form-modal").filter({ hasText: "New Work Order" });
  const number = `WO-ROLE-${Date.now()}`;
  await create.getByLabel("Work order number").fill(number);
  await create.getByLabel("Issue title").fill(`Technician test work order ${number}`);
  await create.getByLabel("Category").fill("Plumbing");
  await create.getByLabel("Property").selectOption({ index: 1 });
  await create.getByLabel("Description").fill("Created from the technician role journey.");
  await create.getByRole("button", { name: "Create Work Order" }).click();
  await expect(page.getByText(number, { exact: true }).first()).toBeVisible();

  await openTab(page, "Work Orders");
  const assignedRow = page.getByRole("row").filter({ hasText: "WO-2026-1789" });
  await expect(assignedRow.getByRole("button", { name: "Start work", exact: true })).toBeVisible();
  await assignedRow.getByRole("button", { name: "Start work", exact: true }).click();
  await expect(assignedRow).toContainText("in progress");

  await page.getByRole("button", { name: "Contractors", exact: true }).click();
  await expect(page.getByRole("button", { name: "+ Add Contractor", exact: true })).toHaveCount(0);
});

test("@role:facility-inspector @module:facility @story:ROLE-FACILITY-INSPECTOR inspector completes inspections and triggers corrective work but cannot administer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel inspection races");
  await signInAs(page, "role-facility-inspector");
  await page.goto("/facility");
  await openTab(page, "Inspections");
  const inspectionRow = page.getByRole("row").filter({ hasText: "INS-2026-0082" });
  await expect(inspectionRow).toContainText("scheduled");
  await inspectionRow.getByRole("button", { name: "Complete", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Complete Inspection" });
  await dialog.getByLabel("Inspection score").fill("45");
  await dialog.getByLabel("Violations").fill("2");
  await dialog.getByLabel("Findings").fill("Corroded distribution board contacts found during inspection.");
  await dialog.getByRole("button", { name: "Complete Inspection", exact: true }).click();
  await expect(inspectionRow).toContainText("follow-up");

  await openTab(page, "Work Orders");
  await expect(page.getByText(/INS-2026-0082/).first()).toBeVisible();
  await page.getByRole("button", { name: "Contractors", exact: true }).click();
  await expect(page.getByRole("button", { name: "+ Add Contractor", exact: true })).toHaveCount(0);
});

test("@role:facility-occupant @module:facility @story:ROLE-FACILITY-OCCUPANT occupant submits and follows only own service requests", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Single mutation avoids parallel occupant request races");
  await signInAs(page, "role-facility-occupant");
  await page.goto("/facility-portal");
  await expect(page.getByRole("heading", { name: /Good morning, Acacia Consulting Ltd/ })).toBeVisible();
  const requestTitle = `E2E occupant request ${Date.now()}`;
  await page.getByRole("button", { name: "Report an issue", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Report an issue" });
  await dialog.getByLabel("Subject").fill(requestTitle);
  await dialog.getByLabel("Category").fill("Electrical");
  await dialog.getByLabel("Description").fill("Occupant role journey request.");
  await dialog.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText(requestTitle, { exact: true })).toBeVisible();

  await page.goto("/facility");
  await expect(page.getByRole("button", { name: "+ New Work Order", exact: true })).toHaveCount(0);
});

test("@role:switch @story:ROLE-SWITCH-COMMAND-CENTER role switch keeps sidebar in command center", async ({ page }) => {
  await signInAs(page, "admin");
  await page.goto("/workspaces");
  await page.waitForTimeout(2000);
  // Sidebar visible as admin
  await expect(page.locator(".platform-sidebar")).toBeVisible();
  const adminLinks = await page.locator(".platform-sidebar a").count();
  expect(adminLinks).toBeGreaterThan(5);

  // Switch to facility-manager via the profile dropdown
  await page.locator(".profile-trigger").click();
  await page.waitForTimeout(2500);
  const roleBtn = page.locator('[role="menu"] button').filter({ hasText: "@role-facility-manager" }).first();
  await roleBtn.click();
  await page.waitForTimeout(6000);

  // Should land in command center, sidebar still visible but filtered
  await expect(page).toHaveURL(/workspaces/);
  await expect(page.locator(".platform-sidebar")).toBeVisible();
  const roleLinks = await page.locator(".platform-sidebar a").count();
  expect(roleLinks).toBeGreaterThan(0);
  expect(roleLinks).toBeLessThan(adminLinks);
});

test("@role:companion @module:companion @story:ROLE-COMPANION-VIEW companion viewer can access companion but not facility", async ({ page }) => {
  await signInAs(page, "role-companion-viewer");
  await page.goto("/companion");
  await page.waitForTimeout(3000);
  // Companion module renders its horizontal tabs (single-sidebar navigation model)
  await expect(page.locator(".module-nav-bar").first()).toBeVisible();
  // Companion viewer should NOT see facility module mutations
  await page.goto("/facility");
  await page.waitForTimeout(3000);
  const hasUnavailable = await page.evaluate(() => document.body.innerText.includes("Module unavailable"));
  const hasCreate = await page.locator('[data-testid="facility-create-work-order-btn"]').count();
  expect(hasUnavailable || hasCreate === 0).toBeTruthy();
});
